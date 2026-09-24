"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/shared/api";
import { formatBytes, formatRelative } from "@/shared/format";
import { Busy, ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import { DOCUMENT_LIMIT, STATUS_LABELS, deleteDocument, trainDocuments } from "../api";
import { refreshDocuments, useDocuments } from "../hooks";

const TRAINING_WATCH_MS = 60_000;

type Feedback = { tone: "ok" | "error"; message: string } | null;

export function DocumentsTable() {
  const [watch, setWatch] = useState(false);
  const [training, setTraining] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { data, loading, error } = useDocuments({ watch });
  const ready = data?.filter((d) => d.status === "extracted").length ?? 0;
  const documents = data ? [...data].reverse() : [];

  useEffect(() => {
    if (!watch) return;
    const id = setTimeout(() => setWatch(false), TRAINING_WATCH_MS);
    return () => clearTimeout(id);
  }, [watch]);

  async function train() {
    setTraining(true);
    setFeedback(null);
    try {
      const { queued } = await trainDocuments();
      setFeedback({ tone: "ok", message: `Entrenamiento iniciado: ${queued} ${queued === 1 ? "documento" : "documentos"} en cola.` });
      setWatch(true);
      await refreshDocuments();
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
    } finally {
      setTraining(false);
    }
  }

  async function remove(id: string, title: string) {
    setFeedback(null);
    try {
      await deleteDocument(id);
      setFeedback({ tone: "ok", message: `"${title}" eliminado.` });
      await refreshDocuments();
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
    }
  }

  return (
    <TerminalBox wide title="FUENTES DE LA ORGANIZACIÓN" status={data ? `${data.length} de ${DOCUMENT_LIMIT} documentos` : undefined}>
      <div className="stack">
        <div className="toolbar">
          <span className="toolbar__info">
            {ready > 0 ? `${ready} ${ready === 1 ? "documento listo" : "documentos listos"} para entrenar` : "nada pendiente de entrenar"}
          </span>
          <button className="btn btn--small toolbar__action" type="button" onClick={train} disabled={training || ready === 0}>
            {training ? <Busy words={["ENTRENANDO"]} /> : "Entrenar"}
          </button>
        </div>

        {feedback && (
          <p className={`alert alert--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
            {feedback.tone === "error" ? "!" : "✓"} {feedback.message}
          </p>
        )}

        {loading ? (
          <p className="empty">
            <Spinner /> cargando documentos
          </p>
        ) : error && !data ? (
          <p className="alert alert--error">! {errorMessage(error)}</p>
        ) : documents.length === 0 ? (
          <p className="empty">todavía no hay fuentes compartidas. añade un documento sobre tu organización.</p>
        ) : (
          <ul className="doclist">
            {documents.map((doc) => (
              <li key={doc.id} className="doclist__row">
                <span className={`doclist__status status--${doc.status}`}>
                  {(doc.status === "pending" || doc.status === "extracting") && <Spinner />} {STATUS_LABELS[doc.status]}
                </span>
                <span className="doclist__main">
                  <span className="doclist__title">{doc.title}</span>
                  <span className="doclist__meta">
                    {doc.filename} · {formatBytes(doc.sizeBytes)} · {formatRelative(doc.updatedAt)}
                  </span>
                  {doc.description && <span className="doclist__description">{doc.description}</span>}
                </span>
                <span className="doclist__actions">
                  <ConfirmButton question="¿eliminar?" onConfirm={() => remove(doc.id, doc.title)}>
                    eliminar
                  </ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}
