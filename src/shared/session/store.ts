export type Role = "owner" | "admin" | "member";

export interface User {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  setupComplete: boolean;
  createdAt: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "propietario",
  admin: "administrador",
  member: "operador",
};

export const ADMIN_ROLES: Role[] = ["owner", "admin"];

const KEY = "theway.user";

export function saveUser(user: User) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {}
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
