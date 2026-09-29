import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeysManager } from "@/features/api-keys/components/ApiKeysManager";
import ApiKeysPage from "@/app/(app)/api-keys/page";
import { MembersList } from "@/features/members";
import { SessionProvider, type User } from "@/shared/session";

const member: User = { id: "operator-1", organizationId: "org-1", email: "operator@example.com", role: "member", setupComplete: false, createdAt: "2026-01-01" };
function render(ui: ReactElement) {
  return renderUI(<SessionProvider user={{ ...member, role: "owner" }}>{ui}</SessionProvider>);
}
let keys: object[];
let ready: boolean;
let failSave: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  keys = []; ready = false; failSave = false;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/backend/users") return Response.json([{ ...member, setupComplete: ready }]);
    if (url === "/api/backend/organizations/me") return Response.json({ id: "org-1", name: "Team", seatLimit: 10 });
    if (init?.method === "POST") {
      if (failSave) return Response.json({ code: "user_not_found" }, { status: 404 });
      const body = JSON.parse(init.body as string);
      keys = [{ id: "key-1", userId: body.userId, provider: body.provider, lastFour: "1234", model: body.model ?? null }];
      ready = body.provider !== "gohighlevel";
      return Response.json(keys[0]);
    }
    if (init?.method === "DELETE") { keys = []; ready = false; return Response.json({ detail: "deleted" }); }
    return Response.json(keys);
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("API key management", () => {
  it("opens the selected provider configuration from its card", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await screen.findByText("Necesita una llave de IA");
    await user.click(within(screen.getByRole("region", { name: "GoHighLevel" })).getByRole("button", { name: /Configurar/ }));
    expect(screen.getByLabelText("Proveedor")).toHaveValue("gohighlevel");
    expect(screen.getByLabelText("ID de ubicación")).toBeInTheDocument();
    expect(screen.getByLabelText("Llave secreta")).toHaveFocus();
  });

  it("filters the operator directory by email and readiness", async () => {
    const user = userEvent.setup();
    render(<MembersList />);
    await screen.findByText("operator@example.com");
    await user.type(screen.getByLabelText("Buscar operador"), "missing");
    expect(screen.queryByRole("link", { name: /Gestionar llaves/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Buscar operador"));
    await user.selectOptions(screen.getByLabelText("Configuración"), "ready");
    expect(screen.getByText(/No hay operadores que coincidan/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Configuración"), "pending");
    expect(screen.getByRole("link", { name: /Gestionar llaves/ })).toBeInTheDocument();
  });

  it("replaces an existing provider credential and omits the model for server defaults", async () => {
    keys = [{ id: "key-1", userId: member.id, provider: "anthropic", lastFour: "old1", model: null }];
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await screen.findByText(/Al guardar reemplazarás/);
    await user.type(screen.getByLabelText("Llave secreta"), "replacement-1234");
    await user.click(screen.getByRole("button", { name: "Reemplazar llave" }));
    await screen.findByText(/Llave guardada/);
    expect(screen.queryByText(/old1/)).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(call![1].body)).toEqual({ userId: member.id, provider: "anthropic", secret: "replacement-1234" });
  });

  it("does not allow a stale member link to assign credentials", async () => {
    render(<ApiKeysManager initialUserId="removed-user" />);
    await screen.findByLabelText("Persona");
    expect(screen.getByRole("button", { name: "Guardar llave" })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("assigns an OpenAI key, clears the secret, and refreshes readiness", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await screen.findByText("Necesita una llave de IA");
    await user.selectOptions(screen.getByLabelText("Proveedor"), "openai");
    await user.selectOptions(screen.getByLabelText("Modelo"), "gpt-5.4-mini");
    await user.type(screen.getByLabelText("Llave secreta"), "secret-1234");
    await user.click(screen.getByRole("button", { name: "Guardar llave" }));
    await screen.findByText("Listo para usar IA");
    expect(screen.getByLabelText("Llave secreta")).toHaveValue("");
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(call![1].body)).toEqual({ userId: member.id, provider: "openai", secret: "secret-1234", model: "gpt-5.4-mini" });
    expect(screen.queryByText("secret-1234")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reemplazar llave" })).toBeInTheDocument();
  });

  it("requires a GoHighLevel location and never sends an AI model for it", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await screen.findByText("Necesita una llave de IA");
    await user.selectOptions(screen.getByLabelText("Proveedor"), "gohighlevel");
    await user.type(screen.getByLabelText("Llave secreta"), "ghl-1234");
    await user.click(screen.getByRole("button", { name: "Guardar llave" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    await user.type(screen.getByLabelText("ID de ubicación"), "location-1");
    await user.click(screen.getByRole("button", { name: "Guardar llave" }));
    await screen.findByText(/Llave guardada/);
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(call![1].body)).toEqual({ userId: member.id, provider: "gohighlevel", secret: "ghl-1234", accountId: "location-1" });
    expect(screen.queryByLabelText("Modelo")).not.toBeInTheDocument();
  });

  it("shows failed saves and permits a retry", async () => {
    failSave = true;
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await screen.findByText("Necesita una llave de IA");
    await user.type(screen.getByLabelText("Llave secreta"), "secret-1234");
    await user.click(screen.getByRole("button", { name: "Guardar llave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El operador ya no está disponible.");
    failSave = false;
    await user.click(screen.getByRole("button", { name: "Guardar llave" }));
    await screen.findByText(/Llave guardada/);
  });

  it("revokes only after confirmation and refreshes readiness", async () => {
    keys = [{ id: "key-1", userId: member.id, provider: "anthropic", lastFour: "1234", model: null }]; ready = true;
    const user = userEvent.setup();
    render(<ApiKeysManager initialUserId={member.id} />);
    await user.click(await screen.findByRole("button", { name: "Revocar" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "[sí]" }));
    await screen.findByText("Necesita una llave de IA");
    expect(screen.getByText("No hay llaves asignadas.")).toBeInTheDocument();
  });

  it.each(["owner", "admin"] as const)("allows %s to access management", async (role) => {
    render(<SessionProvider user={{ ...member, role }}>{await ApiKeysPage({ searchParams: Promise.resolve({}) })}</SessionProvider>);
    expect(await screen.findByLabelText("Persona")).toBeInTheDocument();
  });

  it("prevents members from mounting the management form or fetching credentials", async () => {
    render(<SessionProvider user={member}>{await ApiKeysPage({ searchParams: Promise.resolve({}) })}</SessionProvider>);
    expect(screen.queryByLabelText("Llave secreta")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows operator readiness and a targeted management link", async () => {
    render(<SessionProvider user={{ ...member, role: "admin" }}><MembersList /></SessionProvider>);
    await waitFor(() => expect(screen.getByText("Necesita configuración")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Gestionar llaves" })).toHaveAttribute("href", "/api-keys?userId=operator-1");
  });
});
