"use client";

import { useResource } from "@/shared/api";
import { getMyOrganization } from "./api";

export function useOrganization() {
  return useResource("organization", getMyOrganization);
}
