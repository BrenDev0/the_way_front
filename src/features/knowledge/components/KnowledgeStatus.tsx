"use client";

import { errorMessage } from "@/shared/api";
import { Spinner, TerminalBox } from "@/shared/ui";
import { STATUS_LABELS, STATUS_ORDER } from "../api";
import { useDocuments } from "../hooks";

const BAR_CELLS = 16;

export function KnowledgeStatus() {
  const { data, loading, error } = useDocuments();
  const total = data?.length ?? 0;
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: data?.filter((d) => d.status === status).length ?? 0,
  })).filter(({ count }) => count > 0);
  const processing = data?.some((d) => d.status === "pending" || d.status === "extracting");

  return (
    <TerminalBox
      wide
      title="CONOCIMIENTO"
      status={processing ? "procesando documentos" : data ? `${total} documentos` : undefined}
    >
      {loading ? (
        <p className="empty">
          <Spinner /> cargando documentos
        </p>
      ) : error && !data ? (
        <p className="alert alert--error">! {errorMessage(error)}</p>
      ) : total === 0 ? (
        <p className="empty">la base de conocimiento está vacía</p>
      ) : (
        <ul className="bars">
          {counts.map(({ status, count }) => {
            const filled = Math.max(1, Math.round((count / total) * BAR_CELLS));
            return (
              <li key={status} className={`bars__row status--${status}`}>
                <span className="bars__label">{STATUS_LABELS[status]}</span>
                <span className="bars__bar" aria-hidden="true">
                  {"█".repeat(filled)}
                  <span className="bars__rest">{"░".repeat(BAR_CELLS - filled)}</span>
                </span>
                <span className="bars__count">{count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </TerminalBox>
  );
}
