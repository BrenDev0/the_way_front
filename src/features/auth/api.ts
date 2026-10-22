import { request, type ErrorMessages } from "@/shared/api";
import type { User } from "@/shared/session";

const AUTH_ERRORS: ErrorMessages = {
  user_email_already_exists: "Ese correo ya está registrado.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  missing_session: "No hay una sesión activa.",
  session_not_found: "La sesión ya no existe.",
  invitation_invalid: "La invitación no es válida o fue revocada.",
  invitation_already_accepted: "Esta invitación ya fue aceptada. Inicia sesión.",
  invitation_expired: "La invitación expiró. Pide una nueva a quien te invitó.",
  organization_seat_limit_reached: "La organización no tiene asientos disponibles. Contacta a tu administrador.",
};

export function login(email: string, password: string) {
  return request<{ user: User }>("auth/login", { method: "POST", body: { email, password }, errors: AUTH_ERRORS });
}

export function acceptInvitation(token: string, password: string) {
  return request<User>("invitations/accept", { method: "POST", body: { token, password }, errors: AUTH_ERRORS });
}

/** An invitation from Xplorers: accepting it creates the organization and its owner. */
export function acceptOwnerInvitation(token: string, password: string) {
  return request<User>("owner-invitations/accept", { method: "POST", body: { token, password }, errors: AUTH_ERRORS });
}

export function logout() {
  return request<{ detail: string }>("auth/logout", { method: "POST", errors: AUTH_ERRORS });
}
