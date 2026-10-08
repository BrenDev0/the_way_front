"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMembers } from "@/features/members/hooks";
import { clearResources, errorMessage, revalidate, useResource } from "@/shared/api";
import { formatBytes, formatRelative } from "@/shared/format";
import { ROLE_LABELS, clearUser, saveUser, useSession, type User } from "@/shared/session";
import { Busy, ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import {
  deleteOrganization,
  deleteProject,
  getOverview,
  getUsage,
  reassignProject,
  renameOrganization,
  transferOwnership,
  type Overview,
  type Usage,
} from "../api";
import { useOrganization } from "../hooks";

type Feedback = { tone: "ok" | "error"; message: string } | null;

const number = new Intl.NumberFormat("es-MX");

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p className={`alert alert--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
      {feedback.tone === "error" ? "!" : "✓"} {feedback.message}
    </p>
  );
}

function nameOf(members: User[] | undefined, id: string | null) {
  if (!id) return "sin dueño";
  return members?.find((m) => m.id === id)?.email ?? "persona eliminada";
}

/** The organization's settings, for its owners and admins. */
export function OrganizationSettings() {
  const user = useSession();
  const overview = useResource("organization-overview", getOverview);
  const { data: members } = useMembers();

  return (
    <div className="org">
      <div className="org__grid">
        <TerminalBox title="ORGANIZACIÓN">
          <Profile overview={overview.data} members={members} />
        </TerminalBox>
        <TerminalBox title="ALMACENAMIENTO" status={overview.data ? formatBytes(overview.data.storage.bytes) : undefined}>
          {overview.loading ? (
            <p className="empty">
              <Spinner /> calculando
            </p>
          ) : overview.error && !overview.data ? (
            <p className="alert alert--error">! {errorMessage(overview.error)}</p>
          ) : overview.data ? (
            <Storage overview={overview.data} members={members} />
          ) : null}
        </TerminalBox>
        <TerminalBox wide title="PROYECTOS SIN DUEÑO" status={overview.data ? `${overview.data.orphans.length}` : undefined}>
          {overview.data ? <Orphans overview={overview.data} members={members} /> : <p className="empty"><Spinner /> cargando</p>}
        </TerminalBox>
        <TerminalBox wide title="USO DE IA">
          <UsageSection members={members} />
        </TerminalBox>
        {user.role === "owner" && (
          <TerminalBox wide tone="magenta" title="ZONA DE PELIGRO">
            <DangerZone members={members} self={user} />
          </TerminalBox>
        )}
      </div>
    </div>
  );
}

// --- profile and seats ----------------------------------------------------------------

function Profile({ overview, members }: { overview: Overview | undefined; members: User[] | undefined }) {
  const { data: organization } = useOrganization();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const value = name ?? organization?.name ?? "";

  async function save(e: FormEvent) {
    e.preventDefault();
    const cleaned = value.trim();
    if (!cleaned || cleaned === organization?.name) return;
    setSaving(true);
    setFeedback(null);
    try {
      await renameOrganization(cleaned);
      await revalidate("organization");
      setName(null);
      setFeedback({ tone: "ok", message: "Nombre actualizado." });
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const seats = overview?.seats;
  const used = seats ? seats.members + seats.pending : 0;
  const ratio = seats?.limit ? Math.min(1, used / seats.limit) : null;

  return (
    <div className="stack">
      <form className="org__rename" onSubmit={save}>
        <label className="field">
          <span className="field__label">nombre</span>
          <input className="field__input" value={value} maxLength={255} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--small" disabled={saving || !value.trim() || value.trim() === organization?.name}>
          {saving ? <Busy words={["GUARDANDO"]} /> : "guardar"}
        </button>
      </form>
      <FeedbackLine feedback={feedback} />
      <dl className="cx__facts">
        <dt>creada</dt>
        <dd>{organization ? new Date(organization.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—"}</dd>
        <dt>propietario</dt>
        <dd>{overview ? nameOf(members, overview.ownerId) : "—"}</dd>
      </dl>
      {seats && (
        <div className="stack">
          <span className="cx__subtitle">asientos</span>
          {seats.limit === null ? (
            <p className="cx__lead">
              <strong>{number.format(seats.members)}</strong> personas{seats.pending ? ` + ${number.format(seats.pending)} invitaciones pendientes` : ""} · sin límite
            </p>
          ) : (
            <>
              <p className="cx__lead">
                <strong>
                  {number.format(used)} de {number.format(seats.limit)}
                </strong>{" "}
                en uso · {number.format(seats.members)} personas{seats.pending ? ` y ${number.format(seats.pending)} invitaciones pendientes` : ""}
              </p>
              <div
                className={ratio !== null && ratio >= 1 ? "org__meter org__meter--full" : "org__meter"}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={seats.limit}
                aria-valuenow={used}
                aria-label="Asientos en uso"
              >
                <span style={{ width: `${(ratio ?? 0) * 100}%` }} />
              </div>
              {ratio !== null && ratio >= 1 && <p className="cx__note">⚠ No quedan asientos: revoca una invitación o quita a alguien para invitar a otra persona.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- storage --------------------------------------------------------------------------

function Storage({ overview, members }: { overview: Overview; members: User[] | undefined }) {
  const { storage } = overview;
  return (
    <div className="stack">
      <dl className="cx__figures">
        <div>
          <dt>en total</dt>
          <dd>{formatBytes(storage.bytes)}</dd>
          <span className="cx__muted">{number.format(storage.files)} archivos</span>
        </div>
        <div>
          <dt>biblioteca</dt>
          <dd>{storage.library ? formatBytes(storage.library.bytes) : "—"}</dd>
          {storage.library && <span className="cx__muted">{number.format(storage.library.files)} archivos</span>}
        </div>
      </dl>
      {storage.byPerson.length > 0 && (
        <table className="cx__table">
          <thead>
            <tr>
              <th scope="col">persona</th>
              <th scope="col">proyectos</th>
              <th scope="col">archivos</th>
              <th scope="col">espacio</th>
            </tr>
          </thead>
          <tbody>
            {storage.byPerson.map((p) => (
              <tr key={p.id}>
                <th scope="row">{nameOf(members, p.id)}</th>
                <td>{number.format(p.projects)}</td>
                <td>{number.format(p.files)}</td>
                <td>{formatBytes(p.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- orphaned projects ----------------------------------------------------------------

function Orphans({ overview, members }: { overview: Overview; members: User[] | undefined }) {
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (!overview.orphans.length) {
    return <p className="empty">todos los proyectos tienen dueño. ✓</p>;
  }

  async function reassign(projectId: string, name: string) {
    const owner = owners[projectId];
    if (!owner) return;
    setBusy(projectId);
    setFeedback(null);
    try {
      await reassignProject(projectId, owner);
      setFeedback({ tone: "ok", message: `"${name}" ahora es de ${nameOf(members, owner)}.` });
      await revalidate("organization-overview");
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function remove(projectId: string, name: string) {
    setBusy(projectId);
    setFeedback(null);
    try {
      await deleteProject(projectId);
      setFeedback({ tone: "ok", message: `"${name}" eliminado con sus archivos.` });
      await revalidate("organization-overview");
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <p className="cx__note">Quedan así cuando se elimina a alguien. Nadie los ve mientras no tengan dueño: dáselos a alguien del equipo o elimínalos.</p>
      <FeedbackLine feedback={feedback} />
      <ul className="org__orphans" aria-label="Proyectos sin dueño">
        {overview.orphans.map((project) => (
          <li key={project.id}>
            <span className="cx__list-main">
              <strong>{project.name}</strong>
              <span className="cx__muted">
                {number.format(project.files)} archivos · {formatBytes(project.bytes)} · movido {formatRelative(project.updatedAt)}
              </span>
            </span>
            <span className="org__orphan-actions">
              <label className="sr-only" htmlFor={`owner-${project.id}`}>
                Nuevo dueño de {project.name}
              </label>
              <select
                id={`owner-${project.id}`}
                className="field__input"
                value={owners[project.id] ?? ""}
                onChange={(e) => setOwners((all) => ({ ...all, [project.id]: e.target.value }))}
              >
                <option value="">elegir dueño…</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email} · {ROLE_LABELS[m.role]}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--small" disabled={!owners[project.id] || busy === project.id} onClick={() => reassign(project.id, project.name)}>
                asignar
              </button>
              <ConfirmButton question="¿eliminar con sus archivos?" onConfirm={() => remove(project.id, project.name)}>
                eliminar
              </ConfirmButton>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- AI usage -------------------------------------------------------------------------

const PRICES_KEY = "theway.ai-prices";

interface Prices {
  input: string;
  cached: string;
  output: string;
}

const NO_PRICES: Prices = { input: "", cached: "", output: "" };

function loadPrices(): Prices {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICES_KEY) ?? "null");
    if (saved && typeof saved.input === "string" && typeof saved.output === "string") return { ...NO_PRICES, ...saved };
  } catch {}
  return NO_PRICES;
}

function savePrices(prices: Prices) {
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
  } catch {}
}

function compact(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function monthName(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

function totals(rows: Usage["rows"]) {
  return rows.reduce(
    (sum, r) => ({
      conversations: sum.conversations + r.conversations,
      input: sum.input + r.input,
      output: sum.output + r.output,
      cacheRead: sum.cacheRead + r.cacheRead,
      cacheWrite: sum.cacheWrite + r.cacheWrite,
    }),
    { conversations: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  );
}

/** One price box: a dollar amount per million tokens, with what it is and where it is. */
function PriceField({
  id,
  label,
  column,
  help,
  example,
  value,
  optional,
  onChange,
}: {
  id: string;
  label: string;
  column: string;
  help: string;
  example: string;
  value: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="org__price">
      <label htmlFor={id} className="field__label">
        {label}
        {optional && <span className="org__optional"> · opcional</span>}
      </label>
      <div className="org__price-input">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          className="field__input"
          inputMode="decimal"
          placeholder={example}
          value={value}
          aria-describedby={`${id}-help`}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
        />
        <span className="cx__muted">USD por 1 M tokens</span>
      </div>
      <p id={`${id}-help`} className="cx__note">
        {help} En la página de precios es la columna <strong>“{column}”</strong>.
      </p>
    </div>
  );
}

function UsageSection({ members }: { members: User[] | undefined }) {
  const [months, setMonths] = useState(6);
  const usage = useResource(`organization-usage:${months}`, () => getUsage(months));
  const [prices, setPrices] = useState<Prices>(() => (typeof window === "undefined" ? NO_PRICES : loadPrices()));

  function updatePrice(key: keyof Prices, value: string) {
    const next = { ...prices, [key]: value };
    setPrices(next);
    savePrices(next);
  }

  const input = Number.parseFloat(prices.input);
  const output = Number.parseFloat(prices.output);
  // left blank, cached input is priced like any other input: an overestimate, never an under
  const cachedPrice = prices.cached.trim() === "" ? input : Number.parseFloat(prices.cached);
  const priced = [input, output, cachedPrice].every((p) => Number.isFinite(p) && p >= 0);
  // The input count already includes what was read from the cache (and, for Anthropic,
  // what was written to it). Only the cached reads are billed at their own, lower price;
  // writes stay at the input price, a little under Anthropic's surcharge for them.
  const cost = (t: { input: number; output: number; cacheRead: number; cacheWrite: number }) =>
    (Math.max(0, t.input - t.cacheRead) * input + t.cacheRead * cachedPrice + t.output * output) / 1_000_000;
  const usd = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  const data = usage.data;
  const people = data
    ? Object.entries(
        data.rows.reduce<Record<string, Usage["rows"]>>((all, r) => {
          (all[r.userId] ??= []).push(r);
          return all;
        }, {}),
      )
        .map(([id, rows]) => ({ id, ...totals(rows) }))
        .sort((a, b) => b.input + b.output - (a.input + a.output))
    : [];
  const all = data ? totals(data.rows) : null;
  const perMonth = data ? data.months.map((m) => ({ month: m, ...totals(data.rows.filter((r) => r.month === m)) })) : [];
  const peak = Math.max(1, ...perMonth.map((m) => m.input + m.output));

  return (
    <div className="stack">
      <div className="cx__filters">
        <label className="field">
          <span className="field__label">periodo</span>
          <select className="field__input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </label>
      </div>

      <fieldset className="org__prices">
        <legend className="cx__subtitle">precios de tu modelo · para calcular el costo</legend>
        <p className="cx__note">
          Copia los tres precios del modelo que usa tu llave desde la página de tu proveedor:{" "}
          <a href="https://openai.com/api/pricing" target="_blank" rel="noreferrer noopener" className="linkbtn">
            precios de OpenAI ↗
          </a>{" "}
          o{" "}
          <a href="https://claude.com/pricing" target="_blank" rel="noreferrer noopener" className="linkbtn">
            precios de Anthropic ↗
          </a>
          . Busca la fila de tu modelo y escribe solo el número en dólares.
        </p>
        <div className="org__price-grid">
          <PriceField
            id="price-input"
            label="Precio de entrada"
            column="Input"
            help="Lo que cuesta todo lo que se le envía a la IA: tus mensajes, el historial, las instrucciones y lo que lee."
            example="3.00"
            value={prices.input}
            onChange={(v) => updatePrice("input", v)}
          />
          <PriceField
            id="price-cached"
            label="Precio de entrada en caché"
            column="Cached input"
            help="El precio rebajado de lo que la IA ya había recibido antes en la misma conversación. Si lo dejas vacío, se cobra como entrada normal."
            example="0.30"
            value={prices.cached}
            optional
            onChange={(v) => updatePrice("cached", v)}
          />
          <PriceField
            id="price-output"
            label="Precio de salida"
            column="Output"
            help="Lo que cuesta lo que la IA escribe de vuelta. Suele ser varias veces más caro que la entrada."
            example="15.00"
            value={prices.output}
            onChange={(v) => updatePrice("output", v)}
          />
        </div>
      </fieldset>

      {usage.loading ? (
        <p className="empty">
          <Spinner /> sumando el uso
        </p>
      ) : usage.error && !data ? (
        <p className="alert alert--error">! {errorMessage(usage.error)}</p>
      ) : all && all.conversations === 0 ? (
        <p className="empty">nadie ha conversado con el agente en este periodo.</p>
      ) : all ? (
        <>
          <dl className="cx__figures">
            <div>
              <dt>conversaciones</dt>
              <dd>{number.format(all.conversations)}</dd>
            </div>
            <div>
              <dt>tokens de entrada</dt>
              <dd>{compact(all.input)}</dd>
              <span className="cx__muted">incluye {compact(all.cacheRead)} leídos de caché</span>
            </div>
            <div>
              <dt>tokens de salida</dt>
              <dd>{compact(all.output)}</dd>
            </div>
            <div>
              <dt>costo estimado</dt>
              <dd>{priced ? usd.format(cost(all)) : "—"}</dd>
              {!priced && <span className="cx__muted">escribe los precios de entrada y salida abajo</span>}
            </div>
          </dl>

          <ul className="ranked" aria-label="Tokens por mes">
            {perMonth.map((m) => (
              <li key={m.month} className="ranked__row">
                <span className="ranked__name">{monthName(m.month)}</span>
                <span className="ranked__track">
                  <span className="ranked__bar" style={{ width: m.input + m.output ? `${Math.max(1.5, ((m.input + m.output) / peak) * 55)}%` : 0 }} />
                  <span className="ranked__value">
                    {compact(m.input + m.output)} tokens
                    <span className="ranked__detail"> · {number.format(m.conversations)} conv.{priced ? ` · ${usd.format(cost(m))}` : ""}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <table className="cx__table">
            <thead>
              <tr>
                <th scope="col">persona</th>
                <th scope="col">conversaciones</th>
                <th scope="col">entrada</th>
                <th scope="col">salida</th>
                <th scope="col">de ellos, caché</th>
                <th scope="col">costo</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{nameOf(members, p.id)}</th>
                  <td>{number.format(p.conversations)}</td>
                  <td>{compact(p.input)}</td>
                  <td>{compact(p.output)}</td>
                  <td>{compact(p.cacheRead)}</td>
                  <td>{priced ? usd.format(cost(p)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cx__note">
            Cada persona usa su propia llave de IA, así que el cobro llega a cada llave. El costo es una estimación con los precios que escribiste (se guardan en este
            navegador). No incluye las tareas en segundo plano, que todavía no registran tokens.
          </p>
        </>
      ) : null}
    </div>
  );
}

// --- danger zone ----------------------------------------------------------------------

function DangerZone({ members, self }: { members: User[] | undefined; self: User }) {
  const router = useRouter();
  const { data: organization } = useOrganization();
  const [newOwner, setNewOwner] = useState("");
  const [transferTyped, setTransferTyped] = useState("");
  const [deleteTyped, setDeleteTyped] = useState("");
  const [busy, setBusy] = useState<"transfer" | "delete" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const candidates = members?.filter((m) => m.id !== self.id) ?? [];
  const chosen = candidates.find((m) => m.id === newOwner);

  async function transfer(e: FormEvent) {
    e.preventDefault();
    if (!chosen || transferTyped.trim().toLowerCase() !== chosen.email.toLowerCase()) return;
    setBusy("transfer");
    setFeedback(null);
    try {
      await transferOwnership(chosen.id);
      // the signed-in person is an admin now: the panel must stop offering owner actions
      saveUser({ ...self, role: "admin" });
      window.location.reload();
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
      setBusy(null);
    }
  }

  async function remove(e: FormEvent) {
    e.preventDefault();
    if (!organization || deleteTyped.trim() !== organization.name) return;
    setBusy("delete");
    setFeedback(null);
    try {
      await deleteOrganization();
      clearUser();
      clearResources();
      router.replace("/login");
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err) });
      setBusy(null);
    }
  }

  return (
    <div className="org__danger">
      <FeedbackLine feedback={feedback} />
      <form className="stack" onSubmit={transfer} aria-label="Transferir la propiedad">
        <span className="cx__subtitle">transferir la propiedad</span>
        <p className="cx__note">La otra persona pasa a ser propietaria y tú quedas como administrador. Solo ella podrá devolvértela.</p>
        <label className="field">
          <span className="field__label">nuevo propietario</span>
          <select className="field__input" value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
            <option value="">elegir persona…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email} · {ROLE_LABELS[m.role]}
              </option>
            ))}
          </select>
        </label>
        {chosen && (
          <label className="field">
            <span className="field__label">escribe {chosen.email} para confirmar</span>
            <input className="field__input" value={transferTyped} autoComplete="off" onChange={(e) => setTransferTyped(e.target.value)} />
          </label>
        )}
        <button type="submit" className="btn btn--small" disabled={!chosen || transferTyped.trim().toLowerCase() !== chosen.email.toLowerCase() || busy !== null}>
          {busy === "transfer" ? <Busy words={["TRANSFIRIENDO"]} /> : "transferir"}
        </button>
      </form>

      <form className="stack" onSubmit={remove} aria-label="Eliminar la organización">
        <span className="cx__subtitle">eliminar la organización</span>
        <p className="cx__note">
          Borra para siempre a todas las personas, conversaciones, proyectos, archivos, la biblioteca y el conocimiento. No se puede deshacer y no hay respaldo.
        </p>
        <label className="field">
          <span className="field__label">escribe {organization ? `“${organization.name}”` : "el nombre"} para confirmar</span>
          <input className="field__input" value={deleteTyped} autoComplete="off" onChange={(e) => setDeleteTyped(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--small org__delete" disabled={!organization || deleteTyped.trim() !== organization.name || busy !== null}>
          {busy === "delete" ? <Busy words={["ELIMINANDO"]} /> : "eliminar la organización"}
        </button>
      </form>
    </div>
  );
}
