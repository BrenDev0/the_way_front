"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clearResources, errorMessage } from "@/shared/api";
import { saveUser } from "@/shared/session";
import { AuthShell, Busy, Field, Scramble, TerminalBox } from "@/shared/ui";
import { acceptInvitation, login } from "../api";

const MIN_PASSWORD = 8;

export function AcceptInviteScreen({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (password.length < MIN_PASSWORD) return setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError("Las contraseñas no coinciden.");

    setBusy(true);
    let email: string;
    try {
      email = (await acceptInvitation(token, password)).email;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    try {
      const { user } = await login(email, password);
      clearResources();
      saveUser(user);
      router.replace("/welcome");
    } catch {
      setAcceptedEmail(email);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <TerminalBox title={<Scramble text={acceptedEmail ? "INVITACIÓN :: ACTIVADA" : "INVITACIÓN :: ACEPTAR"} />} status={acceptedEmail ? "cuenta creada" : token ? "define tu contraseña" : "enlace inválido"}>
        {acceptedEmail ? (
          <div className="stack">
            <p className="alert alert--ok" role="status">✓ Tu cuenta para {acceptedEmail} está lista.</p>
            <p className="field__hint">No pudimos iniciar tu sesión automáticamente. Entra con la contraseña que acabas de crear.</p>
            <Link className="btn invite-login-link" href="/login">Iniciar sesión</Link>
          </div>
        ) : token ? (
          <form className="stack" onSubmit={onSubmit} noValidate>
            <div className="steps" aria-hidden="true">
              <span className="steps__item--active">[01] activar cuenta</span>
              <span className="steps__line" />
              <span>[02] entrar al equipo</span>
            </div>
            <p className="field__hint">Te invitaron a unirte a una organización en THE WAY. Crea tu contraseña para acceder al espacio compartido del equipo.</p>
            <Field
              label="contraseña"
              revealable
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={`mínimo ${MIN_PASSWORD} caracteres`}
              autoFocus
              required
            />
            <Field
              label="confirmar contraseña"
              revealable
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {error && (
              <p className="alert alert--error" role="alert">
                ! {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? <Busy words={["ACTIVANDO", "PROVISIONANDO", "CONECTANDO"]} /> : "Unirme"}
            </button>
          </form>
        ) : (
          <p className="alert alert--error" role="alert">
            ! El enlace de invitación no es válido. Revisa el correo o pide una nueva invitación.
          </p>
        )}
        {!acceptedEmail && (
          <p className="switch">
            ¿ya tienes cuenta? <Link href="/login">inicia sesión ❯</Link>
          </p>
        )}
      </TerminalBox>
    </AuthShell>
  );
}
