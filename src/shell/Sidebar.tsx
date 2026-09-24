"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/features/organization";
import { ADMIN_ROLES, ROLE_LABELS, useSession } from "@/shared/session";
import { Busy, Logo } from "@/shared/ui";

interface NavItem {
  label: string;
  href?: string;
}

const NAV: NavItem[] = [
  { label: "inicio", href: "/home" },
  { label: "conocimiento", href: "/knowledge" },
  { label: "operadores", href: "/members" },
  { label: "skills" },
  { label: "llaves api" },
  { label: "organización" },
];

export function Sidebar({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const pathname = usePathname();
  const user = useSession();
  const { data: organization } = useOrganization();
  const [leaving, setLeaving] = useState(false);
  const isAdmin = ADMIN_ROLES.includes(user.role);

  async function handleSignOut() {
    setLeaving(true);
    await onSignOut();
  }

  return (
    <aside className="sidebar">
      <Link href={isAdmin ? "/home" : "/welcome"} className="sidebar__brand" aria-label="Inicio">
        <Logo />
      </Link>

      {isAdmin && <nav className="nav" aria-label="Principal">
        {NAV.map((item) => {
          if (!item.href) {
            return (
              <span key={item.label} className="nav__item nav__item--disabled" aria-disabled="true">
                <span className="nav__prompt" aria-hidden="true">
                  ❯
                </span>
                {item.label}
                <span className="nav__tag">pronto</span>
              </span>
            );
          }
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={active ? "nav__item nav__item--active" : "nav__item"}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav__prompt" aria-hidden="true">
                ❯
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>}

      <div className="sidebar__footer">
        <div className="sidebar__org">{organization?.name ?? "···"}</div>
        <div className="sidebar__user">{user.email}</div>
        <div className="sidebar__role">{ROLE_LABELS[user.role]}</div>
        <button className="btn btn--ghost btn--small" type="button" onClick={handleSignOut} disabled={leaving}>
          {leaving ? <Busy words={["DESCONECTANDO"]} /> : "Desconectar"}
        </button>
      </div>
    </aside>
  );
}
