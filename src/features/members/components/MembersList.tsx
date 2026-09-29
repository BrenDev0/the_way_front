"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrganization } from "@/features/organization";
import { errorMessage } from "@/shared/api";
import { formatRelative } from "@/shared/format";
import { ROLE_LABELS, useSession } from "@/shared/session";
import { Spinner } from "@/shared/ui";
import { refreshMembers, useMembers } from "../hooks";

export function MembersList() {
  const currentUser = useSession();
  const { data, loading, error } = useMembers();
  const { data: organization } = useOrganization();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = data?.filter((member) => member.email.toLowerCase().includes(query.toLowerCase()) && (status === "all" || (status === "ready" ? member.setupComplete : !member.setupComplete)));
  const seatLimit = organization?.seatLimit;
  const seatsUsed = data?.length ?? 0;

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshMembers();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="members-card" aria-labelledby="members-title">
      <div className="members-card__hero">
        <div className="members-card__intro">
          <div className="members-card__eyebrow">
            <span className="members-card__pulse" aria-hidden="true" />
            DIRECTORIO / ACCESO ACTIVO
          </div>
          <h2 id="members-title" className="members-card__title">Tu equipo, en un solo lugar.</h2>
          <p className="members-card__copy">Personas con acceso a {organization?.name ?? "tu organización"}.</p>
        </div>
        <div className="members-card__metric" aria-label={data ? `${seatsUsed} operadores activos` : "Cargando operadores activos"}>
          <span className="members-card__metric-label">OPERADORES ACTIVOS</span>
          <span className="members-card__metric-number">{data ? String(seatsUsed).padStart(2, "0") : "--"}</span>
          <span className="members-card__metric-bottom">
            {seatLimit != null ? `DE ${seatLimit} ASIENTOS` : "EN TU ORGANIZACIÓN"}
          </span>
          {seatLimit != null && seatLimit > 0 && data && (
            <span className="members-card__meter" aria-hidden="true">
              <span style={{ width: `${Math.min((seatsUsed / seatLimit) * 100, 100)}%` }} />
            </span>
          )}
        </div>
      </div>

      <div className="members-card__directory">
        <div className="members-card__toolbar">
          <h3>Directorio <span>{data ? `(${seatsUsed})` : ""}</span></h3>
          <button className="members-card__refresh" type="button" onClick={refresh} disabled={loading || refreshing}>
            <span aria-hidden="true">↻</span> {refreshing ? "actualizando..." : "actualizar lista"}
          </button>
        </div>
        {error ? <p className="alert alert--error" role="alert">! {errorMessage(error)}</p> : null}
        <div className="directory-filters">
          <label className="field">Buscar operador<input className="field__input" type="search" placeholder="Buscar por correo…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="field">Configuración<select className="field__input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todo el equipo</option><option value="ready">Listos para IA</option><option value="pending">Necesitan configuración</option></select></label>
        </div>
        {loading ? (
          <p className="empty members-card__empty"><Spinner /> cargando operadores</p>
        ) : !data?.length ? (
          <p className="empty members-card__empty">no hay operadores activos</p>
        ) : (
          <ul className="members-list">
            {!filtered?.length && <li className="empty">No hay operadores que coincidan con los filtros.</li>}
            {filtered?.map((member, index) => (
              <li key={member.id} className="members-list__row">
                <span className="members-list__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className={`members-list__avatar members-list__avatar--${member.role}`} aria-hidden="true">
                  {member.email.charAt(0).toUpperCase()}
                </span>
                <span className="members-list__identity">
                  <span className="members-list__email-line">
                    <span className="members-list__email" title={member.email}>{member.email}</span>
                    {member.id === currentUser.id && <span className="members-list__you">TÚ</span>}
                  </span>
                  <span className="members-list__joined">se unió {formatRelative(member.createdAt)}</span>
                </span>
                <span className="members-list__status">
                  <span className={`console-badge ${member.setupComplete ? "console-badge--ready" : "console-badge--pending"}`}>{member.setupComplete ? "Listo para usar IA" : "Necesita configuración"}</span>
                </span>
                <span className={`members-list__role members-list__role--${member.role}`}>
                  <span aria-hidden="true">●</span> {ROLE_LABELS[member.role]}
                </span>
                <Link className="member-action" href={`/api-keys?userId=${encodeURIComponent(member.id)}`}>Gestionar llaves <span aria-hidden="true">↗</span></Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
