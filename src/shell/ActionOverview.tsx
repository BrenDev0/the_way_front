"use client";

import Link from "next/link";
import { useInvitations } from "@/features/invitations/hooks";
import { isAvailable } from "@/features/knowledge/api";
import { useDocuments } from "@/features/knowledge/hooks";

export function ActionOverview() {
  const invitations = useInvitations();
  const documents = useDocuments();
  const actions = [
    { label: "Revisar invitaciones", detail: "Invitaciones pendientes", href: "/members", count: invitations.data?.length, error: invitations.error },
    { label: "Describir conocimiento", detail: "Documentos sin descripción", href: "/knowledge", count: documents.data?.filter((d) => isAvailable(d) && !d.description.trim()).length, error: documents.error },
  ];
  return <section className="action-overview" aria-label="Acciones pendientes">
    <div className="console-section-label">01 / SIGUIENTES ACCIONES <span>Tu centro de operaciones</span></div>
    <div className="action-grid">{actions.map((action, index) => <Link key={action.label} href={action.href} className="action-card">
      <span className="action-card__index">0{index + 1} <span aria-hidden="true">↗</span></span>
      <strong>{action.error ? "—" : action.count ?? "…"}</strong>
      <span>{action.error ? "Datos no disponibles" : action.detail}</span>
      <b>{action.label}</b>
    </Link>)}</div>
  </section>;
}
