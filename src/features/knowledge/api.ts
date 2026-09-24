import { request, type ErrorMessages } from "@/shared/api";

export type DocumentStatus = "pending" | "extracting" | "extracted" | "trained" | "unsupported" | "failed";

export interface KnowledgeDocument {
  id: string;
  title: string;
  description: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  extractedChars: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_LIMIT = 200;
export const MAX_BYTES = 64 * 1024 * 1024;

export const STATUS_ORDER: DocumentStatus[] = ["trained", "extracted", "extracting", "pending", "unsupported", "failed"];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "pendiente",
  extracting: "extrayendo",
  extracted: "listo para entrenar",
  trained: "entrenado",
  unsupported: "no soportado",
  failed: "fallido",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  rst: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  jsonl: "application/jsonl",
  yaml: "application/yaml",
  yml: "application/yaml",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  py: "text/x-python",
  js: "text/javascript",
  ts: "text/plain",
  sql: "application/sql",
  ini: "text/plain",
  cfg: "text/plain",
  toml: "application/toml",
  log: "text/plain",
};

export const SUPPORTED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

const KNOWLEDGE_ERRORS: ErrorMessages = {
  document_too_large: "El archivo supera el máximo de 64 MB.",
  document_limit_reached: "Alcanzaste el límite de 200 documentos.",
  document_not_found: "Ese documento ya no existe.",
  document_not_uploaded: "El archivo no terminó de subirse. Intenta de nuevo.",
  document_nothing_to_train: "No hay documentos listos para entrenar.",
};

export function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function contentTypeFor(file: File) {
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? (file.type || "application/octet-stream");
}

export function listDocuments() {
  return request<KnowledgeDocument[]>("documents", { errors: KNOWLEDGE_ERRORS });
}

export function createDocument(input: { title: string; filename: string; contentType: string; sizeBytes: number }) {
  return request<{ document: KnowledgeDocument; uploadUrl: string; expiresInSeconds: number }>("documents", {
    method: "POST",
    body: input,
    errors: KNOWLEDGE_ERRORS,
  });
}

export function completeDocument(id: string) {
  return request<KnowledgeDocument>(`documents/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    errors: KNOWLEDGE_ERRORS,
  });
}

export function deleteDocument(id: string) {
  return request<{ detail: string }>(`documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errors: KNOWLEDGE_ERRORS,
  });
}

export function trainDocuments() {
  return request<{ detail: string; queued: number }>("documents/train", { method: "POST", errors: KNOWLEDGE_ERRORS });
}

function publicUploadUrl(url: string) {
  const origin = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN;
  if (!origin) return url;
  const target = new URL(url);
  const replacement = new URL(origin);
  target.protocol = replacement.protocol;
  target.host = replacement.host;
  return target.toString();
}

export function uploadToStorage(url: string, file: File, contentType: string, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", publicUploadUrl(url));
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        console.error(`[upload] storage responded ${xhr.status}`, xhr.responseText);
        reject(new Error("upload_failed"));
      }
    };
    xhr.onerror = () => {
      console.error("[upload] network error while uploading to storage");
      reject(new Error("upload_failed"));
    };
    xhr.send(file);
  });
}
