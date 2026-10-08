import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationSettings } from "@/features/organization";
import { SessionProvider, type User } from "@/shared/session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const owner: User = { id: "u-owner", organizationId: "org-1", email: "brenda@soullens.mx", role: "owner", setupComplete: true, createdAt: "2026-01-01" };
const admin: User = { id: "u-admin", organizationId: "org-1", email: "eleazar@soullens.mx", role: "admin", setupComplete: true, createdAt: "2026-01-01" };

const OVERVIEW = {
  seats: { limit: 5, members: 4, pending: 1 },
  ownerId: "u-owner",
  storage: {
    bytes: 52_428_800,
    files: 40,
    library: { files: 12, bytes: 10_485_760 },
    byPerson: [{ id: "u-admin", projects: 2, files: 20, bytes: 31_457_280 }],
    largest: [],
  },
  orphans: [{ id: "p-orphan", name: "Proyectos de Carla", ownerId: null, shared: false, updatedAt: "2026-09-01T00:00:00Z", files: 8, bytes: 2_097_152 }],
};

const USAGE = {
  months: ["2026-09-01", "2026-10-01"],
  rows: [
    { userId: "u-owner", month: "2026-09-01", conversations: 10, input: 1_000_000, output: 100_000, cacheRead: 500_000, cacheWrite: 0 },
    { userId: "u-admin", month: "2026-10-01", conversations: 4, input: 2_000_000, output: 200_000, cacheRead: 0, cacheWrite: 0 },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function render(ui: ReactElement, user: User = owner) {
  return renderUI(<SessionProvider user={user}>{ui}</SessionProvider>);
}

function calls(path: string, method: string) {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/api/backend/${path}` && (init?.method ?? "GET") === method);
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/backend/organizations/me") return Response.json({ id: "org-1", name: "Soul Lens Studios", seatLimit: 5, createdAt: "2026-01-15T00:00:00Z" });
    if (url === "/api/backend/organizations/me/overview") return Response.json(OVERVIEW);
    if (url.startsWith("/api/backend/organizations/me/usage")) return Response.json(USAGE);
    if (url === "/api/backend/users") return Response.json([owner, admin]);
    return Response.json({ detail: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("organization settings", () => {
  it("shows seats in use with pending invitations and who owns it", async () => {
    render(<OrganizationSettings />);

    expect(await screen.findByText("5 de 5")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Asientos en uso" })).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByText(/No quedan asientos/)).toBeInTheDocument();
    expect(await screen.findByText("brenda@soullens.mx", { selector: "dd" })).toBeInTheDocument();
  });

  it("gives an orphaned project to someone on the team", async () => {
    render(<OrganizationSettings />);
    const orphans = await screen.findByRole("list", { name: "Proyectos sin dueño" });

    await userEvent.selectOptions(within(orphans).getByLabelText("Nuevo dueño de Proyectos de Carla"), "u-admin");
    await userEvent.click(within(orphans).getByRole("button", { name: "asignar" }));

    await waitFor(() => expect(calls("projects/management/p-orphan/transfer", "POST")).toHaveLength(1));
    expect(JSON.parse(calls("projects/management/p-orphan/transfer", "POST")[0][1].body)).toEqual({ newOwnerId: "u-admin" });
  });

  it("estimates cost from the prices written in, with cached reads at their own price", async () => {
    render(<OrganizationSettings />);
    const usage = (await screen.findByRole("heading", { name: "USO DE IA" })).closest("section")!;
    expect(await within(usage).findByText("escribe los precios de entrada y salida abajo")).toBeInTheDocument();

    await userEvent.type(within(usage).getByLabelText("Precio de entrada"), "3");
    await userEvent.type(within(usage).getByLabelText("Precio de salida"), "15");

    // cache left blank: all 3M input × $3 + 0.3M output × $15 = $13.50
    expect(within(usage).getByText(/13\.50/)).toBeInTheDocument();

    // the 0.5M read from cache are part of the input: 2.5M × $3 + 0.5M × $0.30 + 0.3M × $15 = $12.15
    await userEvent.type(within(usage).getByLabelText(/Precio de entrada en caché/), "0.30");
    expect(within(usage).getByText(/12\.15/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("theway.ai-prices")!)).toEqual({ input: "3", cached: "0.30", output: "15" });
    // each box says which column of the price page it takes
    expect(within(usage).getByLabelText("Precio de salida")).toHaveAccessibleDescription(/columna “Output”/);
    expect(within(usage).getByRole("link", { name: /precios de OpenAI/ })).toHaveAttribute("href", "https://openai.com/api/pricing");
  });

  it("deletes the organization only after its exact name is typed", async () => {
    render(<OrganizationSettings />);
    const danger = (await screen.findByRole("heading", { name: "ZONA DE PELIGRO" })).closest("section")!;
    const button = within(danger).getByRole("button", { name: "eliminar la organización" });
    expect(button).toBeDisabled();

    await waitFor(() => expect(within(danger).getByLabelText(/escribe “Soul Lens Studios” para confirmar/)).toBeInTheDocument());
    await userEvent.type(within(danger).getByLabelText(/escribe “Soul Lens Studios” para confirmar/), "soul lens studios");
    expect(button).toBeDisabled();
    await userEvent.clear(within(danger).getByLabelText(/escribe “Soul Lens Studios” para confirmar/));
    await userEvent.type(within(danger).getByLabelText(/escribe “Soul Lens Studios” para confirmar/), "Soul Lens Studios");
    expect(button).toBeEnabled();
  });

  it("keeps the danger zone from admins", async () => {
    render(<OrganizationSettings />, admin);

    await screen.findByText("5 de 5");
    expect(screen.queryByRole("heading", { name: "ZONA DE PELIGRO" })).not.toBeInTheDocument();
  });
});
