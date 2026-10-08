"use client";

import { StatTile } from "@/shared/ui";
import { DOCUMENT_LIMIT, isAvailable } from "../api";
import { useDocuments } from "../hooks";

export function DocumentsStat() {
  const { data, loading, error } = useDocuments();
  const trained = data?.filter(isAvailable).length ?? 0;

  return (
    <StatTile
      label="documentos"
      value={
        <>
          {trained}
          <span className="stat__of">/{data?.length ?? 0}</span>
        </>
      }
      detail={`disponibles · máx ${DOCUMENT_LIMIT}`}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
