import { request, type ErrorMessages } from "@/shared/api";
import type { User } from "@/shared/session";

const AUTH_ERRORS: ErrorMessages = {
  user_email_already_exists: "Ese correo ya está registrado.",
  verification_request_limit_reached: "Demasiadas solicitudes de código. Intenta de nuevo en 15 minutos.",
  verification_request_cooldown_active: "Las solicitudes de código están en pausa. Intenta de nuevo en unos minutos.",
  verification_code_expired: "El código expiró. Solicita uno nuevo.",
  invalid_verification_code: "Código de verificación inválido.",
  verification_attempt_limit_reached: "Demasiados intentos fallidos. Espera 15 minutos y solicita un nuevo código.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  missing_session: "No hay una sesión activa.",
  session_not_found: "La sesión ya no existe.",
  invitation_invalid: "La invitación no es válida o fue revocada.",
  invitation_already_accepted: "Esta invitación ya fue aceptada. Inicia sesión.",
  invitation_expired: "La invitación expiró. Pide una nueva a tu administrador.",
  organization_seat_limit_reached: "La organización no tiene asientos disponibles. Contacta a tu administrador.",
};

export interface RegisterInput {
  organizationName: string;
  email: string;
  password: string;
  verificationCode: string;
}

export function requestVerification(email: string) {
  return request<{ detail: string; expiresAt: string }>("auth/register/request-verification", {
    method: "POST",
    body: { email },
    errors: AUTH_ERRORS,
  });
}

export function register(input: RegisterInput) {
  return request<User>("auth/register", { method: "POST", body: input, errors: AUTH_ERRORS });
}

export function login(email: string, password: string) {
  return request<{ user: User }>("auth/login", { method: "POST", body: { email, password }, errors: AUTH_ERRORS });
}

export function acceptInvitation(token: string, password: string) {
  return request<User>("invitations/accept", { method: "POST", body: { token, password }, errors: AUTH_ERRORS });
}

export function logout() {
  return request<{ detail: string }>("auth/logout", { method: "POST", errors: AUTH_ERRORS });
}
