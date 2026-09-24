"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { logout } from "@/features/auth";
import { useOrganization } from "@/features/organization";
import { ApiError, clearResources } from "@/shared/api";
import { SessionProvider, clearUser, loadUser, type User } from "@/shared/session";
import { Busy } from "@/shared/ui";
import { Sidebar } from "./Sidebar";

function useSignOut() {
  const router = useRouter();
  return useCallback(async () => {
    try {
      await logout();
    } catch {}
    clearUser();
    clearResources();
    router.replace("/login");
  }, [router]);
}

function SessionGuard({ onExpired }: { onExpired: () => void }) {
  const { error } = useOrganization();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) onExpired();
  }, [error, onExpired]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSignOut();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = loadUser();
    if (stored) setUser(stored);
    else signOut();
  }, [signOut]);

  useEffect(() => {
    if (user?.role === "member" && pathname !== "/welcome") router.replace("/welcome");
  }, [pathname, router, user]);

  if (!user || (user.role === "member" && pathname !== "/welcome")) {
    return (
      <div className="boot">
        <Busy words={["INICIANDO", "CARGANDO", "SINCRONIZANDO"]} />
      </div>
    );
  }

  return (
    <SessionProvider user={user}>
      <SessionGuard onExpired={signOut} />
      <div className="app">
        <Sidebar onSignOut={signOut} />
        <main className="app__main">{children}</main>
      </div>
    </SessionProvider>
  );
}
