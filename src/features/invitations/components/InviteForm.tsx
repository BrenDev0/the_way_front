"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/api";
import { ROLE_LABELS, useSession } from "@/shared/session";
import { Busy, Field, Segmented, TerminalBox } from "@/shared/ui";
import { createInvitation, type InviteRole } from "../api";
import { refreshInvitations } from "../hooks";

export function InviteForm() {
  const user = useSession();
  const roles: InviteRole[] = user.role === "owner" ? ["member", "admin"] : ["member"];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const target = email.trim();
    if (!target.includes("@")) return setError("Ingresa un correo válido.");

    setBusy(true);
    try {
      await createInvitation(target, role);
      setNotice(`Invitación enviada a ${target}`);
      setEmail("");
      await refreshInvitations();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerminalBox wide title="INVITAR OPERADOR" status="la invitación expira en 7 días">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field
          label="correo"
          type="email"
          autoComplete="off"
          placeholder="nuevo@dominio.io"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {roles.length > 1 ? (
          <Segmented
            label="rol"
            value={role}
            options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            onChange={setRole}
            disabled={busy}
          />
        ) : (
          <p className="field__hint">se unirá como {ROLE_LABELS.member}</p>
        )}
        {error && (
          <p className="alert alert--error" role="alert">
            ! {error}
          </p>
        )}
        {notice && (
          <p className="alert alert--ok" role="status">
            ✓ {notice}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? <Busy words={["TRANSMITIENDO", "ENRUTANDO"]} /> : "Enviar invitación"}
        </button>
      </form>
    </TerminalBox>
  );
}
