"use client";

import Link from "next/link";
import { useOrganization } from "@/features/organization";
import { ADMIN_ROLES, ROLE_LABELS, useSession } from "@/shared/session";

export default function InviteWelcomePage() {
  const user = useSession();
  const { data: organization, loading: organizationLoading } = useOrganization();
  const canManage = ADMIN_ROLES.includes(user.role);

  return (
    <div className="dash invite-welcome">
      <section className="invite-welcome__hero" aria-labelledby="invite-welcome-title">
        <p className="invite-welcome__eyebrow"><span aria-hidden="true">✦</span> INVITACIÓN ACEPTADA / ACCESO CONCEDIDO</p>
        <h1 id="invite-welcome-title">Ya formas parte del equipo.</h1>
        <p>Tu espacio en {organization?.name ?? "la organización"} está listo. El conocimiento compartido le da contexto al agente para apoyar el trabajo de todos.</p>
        {canManage ? (
          <Link href="/home" className="btn invite-welcome__primary">Entrar a mi espacio <span aria-hidden="true">↗</span></Link>
        ) : (
          <p>Tu espacio de trabajo será THE WAY Desktop. Tu cuenta ya está activada.</p>
        )}
        <span className="invite-welcome__mark" aria-hidden="true">✓</span>
      </section>

      <section className="invite-welcome__details" aria-label="Tu acceso">
        <div className="invite-welcome__detail">
          <span className="invite-welcome__number">01 / IDENTIDAD</span>
          <strong>{user.email}</strong>
          <span>Tu cuenta está activa como {ROLE_LABELS[user.role]}.</span>
        </div>
        <div className="invite-welcome__detail">
          <span className="invite-welcome__number">02 / ORGANIZACIÓN</span>
          <strong>{organization?.name ?? (organizationLoading ? "Cargando organización..." : "Tu organización")}</strong>
          <span>Trabajas dentro del espacio compartido de tu equipo.</span>
        </div>
        <div className="invite-welcome__detail">
          <span className="invite-welcome__number">03 / CONOCIMIENTO</span>
          <strong>Contexto compartido</strong>
          <span>El agente puede consultar las fuentes entrenadas de tu organización.</span>
        </div>
      </section>

      {canManage && (
        <section className="invite-welcome__manage" aria-labelledby="invite-welcome-manage-title">
          <div>
            <p className="invite-welcome__number">TU ROL / GESTIÓN</p>
            <h2 id="invite-welcome-manage-title">Prepara el espacio para tu equipo.</h2>
            <p>Como {ROLE_LABELS[user.role]}, puedes gestionar las fuentes de conocimiento y consultar el directorio de operadores.</p>
          </div>
          <div className="invite-welcome__links">
            <Link href="/knowledge">Explorar conocimiento <span aria-hidden="true">↗</span></Link>
            <Link href="/members">Ver operadores <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      )}
    </div>
  );
}
