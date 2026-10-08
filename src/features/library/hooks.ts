"use client";

import { revalidate, useResource } from "@/shared/api";
import { getLibrary, getTree, type Library, type LibraryTree } from "./api";

const LIBRARY_KEY = "library";
const treeKey = (library: Library) => `library-tree:${library.id}`;

export function useLibrary() {
  return useResource<Library>(LIBRARY_KEY, getLibrary);
}

/** The library's folders and files, once the library itself is known. */
export function useLibraryTree(library: Library | undefined) {
  return useResource<LibraryTree>(library ? treeKey(library) : null, () => getTree(library!.id));
}

export function refreshLibrary(library: Library) {
  return revalidate(treeKey(library));
}
