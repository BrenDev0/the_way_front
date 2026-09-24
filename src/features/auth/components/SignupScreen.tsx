"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { clearResources, errorMessage } from "@/shared/api";
import { saveUser } from "@/shared/session";
import { AuthShell, Busy, Field, Scramble, TerminalBox } from "@/shared/ui";
import { login, register, requestVerification } from "../api";

type Step = "email" | "verify";

const MIN_PASSWORD = 8;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (step !== "verify") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;

  async function sendCode() {
    const { expiresAt: expiry } = await requestVerification(email.trim());
    setExpiresAt(Date.parse(expiry));
    setNow(Date.now());
    setNotice(`Código enviado a ${email.trim()}`);
  }

  async function onRequestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) return setError("Ingresa un correo válido.");

    setBusy(true);
    try {
      await sendCode();
      setStep("verify");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await sendCode();
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code)) return setError("El código de verificación tiene 6 dígitos.");
    if (organizationName.trim().length < 2) return setError("El nombre de la organización necesita al menos 2 caracteres.");
    if (password.length < MIN_PASSWORD) return setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError("Las contraseñas no coinciden.");

    setBusy(true);
    try {
      await register({
        organizationName: organizationName.trim(),
        email: email.trim(),
        password,
        verificationCode: code,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    try {
      const { user } = await login(email.trim(), password);
      clearResources();
      saveUser(user);
      router.replace("/home");
    } catch {
      router.replace("/login");
    }
  }

  function backToEmail() {
    setStep("email");
    setError(null);
    setNotice(null);
    setCode("");
  }

  return (
    <AuthShell>
      <TerminalBox
        title={<Scramble text={step === "email" ? "IDENTIDAD :: SOLICITUD" : "IDENTIDAD :: VERIFICACIÓN"} />}
        status={step === "email" ? "paso 1/2 · identificar" : "paso 2/2 · verificar"}
      >
        <div className="stack">
          <div className="steps" aria-hidden="true">
            <span className={step === "email" ? "steps__item--active" : "steps__item--done"}>
              {step === "email" ? "[01]" : "[✓]"} identificar
            </span>
            <span className="steps__line" />
            <span className={step === "verify" ? "steps__item--active" : ""}>[02] verificar</span>
          </div>

          {step === "email" ? (
            <form className="stack" onSubmit={onRequestCode} noValidate>
              <Field
                label="correo"
                type="email"
                autoComplete="email"
                placeholder="operador@dominio.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hint="enviaremos un código de acceso de 6 dígitos a este correo"
                autoFocus
                required
              />
              {error && (
                <p className="alert alert--error" role="alert">
                  ! {error}
                </p>
              )}
              <button className="btn" type="submit" disabled={busy}>
                {busy ? <Busy words={["TRANSMITIENDO", "ENRUTANDO", "CODIFICANDO"]} /> : "Enviar código"}
              </button>
            </form>
          ) : (
            <form className="stack" onSubmit={onRegister} noValidate>
              {notice && (
                <p className="alert alert--ok" role="status">
                  ✓ {notice}
                </p>
              )}
              <Field
                label="código de verificación"
                className="field__input--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                hint={
                  <span className="row-between">
                    <span className={remaining > 0 ? "" : "warn"}>
                      {remaining > 0 ? `expira en ${formatCountdown(remaining)}` : "código expirado"}
                    </span>
                    <button type="button" className="linkbtn" onClick={onResend} disabled={resending || busy}>
                      {resending ? "reenviando..." : "reenviar código"}
                    </button>
                  </span>
                }
                autoFocus
                required
              />
              <Field
                label="organización"
                autoComplete="organization"
                placeholder="xplorers"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
              <Field
                label="contraseña"
                revealable
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={`mínimo ${MIN_PASSWORD} caracteres`}
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
                {busy ? <Busy words={["APROVISIONANDO", "COMPILANDO", "CIFRANDO"]} /> : "Crear identidad"}
              </button>
              <div className="row-between">
                <span>{email.trim()}</span>
                <button type="button" className="linkbtn" onClick={backToEmail} disabled={busy}>
                  cambiar correo
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="switch">
          ¿ya tienes acceso? <Link href="/login">inicia sesión ❯</Link>
        </p>
      </TerminalBox>
    </AuthShell>
  );
}
