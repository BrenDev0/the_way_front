import { request } from "@/shared/api";

export type ConversationStatus = "idle" | "running" | "awaiting_approval" | "failed";

export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
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
