import type { SkillImport } from "./api";
import {
  FILE_PATH_PATTERN,
  MAX_FILE_CHARS,
  MAX_FILES_PER_SKILL,
  MAX_FILES_TOTAL_CHARS,
  draftProblem,
  parseSkill,
} from "./draft";

/** A file picked from a folder, by its path inside that folder (`webkitRelativePath`). */
export interface KitFile {
  path: string;
  text: string;
}

export interface KitSkill {
  name: string;
  description: string;
  folder: string;
  import: SkillImport;
  /** Why the backend would refuse it; a skill with a problem cannot be selected. */
  problem: string | null;
}

// Reference files travel as text; logos, fonts and other binaries stay out.
export const TEXT_EXTENSIONS = ["md", "markdown", "txt", "css", "js", "mjs", "html", "json", "yaml", "yml", "csv", "svg"];
export const MAX_KIT_FILE_BYTES = 256 * 1024;

const SKILL_FILE = "SKILL.md";
const INDEX_FILE = "skills.json";

const dirname = (path: string) => path.split("/").slice(0, -1).join("/");
const basename = (path: string) => path.split("/").pop() ?? "";

export function isKitTextFile(path: string) {
  const name = basename(path);
  if (name.startsWith(".")) return false;
  return TEXT_EXTENSIONS.includes(name.split(".").pop()?.toLowerCase() ?? "");
}

/** The paths skills.json lists, relative to the folder holding it; null when there is no usable index. */
function indexedPaths(files: KitFile[]) {
  const index = files
    .filter((file) => basename(file.path) === INDEX_FILE)
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  if (!index) return null;
  try {
    const data = JSON.parse(index.text) as { skills?: { path?: unknown }[] };
    const root = dirname(index.path);
    const paths = (data.skills ?? []).map((skill) => skill.path).filter((path): path is string => typeof path === "string");
    return paths.length ? new Set(paths.map((path) => (root ? `${root}/${path}` : path))) : null;
  } catch {
    return null;
  }
}

function filesProblem(files: Record<string, string>) {
  const paths = Object.keys(files);
  if (paths.length > MAX_FILES_PER_SKILL) return `Lleva más de ${MAX_FILES_PER_SKILL} archivos de referencia.`;
  const invalid = paths.find((path) => !FILE_PATH_PATTERN.test(path) || path.split("/").some((part) => part === "." || part === ".."));
  if (invalid) return `“${invalid}” no es una ruta válida para un archivo de referencia.`;
  const long = paths.find((path) => files[path].length > MAX_FILE_CHARS);
  if (long) return `“${long}” supera los ${MAX_FILE_CHARS.toLocaleString("es")} caracteres.`;
  const total = paths.reduce((sum, path) => sum + files[path].length, 0);
  if (total > MAX_FILES_TOTAL_CHARS) return `Sus archivos de referencia superan los ${MAX_FILES_TOTAL_CHARS.toLocaleString("es")} caracteres en total.`;
  return null;
}

/**
 * Every skill in a kit folder: each SKILL.md with the text files beside and below it as its
 * reference files. When the folder has a skills.json, only the skills it lists are taken --
 * the kit's own contract says the index is what an agent ingests.
 */
export function readKit(files: KitFile[]): KitSkill[] {
  const listed = indexedPaths(files);
  const skillFiles = files
    .filter((file) => basename(file.path) === SKILL_FILE && (!listed || listed.has(file.path)))
    .sort((a, b) => a.path.localeCompare(b.path));
  const folders = skillFiles.map((file) => dirname(file.path));

  const skills = skillFiles.map((skillFile) => {
    const folder = dirname(skillFile.path);
    const prefix = folder ? `${folder}/` : "";
    const references: Record<string, string> = {};
    for (const file of files) {
      if (file === skillFile || !file.path.startsWith(prefix) || !file.text.trim() || !isKitTextFile(file.path)) continue;
      // A skill folder nested inside this one keeps its own files.
      const owner = folders.filter((other) => file.path.startsWith(`${other}/`)).sort((a, b) => b.length - a.length)[0];
      if (owner !== folder) continue;
      references[file.path.slice(prefix.length)] = file.text;
    }

    const parsed = parseSkill(skillFile.text);
    const name = (parsed.name ?? basename(folder)).toLowerCase();
    return {
      name,
      description: parsed.description ?? "",
      folder,
      import: { instructions: skillFile.text, files: references },
      problem: draftProblem(parsed) ?? filesProblem(references),
    };
  });

  // The backend refuses an import that names a skill twice, so neither copy can go.
  for (const skill of skills) {
    if (!skill.problem && skills.filter((other) => other.name === skill.name).length > 1) {
      skill.problem = `Hay otra skill llamada “${skill.name}” en la carpeta.`;
    }
  }
  return skills;
}
