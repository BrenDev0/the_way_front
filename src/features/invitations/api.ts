import { request, type ErrorMessages } from "@/shared/api";
import type { Role } from "@/shared/session";

export type InviteRole = Exclude<Role, "owner">;

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
}

const INVITATION_ERRORS: ErrorMessages = {
  invitation_role_not_allowed: "No tienes permiso para invitar con ese rol.",
  user_email_already_exists: "Ese correo ya tiene una cuenta.",
  organization_seat_limit_reached: "Tu organización alcanzó el límite de asientos.",
  invitation_not_found: "Esa invitación ya no existe.",
};

export function listInvitations() {
  return request<Invitation[]>("invitations", { errors: INVITATION_ERRORS });
}

export function createInvitation(email: string, role: InviteRole) {
  return request<Invitation>("invitations", { method: "POST", body: { email, role }, errors: INVITATION_ERRORS });
}

export function revokeInvitation(id: string) {
  return request<{ detail: string }>(`invitations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errors: INVITATION_ERRORS,
  });
}
