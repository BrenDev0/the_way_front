import type { Skill } from "./api";

// Mirrors the backend limits in src/skills/config.py.
export const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_NAME_CHARS = 64;
export const MAX_DESCRIPTION_CHARS = 500;
export const MAX_INSTRUCTIONS_CHARS = 100_000;

const FENCE = "---";

export interface ParsedSkill {
  name: string | null;
  description: string | null;
  body: string;
}

/** Same rules as the backend's frontmatter.parse. */
export function parseSkill(content: string): ParsedSkill {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== FENCE) return { name: null, description: null, body: content.trim() };

  let name: string | null = null;
  let description: string | null = null;
  let bodyStart = lines.length;
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line === FENCE) {
      bodyStart = index + 1;
      break;
    }
    if (line.startsWith("name:")) name = line.slice(5).trim();
    else if (line.startsWith("description:")) description = line.slice(12).trim();
  }
  return { name: name || null, description: description || null, body: lines.slice(bodyStart).join("\n").trim() };
}

/** First problem that would make the backend reject this file, if any. */
export function draftProblem({ name, description, body }: ParsedSkill) {
  if (!name) return "Falta el nombre: añade `name:` en el encabezado.";
  const cleaned = name.toLowerCase();
  if (cleaned.length > MAX_NAME_CHARS || !NAME_PATTERN.test(cleaned)) return "El nombre debe estar en minúsculas con guiones, como brand-voice.";
  if ((description ?? "").length > MAX_DESCRIPTION_CHARS) return `La descripción supera los ${MAX_DESCRIPTION_CHARS} caracteres.`;
  if (!body) return "Faltan las instrucciones debajo del encabezado.";
  if (body.length > MAX_INSTRUCTIONS_CHARS) return "Las instrucciones superan los 100 000 caracteres.";
  return null;
}

export function serializeSkill(skill: Pick<Skill, "name" | "description" | "instructions">) {
  return `${FENCE}\nname: ${skill.name}\ndescription: ${skill.description}\n${FENCE}\n\n${skill.instructions}\n`;
}

/** Kebab-case name derived from a filename, used when an uploaded file has no frontmatter name. */
export function nameFromFilename(filename: string) {
  const slug = filename
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_CHARS)
    .replace(/-+$/, "");
  return slug && slug !== "skill" ? slug : null;
}

// The agent is asked to wrap drafts in a four-backtick fence so code blocks inside the skill survive.
const DRAFT_BLOCK = /(`{3,}|~{3,})([\w-]*)[^\n]*\n([\s\S]*?)\n\1[ \t]*(?=\n|$)/g;

export interface ReplyPart {
  kind: "text" | "draft";
  content: string;
}

/** Splits an assistant reply into prose and skill drafts (fenced blocks that carry frontmatter). */
export function splitReply(text: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  let last = 0;
  for (const match of text.matchAll(DRAFT_BLOCK)) {
    const [whole, , tag, inner] = match;
    const isDraft = tag === "skill" || ((tag === "" || tag === "md" || tag === "markdown") && inner.trimStart().startsWith(FENCE));
    if (!isDraft) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", content: text.slice(last, start) });
    parts.push({ kind: "draft", content: inner.trim() + "\n" });
    last = start + whole.length;
  }
  if (last < text.length) parts.push({ kind: "text", content: text.slice(last) });
  return parts.filter((part) => part.kind === "draft" || part.content.trim());
}

const MARKER = "[[skill-coworking]]";
const SEPARATOR = "\n[[mensaje]]\n";

const BRIEF = `You are helping an administrator of this organization write a skill: reusable instructions that the organization's agent loads when a task matches it. Work with them like a coworker. Ask short questions about the goal, when the skill should be used, the steps, tone, inputs and edge cases, a few at a time, never all at once. Reply in the user's language.

Whenever you have a complete draft, or the user asks for a change, output the entire skill file inside a single fenced block that opens with four backticks and the tag skill, exactly like this:

\`\`\`\`skill
---
name: kebab-case-name
description: One line saying what the skill does and when to use it
---

The instructions, in Markdown.
\`\`\`\`

Rules: the name is lowercase words joined by hyphens, at most ${MAX_NAME_CHARS} characters. The description is a single line of at most ${MAX_DESCRIPTION_CHARS} characters. Always send the complete file, never a partial edit. You cannot save the skill yourself: the user reviews the draft in an editor and saves it.`;

/**
 * Builds the text sent to the agent. The coworking brief goes out with the first message only;
 * the editor contents go out whenever the agent has not seen them yet, because the user may edit by hand.
 */
export function composeMessage(text: string, { first, draft }: { first: boolean; draft?: string }) {
  const context: string[] = [];
  if (first) context.push(BRIEF);
  if (draft?.trim()) context.push(`Current contents of the skill editor (the user may have edited it by hand):\n~~~~\n${draft.trim()}\n~~~~`);
  return context.length ? `${MARKER}\n${context.join("\n\n")}${SEPARATOR}${text}` : text;
}

/** What the user actually typed, without the hidden context. */
export function visibleText(message: string) {
  if (!message.startsWith(MARKER)) return message;
  const at = message.indexOf(SEPARATOR);
  return at === -1 ? "" : message.slice(at + SEPARATOR.length);
}
