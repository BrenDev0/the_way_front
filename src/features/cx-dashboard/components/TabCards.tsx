"use client";

import { isReady, type Content, type Dashboard, type Handovers, type Social, type Tasks } from "../api";
import { change, count, person, share } from "../format";
import { ColumnChart, RankedBars } from "./charts";

const NETWORKS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  google: "Google",
  twitter: "X",
  threads: "Threads",
};

export function network(name: string) {
  return NETWORKS[name.toLowerCase()] ?? name;
}

const DAYS: Record<string, string> = { Mon: "lun", Tue: "mar", Wed: "mié", Thu: "jue", Fri: "vie", Sat: "sáb", Sun: "dom" };

function Figures({ items }: { items: { label: string; value: string; note?: string | null }[] }) {
  return (
    <dl className="cx__figures">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note && <span className="cx__muted">{item.note}</span>}
        </div>
      ))}
    </dl>
  );
}

// --- resumen: what needs someone today ------------------------------------------------

type Alert = { tone: "warn" | "info"; text: string; tab: string };

export function alertsOf(d: Dashboard): Alert[] {
  const alerts: Alert[] = [];
  if (isReady(d.inbox) && d.inbox.recent > 0)
    alerts.push({ tone: "warn", text: `${count(d.inbox.recent)} clientes de esta semana esperan respuesta`, tab: "conversaciones" });
  if (isReady(d.tasks) && d.tasks.overdue > 0) alerts.push({ tone: "warn", text: `${count(d.tasks.overdue)} tareas vencidas del equipo`, tab: "equipo" });
  if (isReady(d.appointments) && d.appointments.pending > 0)
    alerts.push({ tone: "info", text: `${count(d.appointments.pending)} citas pasadas sin marcar si el cliente llegó`, tab: "clientes" });
  if (isReady(d.pipeline) && d.pipeline.valueWarning)
    alerts.push({ tone: "warn", text: `${count(d.pipeline.valueWarning.count)} montos del pipeline parecen errores de captura`, tab: "ventas" });
  if (isReady(d.pipeline) && d.pipeline.open > 0 && d.pipeline.stale >= d.pipeline.open * 0.8)
    alerts.push({ tone: "info", text: `${share(d.pipeline.stale / d.pipeline.open)} del pipeline lleva ${d.pipeline.staleDays}+ días sin moverse`, tab: "ventas" });
  if (isReady(d.sales) && d.sales.won + d.sales.lost === 0 && isReady(d.pipeline) && d.pipeline.open > 0)
    alerts.push({ tone: "info", text: "ninguna oportunidad se marcó ganada o perdida en el periodo", tab: "ventas" });
  const content = isReady(d.social) ? d.social.content : undefined;
  if (content?.daysSinceLastPost != null && content.daysSinceLastPost >= 7)
    alerts.push({ tone: "info", text: `${count(content.daysSinceLastPost)} días sin publicar en redes`, tab: "redes" });
  if (d.nps?.status === "no_survey") alerts.push({ tone: "info", text: "todavía no mides el NPS", tab: "clientes" });
  return alerts;
}

export function AlertsCard({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: (tab: string) => void }) {
  const alerts = alertsOf(dashboard);
  if (!alerts.length) return <p className="empty">nada urgente. ✓</p>;
  return (
    <ul className="cx__alerts">
      {alerts.map((alert) => (
        <li key={alert.text} className={`cx__alert cx__alert--${alert.tone}`}>
          <span aria-hidden="true">{alert.tone === "warn" ? "⚠" : "ⓘ"}</span>
          <span className="cx__alert-text">{alert.text}</span>
          <button type="button" className="linkbtn" onClick={() => onOpen(alert.tab)}>
            ver {alert.tab}
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- conversaciones: AI hand-offs -----------------------------------------------------

export function HandoversCard({ handovers }: { handovers: Handovers }) {
  return (
    <div className="stack">
      <p className="cx__lead">
        <strong>{count(handovers.handedOver)}</strong> de {count(handovers.leads)} leads del periodo pasaron del agente de IA a una persona
        {handovers.handoverRate !== null && <> ({share(handovers.handoverRate)})</>}.
      </p>
      <p className="cx__note">se cuentan los contactos con etiquetas como “human handover”, “transferencia a humano” o “stop bot”.</p>
      <span className="cx__subtitle">etiquetas de los leads del periodo</span>
      <RankedBars label="Etiquetas de los leads" rows={handovers.tags.map((t) => ({ name: t.name, value: t.count }))} empty="los leads del periodo no tienen etiquetas" />
    </div>
  );
}

// --- equipo: tasks --------------------------------------------------------------------

export function TasksCard({ tasks, users }: { tasks: Tasks; users: Record<string, string> }) {
  return (
    <div className="stack">
      <Figures
        items={[
          { label: "abiertas", value: count(tasks.open) },
          { label: "vencidas", value: count(tasks.overdue), note: tasks.open ? share(tasks.overdue / tasks.open) : null },
          { label: "vencen hoy", value: count(tasks.dueToday) },
        ]}
      />
      {tasks.byPerson.length > 0 && (
        <table className="cx__table">
          <thead>
            <tr>
              <th scope="col">persona</th>
              <th scope="col">abiertas</th>
              <th scope="col">vencidas</th>
            </tr>
          </thead>
          <tbody>
            {tasks.byPerson.map((p) => (
              <tr key={p.id ?? "none"}>
                <th scope="row">{person(p.id, p.id ? users[p.id] ?? null : null)}</th>
                <td>{count(p.open)}</td>
                <td>{p.overdue ? <span className="cx__wait--late">⚠ {count(p.overdue)}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tasks.overdueList.length > 0 && (
        <>
          <span className="cx__subtitle">las más atrasadas</span>
          <ul className="cx__list">
            {tasks.overdueList.map((t) => (
              <li key={t.id}>
                <span className="cx__list-main">
                  <strong>{t.title}</strong>
                  <span className="cx__muted">
                    {[t.contact, t.assignedTo ? users[t.assignedTo] ?? person(t.assignedTo, null) : "sin asignar"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="cx__list-side cx__wait cx__wait--late">
                  {count(t.daysLate)} {t.daysLate === 1 ? "día" : "días"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// --- redes ----------------------------------------------------------------------------

export function SocialReachCard({ social }: { social: Social }) {
  if (!social.accounts) return <p className="empty">no hay redes conectadas al planificador social del CX.</p>;
  return (
    <div className="stack">
      <Figures
        items={[
          { label: "impresiones", value: count(social.impressions ?? 0), note: change(social.impressionsChange ?? null) ? `${change(social.impressionsChange ?? null)} vs semana anterior` : null },
          { label: "alcance", value: social.reach == null ? "—" : count(social.reach), note: change(social.reachChange ?? null) },
          { label: "interacciones", value: count(social.interactions ?? 0), note: social.engagementRate == null ? null : `tasa ${share(social.engagementRate)}` },
          { label: "seguidores nuevos", value: social.newFollowers == null ? "—" : count(social.newFollowers) },
        ]}
      />
      {social.series && social.series.length > 0 && (
        <ColumnChart
          label="Impresiones por día, últimos 7 días"
          data={social.series.map((d, index) => ({ key: `${index}-${d.day}`, value: d.impressions }))}
          dateLabel={(key) => DAYS[key.split("-")[1]] ?? key.split("-")[1]}
        />
      )}
      <span className="cx__subtitle">impresiones por red</span>
      <RankedBars
        label="Impresiones por red social"
        rows={(social.platforms ?? []).map((p) => ({ name: network(p.name), value: p.impressions }))}
        detail={(row) => {
          const platform = social.platforms?.find((p) => network(p.name) === row.name);
          return platform?.engagement ? `${count(platform.engagement)} interacciones` : null;
        }}
        empty="sin impresiones esta semana"
      />
      <p className="cx__note">
        {count(social.accounts)} redes conectadas{social.networks?.length ? ` (${social.networks.map(network).join(", ")})` : ""}. El CX da estas
        estadísticas siempre de los últimos 7 días contra los 7 anteriores.
      </p>
      {social.expired && social.expired.length > 0 && (
        <p className="alert alert--warn" role="status">
          <span aria-hidden="true">⚠</span> Reconecta {social.expired.map(network).join(", ")}: su conexión expiró y no reporta datos.
        </p>
      )}
    </div>
  );
}

function Unmeasured({ content }: { content: Content }) {
  if (!content.unmeasured.length) return null;
  return (
    <p className="cx__note">
      {content.unmeasured.map(network).join(", ")} no reportan likes ni comentarios por publicación al CX: cuentan como publicadas, pero no entran en los
      promedios.
    </p>
  );
}

export function ContentCard({ content }: { content: Content }) {
  return (
    <div className="stack">
      <Figures
        items={[
          { label: "publicaciones", value: count(content.published), note: `${content.perWeek.toLocaleString("es-MX")} por semana` },
          { label: "interacciones", value: count(content.engagement), note: `${count(content.likes)} likes · ${count(content.comments)} comentarios · ${count(content.shares)} compartidos` },
          { label: "por publicación", value: content.average === null ? "—" : content.average.toLocaleString("es-MX", { maximumFractionDigits: 1 }) },
          {
            label: "última publicación",
            value: content.daysSinceLastPost === null ? "—" : content.daysSinceLastPost === 0 ? "hoy" : `hace ${count(content.daysSinceLastPost)} días`,
          },
        ]}
      />
      <span className="cx__subtitle">interacciones promedio por publicación, por red</span>
      <RankedBars
        label="Interacciones promedio por red"
        rows={content.byPlatform.map((p) => ({ name: network(p.name), value: p.average ?? 0 }))}
        format={(v) => v.toLocaleString("es-MX", { maximumFractionDigits: 1 })}
        detail={(row) => {
          const p = content.byPlatform.find((x) => network(x.name) === row.name);
          return p ? `${count(p.posts)} publicaciones` : null;
        }}
        empty="ninguna red reporta interacciones por publicación en este periodo"
      />
      <span className="cx__subtitle">por formato</span>
      <RankedBars
        label="Interacciones promedio por formato"
        rows={content.byFormat.map((f) => ({ name: f.name === "reel" ? "reels / video corto" : "publicación", value: f.average ?? 0 }))}
        format={(v) => v.toLocaleString("es-MX", { maximumFractionDigits: 1 })}
      />
      <span className="cx__subtitle">publicado por red</span>
      <RankedBars label="Publicaciones por red" rows={content.postsByPlatform.map((p) => ({ name: network(p.name), value: p.count }))} />
      <Unmeasured content={content} />
    </div>
  );
}

export function TimingCard({ content }: { content: Content }) {
  const fmt = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 1 });
  return (
    <div className="stack">
      <p className="cx__lead">
        {content.bestWeekday || content.bestDaypart ? (
          <>
            Lo que mejor funciona: {content.bestWeekday && <strong>{content.bestWeekday}</strong>}
            {content.bestWeekday && content.bestDaypart && " por la "}
            {content.bestDaypart && <strong>{content.bestDaypart}</strong>}.
          </>
        ) : (
          "Todavía no hay suficientes publicaciones con métricas para saber qué día u hora funciona mejor."
        )}
      </p>
      <span className="cx__subtitle">interacciones promedio por día</span>
      <RankedBars label="Interacciones promedio por día de la semana" rows={content.byWeekday.map((d) => ({ name: d.name, value: d.average ?? 0 }))} format={fmt} detail={(row) => `${count(content.byWeekday.find((d) => d.name === row.name)?.posts ?? 0)} pub.`} />
      <span className="cx__subtitle">por momento del día</span>
      <RankedBars label="Interacciones promedio por momento del día" rows={content.byDaypart.map((d) => ({ name: d.name, value: d.average ?? 0 }))} format={fmt} detail={(row) => `${count(content.byDaypart.find((d) => d.name === row.name)?.posts ?? 0)} pub.`} />
      <p className="cx__note">sobre {count(content.patternSample)} publicaciones con métricas de los últimos 90 días o más; un día necesita 3 publicaciones para contar.</p>
    </div>
  );
}

export function TopPostsCard({ content }: { content: Content }) {
  if (!content.top.length) return <p className="empty">no hay publicaciones con métricas en este periodo.</p>;
  return (
    <ul className="cx__posts" aria-label="Publicaciones con más interacciones">
      {content.top.map((post) => (
        <li key={post.id} className="cx__post">
          <span className="cx__post-thumb">
            {post.thumbnail ? <img src={post.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{network(post.platform).slice(0, 2)}</span>}
          </span>
          <span className="cx__post-body">
            <span className="cx__muted">
              {network(post.platform)} · {post.format === "reel" ? "reel" : "publicación"} ·{" "}
              {new Date(post.publishedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            </span>
            <span className="cx__post-caption">{post.caption || "(sin texto)"}</span>
            <span className="cx__post-stats">
              <strong>{count(post.engagement)}</strong> interacciones · {count(post.likes)} likes · {count(post.comments)} comentarios · {count(post.shares)} compartidos
            </span>
            {post.link && (
              <a href={post.link} target="_blank" rel="noreferrer noopener" className="linkbtn">
                ver publicación ↗
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CadenceCard({ content }: { content: Content }) {
  return (
    <div className="stack">
      <ColumnChart
        label="Publicaciones por semana"
        data={content.cadence.map((w, index) => ({ key: w.week, value: w.posts, partial: index === content.cadence.length - 1 }))}
        dateLabel={(iso) => `sem. ${new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
      />
      <p className="cx__note">
        {content.perWeek.toLocaleString("es-MX")} publicaciones por semana en promedio. La constancia pesa más que el volumen: semanas en cero cortan el alcance.
      </p>
    </div>
  );
}
