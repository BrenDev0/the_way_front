"use client";

import { StatTile } from "@/shared/ui";
import { useInvitations } from "../hooks";

export function InvitationsStat() {
  const { data, loading, error } = useInvitations();

  return (
    <StatTile
      label="Invitaciones"
      value={data?.length}
      detail={data?.length ? "Pendientes de aceptar" : "Ninguna pendiente"}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
