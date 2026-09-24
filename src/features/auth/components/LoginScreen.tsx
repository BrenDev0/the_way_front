"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clearResources, errorMessage } from "@/shared/api";
import { saveUser } from "@/shared/session";
import { AuthShell, Busy, Field, Scramble, TerminalBox } from "@/shared/ui";
import { login } from "../api";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) return setError("Ingresa un correo válido.");
    if (!password) return setError("Ingresa tu contraseña.");

    setBusy(true);
    try {
      const { user } = await login(email.trim(), password);
      clearResources();
      saveUser(user);
      router.replace(user.role === "member" ? "/welcome" : "/home");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <TerminalBox
        title={<Scramble text="AUTH :: ACCESO" />}
        status={busy ? "handshake en progreso" : "esperando credenciales"}
      >
        <form className="stack" onSubmit={onSubmit} noValidate>
          <Field
            label="correo"
            type="email"
            autoComplete="email"
            placeholder="admin@dominio.io"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
          <Field
            label="contraseña"
            revealable
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className="alert alert--error" role="alert">
              ! {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <Busy words={["AUTENTICANDO", "CONECTANDO", "DESCIFRANDO"]} /> : "Conectar"}
          </button>
        </form>
        <p className="switch">
          ¿sin identidad? <Link href="/signup">crea una ❯</Link>
        </p>
      </TerminalBox>
    </AuthShell>
  );
}
