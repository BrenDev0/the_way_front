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

export function listApiKeys(userId?: string) {
  return request<ApiKey[]>(userId ? `api-keys?userId=${encodeURIComponent(userId)}` : "api-keys");
}
