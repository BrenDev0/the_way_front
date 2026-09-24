"use client";

import { revalidate, useResource } from "@/shared/api";
import { listMembers } from "./api";

const KEY = "members";

export function useMembers() {
  return useResource(KEY, listMembers);
}

export function refreshMembers() {
  return revalidate(KEY);
}
