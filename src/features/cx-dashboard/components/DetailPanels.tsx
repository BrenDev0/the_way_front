"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { errorMessage, useResource } from "@/shared/api";
import { Busy, Spinner } from "@/shared/ui";
import {
  getAds,
  getConversation,
  getPosts,
  replyConversation,
  type AdDetail,
  type ConversationDetail,
  type ConversationMessage,
  type PeriodDays,
  type PostDetail,
} from "../api";
import { count, money, share, waited } from "../format";
import { RankedBars } from "./charts";
import { network } from "./TabCards";

// --- the panel ------------------------------------------------------------------------

/** A side panel over the dashboard: Escape or the close button shuts it, focus moves in
 *  when it opens and back to what opened it when it closes. */
export function Panel({ title, subtitle, onClose, children }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // the latest onClose, without re-running the effect -- which would bounce focus
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="panel__backdrop" onClick={onClose}>
      <div ref={ref} className="panel" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="panel__head">
          <div>
            <h2 id={id} className="panel__title">
              {title}
            </h2>
            {subtitle && <div className="cx__muted">{subtitle}</div>}
          </div>
          <button type="button" className="btn btn--small btn--ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="panel__body">{children}</div>
      </div>
    </div>
  );
}

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
}

// --- a conversation -------------------------------------------------------------------

const REJECTED = "El CX no envió el mensaje.";

const WINDOW_CHANNELS: Record<string, string> = { WhatsApp: "WhatsApp", IG: "Instagram", FB: "Messenger" };

function hoursSince(iso: string) {
  return (Date.now() - Date.parse(iso)) / 3_600_000;
}

/** Why a reply cannot go out on a Meta channel, said the way the rule works. */
function ClosedWindow({ channel, lastInbound }: { channel: string; lastInbound: string | null }) {
  return (
    <div className="chat__closed" role="status">
      <p>
        <span aria-hidden="true">🔒 </span>
        <strong>La ventana de 24 h de {channel} está cerrada.</strong>{" "}
        {lastInbound ? `El cliente escribió por última vez hace ${waited(hoursSince(lastInbound))}.` : "El cliente no ha escrito recientemente."}
      </p>
      <p className="cx__muted">
        {channel} solo permite responder libremente en las 24 horas siguientes al último mensaje del cliente. Para retomar la conversación, envía una plantilla
        aprobada desde el CX; cuando el cliente conteste, podrás responder aquí.
      </p>
    </div>
  );
}
const STATUS: Record<string, string> = { delivered: "entregado", read: "leído", sent: "enviado", failed: "falló", pending: "enviando" };

function Bubble({ message }: { message: ConversationMessage }) {
  if (message.kind === "activity") {
    return (
      <li className="chat__activity">
        <span>{message.body}</span> · {when(message.date)}
      </li>
    );
  }
  const mine = message.direction === "outbound";
  return (
    <li className={mine ? "chat__bubble chat__bubble--out" : "chat__bubble chat__bubble--in"}>
      {message.body && <p className="chat__text">{message.body}</p>}
      {message.attachments.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="linkbtn">
          adjunto ↗
        </a>
      ))}
      <span className="chat__meta">
        {mine && (message.sender ?? (message.automated ? "automático" : "equipo"))}
        {mine && " · "}
        {message.channel} · {when(message.date)}
        {mine && message.status && ` · ${STATUS[message.status] ?? message.status}`}
      </span>
    </li>
  );
}

export function ConversationPanel({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { data, error, loading } = useResource(`cx-conversation:${id}`, () => getConversation(id));
  const [older, setOlder] = useState<ConversationMessage[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sent, setSent] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const end = useRef<HTMLLIElement>(null);

  const before = cursor === undefined ? data?.before ?? null : cursor;
  const messages = [...older, ...(data?.messages ?? []), ...sent];

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [data, sent.length]);

  async function loadOlder() {
    if (!before) return;
    setLoadingOlder(true);
    try {
      const page = await getConversation(id, before);
      setOlder((list) => [...page.messages, ...list]);
      setCursor(page.before);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !data) return;
    setSending(true);
    setProblem(null);
    try {
      const result = await replyConversation(id, text);
      if (result.sent) {
        setSent((list) => [
          ...list,
          { id: result.messageId ?? `sent-${list.length}`, direction: "outbound", kind: "message", channel: data.replyChannel ?? "", body: text, attachments: [], date: new Date().toISOString(), status: "sent", sender: "tú", automated: false },
        ]);
        setDraft("");
      } else {
        setProblem(
          result.reason === "unsupported_channel"
            ? "Este canal no se puede responder desde aquí; contesta en el CX."
            : result.reason === "window_closed"
              ? "La ventana de 24 h se cerró: el mensaje no se envió. Retoma la conversación con una plantilla desde el CX."
              : `${REJECTED} ${result.detail ?? ""}`.trim(),
        );
      }
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel
      title={data?.name ?? name}
      subtitle={data && [data.phone, data.email, data.assignedTo && `asignado a ${data.assignedTo}`].filter(Boolean).join(" · ")}
      onClose={onClose}
    >
      {loading ? (
        <p className="empty">
          <Spinner /> abriendo la conversación
        </p>
      ) : error && !data ? (
        <p className="alert alert--error">! {errorMessage(error)}</p>
      ) : data ? (
        <div className="chat">
          {data.tags.length > 0 && <p className="cx__muted">etiquetas: {data.tags.join(", ")}</p>}
          {before && (
            <button type="button" className="linkbtn chat__older" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? "cargando…" : "ver mensajes anteriores"}
            </button>
          )}
          <ul className="chat__messages" aria-label={`Mensajes con ${data.name}`}>
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            <li ref={end} aria-hidden="true" />
          </ul>
          {problem && (
            <p className="alert alert--error" role="alert">
              ! {problem}
            </p>
          )}
          {data.replyType && !data.replyWindow.open && data.replyWindow.reason === "window_closed" ? (
            <ClosedWindow channel={WINDOW_CHANNELS[data.replyType] ?? data.replyType} lastInbound={data.replyWindow.lastInbound} />
          ) : data.replyType ? (
            <form className="chat__reply" onSubmit={send}>
              <label htmlFor={`reply-${id}`} className="field__label">
                responder por {data.replyChannel}
              </label>
              <textarea
                id={`reply-${id}`}
                className="field__input"
                rows={3}
                maxLength={1600}
                value={draft}
                placeholder={`Escribe a ${data.name}…`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="chat__actions">
                <span className="cx__muted">
                  {data.replyWindow.closesAt
                    ? `quedan ${waited(Math.max(0, -hoursSince(data.replyWindow.closesAt)))} de la ventana de 24 h · `
                    : ""}
                  se envía al pulsar enviar · Ctrl+Enter
                </span>
                <button type="submit" className="btn btn--small" disabled={sending || !draft.trim()}>
                  {sending ? <Busy words={["ENVIANDO"]} /> : "enviar"}
                </button>
              </div>
            </form>
          ) : (
            <p className="cx__note">Este canal (email o llamada) se responde desde el CX.</p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

// --- posts ----------------------------------------------------------------------------

type Sort = "recent" | "engagement";

function Preview({ post, large = false }: { post: Pick<PostDetail, "thumbnail" | "video" | "platform">; large?: boolean }) {
  if (post.thumbnail) return <img src={post.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  if (post.video) return <video src={post.video} muted playsInline preload="metadata" controls={large} />;
  return <span aria-hidden="true">{network(post.platform).slice(0, 2)}</span>;
}

export function PostsCard({ days }: { days: PeriodDays }) {
  const { data, error, loading } = useResource(`cx-posts:${days}`, () => getPosts(days));
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [open, setOpen] = useState<PostDetail | null>(null);

  if (loading) {
    return (
      <p className="empty">
        <Spinner /> cargando publicaciones
      </p>
    );
  }
  if (error && !data) return <p className="alert alert--error">! {errorMessage(error)}</p>;
  if (!data?.posts.length) return <p className="empty">no hay publicaciones en este periodo.</p>;

  const shown = data.posts
    .filter((post) => filter === "all" || post.platform === filter)
    .sort((a, b) => (sort === "engagement" ? b.engagement - a.engagement : (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")));
  const unmeasured = new Set(data.networks.filter((n) => !n.measured).map((n) => n.name));

  return (
    <div className="stack">
      <div className="cx__filters">
        <label className="field">
          <span className="field__label">red</span>
          <select className="field__input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">todas ({count(data.posts.length)})</option>
            {data.networks.map((n) => (
              <option key={n.name} value={n.name}>
                {network(n.name)} ({count(n.count)})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">ordenar por</span>
          <select className="field__input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">más recientes</option>
            <option value="engagement">más interacciones</option>
          </select>
        </label>
      </div>
      <ul className="cx__postlist" aria-label="Todas las publicaciones">
        {shown.map((post) => (
          <li key={post.id}>
            <button type="button" className="cx__postrow" onClick={() => setOpen(post)}>
              <span className="cx__post-thumb">
                <Preview post={post} />
              </span>
              <span className="cx__post-body">
                <strong className="cx__post-title">{post.title}</strong>
                <span className="cx__muted">
                  {network(post.platform)}
                  {post.profiles.length ? ` · ${post.profiles.join(", ")}` : ""} · {post.format === "reel" ? "reel" : "publicación"} · {when(post.publishedAt)}
                </span>
              </span>
              <span className="cx__post-numbers">
                {unmeasured.has(post.platform) ? (
                  <span className="cx__muted">sin métricas</span>
                ) : (
                  <>
                    <strong>{count(post.engagement)}</strong>
                    <span className="cx__muted">
                      {count(post.likes)} ♥ · {count(post.comments)} 💬 · {count(post.shares)} ↻
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {unmeasured.size > 0 && (
        <p className="cx__note">{[...unmeasured].map(network).join(", ")} no reportan interacciones por publicación al CX.</p>
      )}
      {open && <PostPanel post={open} measured={!unmeasured.has(open.platform)} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function PostPanel({ post, measured, onClose }: { post: PostDetail; measured: boolean; onClose: () => void }) {
  return (
    <Panel title={post.title} subtitle={`${network(post.platform)} · ${when(post.publishedAt)}`} onClose={onClose}>
      <div className="stack">
        <div className="cx__post-media">
          <Preview post={post} large />
        </div>
        <dl className="cx__figures">
          <div>
            <dt>interacciones</dt>
            <dd>{measured ? count(post.engagement) : "—"}</dd>
          </div>
          <div>
            <dt>likes</dt>
            <dd>{measured ? count(post.likes) : "—"}</dd>
          </div>
          <div>
            <dt>comentarios</dt>
            <dd>{measured ? count(post.comments) : "—"}</dd>
          </div>
          <div>
            <dt>compartidos</dt>
            <dd>{measured ? count(post.shares) : "—"}</dd>
          </div>
        </dl>
        {!measured && <p className="cx__note">{network(post.platform)} no reporta interacciones por publicación al CX; míralas en la propia red.</p>}
        <dl className="cx__facts">
          <dt>perfil</dt>
          <dd>{post.profiles.join(", ") || "—"}</dd>
          <dt>formato</dt>
          <dd>{post.format === "reel" ? "reel / video corto" : "publicación"}</dd>
          <dt>estado</dt>
          <dd>{post.status ?? "—"}</dd>
          <dt>creada por</dt>
          <dd>{post.createdBy ?? "—"}</dd>
          {post.tags.length > 0 && (
            <>
              <dt>etiquetas</dt>
              <dd>{post.tags.join(", ")}</dd>
            </>
          )}
        </dl>
        <span className="cx__subtitle">texto</span>
        <p className="cx__caption">{post.caption || "(sin texto)"}</p>
        {post.link && (
          <a href={post.link} target="_blank" rel="noreferrer noopener" className="btn btn--small">
            ver en {network(post.platform)} ↗
          </a>
        )}
      </div>
    </Panel>
  );
}

// --- an ad ----------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = { open: "abierta", won: "ganada", lost: "perdida", abandoned: "abandonada" };

export function AdPanel({ name, days, onClose }: { name: string; days: PeriodDays; onClose: () => void }) {
  const { data, error, loading } = useResource(`cx-ads:${days}`, () => getAds(days));
  const ad: AdDetail | undefined = data?.ads.find((a) => a.name === name);

  return (
    <Panel title={name} subtitle={ad?.adId ? `anuncio ${ad.adId}` : undefined} onClose={onClose}>
      {loading ? (
        <p className="empty">
          <Spinner /> cargando los leads del anuncio
        </p>
      ) : error && !data ? (
        <p className="alert alert--error">! {errorMessage(error)}</p>
      ) : !ad ? (
        <p className="empty">este anuncio no trajo leads en el periodo.</p>
      ) : (
        <div className="stack">
          <dl className="cx__figures">
            <div>
              <dt>leads</dt>
              <dd>{count(ad.leads)}</dd>
            </div>
            <div>
              <dt>→ oportunidad</dt>
              <dd>{share(ad.toOpportunity)}</dd>
            </div>
            <div>
              <dt>ganados</dt>
              <dd>{count(ad.won)}</dd>
            </div>
          </dl>
          {ad.landing && (
            <p className="cx__muted">
              página de destino:{" "}
              <a href={ad.landing} target="_blank" rel="noreferrer noopener" className="linkbtn">
                {ad.landing.replace(/^https?:\/\//, "")} ↗
              </a>
            </p>
          )}
          <span className="cx__subtitle">dónde están ahora</span>
          <RankedBars label="Leads del anuncio por etapa" rows={ad.byStage.map((s) => ({ name: s.name, value: s.count }))} detail={(row) => share(row.value / ad.leads)} />
          <span className="cx__subtitle">leads, del más reciente</span>
          <table className="cx__table">
            <thead>
              <tr>
                <th scope="col">contacto</th>
                <th scope="col">llegó</th>
                <th scope="col">etapa</th>
                <th scope="col">valor</th>
              </tr>
            </thead>
            <tbody>
              {ad.people.map((lead) => (
                <tr key={lead.contactId}>
                  <th scope="row">{lead.name}</th>
                  <td>{new Date(lead.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</td>
                  <td>{lead.stage ?? (lead.status ? STATUS_LABELS[lead.status] ?? lead.status : "sin oportunidad")}</td>
                  <td>{lead.value ? money(lead.value) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ad.people.length < ad.leads && <p className="cx__note">se muestran los {count(ad.people.length)} más recientes.</p>}
        </div>
      )}
    </Panel>
  );
}
