"use client";

import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { formatRelative } from "@/shared/format";
import { ROLE_LABELS } from "@/shared/session";
import { ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import { createInvitation, revokeInvitation, type Invitation, type InviteRole } from "../api";
import { refreshInvitations, useInvitations } from "../hooks";

type Feedback = { tone: "ok" | "error"; message: string } | null;

function InvitationRow({ invitation, onFeedback }: { invitation: Invitation; onFeedback: (f: Feedback) => void }) {
  const [resending, setResending] = useState(false);

  async function resend() {
    setResending(true);
    onFeedback(null);
    try {
      await createInvitation(invitation.email, invitation.role as InviteRole);
      onFeedback({ tone: "ok", message: `Invitación reenviada a ${invitation.email}` });
      await refreshInvitations();
    } catch (err) {
      onFeedback({ tone: "error", message: errorMessage(err) });
      setResending(false);
    }
  }

  async function revoke() {
    onFeedback(null);
    try {
      await revokeInvitation(invitation.id);
      onFeedback({ tone: "ok", message: `Invitación a ${invitation.email} revocada` });
      await refreshInvitations();
    } catch (err) {
      onFeedback({ tone: "error", message: errorMessage(err) });
    }
  }

  return (
    <li className="rail__item">
      <span className="rail__glyph" aria-hidden="true">
        ✉
      </span>
      <span className="rail__title">{invitation.email}</span>
      <span className="status status--pending">{ROLE_LABELS[invitation.role]}</span>
      <span className="rail__meta rail__meta--actions">
        <span>expira {formatRelative(invitation.expiresAt)}</span>
        <span className="rail__actions">
          <button type="button" className="linkbtn" onClick={resend} disabled={resending}>
            {resending ? "reenviando..." : "reenviar"}
          </button>
          <ConfirmButton question="¿revocar?" onConfirm={revoke} disabled={resending}>
            revocar
          </ConfirmButton>
        </span>
      </span>
    </li>
  );
}

export function PendingInvitations() {
  const { data, loading, error } = useInvitations();
  const [feedback, setFeedback] = useState<Feedback>(null);

  return (
    <TerminalBox wide title="INVITACIONES PENDIENTES" status={data ? `${data.length} pendientes` : undefined}>
      <div className="stack">
        {feedback && (
          <p className={`alert alert--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
            {feedback.tone === "error" ? "!" : "✓"} {feedback.message}
          </p>
        )}
        {loading ? (
          <p className="empty">
            <Spinner /> cargando invitaciones
          </p>
        ) : error && !data ? (
          <p className="alert alert--error">! {errorMessage(error)}</p>
        ) : !data?.length ? (
          <p className="empty">no hay invitaciones pendientes</p>
        ) : (
          <ul className="rail">
            {data.map((invitation) => (
              <InvitationRow key={invitation.id} invitation={invitation} onFeedback={setFeedback} />
            ))}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}
