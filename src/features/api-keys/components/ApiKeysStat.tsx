"use client";

import { useResource } from "@/shared/api";
import { StatTile } from "@/shared/ui";
import { listApiKeys } from "../api";

export function ApiKeysStat() {
  const { data, loading, error } = useResource("api-keys", () => listApiKeys());
  const providers = [...new Set(data?.map((k) => k.provider) ?? [])];

  return (
    <StatTile
      label="Llaves API"
      value={data?.length}
      detail={providers.length ? providers.join(" · ") : "Ninguna asignada"}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
