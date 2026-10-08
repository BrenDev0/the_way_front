"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLibrary, useLibraryTree } from "@/features/library";
import { brandsOf } from "@/features/library/api";
import { errorMessage } from "@/shared/api";
import { formatBytes, formatRelative } from "@/shared/format";
import { Busy, ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import { DOCUMENT_LIMIT, STATUS_LABELS, deleteDocument, isAvailable, trainDocuments, updateDocument, type KnowledgeDocument } from "../api";
import { refreshDocuments, useDocuments } from "../hooks";

const TRAINING_WATCH_MS = 60_000;
const NO_BRAND = "";

type Feedback = { tone: "ok" | "error"; message: string } | null;

/** The brands a document can belong to: the library's brand folders. */
function useBrandNames() {
  const { data: library } = useLibrary();
  const { data: tree } = useLibraryTree(library);
  return tree ? brandsOf(tree).brands.map((brand) => brand.folder.name) : [];
}

export function DocumentsTable() {
  const [watch, setWatch] = useState(false);
  const [training, setTraining] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { data, loading, error } = useDocuments({ watch });
  const brands = useBrandNames();
  const undescribed = data?.filter((d) => isAvailable(d) && !d.description.trim()).length ?? 0;
  const documents = data ? [...data].reverse() : [];

  useEffect(() => {
    if (!watch) return;
    const id = setTimeout(() => setWatch(false), TRAINING_WATCH_MS);
    return () => clearTimeout(id);
  }, [watch]);

  async function describe() {
    setTraining(true);
    setFeedback(null);
    try {
      const { queued } = await trainDocuments();
      setFeedback({ tone: "ok", message: `Generando descripciones: ${queued} ${queued === 1 ? "documento" : "documentos"} en cola.` });
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
            {undescribed > 0
              ? `${undescribed} ${undescribed === 1 ? "documento" : "documentos"} sin descripción — ya están disponibles; una descripción ayuda al agente a elegir cuál leer`
              : "todas las fuentes tienen descripción"}
          </span>
          <button className="btn btn--small toolbar__action" type="button" onClick={describe} disabled={training || undescribed === 0}>
            {training ? <Busy words={["DESCRIBIENDO"]} /> : "Generar descripciones"}
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
            {documents.map((doc) =>
              editing === doc.id ? (
                <li key={doc.id} className="doclist__row doclist__row--editing">
                  <DocumentEditor
                    document={doc}
                    brands={brands}
                    onCancel={() => setEditing(null)}
                    onSaved={(title) => {
                      setEditing(null);
                      setFeedback({ tone: "ok", message: `"${title}" actualizado.` });
                    }}
                    onError={(message) => setFeedback({ tone: "error", message })}
                  />
                </li>
              ) : (
                <li key={doc.id} className="doclist__row">
                  <span className={`doclist__status status--${doc.status}`}>
                    {(doc.status === "pending" || doc.status === "extracting") && <Spinner />} {STATUS_LABELS[doc.status]}
                  </span>
                  <span className="doclist__main">
                    <span className="doclist__title">
                      {doc.title}
                      {doc.brand && <span className="doclist__brand">{doc.brand}</span>}
                    </span>
                    <span className="doclist__meta">
                      {doc.filename} · {formatBytes(doc.sizeBytes)} · {formatRelative(doc.updatedAt)}
                    </span>
                    {doc.description && <span className="doclist__description">{doc.description}</span>}
                  </span>
                  <span className="doclist__actions">
                    <button type="button" className="linkbtn" onClick={() => setEditing(doc.id)}>
                      editar
                    </button>
                    <ConfirmButton question="¿eliminar?" onConfirm={() => remove(doc.id, doc.title)}>
                      eliminar
                    </ConfirmButton>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}

function DocumentEditor({
  document,
  brands,
  onCancel,
  onSaved,
  onError,
}: {
  document: KnowledgeDocument;
  brands: string[];
  onCancel: () => void;
  onSaved: (title: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description);
  const [brand, setBrand] = useState(document.brand ?? NO_BRAND);
  const [saving, setSaving] = useState(false);
  // a brand set before its folder was renamed or removed stays choosable
  const options = document.brand && !brands.includes(document.brand) ? [document.brand, ...brands] : brands;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDocument(document.id, { title: title.trim(), description: description.trim(), brand });
      await refreshDocuments();
      onSaved(title.trim());
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="doc-editor" onSubmit={save} aria-label={`Editar ${document.title}`}>
      <label className="field">
        <span className="field__label">título</span>
        <input className="field__input" value={title} minLength={2} maxLength={255} required onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">marca</span>
        <select className="field__input" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value={NO_BRAND}>— la organización (ninguna marca)</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="field doc-editor__wide">
        <span className="field__label">descripción — qué contiene y cuándo leerlo</span>
        <textarea className="field__input" value={description} rows={3} maxLength={1024} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="doc-editor__actions">
        <button type="button" className="linkbtn" onClick={onCancel}>
          cancelar
        </button>
        <button type="submit" className="btn btn--small" disabled={saving || title.trim().length < 2}>
          {saving ? <Busy words={["GUARDANDO"]} /> : "guardar"}
        </button>
      </div>
    </form>
  );
}
