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
  icon: string;
}

const NAV: NavItem[] = [
  { label: "inicio", href: "/home", icon: "⌂" },
  { label: "mi cx", href: "/cx", icon: "◫" },
  { label: "conocimiento", href: "/knowledge", icon: "▤" },
  { label: "biblioteca", href: "/library", icon: "▣" },
  { label: "operadores", href: "/members", icon: "◎" },
  { label: "skills", href: "/skills", icon: "◇" },
  { label: "llaves api", href: "/api-keys", icon: "⚿" },
  { label: "organización", href: "/organization", icon: "▦" },
];

export function Sidebar({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const pathname = usePathname();
  const user = useSession();
  const { data: organization } = useOrganization();
  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
      <span className="sidebar__caption">CONSOLA DE GESTIÓN / 01</span>
      {isAdmin && <button className="btn btn--ghost sidebar__toggle" aria-expanded={expanded} aria-controls="main-navigation" onClick={() => setExpanded(!expanded)}>{expanded ? "Cerrar menú −" : "Navegación +"}</button>}

      {isAdmin && <nav id="main-navigation" className={`nav ${expanded ? "nav--expanded" : ""}`} aria-label="Principal">
        {NAV.map((item) => {
          if (!item.href) {
            return (
              <span key={item.label} className="nav__item nav__item--disabled" aria-disabled="true">
                <span className="nav__prompt" aria-hidden="true">
                  {item.icon}
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
              onClick={() => setExpanded(false)}
              className={active ? "nav__item nav__item--active" : "nav__item"}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav__prompt" aria-hidden="true">
                {item.icon}
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
