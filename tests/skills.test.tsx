import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillsPage from "@/app/(app)/skills/page";
import { SkillsWorkspace } from "@/features/skills";
import { cleanTriggers, composeMessage, draftProblem, parseSkill, serializeSkill, splitReply, visibleText } from "@/features/skills/draft";
import { readKit } from "@/features/skills/kit";
import { SessionProvider, type User } from "@/shared/session";

const owner: User = { id: "owner-1", organizationId: "org-1", email: "owner@example.com", role: "owner", setupComplete: true, createdAt: "2026-01-01" };
const DRAFT = "---\nname: brand-voice\ndescription: Tono de la marca\n---\n\nEscribe con calidez.\n\n```\nejemplo\n```\n";
const REPLY = `Aquí tienes el borrador:\n\n\`\`\`\`skill\n${DRAFT}\`\`\`\`\n\n¿Algo más?`;

function render(ui: ReactElement, user: User = owner) {
  return renderUI(<SessionProvider user={user}>{ui}</SessionProvider>);
}

let skills: object[];
let messages: object[];
/** Reference file paths by skill, which only the single-skill GET returns, like the backend. */
let skillFiles: Record<string, string[]>;
let fetchMock: ReturnType<typeof vi.fn>;

function posts(path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/api/backend/${path}` && init?.method === "POST").map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  skills = [];
  skillFiles = {};
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
    if (url === "/api/backend/skills/import" && method === "POST") {
      const body = JSON.parse(init!.body as string) as { skills: { instructions: string }[] };
      return Response.json(body.skills.map((item, index) => ({ id: `k${index}`, name: parseSkill(item.instructions).name, description: "", instructions: "", triggers: [], files: [], createdBy: owner.id, createdAt: "2026-01-01", updatedAt: "2026-01-01" })));
    }
    if (url.startsWith("/api/backend/skills/") && method === "GET") {
      const name = decodeURIComponent(url.slice("/api/backend/skills/".length));
      const skill = (skills as { name: string }[]).find((item) => item.name === name);
      if (!skill) return Response.json({ code: "skill_not_found" }, { status: 404 });
      return Response.json({ ...skill, files: skillFiles[name] ?? [] });
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

  it("reads folded and literal descriptions like the backend, without leaking list items", () => {
    const folded = "---\nname: using-this-kit\ndescription: >\n  How to mount this kit.\n  Use when: asked.\ntriggers:\n  - \"description: no\"\n---\n\n# Body\n";
    expect(parseSkill(folded)).toEqual({ name: "using-this-kit", description: "How to mount this kit. Use when: asked.", body: "# Body", triggers: ["description: no"] });

    const literal = "---\nname: x\ndescription: |\n  First line.\n  Second line.\n---\nbody";
    expect(parseSkill(literal).description).toBe("First line.\nSecond line.");
    expect(parseSkill("---\nname: 'quoted'\n---\nbody").name).toBe("quoted");
  });

  it("serializes a multi-line description so it parses back unchanged", () => {
    const skill = { name: "x", description: "First line.\nSecond line.", instructions: "body" };
    expect(parseSkill(serializeSkill(skill))).toEqual({ name: "x", description: skill.description, body: "body", triggers: [] });
  });

  it("reads triggers from the header and writes them back", () => {
    const content = "---\nname: x\ndescription: d\ntriggers:\n  - \"draft the recap\"\n- 'say \"hi\"'\n---\nbody";
    expect(parseSkill(content).triggers).toEqual(["draft the recap", 'say "hi"']);
    expect(parseSkill("---\nname: x\ntriggers: [one, 'two']\n---\nbody").triggers).toEqual(["one", "two"]);

    const skill = { name: "x", description: "d", instructions: "body", triggers: ["draft the recap", 'say "hi"'] };
    expect(parseSkill(serializeSkill(skill)).triggers).toEqual(skill.triggers);
  });

  it("flags more triggers than the backend keeps", () => {
    const triggers = Array.from({ length: 11 }, (_, index) => `request ${index}`);
    expect(draftProblem({ name: "x", description: "", body: "b", triggers })).toMatch(/máximo 10 triggers/);
    expect(draftProblem({ name: "x", description: "", body: "b", triggers: ["a", " A ", ""] })).toBeNull();
    expect(cleanTriggers(["  a   b ", "A B", ""])).toEqual(["a b"]);
  });

  it("hides the coworking brief from the visible message", () => {
    const sent = composeMessage("hola", { first: true, draft: "borrador" });
    expect(sent).toContain("four backticks");
    expect(sent).toContain("borrador");
    expect(visibleText(sent)).toBe("hola");
    expect(composeMessage("hola", { first: false })).toBe("hola");
  });
});

const KIT_SKILL = (name: string) => `---\nname: ${name}\ndescription: >\n  Does ${name}.\ntriggers:\n  - "do ${name}"\n---\n\n# ${name}\n`;

describe("kit folders", () => {
  const kit = [
    { path: "kit/skills.json", text: JSON.stringify({ skills: [{ path: "skills/landing-pages/SKILL.md" }, { path: "skills/output-documents/SKILL.md" }] }) },
    { path: "kit/skills/landing-pages/SKILL.md", text: KIT_SKILL("landing-pages") },
    { path: "kit/skills/landing-pages/laws.md", text: "# Laws" },
    { path: "kit/skills/landing-pages/empty.md", text: "  " },
    { path: "kit/skills/output-documents/SKILL.md", text: KIT_SKILL("output-documents") },
    { path: "kit/skills/output-documents/engine/core.css", text: ":root {}" },
    { path: "kit/skills/not-indexed/SKILL.md", text: KIT_SKILL("not-indexed") },
    { path: "kit/brand-packs/SLS/voice.md", text: "# Voice" },
  ];

  it("takes the skills skills.json lists, each with the text files of its folder", () => {
    const skills = readKit(kit);
    expect(skills.map((skill) => skill.name)).toEqual(["landing-pages", "output-documents"]);
    expect(skills[0].import.files).toEqual({ "laws.md": "# Laws" });
    expect(skills[1].import.files).toEqual({ "engine/core.css": ":root {}" });
    expect(skills[0].description).toBe("Does landing-pages.");
    expect(skills.every((skill) => skill.problem === null)).toBe(true);
  });

  it("takes every SKILL.md when there is no index, and marks the ones the backend would refuse", () => {
    const skills = readKit([
      { path: "kit/a/SKILL.md", text: KIT_SKILL("same") },
      { path: "kit/b/SKILL.md", text: KIT_SKILL("same") },
      { path: "kit/c/SKILL.md", text: "---\nname: hollow\n---\n" },
    ]);
    expect(skills.map((skill) => skill.problem)).toEqual([
      expect.stringMatching(/otra skill llamada/),
      expect.stringMatching(/otra skill llamada/),
      expect.stringMatching(/Faltan las instrucciones/),
    ]);
  });
});

function folderFile(path: string, text: string) {
  const file = new File([text], path.split("/").pop()!);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("skills workspace", () => {
  it("imports a kit folder in one request, leaving out the skills unticked", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<SkillsWorkspace />);
    await user.upload(screen.getByTestId("skill-kit-folder"), [
      folderFile("kit/skills/landing-pages/SKILL.md", KIT_SKILL("landing-pages")),
      folderFile("kit/skills/landing-pages/laws.md", "# Laws"),
      folderFile("kit/skills/drift-check/SKILL.md", KIT_SKILL("drift-check")),
    ]);
    await user.click(await screen.findByRole("checkbox", { name: /drift-check/ }));
    await user.click(screen.getByRole("button", { name: "Importar 1 skills" }));
    await screen.findByText(/1 skills importadas/);
    expect(posts("skills/import")).toEqual([{ skills: [{ instructions: KIT_SKILL("landing-pages"), files: { "laws.md": "# Laws" } }] }]);
  });

  it("drafts a skill with the agent, loads it into the editor and saves it", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    await user.type(screen.getByLabelText("Mensaje para AGENTIX"), "Quiero una skill de tono");
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

  it("shows why a turn paused and resumes it on Reanudar", async () => {
    let state = "paused";
    const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/backend/conversations/c1") {
        return Response.json({ id: "c1", status: state, pause: state === "paused" ? { reason: "rate_limit", detail: "", pausedAt: "x", retryAfter: null } : null });
      }
      if (url === "/api/backend/conversations/c1/resume" && init?.method === "POST") {
        state = "idle";
        return Response.json({ id: "c1", status: "running" }, { status: 202 });
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    await user.type(screen.getByLabelText("Mensaje para AGENTIX"), "Quiero una skill");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await screen.findByText(/limitó las solicitudes/, undefined, { timeout: 4000 });
    expect(screen.queryByText(/no pudo terminar/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reanudar" }));

    await waitFor(() => expect(screen.queryByText(/limitó las solicitudes/)).not.toBeInTheDocument(), { timeout: 4000 });
    expect(posts("conversations/c1/resume")).toEqual([{}]);
  });

  it("does not overwrite hand edits with a new agent draft and shares them with the agent", async () => {
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    const editor = screen.getByLabelText(/Archivo de la skill/);
    await user.type(editor, "mis notas");
    await user.type(screen.getByLabelText("Mensaje para AGENTIX"), "mejóralo");
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
    await screen.findByText(/Creada · atencion-cliente/);
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
    await user.click(screen.getByRole("button", { name: "Corregir en el editor" }));
    expect(screen.getByLabelText(/Archivo de la skill/)).toHaveValue("---\nname: vacia\n---\n");
  });

  it("edits and deletes skills from the library after confirmation", async () => {
    skills = [{ id: "s1", name: "brand-voice", description: "Tono", instructions: "Escribe con calidez.", createdBy: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    const row = (await screen.findByText("brand-voice")).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText(/Archivo de la skill/)).toHaveValue("---\nname: brand-voice\ndescription: Tono\n---\n\nEscribe con calidez.\n");
    expect(screen.getByRole("button", { name: "Reemplazar skill" })).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Eliminar" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await user.click(within(row).getByRole("button", { name: "[Sí]" }));
    await screen.findByText(/Skill "brand-voice" eliminada/);
    expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/backend/skills/brand-voice" && init?.method === "DELETE")).toBe(true);
  });

  it("shows a skill's reference file names in the library, fetched only when asked for", async () => {
    const base = { description: "", instructions: "x", triggers: [], files: [], createdBy: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    skills = [
      { ...base, id: "s1", name: "landing-pages" },
      { ...base, id: "s2", name: "brand-voice" },
      { ...base, id: "s3", name: "drift-check", files: ["notes.md"] },
    ];
    skillFiles = { "landing-pages": ["brief.md", "laws.md", "verification.md"] };
    const user = userEvent.setup();
    render(<SkillsWorkspace />);
    const row = (name: string) => screen.getByText(name, { selector: ".rail__title" }).closest("li")!;
    await screen.findByText("landing-pages");

    // The list does not load files; a listing that does carry them shows them as they are.
    expect(row("drift-check")).toHaveTextContent("1 archivo: notes.md");
    expect(within(row("drift-check")).queryByRole("button", { name: "Archivos" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/backend/skills/"))).toEqual([]);

    await user.click(within(row("landing-pages")).getByRole("button", { name: "Archivos" }));
    await waitFor(() => expect(row("landing-pages")).toHaveTextContent("3 archivos: brief.md · laws.md · verification.md"));
    expect(within(row("landing-pages")).queryByRole("button", { name: "Archivos" })).not.toBeInTheDocument();

    // Opening a skill in the editor shows its files too.
    await user.click(within(row("brand-voice")).getByRole("button", { name: "Editar" }));
    await waitFor(() => expect(row("brand-voice")).toHaveTextContent("Sin archivos de referencia"));
    expect(fetchMock.mock.calls.map(([url]) => url).filter((url) => String(url).startsWith("/api/backend/skills/"))).toEqual([
      "/api/backend/skills/landing-pages",
      "/api/backend/skills/brand-voice",
    ]);
  });

  it("keeps members out of skill management", () => {
    render(<SkillsPage />, { ...owner, role: "member" });
    expect(screen.queryByLabelText("Mensaje para AGENTIX")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
