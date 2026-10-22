import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptInviteScreen, LoginScreen } from "@/features/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const OWNER = { id: "u-1", organizationId: "org-1", email: "dueno@acme.mx", role: "owner", setupComplete: false, createdAt: "2026-10-22" };

let fetchMock: ReturnType<typeof vi.fn>;

function calls(path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/api/backend/${path}` && init?.method === "POST");
}

function body(call: unknown[]) {
  return JSON.parse((call[1] as { body: string }).body);
}

async function fillAndSubmit(button: string, password = "una-clave-larga") {
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.type(screen.getByLabelText("Confirmar contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: button }));
}

beforeEach(() => {
  localStorage.clear();
  replace.mockClear();
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/backend/auth/login") return Response.json({ user: OWNER });
    return Response.json(OWNER, { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("an owner invitation from Xplorers", () => {
  it("is accepted on its own route, then the new owner is signed in", async () => {
    render(<AcceptInviteScreen kind="owner" token="tok-owner" />);

    expect(screen.getByText(/Xplorers te invitó a abrir tu organización/)).toBeInTheDocument();
    await fillAndSubmit("Abrir mi organización");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/welcome"));
    expect(calls("owner-invitations/accept")).toHaveLength(1);
    expect(body(calls("owner-invitations/accept")[0])).toEqual({ token: "tok-owner", password: "una-clave-larga" });
    expect(calls("invitations/accept")).toHaveLength(0);
    expect(body(calls("auth/login")[0])).toEqual({ email: "dueno@acme.mx", password: "una-clave-larga" });
  });

  it("says so when the link was already used", async () => {
    fetchMock.mockImplementationOnce(async () => Response.json({ code: "invitation_already_accepted" }, { status: 409 }));
    render(<AcceptInviteScreen kind="owner" token="tok-owner" />);

    await fillAndSubmit("Abrir mi organización");

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta invitación ya fue aceptada");
    expect(replace).not.toHaveBeenCalled();
    expect(calls("auth/login")).toHaveLength(0);
  });

  it("asks for a longer password before sending anything", async () => {
    render(<AcceptInviteScreen kind="owner" token="tok-owner" />);

    await fillAndSubmit("Abrir mi organización", "corta");

    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a broken link, not a form, when there is no token", () => {
    render(<AcceptInviteScreen kind="owner" token={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent("El enlace de invitación no es válido");
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
  });
});

describe("a member invitation", () => {
  it("still goes to the members' route", async () => {
    render(<AcceptInviteScreen token="tok-member" />);

    await fillAndSubmit("Unirme");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/welcome"));
    expect(calls("invitations/accept")).toHaveLength(1);
    expect(calls("owner-invitations/accept")).toHaveLength(0);
  });
});

describe("the sign-in page", () => {
  it("no longer offers to create an account", () => {
    render(<LoginScreen />);

    expect(screen.queryByRole("link", { name: /Crea una/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/signup"]')).toBeNull();
    expect(screen.getByText(/solo por invitación/)).toBeInTheDocument();
  });
});
