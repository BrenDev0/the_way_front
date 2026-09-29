"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { errorMessage, revalidate } from "@/shared/api";
import { ConfirmButton, TerminalBox } from "@/shared/ui";
import { saveSkill, type Skill } from "../api";
import { draftProblem, nameFromFilename, parseSkill } from "../draft";

type UploadState = "queued" | "saving" | "created" | "replaced" | "error";

interface UploadItem {
  id: string;
  filename: string;
  content?: string;
  state: UploadState;
  message?: string;
}

const EXTENSIONS = ["md", "markdown"];
const MAX_BYTES = 256 * 1024;

const LABELS: Record<Exclude<UploadState, "error">, string> = {
  queued: "en cola",
  saving: "guardando",
  created: "✓ creada",
  replaced: "✓ reemplazada",
};

interface SkillUploaderProps {
  skills: Skill[] | undefined;
  dirty: boolean;
  onOpen: (content: string) => void;
}

export function SkillUploader({ skills, dirty, onOpen }: SkillUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const known = useRef(new Set<string>());
  known.current = new Set(skills?.map((skill) => skill.name));

  function update(id: string, patch: Partial<UploadItem>) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function upload(item: UploadItem, file: File) {
    update(item.id, { state: "saving" });
    let content: string | undefined;
    try {
      content = await file.text();
      const parsed = parseSkill(content);
      const name = parsed.name ?? nameFromFilename(file.name);
      const problem = draftProblem({ ...parsed, name });
      if (problem) {
        update(item.id, { state: "error", message: problem, content });
        return;
      }
      const existed = known.current.has(name!.toLowerCase());
      await saveSkill({ instructions: content, ...(parsed.name ? {} : { name: name! }) });
      known.current.add(name!.toLowerCase());
      update(item.id, { state: existed ? "replaced" : "created", message: name!, content });
      await revalidate("skills");
    } catch (err) {
      update(item.id, { state: "error", message: errorMessage(err), content });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const problem = !EXTENSIONS.includes(ext)
        ? "Solo se aceptan archivos .md."
        : file.size === 0
          ? "El archivo está vacío."
          : file.size > MAX_BYTES
            ? "Supera el máximo de 256 KB."
            : null;
      const item: UploadItem = { id: crypto.randomUUID(), filename: file.name, state: problem ? "error" : "queued", message: problem ?? undefined };
      setItems((list) => [item, ...list]);
      if (!problem) queueRef.current = queueRef.current.then(() => upload(item, file));
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  const active = items.some((item) => item.state === "queued" || item.state === "saving");

  return (
    <TerminalBox wide title="SUBIR ARCHIVOS .MD" status={active ? "guardando" : "máx 256 KB por archivo"}>
      <div className="stack">
        <div
          className={dragging ? "dropzone dropzone--active" : "dropzone"}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar archivos de skills para subir"
          onClick={() => inputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="dropzone__glyph" aria-hidden="true">⇪</span>
          <span className="dropzone__title">{dragging ? "suelta para guardar" : "arrastra archivos SKILL.md aquí o haz clic"}</span>
          <span className="dropzone__hint">el nombre y la descripción se leen del encabezado · un archivo con el mismo nombre reemplaza la skill</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".md,.markdown"
            hidden
            data-testid="skill-files"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <>
            <ul className="uploads">
              {items.map((item) => (
                <li key={item.id} className={`upload upload--${item.state === "error" ? "error" : item.state === "created" || item.state === "replaced" ? "done" : "processing"}`}>
                  <span className="upload__name">{item.filename}</span>
                  <span className="upload__state">
                    {item.state === "error" ? item.message : `${LABELS[item.state]}${item.message ? ` · ${item.message}` : ""}`}
                  </span>
                  {item.state === "error" && item.content !== undefined &&
                    (dirty ? (
                      <ConfirmButton question="¿Descartar el borrador?" onConfirm={() => onOpen(item.content!)}>
                        corregir en el editor
                      </ConfirmButton>
                    ) : (
                      <button type="button" className="linkbtn" onClick={() => onOpen(item.content!)}>
                        corregir en el editor
                      </button>
                    ))}
                </li>
              ))}
            </ul>
            {!active && (
              <div className="row-between">
                <span>{items.length} archivos procesados</span>
                <button type="button" className="linkbtn" onClick={() => setItems([])}>
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
