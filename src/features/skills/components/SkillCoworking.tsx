"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  getConversation,
  listMessages,
  sendMessage,
  startConversation,
  textOf,
  type Conversation,
  type ConversationMessage,
} from "@/features/conversations/api";
import { errorMessage } from "@/shared/api";
import { Busy, TerminalBox } from "@/shared/ui";
import { composeMessage, parseSkill, splitReply, visibleText } from "../draft";

const POLL_MS = 1500;
const SLOW_AFTER_POLLS = 40;

interface SkillCoworkingProps {
  draft: string;
  /** Called with each new draft the agent writes. */
  onAgentDraft: (content: string) => void;
  onLoadDraft: (content: string) => void;
}

interface Line {
  key: string;
  role: "user" | "assistant";
  text: string;
  tools?: string[];
}

function toLines(messages: ConversationMessage[]): Line[] {
  return messages.flatMap((message, index): Line[] => {
    if (message.role === "user") return [{ key: `m${index}`, role: "user", text: visibleText(textOf(message.content)) }];
    if (message.role !== "assistant") return [];
    const tools = message.toolCalls?.map((call) => call.name) ?? [];
    const text = textOf(message.content);
    return text.trim() || tools.length ? [{ key: `m${index}`, role: "assistant", text, tools }] : [];
  });
}

function latestDraft(lines: Line[]) {
  const reply = lines[lines.length - 1];
  if (reply?.role !== "assistant") return null;
  const drafts = splitReply(reply.text).filter((part) => part.kind === "draft");
  return drafts.length ? drafts[drafts.length - 1].content : null;
}

export function SkillCoworking({ draft, onAgentDraft, onLoadDraft }: SkillCoworkingProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [polls, setPolls] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const briefed = useRef(false);
  const seenDraft = useRef("");
  const log = useRef<HTMLDivElement>(null);
  const agentDraft = useRef(onAgentDraft);
  agentDraft.current = onAgentDraft;

  useEffect(() => {
    if (!waiting || !conversation) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const latest = await getConversation(conversation.id);
        if (cancelled) return;
        setPolls((n) => n + 1);
        if (latest.status === "running") return;
        clearInterval(id);
        const next = toLines(await listMessages(conversation.id));
        if (cancelled) return;
        setConversation(latest);
        setLines(next);
        setPending(null);
        setWaiting(false);
        if (latest.status !== "idle") setError("El agente no pudo terminar la respuesta. Inicia una nueva sesión para continuar.");
        const written = latestDraft(next);
        if (written) {
          seenDraft.current = written;
          agentDraft.current(written);
        }
      } catch (err) {
        if (cancelled) return;
        clearInterval(id);
        setWaiting(false);
        setError(errorMessage(err));
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waiting, conversation]);

  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [lines, pending, waiting]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending || waiting) return;
    setSending(true);
    setError(null);
    setPending(text);
    setInput("");
    try {
      const current = conversation ?? (await startConversation("Skill · coworking"));
      setConversation(current);
      const shareDraft = draft.trim() && draft !== seenDraft.current ? draft : undefined;
      await sendMessage(current.id, composeMessage(text, { first: !briefed.current, draft: shareDraft }));
      briefed.current = true;
      seenDraft.current = draft;
      setPolls(0);
      setWaiting(true);
    } catch (err) {
      setPending(null);
      setInput(text);
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function reset() {
    setConversation(null);
    setLines([]);
    setPending(null);
    setWaiting(false);
    setError(null);
    briefed.current = false;
    seenDraft.current = "";
  }

  const busy = sending || waiting;

  return (
    <TerminalBox wide title="01 / COWORKING CON EL AGENTE" status={waiting ? "el agente está escribiendo" : conversation ? "sesión activa" : "sin sesión"}>
      <div className="skill-chat">
        <div className="skill-chat__log" ref={log} aria-live="polite">
          {!lines.length && !pending && (
            <div className="skill-chat__intro">
              <strong>Describe la skill que necesitas.</strong>
              <span>El agente te hará preguntas y escribirá un borrador en el editor. Tú lo revisas y lo guardas.</span>
              <span>Si el editor ya tiene contenido, el agente lo recibe para mejorarlo.</span>
            </div>
          )}
          {lines.map((line) => (
            <div key={line.key} className={`skill-chat__msg skill-chat__msg--${line.role}`}>
              <span className="skill-chat__who">{line.role === "user" ? "TÚ" : "AGENTE"}</span>
              {line.role === "user" ? (
                <p>{line.text}</p>
              ) : (
                <>
                  {line.tools?.length ? <p className="skill-chat__tools">· consultando {line.tools.join(", ")}</p> : null}
                  {splitReply(line.text).map((part, index) =>
                    part.kind === "text" ? (
                      <p key={index}>{part.content.trim()}</p>
                    ) : (
                      <div key={index} className="skill-chat__draft">
                        <span>Borrador · <strong>{parseSkill(part.content).name ?? "sin nombre"}</strong></span>
                        {part.content === draft ? (
                          <span className="console-badge console-badge--ready">En el editor</span>
                        ) : (
                          <button type="button" className="btn btn--ghost btn--small" onClick={() => onLoadDraft(part.content)}>
                            Cargar en el editor
                          </button>
                        )}
                      </div>
                    ),
                  )}
                </>
              )}
            </div>
          ))}
          {pending && (
            <div className="skill-chat__msg skill-chat__msg--user">
              <span className="skill-chat__who">TÚ</span>
              <p>{pending}</p>
            </div>
          )}
          {waiting && (
            <div className="skill-chat__msg skill-chat__msg--assistant">
              <span className="skill-chat__who">AGENTE</span>
              <Busy words={["PENSANDO"]} />
              {polls >= SLOW_AFTER_POLLS && (
                <p className="field__hint">Está tardando más de lo normal. Si no avanza, revisa que el worker del backend esté activo.</p>
              )}
            </div>
          )}
        </div>
        {error && <p className="alert alert--error" role="alert">! {error}</p>}
        <form className="skill-chat__composer" onSubmit={send}>
          <label className="field">
            Mensaje para el agente
            <textarea
              className="field__input skill-textarea skill-chat__input"
              rows={3}
              value={input}
              placeholder="Ej.: una skill para responder reclamos con el tono de la marca…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
          </label>
          <div className="skill-chat__actions">
            <button type="button" className="linkbtn" onClick={reset} disabled={busy || !conversation}>
              nueva sesión
            </button>
            <button className="btn btn--small" disabled={busy || !input.trim()}>
              {busy ? <Busy words={["ENVIANDO"]} /> : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </TerminalBox>
  );
}
