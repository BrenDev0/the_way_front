"use client";

import { StatTile } from "@/shared/ui";
import { DOCUMENT_LIMIT } from "../api";
import { useDocuments } from "../hooks";

export function DocumentsStat() {
  const { data, loading, error } = useDocuments();
  const trained = data?.filter((d) => d.status === "trained").length ?? 0;

  return (
    <StatTile
      label="documentos"
      value={
        <>
          {trained}
          <span className="stat__of">/{data?.length ?? 0}</span>
        </>
      }
      detail={`entrenados · máx ${DOCUMENT_LIMIT}`}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
