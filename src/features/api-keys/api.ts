import { request } from "@/shared/api";

export type Provider = "anthropic" | "openai" | "gohighlevel";

export interface ApiKey {
  id: string;
  userId: string;
  provider: Provider;
  lastFour: string;
  model: string | null;
  issuedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LLM_PROVIDERS: Provider[] = ["anthropic", "openai"];

export interface IssueApiKeyInput {
  userId: string;
  provider: Provider;
  secret: string;
  accountId?: string;
  model?: string;
}

const errors = {
  api_key_account_id_required: "GoHighLevel necesita un ID de ubicación.",
  api_key_model_provider_mismatch: "El modelo no corresponde al proveedor.",
  api_key_model_not_supported: "Este proveedor no admite modelos.",
  user_not_found: "El operador ya no está disponible.",
  api_key_not_found: "La llave ya no existe.",
};

export function issueApiKey(input: IssueApiKeyInput) {
  return request<ApiKey>("api-keys", { method: "POST", body: input, errors });
}

export function deleteApiKey(id: string) {
  return request<{ detail: string }>(`api-keys/${encodeURIComponent(id)}`, { method: "DELETE", errors });
}

export function listApiKeys(userId?: string) {
  return request<ApiKey[]>(userId ? `api-keys?userId=${encodeURIComponent(userId)}` : "api-keys");
}
