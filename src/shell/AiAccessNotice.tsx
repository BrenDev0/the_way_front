"use client";

import { useSession } from "@/shared/session";

/** Whether the organization has AI access is set by Xplorers, not by anyone in it: this only
 *  says so, and who to ask. The session carries the answer, so there is nothing to fetch. */
export function AiAccessNotice() {
  const user = useSession();

  if (user.setupComplete) return null;

  return (
    <p className="alert alert--warn" role="status">
      ! El acceso a la IA de tu organización todavía no está habilitado. Las conversaciones no podrán ejecutarse hasta que Xplorers lo habilite: escríbeles para activarlo.
    </p>
  );
}
