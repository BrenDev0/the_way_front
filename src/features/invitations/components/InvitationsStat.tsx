"use client";

import { StatTile } from "@/shared/ui";
import { useInvitations } from "../hooks";

export function InvitationsStat() {
  const { data, loading, error } = useInvitations();

  return (
    <StatTile
      label="invitaciones"
      value={data?.length}
      detail={data?.length ? "pendientes de aceptar" : "ninguna pendiente"}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
