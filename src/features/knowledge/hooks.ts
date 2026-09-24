"use client";

import { revalidate, useResource } from "@/shared/api";
import { listDocuments, type KnowledgeDocument } from "./api";

const KEY = "documents";
const POLL_MS = 4000;

function isProcessing(documents: KnowledgeDocument[] | undefined) {
  return documents?.some((d) => d.status === "pending" || d.status === "extracting") ?? false;
}

export function useDocuments({ watch = false }: { watch?: boolean } = {}) {
  return useResource(KEY, listDocuments, {
    refreshInterval: (data) => (watch || isProcessing(data) ? POLL_MS : 0),
  });
}

export function refreshDocuments() {
  return revalidate(KEY);
}
