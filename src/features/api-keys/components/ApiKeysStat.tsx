"use client";

import { useResource } from "@/shared/api";
import { StatTile } from "@/shared/ui";
import { listApiKeys } from "../api";

export function ApiKeysStat() {
  const { data, loading, error } = useResource("api-keys", () => listApiKeys());
  const providers = [...new Set(data?.map((k) => k.provider) ?? [])];

  return (
    <StatTile
      label="llaves api"
      value={data?.length}
      detail={providers.length ? providers.join(" · ") : "ninguna asignada"}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
