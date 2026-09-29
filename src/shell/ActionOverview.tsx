"use client";

import Link from "next/link";
import { useMembers } from "@/features/members/hooks";
import { useInvitations } from "@/features/invitations/hooks";
import { useDocuments } from "@/features/knowledge/hooks";

export function ActionOverview() {
  const members = useMembers();
  const invitations = useInvitations();
  const documents = useDocuments();
  const actions = [
    { label: "Configurar equipo", detail: "personas necesitan una llave de IA", href: "/members", count: members.data?.filter((m) => !m.setupComplete).length, error: members.error },
    { label: "Revisar invitaciones", detail: "invitaciones pendientes", href: "/members", count: invitations.data?.length, error: invitations.error },
    { label: "Entrenar conocimiento", detail: "documentos listos para entrenar", href: "/knowledge", count: documents.data?.filter((d) => d.status === "extracted").length, error: documents.error },
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
