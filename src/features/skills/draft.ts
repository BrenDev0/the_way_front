import type { Skill } from "./api";

// Mirrors the backend limits in src/skills/config.py.
export const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_NAME_CHARS = 64;
export const MAX_DESCRIPTION_CHARS = 500;
export const MAX_INSTRUCTIONS_CHARS = 100_000;
export const MAX_TRIGGERS = 10;
export const MAX_TRIGGER_CHARS = 200;
export const FILE_PATH_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
export const MAX_FILES_PER_SKILL = 30;
export const MAX_FILE_CHARS = 100_000;
export const MAX_FILES_TOTAL_CHARS = 400_000;
export const MAX_SKILLS_PER_IMPORT = 50;

const FENCE = "---";

export interface ParsedSkill {
  name: string | null;
  description: string | null;
  body: string;
  triggers: string[];
}

const KEY = /^\s*([A-Za-z_][\w-]*)\s*:(.*)$/;
// YAML block scalars: ">" folds the indented lines below into one line, "|" keeps their breaks.
const FOLDED = new Set([">", ">-", ">+"]);
const LITERAL = new Set(["|", "|-", "|+"]);

const indentOf = (line: string) => line.length - line.trimStart().length;

function unquote(value: string) {
  const quoted = value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === "'" || value[0] === '"');
  return quoted ? value.slice(1, -1) : value;
}

function fold(block: string[]) {
  const paragraphs: string[][] = [[]];
  for (const line of block) {
    if (line.trim()) paragraphs[paragraphs.length - 1].push(line.trim());
    else if (paragraphs[paragraphs.length - 1].length) paragraphs.push([]);
  }
  return paragraphs.filter((words) => words.length).map((words) => words.join(" ")).join("\n");
}

function dedent(block: string[]) {
  const depth = Math.min(...block.filter((line) => line.trim()).map(indentOf));
  return block.map((line) => line.slice(Number.isFinite(depth) ? depth : 0)).join("\n").trim();
}

const listItems = (block: string[]) =>
  block.filter((line) => line.trim().startsWith("-")).map((line) => unquote(line.trim().slice(1).trim()));

function readFields(lines: string[]) {
  const fields: Record<string, string | string[]> = {};
  let index = 0;
  while (index < lines.length) {
    const line = lines[index++];
    const match = KEY.exec(line);
    if (!match) continue;
    const raw = match[2].trim();
    let value: string | string[];
    if (FOLDED.has(raw) || LITERAL.has(raw)) {
      const start = index;
      while (index < lines.length && (!lines[index].trim() || indentOf(lines[index]) > indentOf(line))) index++;
      const block = lines.slice(start, index);
      value = FOLDED.has(raw) ? fold(block) : dedent(block);
    } else if (!raw) {
      // "triggers:" followed by "- item" lines is a list; the items may sit at the key's indentation.
      let end = index;
      while (end < lines.length && (!lines[end].trim() || indentOf(lines[end]) > indentOf(line) || lines[end].trim().startsWith("-"))) end++;
      const items = listItems(lines.slice(index, end));
      if (items.length) index = end;
      value = items.length ? items : "";
    } else if (raw.startsWith("[") && raw.endsWith("]")) {
      value = raw.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean);
    } else {
      value = unquote(raw);
    }
    fields[match[1]] = value;
  }
  return fields;
}

const text = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : null);

/** Same rules as the backend's frontmatter.parse. */
export function parseSkill(content: string): ParsedSkill {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== FENCE) return { name: null, description: null, body: content.trim(), triggers: [] };

  let end = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (end === -1) end = lines.length;
  const fields = readFields(lines.slice(1, end));
  return {
    name: text(fields.name),
    description: text(fields.description),
    body: lines.slice(end + 1).join("\n").trim(),
    triggers: Array.isArray(fields.triggers) ? fields.triggers : [],
  };
}

/** The triggers the backend keeps: whitespace tidied, blanks and repeats dropped. */
export function cleanTriggers(triggers: string[]) {
  const cleaned: string[] = [];
  for (const trigger of triggers) {
    const tidy = trigger.split(/\s+/).filter(Boolean).join(" ");
    if (tidy && !cleaned.some((seen) => seen.toLowerCase() === tidy.toLowerCase())) cleaned.push(tidy);
  }
  return cleaned;
}

/** First problem that would make the backend reject this file, if any. */
export function draftProblem({ name, description, body, triggers = [] }: Omit<ParsedSkill, "triggers"> & { triggers?: string[] }) {
  if (!name) return "Falta el nombre: añade `name:` en el encabezado.";
  const cleaned = name.toLowerCase();
  if (cleaned.length > MAX_NAME_CHARS || !NAME_PATTERN.test(cleaned)) return "El nombre debe estar en minúsculas con guiones, como brand-voice.";
  if ((description ?? "").length > MAX_DESCRIPTION_CHARS) return `La descripción supera los ${MAX_DESCRIPTION_CHARS} caracteres.`;
  if (!body) return "Faltan las instrucciones debajo del encabezado.";
  if (body.length > MAX_INSTRUCTIONS_CHARS) return "Las instrucciones superan los 100 000 caracteres.";
  const kept = cleanTriggers(triggers);
  if (kept.length > MAX_TRIGGERS) return `Una skill admite como máximo ${MAX_TRIGGERS} triggers.`;
  if (kept.some((trigger) => trigger.length > MAX_TRIGGER_CHARS)) return `Cada trigger admite como máximo ${MAX_TRIGGER_CHARS} caracteres.`;
  return null;
}

// The parser strips one pair of matching quotes and never unescapes, so pick a quote the text lacks.
const quoted = (value: string) => (!value.includes('"') ? `"${value}"` : !value.includes("'") ? `'${value}'` : value);

export function serializeSkill(skill: Pick<Skill, "name" | "description" | "instructions"> & { triggers?: string[] }) {
  // A description with line breaks only survives the round trip as a literal block.
  const description = skill.description.includes("\n")
    ? `|\n${skill.description.split("\n").map((line) => `  ${line}`).join("\n")}`
    : skill.description;
  const triggers = skill.triggers?.length ? `\ntriggers:\n${skill.triggers.map((trigger) => `  - ${quoted(trigger)}`).join("\n")}` : "";
  return `${FENCE}\nname: ${skill.name}\ndescription: ${description}${triggers}\n${FENCE}\n\n${skill.instructions}\n`;
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
