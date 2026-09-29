import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillsPage from "@/app/(app)/skills/page";
import { SkillsWorkspace } from "@/features/skills";
import { composeMessage, parseSkill, splitReply, visibleText } from "@/features/skills/draft";
import { SessionProvider, type User } from "@/shared/session";

const owner: User = { id: "owner-1", organizationId: "org-1", email: "owner@example.com", role: "owner", setupComplete: true, createdAt: "2026-01-01" };
const DRAFT = "---\nname: brand-voice\ndescription: Tono de la marca\n---\n\nEscribe con calidez.\n\n```\nejemplo\n```\n";
const REPLY = `Aquí tienes el borrador:\n\n\`\`\`\`skill\n${DRAFT}\`\`\`\`\n\n¿Algo más?`;

function render(ui: ReactElement, user: User = owner) {
  return renderUI(<SessionProvider user={user}>{ui}</SessionProvider>);
}

let skills: object[];
let messages: object[];
let fetchMock: ReturnType<typeof vi.fn>;

function posts(path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/api/backend/${path}` && init?.method === "POST").map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  skills = [];
  messages = [];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/backend/skills" && method === "GET") return Response.json(skills);
    if (url === "/api/backend/skills" && method === "POST") {
      const body = JSON.parse(init!.body as string);
      const parsed = parseSkill(body.instructions);
      const skill = { id: "s1", name: body.name ?? parsed.name, description: parsed.description ?? "", instructions: parsed.body, createdBy: owner.id, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
      skills = [skill];
      return Response.json(skill, { status: 201 });
    }
    if (url.startsWith("/api/backend/skills/") && method === "DELETE") { skills = []; return Response.json({ detail: "Skill deleted" }); }
    if (url === "/api/backend/conversations" && method === "POST") return Response.json({ id: "c1", title: "Skill", status: "idle" }, { status: 201 });
    if (url === "/api/backend/conversations/c1/messages" && method === "POST") {
      const { message } = JSON.parse(init!.body as string);
      messages = [{ role: "user", content: message }, { role: "assistant", content: [{ type: "text", text: REPLY }] }];
      return Response.json({ id: "c1", status: "running" }, { status: 202 });
    }
    if (url === "/api/backend/conversations/c1") return Response.json({ id: "c1", status: "idle" });
    if (url === "/api/backend/conversations/c1/messages") return Response.json(messages);
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("skill drafts", () => {
  it("parses frontmatter like the backend and extracts four-backtick drafts with inner code", () => {
    expect(parseSkill(DRAFT)).toMatchObject({ name: "brand-voice", description: "Tono de la marca" });
    const parts = splitReply(REPLY);
    expect(parts.map((part) => part.kind)).toEqual(["text", "draft", "text"]);
    expect(parts[1].content).toBe(DRAFT);
  });

  it("hides the coworking brief from the visible message", () => {
    const sent = composeMessage("hola", { first: true, draft: "borrador" });
    expect(sent).toContain("four backticks");
    expect(sent).toContain("borrador");
    expect(visibleText(sent)).toBe("hola");
    expect(composeMessage("hola", { first: false })).toBe("hola");
  });
});

describe("skills workspace", () => {
  it("drafts a skill with the agent, loads it into the editor and saves it", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    await user.type(screen.getByLabelText("Mensaje para el agente"), "Quiero una skill de tono");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByLabelText(/Archivo de la skill/)).toHaveValue(DRAFT), { timeout: 4000 });
    expect(posts("conversations/c1/messages")[0].message).toContain("[[skill-coworking]]");
    expect(screen.getByText("Quiero una skill de tono")).toBeInTheDocument();
    expect(screen.queryByText(/four backticks/)).not.toBeInTheDocument();
    expect(screen.getByText("En el editor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar skill" }));
    await screen.findByText(/Skill "brand-voice" guardada/);
    expect(posts("skills")).toEqual([{ instructions: DRAFT }]);
    expect(await screen.findByRole("listitem")).toHaveTextContent("brand-voice");
  });

  it("does not overwrite hand edits with a new agent draft and shares them with the agent", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    const editor = screen.getByLabelText(/Archivo de la skill/);
    await user.type(editor, "mis notas");
    await user.type(screen.getByLabelText("Mensaje para el agente"), "mejóralo");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await screen.findByRole("button", { name: "Cargar en el editor" }, { timeout: 4000 });
    expect(editor).toHaveValue("mis notas");
    expect(posts("conversations/c1/messages")[0].message).toContain("mis notas");
    await user.click(screen.getByRole("button", { name: "Cargar en el editor" }));
    expect(editor).toHaveValue(DRAFT);
  });

  it("blocks saving a draft the backend would reject", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    await user.click(screen.getByLabelText(/Archivo de la skill/));
    await user.paste("---\nname: Brand Voice\n---\n\nhola");
    expect(screen.getByText(/minúsculas con guiones/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar skill" })).toBeDisabled();
  });

  it("uploads .md files, naming them from the filename when the header has no name", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    await user.upload(screen.getByTestId("skill-files"), [new File(["Responde siempre en español."], "Atención Cliente.md", { type: "text/markdown" })]);
    await screen.findByText(/creada · atencion-cliente/);
    expect(posts("skills")).toEqual([{ instructions: "Responde siempre en español.", name: "atencion-cliente" }]);
  });

  it("rejects uploads that cannot become a skill and offers to fix them in the editor", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<SkillsWorkspace />);
    await user.upload(screen.getByTestId("skill-files"), [
      new File(["x"], "notas.txt"),
      new File(["---\nname: vacia\n---\n"], "SKILL.md"),
    ]);
    expect(await screen.findByText("Solo se aceptan archivos .md.")).toBeInTheDocument();
    await screen.findByText(/Faltan las instrucciones/);
    expect(posts("skills")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "corregir en el editor" }));
    expect(screen.getByLabelText(/Archivo de la skill/)).toHaveValue("---\nname: vacia\n---\n");
  });

  it("edits and deletes skills from the library after confirmation", async () => {
    skills = [{ id: "s1", name: "brand-voice", description: "Tono", instructions: "Escribe con calidez.", createdBy: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    const row = (await screen.findByText("brand-voice")).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "editar" }));
    expect(screen.getByLabelText(/Archivo de la skill/)).toHaveValue("---\nname: brand-voice\ndescription: Tono\n---\n\nEscribe con calidez.\n");
    expect(screen.getByRole("button", { name: "Reemplazar skill" })).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "eliminar" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await user.click(within(row).getByRole("button", { name: "[sí]" }));
    await screen.findByText(/Skill "brand-voice" eliminada/);
    expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/backend/skills/brand-voice" && init?.method === "DELETE")).toBe(true);
  });

  it("keeps members out of skill management", () => {
    render(<SkillsPage />, { ...owner, role: "member" });
    expect(screen.queryByLabelText("Mensaje para el agente")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
