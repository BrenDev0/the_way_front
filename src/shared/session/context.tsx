"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role, User } from "./store";

const SessionContext = createContext<User | null>(null);

export function SessionProvider({ user, children }: { user: User; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside SessionProvider");
  return user;
}

export function useHasRole(roles: Role[]) {
  return roles.includes(useSession().role);
}

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  return <>{useHasRole(roles) ? children : fallback}</>;
}
