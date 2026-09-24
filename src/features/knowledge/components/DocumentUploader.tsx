"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ApiError } from "@/shared/api";
import { formatBytes } from "@/shared/format";
import { TerminalBox } from "@/shared/ui";
import {
  MAX_BYTES,
  SUPPORTED_EXTENSIONS,
  completeDocument,
  contentTypeFor,
  createDocument,
  deleteDocument,
  extensionOf,
  uploadToStorage,
} from "../api";
import { refreshDocuments } from "../hooks";

type UploadState = "queued" | "uploading" | "processing" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  message?: string;
}

const BAR_CELLS = 20;
const ACCEPT = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");
const UPLOAD_FAILED = "No se pudo subir el archivo. Intenta de nuevo.";

function validate(file: File) {
  const ext = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) return `Formato no soportado${ext ? ` (.${ext})` : ""}.`;
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_BYTES) return "Supera el máximo de 64 MB.";
  return null;
}

function titleFor(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base.length >= 2 ? base : filename;
}

function ProgressBar({ ratio }: { ratio: number }) {
  const filled = Math.round(ratio * BAR_CELLS);
  return (
    <span className="upload__bar" aria-hidden="true">
      {"█".repeat(filled)}
      <span className="bars__rest">{"░".repeat(BAR_CELLS - filled)}</span>
    </span>
  );
}

function stateLabel(item: UploadItem) {
  switch (item.state) {
    case "queued":
      return "en cola";
    case "uploading":
      return `${Math.round(item.progress * 100)}%`;
    case "processing":
      return "registrando";
    case "done":
      return "✓ subido";
    case "error":
      return item.message ?? UPLOAD_FAILED;
  }
}

export function DocumentUploader() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  function update(id: string, patch: Partial<UploadItem>) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function upload(item: UploadItem) {
    update(item.id, { state: "uploading", progress: 0 });
    const contentType = contentTypeFor(item.file);
    let documentId: string | null = null;

    try {
      const { document, uploadUrl } = await createDocument({
        title: titleFor(item.file.name),
        filename: item.file.name,
        contentType,
        sizeBytes: item.file.size,
      });
      documentId = document.id;
      await uploadToStorage(uploadUrl, item.file, contentType, (progress) => update(item.id, { progress }));
      update(item.id, { state: "processing", progress: 1 });
      await completeDocument(document.id);
      update(item.id, { state: "done" });
    } catch (err) {
      if (documentId) await deleteDocument(documentId).catch(() => undefined);
      update(item.id, { state: "error", message: err instanceof ApiError ? err.message : UPLOAD_FAILED });
    } finally {
      await refreshDocuments();
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((file): UploadItem => {
      const problem = validate(file);
      return {
        id: crypto.randomUUID(),
        file,
        state: problem ? "error" : "queued",
        progress: 0,
        message: problem ?? undefined,
      };
    });
    setItems((list) => [...added, ...list]);
    for (const item of added) {
      if (item.state === "queued") queueRef.current = queueRef.current.then(() => upload(item));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  const finished = items.filter((i) => i.state === "done" || i.state === "error").length;
  const active = items.some((i) => i.state === "queued" || i.state === "uploading" || i.state === "processing");

  return (
    <TerminalBox wide title="AÑADIR FUENTES" status={active ? "transmitiendo" : "máx 64 MB por archivo"}>
      <div className="stack">
        <div
          className={dragging ? "dropzone dropzone--active" : "dropzone"}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar archivos para subir"
          onClick={() => inputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="dropzone__glyph" aria-hidden="true">
            ⇪
          </span>
          <span className="dropzone__title">{dragging ? "suelta para compartir" : "arrastra fuentes de tu organización aquí o haz clic"}</span>
          <span className="dropzone__hint">pdf · docx · txt · md · csv · json · html · código</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <>
            <ul className="uploads">
              {items.map((item) => (
                <li key={item.id} className={`upload upload--${item.state}`}>
                  <span className="upload__name">{item.file.name}</span>
                  <span className="upload__size">{formatBytes(item.file.size)}</span>
                  {item.state === "uploading" && <ProgressBar ratio={item.progress} />}
                  <span className="upload__state">{stateLabel(item)}</span>
                </li>
              ))}
            </ul>
            {finished > 0 && (
              <div className="row-between">
                <span>
                  {finished} de {items.length} terminados
                </span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => setItems((list) => list.filter((i) => i.state !== "done" && i.state !== "error"))}
                >
                  limpiar lista
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </TerminalBox>
  );
}
