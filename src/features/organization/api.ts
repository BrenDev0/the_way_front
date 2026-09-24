import { request } from "@/shared/api";

export interface Organization {
  id: string;
  name: string;
  seatLimit: number | null;
  createdAt: string;
}

export function getMyOrganization() {
  return request<Organization>("organizations/me");
}
