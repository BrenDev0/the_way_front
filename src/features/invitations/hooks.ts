"use client";

import { revalidate, useResource } from "@/shared/api";
import { listInvitations } from "./api";

const KEY = "invitations";

export function useInvitations() {
  return useResource(KEY, listInvitations);
}

export function refreshInvitations() {
  return revalidate(KEY);
}
