"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMembers, refreshMembers } from "@/features/members/hooks";
import { errorMessage, revalidate, useResource } from "@/shared/api";
import { useSession } from "@/shared/session";
import { Busy, ConfirmButton, Field, Spinner, TerminalBox } from "@/shared/ui";
import { deleteApiKey, issueApiKey, listApiKeys, type Provider } from "../api";

// Keep in sync with the backend's provider catalog. Empty selection uses its default.
const MODELS: Record<Provider, string[]> = {
  anthropic: ["claude-opus-5", "claude-sonnet-5", "claude-fable-5-1", "claude-haiku-4-5-20251001"],
  openai: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini", "o3", "o3-mini"],
  gohighlevel: [],
};

export function ApiKeysManager({ initialUserId = "" }: { initialUserId?: string }) {
  const currentUser = useSession();
  const editor = useRef<HTMLDivElement>(null);
  const members = useMembers();
  const keys = useResource("api-keys", () => listApiKeys());
  const [userId, setUserId] = useState(initialUserId);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const selected = members.data?.find((member) => member.id === userId);
  const replacing = keys.data?.some((key) => key.userId === userId && key.provider === provider);
  const providers: { id: Provider; name: string; detail: string; glyph: string }[] = [
    { id: "anthropic", name: "Anthropic", detail: "Inteligencia artificial", glyph: "A" },
    { id: "openai", name: "OpenAI", detail: "Inteligencia artificial", glyph: "◉" },
    { id: "gohighlevel", name: "GoHighLevel", detail: "Conexión con tu CRM", glyph: "↗" },
  ];

  function configure(target: Provider) {
    setProvider(target); setModel(""); setSecret(""); setAccountId("");
    editor.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    editor.current?.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
  }

  async function refresh(target: string) {
    await Promise.all([revalidate("api-keys"), revalidate(`api-keys:${target}`), refreshMembers()]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFeedback(null);
    if (!selected || !secret.trim() || (provider === "gohighlevel" && !accountId.trim())) {
      setFeedback({ error: true, message: "Selecciona una persona y completa los campos requeridos." });
      return;
    }
    setBusy(true);
    try {
      await issueApiKey({ userId, provider, secret: secret.trim(), ...(provider === "gohighlevel" ? { accountId: accountId.trim() } : model ? { model } : {}) });
      setSecret("");
      setAccountId("");
      setFeedback({ error: false, message: "Llave guardada. La configuración del equipo se ha actualizado." });
      await refresh(userId);
    } catch (error) {
      setFeedback({ error: true, message: errorMessage(error) });
    } finally { setBusy(false); }
  }

  async function remove(id: string, target: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await deleteApiKey(id);
      setFeedback({ error: false, message: "Llave revocada." });
      await refresh(target);
    } catch (error) {
      setFeedback({ error: true, message: errorMessage(error) });
    } finally { setBusy(false); }
  }

  return <div className="stack">
    {feedback && <p className={`alert alert--${feedback.error ? "error" : "ok"}`} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
    <div className="credentials-layout">
    <aside className="credentials-person">
      <span className="console-section-label">01 / IDENTIDAD</span>
      <h2>Acceso del equipo</h2>
      <p className="field__hint">Selecciona una persona para configurar sus proveedores.</p>
      {members.error ? <p role="alert">{errorMessage(members.error)} <button onClick={members.reload}>Reintentar</button></p> : null}
      {members.loading ? <Spinner /> : <>
        <label className="field">Persona
          <select className="field__input" value={userId} onChange={(event) => { setUserId(event.target.value); setSecret(""); setAccountId(""); }} required disabled={busy}>
            <option value="">Seleccionar persona</option>
            {members.data?.map((member) => <option key={member.id} value={member.id}>{member.id === currentUser.id ? "Yo" : member.email}</option>)}
          </select>
        </label>
        {selected && <div className="credentials-person__summary"><span className="identity-mark" aria-hidden="true">{selected.email[0].toUpperCase()}</span><strong>{selected.id === currentUser.id ? "Yo" : selected.email}</strong><span className={`console-badge ${selected.setupComplete ? "console-badge--ready" : "console-badge--pending"}`}>{selected.setupComplete ? "Listo para usar IA" : "Necesita una llave de IA"}</span></div>}
      </>}
      <p className="field__hint">Una llave de IA habilita el acceso. Las credenciales completas permanecen ocultas después de guardarse.</p>
    </aside>
    <div className="credentials-workspace">
    <div className="console-section-label">02 / PROVEEDORES <span>{selected ? "Configura su espacio de trabajo" : "Selecciona una persona"}</span></div>
    <div className="provider-grid">{providers.map((item) => {
      const key = keys.data?.find((entry) => entry.userId === userId && entry.provider === item.id);
      return <section className={`provider-card ${provider === item.id ? "provider-card--selected" : ""}`} key={item.id} aria-label={item.name}>
        <div className="provider-card__top"><span className="provider-card__glyph" aria-hidden="true">{item.glyph}</span><span className={`console-badge ${key ? "console-badge--ready" : ""}`}>{!selected ? "Sin selección" : keys.loading ? "Cargando" : keys.error ? "No disponible" : key ? "Configurado" : "Sin configurar"}</span></div>
        <h3>{item.name}</h3><p>{item.detail}</p>
        <code>{key ? `••••${key.lastFour}` : "— — — —"}</code>
        <span className="provider-card__model">{key?.model ?? (item.id === "gohighlevel" ? "Ubicación de GoHighLevel" : "Modelo del servidor")}</span>
        <button className="btn btn--ghost btn--small" disabled={busy || !selected || keys.loading || Boolean(keys.error)} onClick={() => configure(item.id)}>{key ? "Reemplazar" : "Configurar"} <span aria-hidden="true">↗</span></button>
      </section>;
    })}</div>
    <div ref={editor}>
    <TerminalBox wide title="03 / ASIGNAR LLAVE">
      <form className="stack" onSubmit={save}>
        <label className="field">Proveedor
          <select className="field__input" value={provider} disabled={busy} onChange={(event) => { setProvider(event.target.value as Provider); setModel(""); setSecret(""); setAccountId(""); }}>
            <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="gohighlevel">GoHighLevel</option>
          </select>
        </label>
        {provider === "gohighlevel" ? <Field label="ID de ubicación" value={accountId} onChange={(event) => setAccountId(event.target.value)} required disabled={busy} autoComplete="off" /> :
          <label className="field">Modelo
            <select className="field__input" value={model} onChange={(event) => setModel(event.target.value)} disabled={busy}>
              <option value="">Predeterminado del servidor</option>
              {MODELS[provider].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>}
        <Field label="Llave secreta" type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} required disabled={busy} />
        <p className="field__hint">Solo se muestran los últimos cuatro caracteres de las llaves guardadas. GoHighLevel no habilita IA; asigna Anthropic u OpenAI. Si hay ambos, el servidor prioriza Anthropic.</p>
        {replacing && <p className="alert alert--warn">Al guardar reemplazarás la llave actual de este proveedor para esta persona.</p>}
        <button className="btn" disabled={busy || !selected || keys.loading || Boolean(keys.error) || Boolean(members.error)}>{busy ? <Busy words={["GUARDANDO"]} /> : replacing ? "Reemplazar llave" : "Guardar llave"}</button>
      </form>
    </TerminalBox>
    </div>
    <TerminalBox wide title="LLAVES ASIGNADAS">
      {keys.error ? <p role="alert">{errorMessage(keys.error)} <button onClick={keys.reload}>Reintentar</button></p> : null}
      {keys.loading ? <Spinner /> : !keys.data?.length ? <p>No hay llaves asignadas.</p> : <ul className="rail">
        {keys.data.filter((key) => !userId || key.userId === userId).map((key) => <li key={key.id} className="stack">
          <strong>{key.userId === currentUser.id ? "Yo" : members.data?.find((member) => member.id === key.userId)?.email ?? key.userId}</strong>
          <span>{key.provider} · ••••{key.lastFour}{key.model ? ` · ${key.model}` : ""}</span>
          <ConfirmButton question="¿Revocar esta llave?" disabled={busy} onConfirm={() => remove(key.id, key.userId)}>Revocar</ConfirmButton>
        </li>)}
      </ul>}
      {userId && keys.data && keys.data.length > 0 && !keys.data.some((key) => key.userId === userId) && <p>Esta persona no tiene llaves asignadas.</p>}
    </TerminalBox>
    </div>
    </div>
  </div>;
}
