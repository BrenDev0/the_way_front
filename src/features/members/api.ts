import { request } from "@/shared/api";
import type { User } from "@/shared/session";

export function listMembers() {
  return request<User[]>("users");
}
