import { request } from "@/shared/api";

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  /** Requests that route to the skill, as a person would say them. */
  triggers: string[];
  /** Reference file paths; empty in the list, which does not load them. */
  files: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillImport {
  /** The whole SKILL.md, frontmatter included. */
  instructions: string;
  /** Reference files by path relative to the skill's folder. */
  files: Record<string, string>;
}

export const SKILL_LIMIT = 200;

const errors = {
  skill_not_found: "La skill ya no existe.",
  skill_name_invalid: "El nombre debe estar en minúsculas con guiones, como brand-voice (máx. 64 caracteres).",
  skill_name_missing: "Falta el nombre. Añade `name:` en el encabezado del archivo.",
  skill_description_too_long: "La descripción supera los 500 caracteres.",
  skill_instructions_missing: "La skill no tiene instrucciones.",
  skill_instructions_too_long: "Las instrucciones superan los 100 000 caracteres.",
  skill_limit_reached: `La organización ya tiene el máximo de ${SKILL_LIMIT} skills.`,
  skill_triggers_too_many: "Una skill admite como máximo 10 triggers.",
  skill_trigger_too_long: "Cada trigger admite como máximo 200 caracteres.",
  skill_file_path_invalid: "Un archivo de referencia tiene una ruta no válida.",
  skill_file_too_long: "Un archivo de referencia supera los 100 000 caracteres.",
  skill_files_too_many: "Una skill admite como máximo 30 archivos de referencia.",
  skill_files_too_large: "Los archivos de referencia de una skill superan los 400 000 caracteres en total.",
  skill_import_empty: "La carpeta no contiene ningún SKILL.md.",
  skill_import_too_large: "Una importación admite como máximo 50 skills.",
  skill_import_duplicate: "La importación incluye dos skills con el mismo nombre.",
};

export function listSkills() {
  return request<Skill[]>("skills");
}

/** One skill, with the paths of its reference files (the list leaves them out). */
export function getSkill(name: string) {
  return request<Skill>(`skills/${encodeURIComponent(name)}`, { errors });
}

/** Saves a full skill file; the backend reads name, description and triggers from its frontmatter. */
export function saveSkill(input: { instructions: string; name?: string }) {
  return request<Skill>("skills", { method: "POST", body: input, errors });
}

/** Saves a whole kit at once: the backend checks every skill before saving any. */
export function importSkills(skills: SkillImport[]) {
  return request<Skill[]>("skills/import", { method: "POST", body: { skills }, errors });
}

export function deleteSkill(name: string) {
  return request<{ detail: string }>(`skills/${encodeURIComponent(name)}`, { method: "DELETE", errors });
}
