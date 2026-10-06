import { request } from "@/shared/api";

export type ConversationStatus = "idle" | "running" | "awaiting_client" | "paused" | "failed";

export type PauseReason = "rate_limit" | "quota" | "timeout" | "provider_error" | "credentials" | "interrupted";

/** Why a turn stopped short. Everything it did is kept; resuming carries on from there. */
export interface TurnPause {
  reason: PauseReason;
  detail: string;
  pausedAt: string | null;
  /** Retrying before this is likely to pause again; null when the provider did not say. */
  retryAfter: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
  /** Set while status is "paused". */
  pause?: TurnPause | null;
  iterationsUsed: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  toolCalls?: { id: string; name: string; args: unknown }[] | null;
  toolCallId?: string | null;
}

const errors = {
  conversation_not_found: "La conversación ya no existe.",
  conversation_busy: "El agente sigue trabajando en el mensaje anterior.",
  api_key_not_configured: "No tienes una llave de Anthropic u OpenAI asignada. Asígnate una en llaves api.",
  conversation_not_paused: "La conversación ya no está en pausa.",
};

export function startConversation(title: string) {
  return request<Conversation>("conversations", { method: "POST", body: { title }, errors });
}

export function getConversation(id: string) {
  return request<Conversation>(`conversations/${encodeURIComponent(id)}`, { errors });
}

export function listMessages(id: string) {
  return request<ConversationMessage[]>(`conversations/${encodeURIComponent(id)}/messages`, { errors });
}

export function sendMessage(id: string, message: string) {
  return request<Conversation>(`conversations/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: { message },
    errors,
  });
}

/** Carries on a paused turn (a rate limit, a timeout...) from where it stopped. */
export function resumeConversation(id: string) {
  return request<Conversation>(`conversations/${encodeURIComponent(id)}/resume`, {
    method: "POST",
    body: {},
    errors,
  });
}

/** What happened to a paused turn, and what to do about it. Nothing it did is lost. */
export function pauseText(pause: TurnPause | null | undefined): { title: string; body: string } {
  switch (pause?.reason) {
    case "rate_limit":
      return { title: "El proveedor de IA limitó las solicitudes", body: "Se alcanzó el límite de solicitudes por minuto. Espera un momento y reanuda." };
    case "quota":
      return {
        title: "La llave de IA se quedó sin saldo",
        body: "La cuenta del proveedor llegó a su cuota o límite de gasto. Recarga saldo o asigna otra llave en llaves api, y reanuda.",
      };
    case "timeout":
      return { title: "El modelo tardó demasiado en responder", body: "La solicitud excedió el tiempo de espera. Reanuda para intentarlo de nuevo." };
    case "provider_error":
      return { title: "El proveedor de IA no está disponible", body: "El servicio falló o está saturado. Reanuda en unos minutos." };
    case "credentials":
      return {
        title: "El proveedor rechazó la llave de IA",
        body: "La llave es inválida, fue revocada o no tiene acceso a este modelo. Revísala en llaves api, y reanuda.",
      };
    case "interrupted":
      return { title: "El servidor se reinició a mitad de la respuesta", body: "Reanuda para continuar desde el último paso guardado." };
    default:
      return { title: "La respuesta se pausó", body: "Reanuda para continuar donde se quedó." };
  }
}

/** Message content is a string, or a list of provider content blocks. */
export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.type === "text" && typeof part.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}
