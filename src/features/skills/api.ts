import { request } from "@/shared/api";

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
};

export function listSkills() {
  return request<Skill[]>("skills");
}

/** Saves a full skill file; the backend reads name and description from its frontmatter. */
export function saveSkill(input: { instructions: string; name?: string }) {
  return request<Skill>("skills", { method: "POST", body: input, errors });
}

export function deleteSkill(name: string) {
  return request<{ detail: string }>(`skills/${encodeURIComponent(name)}`, { method: "DELETE", errors });
}
