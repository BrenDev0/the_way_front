"use client";

import { useResource } from "@/shared/api";
import { useSession } from "@/shared/session";
import { LLM_PROVIDERS, listApiKeys } from "../api";

export function LlmKeyNotice() {
  const user = useSession();
  const { data } = useResource(`api-keys:${user.id}`, () => listApiKeys(user.id));

  if (!data || data.some((k) => LLM_PROVIDERS.includes(k.provider))) return null;

  return (
    <p className="alert alert--warn" role="status">
      ! No tienes una llave de Anthropic u OpenAI asignada. Tus conversaciones no podrán ejecutarse hasta que se asigne una.
    </p>
  );
}
