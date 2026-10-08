import { request } from "@/shared/api";

export interface Organization {
  id: string;
  name: string;
  seatLimit: number | null;
  createdAt: string;
}

export function getMyOrganization() {
  return request<Organization>("organizations/me");
}

const ORGANIZATION_ERRORS = {
  organization_not_found: "La organización ya no existe.",
  user_not_found: "Esa persona ya no está en la organización.",
  project_not_found: "Ese proyecto ya no existe.",
  insufficient_role: "Solo el propietario puede hacer esto.",
};

export interface ProjectStorage {
  id: string;
  name: string;
  ownerId: string | null;
  shared: boolean;
  updatedAt: string;
  files: number;
  bytes: number;
}

export interface Overview {
  seats: { limit: number | null; members: number; pending: number };
  ownerId: string | null;
  storage: {
    bytes: number;
    files: number;
    library: { files: number; bytes: number } | null;
    byPerson: { id: string; projects: number; files: number; bytes: number }[];
    largest: ProjectStorage[];
  };
  orphans: ProjectStorage[];
}

export interface Usage {
  months: string[];
  rows: { userId: string; month: string; conversations: number; input: number; output: number; cacheRead: number; cacheWrite: number }[];
}

export function renameOrganization(name: string) {
  return request<Organization>("organizations/me", { method: "PATCH", body: { name }, errors: ORGANIZATION_ERRORS });
}

export function getOverview() {
  return request<Overview>("organizations/me/overview", { errors: ORGANIZATION_ERRORS });
}

export function getUsage(months: number) {
  return request<Usage>(`organizations/me/usage?months=${months}`, { errors: ORGANIZATION_ERRORS });
}

export function reassignProject(projectId: string, newOwnerId: string) {
  return request(`projects/management/${encodeURIComponent(projectId)}/transfer`, { method: "POST", body: { newOwnerId }, errors: ORGANIZATION_ERRORS });
}

export function deleteProject(projectId: string) {
  return request(`projects/management/${encodeURIComponent(projectId)}`, { method: "DELETE", errors: ORGANIZATION_ERRORS });
}

export function transferOwnership(newOwnerId: string) {
  return request<{ detail: string }>("organizations/me/transfer-ownership", { method: "POST", body: { newOwnerId }, errors: ORGANIZATION_ERRORS });
}

export function deleteOrganization() {
  return request<{ detail: string }>("organizations/me", { method: "DELETE", errors: ORGANIZATION_ERRORS });
}
