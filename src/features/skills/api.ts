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

export function listSkills() {
  return request<Skill[]>("skills");
}
