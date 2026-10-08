import { request, type ErrorMessages } from "@/shared/api";

/** The organization's library: one shared project the backend makes on first use, one
 *  folder per client brand. Every member's agent reads it; owners and admins change it. */
export interface Library {
  id: string;
  name: string;
  shared: boolean;
}

export interface LibraryFolder {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryFile {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: "pending" | "ready";
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryTree {
  folders: LibraryFolder[];
  files: LibraryFile[];
}

/** A brand: a folder at the top of the library, with every file anywhere under it. */
export interface Brand {
  folder: LibraryFolder;
  files: LibraryFile[];
}

export const MAX_BYTES = 200 * 1024 * 1024;

const LIBRARY_ERRORS: ErrorMessages = {
  library_read_only: "Solo propietarios y administradores pueden cambiar la biblioteca.",
  project_entry_name_taken: "Ya hay algo con ese nombre en esta marca.",
  project_name_invalid: "Ese nombre no es válido.",
  folder_not_found: "Esa marca ya no existe.",
  file_not_found: "Ese archivo ya no existe.",
  file_not_uploaded: "El archivo no terminó de subirse. Intenta de nuevo.",
};

const IMAGE = /^image\//;

export function isImage(file: Pick<LibraryFile, "contentType">) {
  return IMAGE.test(file.contentType);
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  ai: "application/postscript",
  eps: "application/postscript",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

export function contentTypeFor(file: File) {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? (file.type || "application/octet-stream");
}

/** Brands, alphabetically, each with the files under it; files at the top level apart. */
export function brandsOf(tree: LibraryTree): { brands: Brand[]; loose: LibraryFile[] } {
  const parentOf = new Map(tree.folders.map((folder) => [folder.id, folder.parentId]));
  const topOf = (folderId: string | null): string | null => {
    let current = folderId;
    while (current && parentOf.get(current)) current = parentOf.get(current) ?? null;
    return current;
  };
  const ready = tree.files.filter((file) => file.status === "ready");
  const brands = tree.folders
    .filter((folder) => folder.parentId === null)
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
    .map((folder) => ({ folder, files: ready.filter((file) => topOf(file.folderId) === folder.id) }));
  return { brands, loose: ready.filter((file) => file.folderId === null) };
}

/** How the agent names a file: what to paste into a chat to point at it. */
export function agentPath(library: Library, brand: LibraryFolder, file: LibraryFile) {
  return `project:${library.name}/${brand.name}/${file.name}`;
}

export function contentUrl(library: Library, file: LibraryFile) {
  return `/api/backend/projects/${encodeURIComponent(library.id)}/files/${encodeURIComponent(file.id)}/content`;
}

export function getLibrary() {
  return request<Library>("projects/library", { errors: LIBRARY_ERRORS });
}

export function getTree(libraryId: string) {
  return request<LibraryTree>(`projects/${encodeURIComponent(libraryId)}/tree`, { errors: LIBRARY_ERRORS });
}

export function createBrand(libraryId: string, name: string) {
  return request<LibraryFolder>(`projects/${encodeURIComponent(libraryId)}/folders`, {
    method: "POST",
    body: { name, parentId: null },
    errors: LIBRARY_ERRORS,
  });
}

export function deleteBrand(libraryId: string, folderId: string) {
  return request<{ detail: string }>(`projects/${encodeURIComponent(libraryId)}/folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE",
    errors: LIBRARY_ERRORS,
  });
}

export function requestUpload(libraryId: string, input: { name: string; folderId: string; contentType: string; sizeBytes: number }) {
  return request<{ file: LibraryFile; uploadUrl: string; expiresInSeconds: number }>(`projects/${encodeURIComponent(libraryId)}/files`, {
    method: "POST",
    body: input,
    errors: LIBRARY_ERRORS,
  });
}

export function completeUpload(libraryId: string, fileId: string) {
  return request<LibraryFile>(`projects/${encodeURIComponent(libraryId)}/files/${encodeURIComponent(fileId)}/complete`, {
    method: "POST",
    errors: LIBRARY_ERRORS,
  });
}

export function deleteFile(libraryId: string, fileId: string) {
  return request<{ detail: string }>(`projects/${encodeURIComponent(libraryId)}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    errors: LIBRARY_ERRORS,
  });
}
