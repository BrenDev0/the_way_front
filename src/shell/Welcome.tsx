"use client";

import { useOrganization } from "@/features/organization";
import { useSession } from "@/shared/session";
import { Scramble } from "@/shared/ui";

export function Welcome() {
  const user = useSession();
  const { data: organization } = useOrganization();

  return (
    <header className="welcome">
      <p className="welcome__kicker">
        <Scramble text="SESIÓN :: ESTABLECIDA" />
      </p>
      <h1 className="welcome__title">
        ✓ bienvenido, <span className="welcome__email">{user.email}</span>
        <span className="cursor" aria-hidden="true" />
      </h1>
      {organization && <p className="welcome__org">organización · {organization.name}</p>}
    </header>
  );
}
