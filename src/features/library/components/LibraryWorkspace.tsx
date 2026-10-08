"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, errorMessage, uploadToStorage } from "@/shared/api";
import { formatBytes } from "@/shared/format";
import { ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import {
  MAX_BYTES,
  agentPath,
  brandsOf,
  completeUpload,
  contentTypeFor,
  contentUrl,
  createBrand,
  deleteBrand,
  deleteFile,
  isImage,
  requestUpload,
  type Brand,
  type Library,
  type LibraryFile,
} from "../api";
import { refreshLibrary, useLibrary, useLibraryTree } from "../hooks";

type Feedback = { tone: "ok" | "error"; message: string } | null;

interface UploadItem {
  id: string;
  file: File;
  state: "queued" | "uploading" | "done" | "error";
  progress: number;
  message?: string;
}

const UPLOAD_FAILED = "No se pudo subir el archivo. Intenta de nuevo.";

function validate(file: File) {
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_BYTES) return "Supera el máximo de 200 MB.";
  return null;
}

/**
 * The organization's library: one folder per client brand, holding its logos, images,
 * fonts and brand books. The agent uses these in chat -- on pages, in image edits -- and
 * keeps each brand to its own folder; it can never change them.
 */
export function LibraryWorkspace() {
  const { data: library, error: libraryError } = useLibrary();
  const { data: tree, loading, error } = useLibraryTree(library);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const { brands, loose } = tree ? brandsOf(tree) : { brands: [], loose: [] };
  const selected = brands.find((brand) => brand.folder.id === selectedId) ?? brands[0] ?? null;

  useEffect(() => {
    if (!selectedId && brands[0]) setSelectedId(brands[0].folder.id);
  }, [brands, selectedId]);

  if (libraryError && !library) return <p className="alert alert--error">! {errorMessage(libraryError)}</p>;
  if (!library || loading) {
    return (
      <p className="empty">
        <Spinner /> cargando biblioteca
      </p>
    );
  }
  if (error && !tree) return <p className="alert alert--error">! {errorMessage(error)}</p>;

  return (
    <div className="library">
      <TerminalBox title="MARCAS" status={`${brands.length} ${brands.length === 1 ? "marca" : "marcas"}`}>
        <div className="stack">
          <BrandCreator
            library={library}
            onCreated={(id) => setSelectedId(id)}
            onError={(message) => setFeedback({ tone: "error", message })}
          />
          {brands.length === 0 ? (
            <p className="empty">crea una marca por cliente para empezar.</p>
          ) : (
            <ul className="library__brands" aria-label="Marcas">
              {brands.map((brand) => (
                <li key={brand.folder.id}>
                  <button
                    type="button"
                    className={brand.folder.id === selected?.folder.id ? "library__brand library__brand--active" : "library__brand"}
                    aria-current={brand.folder.id === selected?.folder.id ? "true" : undefined}
                    onClick={() => setSelectedId(brand.folder.id)}
                  >
                    <span className="library__brand-name">{brand.folder.name}</span>
                    <span className="library__brand-count">{brand.files.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {loose.length > 0 && <p className="library__hint">{loose.length} archivo(s) sueltos fuera de una marca.</p>}
        </div>
      </TerminalBox>

      <div className="stack">
        {feedback && (
          <p className={`alert alert--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
            {feedback.tone === "error" ? "!" : "✓"} {feedback.message}
          </p>
        )}
        {selected ? (
          <BrandPanel
            key={selected.folder.id}
            library={library}
            brand={selected}
            onFeedback={setFeedback}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <TerminalBox wide title="ARCHIVOS">
            <p className="empty">elige o crea una marca para subir sus logos, imágenes y manual.</p>
          </TerminalBox>
        )}
      </div>
    </div>
  );
}

function BrandCreator({ library, onCreated, onError }: { library: Library; onCreated: (id: string) => void; onError: (message: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return;
    setBusy(true);
    try {
      const folder = await createBrand(library.id, cleaned);
      setName("");
      await refreshLibrary(library);
      onCreated(folder.id);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="library__new" onSubmit={submit}>
      <label className="sr-only" htmlFor="new-brand">
        Nueva marca
      </label>
      <input id="new-brand" className="field__input" placeholder="nueva marca" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <button className="btn btn--small" type="submit" disabled={busy || !name.trim()}>
        crear
      </button>
    </form>
  );
}

function BrandPanel({
  library,
  brand,
  onFeedback,
  onDeleted,
}: {
  library: Library;
  brand: Brand;
  onFeedback: (feedback: Feedback) => void;
  onDeleted: () => void;
}) {
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
    let fileId: string | null = null;
    try {
      const ticket = await requestUpload(library.id, { name: item.file.name, folderId: brand.folder.id, contentType, sizeBytes: item.file.size });
      fileId = ticket.file.id;
      await uploadToStorage(ticket.uploadUrl, item.file, contentType, (progress) => update(item.id, { progress }));
      await completeUpload(library.id, ticket.file.id);
      update(item.id, { state: "done", progress: 1 });
    } catch (err) {
      if (fileId) await deleteFile(library.id, fileId).catch(() => undefined);
      update(item.id, { state: "error", message: err instanceof ApiError ? err.message : UPLOAD_FAILED });
    } finally {
      await refreshLibrary(library);
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((file): UploadItem => {
      const problem = validate(file);
      return { id: crypto.randomUUID(), file, state: problem ? "error" : "queued", progress: 0, message: problem ?? undefined };
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

  async function removeFile(file: LibraryFile) {
    onFeedback(null);
    try {
      await deleteFile(library.id, file.id);
      onFeedback({ tone: "ok", message: `"${file.name}" eliminado.` });
      await refreshLibrary(library);
    } catch (err) {
      onFeedback({ tone: "error", message: errorMessage(err) });
    }
  }

  async function removeBrand() {
    onFeedback(null);
    try {
      await deleteBrand(library.id, brand.folder.id);
      onFeedback({ tone: "ok", message: `Marca "${brand.folder.name}" eliminada.` });
      onDeleted();
      await refreshLibrary(library);
    } catch (err) {
      onFeedback({ tone: "error", message: errorMessage(err) });
    }
  }

  async function copyPath(file: LibraryFile) {
    const path = agentPath(library, brand.folder, file);
    try {
      await navigator.clipboard.writeText(path);
      onFeedback({ tone: "ok", message: `Copiado: ${path}` });
    } catch {
      onFeedback({ tone: "ok", message: path });
    }
  }

  const uploading = items.some((item) => item.state === "queued" || item.state === "uploading");

  return (
    <TerminalBox wide title={brand.folder.name.toUpperCase()} status={uploading ? "transmitiendo" : `${brand.files.length} archivos`}>
      <div className="stack">
        <div className="toolbar">
          <span className="toolbar__info">
            el agente usa estos archivos solo cuando la conversación es sobre <strong>{brand.folder.name}</strong>
          </span>
          <ConfirmButton
            question={brand.files.length ? `¿eliminar la marca y sus ${brand.files.length} archivos?` : "¿eliminar la marca?"}
            onConfirm={removeBrand}
          >
            eliminar marca
          </ConfirmButton>
        </div>

        <div
          className={dragging ? "dropzone dropzone--active" : "dropzone"}
          role="button"
          tabIndex={0}
          aria-label={`Subir archivos a ${brand.folder.name}`}
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
          <span className="dropzone__title">{dragging ? "suelta para añadir" : `arrastra logos, imágenes o el manual de ${brand.folder.name}`}</span>
          <span className="dropzone__hint">png · jpg · svg · webp · pdf · fuentes — máx 200 MB</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            data-testid="library-input"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <ul className="uploads">
            {items.map((item) => (
              <li key={item.id} className={`upload upload--${item.state}`}>
                <span className="upload__name">{item.file.name}</span>
                <span className="upload__size">{formatBytes(item.file.size)}</span>
                <span className="upload__state">
                  {item.state === "queued" && "en cola"}
                  {item.state === "uploading" && `${Math.round(item.progress * 100)}%`}
                  {item.state === "done" && "✓ subido"}
                  {item.state === "error" && (item.message ?? UPLOAD_FAILED)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {brand.files.length === 0 ? (
          <p className="empty">esta marca todavía no tiene archivos.</p>
        ) : (
          <ul className="library__grid" aria-label={`Archivos de ${brand.folder.name}`}>
            {brand.files.map((file) => (
              <li key={file.id} className="library__card">
                <span className="library__thumb">
                  {isImage(file) ? <img src={contentUrl(library, file)} alt={file.name} loading="lazy" /> : <span aria-hidden="true">{file.name.split(".").pop()?.toUpperCase()}</span>}
                </span>
                <span className="library__name" title={file.name}>
                  {file.name}
                </span>
                <span className="library__meta">{formatBytes(file.sizeBytes)}</span>
                <span className="library__actions">
                  <button type="button" className="linkbtn" onClick={() => copyPath(file)} title="Copia la ruta para pedirle al agente que lo use">
                    copiar ruta
                  </button>
                  <ConfirmButton question="¿eliminar?" onConfirm={() => removeFile(file)}>
                    eliminar
                  </ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="library__hint">
          los manuales de marca en PDF súbelos también en <a href="/knowledge">conocimiento</a> y asígnales esta marca, para que el agente pueda leer su texto.
        </p>
      </div>
    </TerminalBox>
  );
}
