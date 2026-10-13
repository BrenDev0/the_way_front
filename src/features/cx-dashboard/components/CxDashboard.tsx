"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { errorMessage, revalidate, useResource } from "@/shared/api";
import { formatRelative } from "@/shared/format";
import { Busy, Segmented, Spinner, StatTile, TerminalBox } from "@/shared/ui";
import {
  PERIODS,
  getDashboard,
  isReady,
  type Appointments,
  type Dashboard,
  type Inbox,
  type Leads,
  type PeriodDays,
  type Payments,
  type Pipeline,
  type Sales,
  type Section,
  type Team,
} from "../api";
import { change, count, day, money, person, setAccountCurrency, share, waited, when } from "../format";
import { ColumnChart, RankedBars } from "./charts";
import { ConversationPanel, PostsCard } from "./DetailPanels";
import { AdsCard, ConversionCard, GrowthCard, NpsCard, NpsSetup, ResponseCard, RetentionCard } from "./InsightCards";
import { AlertsCard, CadenceCard, ContentCard, HandoversCard, SocialReachCard, TasksCard, TimingCard, TopPostsCard } from "./TabCards";
import { Tabs, useTabFromHash } from "./Tabs";

const PERIOD_LABELS: Record<PeriodDays, string> = { "7": "7 días", "30": "30 días", "90": "90 días" };

const TAB_IDS = ["resumen", "ventas", "conversaciones", "marketing", "redes", "equipo", "clientes"] as const;
type Tab = (typeof TAB_IDS)[number];
const TAB_LABELS: Record<Tab, string> = {
  resumen: "Resumen",
  ventas: "Ventas",
  conversaciones: "Conversaciones",
  marketing: "Marketing",
  redes: "Redes sociales",
  equipo: "Equipo",
  clientes: "Clientes",
};

/**
 * The business at a glance from the person's own CX key. Every section
 * stands on its own: one the key has no permission for says which to add, and the rest
 * still show.
 */
export function CxDashboard() {
  const [days, setDays] = useState<PeriodDays>("30");
  const [tab, setTab] = useTabFromHash(TAB_IDS, "resumen");
  const [refreshing, setRefreshing] = useState(false);
  const force = useRef(false);
  const key = `cx-dashboard:${days}`;
  const { data, error, loading } = useResource(key, () => {
    const refresh = force.current;
    force.current = false;
    return getDashboard(days, refresh);
  });

  async function refresh() {
    force.current = true;
    setRefreshing(true);
    try {
      await revalidate(key);
    } finally {
      setRefreshing(false);
    }
  }

  const controls = (
    <div className="cx__controls">
      <Segmented label="Periodo" value={days} options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} onChange={setDays} disabled={refreshing} />
      <div className="cx__freshness">
        {data && "generatedAt" in data && <span>Actualizado {formatRelative(data.generatedAt)}</span>}
        <button type="button" className="btn btn--small" onClick={refresh} disabled={refreshing || loading}>
          {refreshing ? <Busy words={["LEYENDO EL CX"]} /> : "Actualizar"}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="cx">
        {controls}
        <p className="empty">
          <Spinner /> Leyendo tu cuenta del CX — tarda unos segundos
        </p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="cx">
        {controls}
        <p className="alert alert--error">! {errorMessage(error)}</p>
      </div>
    );
  }
  if (!data || !data.connected) {
    return (
      <TerminalBox wide title="EL CX NO ESTÁ CONECTADO">
        <p>
          Mi CX lee tu cuenta del CX con tu propia llave. Agrégala con su ID de ubicación en{" "}
          <Link href="/api-keys">Llaves API</Link> y vuelve aquí.
        </p>
      </TerminalBox>
    );
  }
  if ("invalidToken" in data && data.invalidToken) {
    return (
      <div className="cx">
        {controls}
        <p className="alert alert--error" role="alert">
          ! El CX rechazó tu llave: puede estar revocada o ser de otra cuenta. Reemplázala en <Link href="/api-keys">Llaves API</Link>.
        </p>
      </div>
    );
  }

  const dashboard = data as Dashboard;
  setAccountCurrency(dashboard.account?.currency);
  const users = dashboard.users ?? {};
  const badge: Partial<Record<Tab, number | null>> = {
    conversaciones: isReady(dashboard.inbox) ? dashboard.inbox.recent : null,
    equipo: dashboard.tasks && isReady(dashboard.tasks) ? dashboard.tasks.overdue : null,
  };
  const content = dashboard.social && isReady(dashboard.social) ? dashboard.social.content : undefined;

  return (
    <div className={refreshing ? "cx cx--refreshing" : "cx"} aria-busy={refreshing}>
      {controls}
      <Tabs label="Secciones de mi CX" tabs={TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id], badge: badge[id] }))} value={tab} onChange={setTab}>
        {tab === "resumen" && (
          <div className="stack">
            <Headline dashboard={dashboard} />
            <div className="cx__grid">
              <TerminalBox wide title="QUÉ ATENDER">
                <AlertsCard dashboard={dashboard} onOpen={(next) => setTab(next as Tab)} />
              </TerminalBox>
              <Card title="LEADS NUEVOS" section={dashboard.leads}>
                {(leads) => <LeadsCard leads={leads} days={dashboard.period.days} />}
              </Card>
              <Card title="CONVERSIÓN Y CICLO DE VENTA" section={dashboard.conversion}>
                {(conversion) => <ConversionCard conversion={conversion} />}
              </Card>
            </div>
          </div>
        )}
        {tab === "ventas" && (
          <div className="cx__grid">
            <Card title="CRECIMIENTO · 12 MESES" section={dashboard.growth} wide>
              {(growth) => <GrowthCard growth={growth} />}
            </Card>
            <Card title="PIPELINE" section={dashboard.pipeline} wide>
              {(pipeline) => <PipelineCard pipeline={pipeline} />}
            </Card>
            <Card title="VENTAS DEL PERIODO" section={dashboard.sales}>
              {(sales) => <SalesCard sales={sales} />}
            </Card>
            <Card title="PAGOS COBRADOS" section={dashboard.payments}>
              {(payments) => <PaymentsCard payments={payments} />}
            </Card>
          </div>
        )}
        {tab === "conversaciones" && (
          <div className="cx__grid">
            <Card title="POR CONTESTAR" section={dashboard.inbox} wide>
              {(inbox) => <InboxCard inbox={inbox} />}
            </Card>
            <Card title="PRIMERA RESPUESTA" section={dashboard.response}>
              {(response) => <ResponseCard response={response} users={users} />}
            </Card>
            <Card title="DEL AGENTE DE IA A UNA PERSONA" section={dashboard.handovers}>
              {(handovers) => <HandoversCard handovers={handovers} />}
            </Card>
          </div>
        )}
        {tab === "marketing" && (
          <div className="cx__grid">
            <Card title="LEADS NUEVOS" section={dashboard.leads}>
              {(leads) => <LeadsCard leads={leads} days={dashboard.period.days} />}
            </Card>
            <Card title="DE DÓNDE VIENEN" section={dashboard.leads}>
              {(leads) => <SourcesCard leads={leads} />}
            </Card>
            <Card title="ANUNCIOS" section={dashboard.ads} wide>
              {(ads) => <AdsCard ads={ads} days={days} />}
            </Card>
          </div>
        )}
        {tab === "redes" && (
          <div className="cx__grid">
            <Card title="ALCANCE · ÚLTIMOS 7 DÍAS" section={dashboard.social}>
              {(social) => <SocialReachCard social={social} />}
            </Card>
            {content && (
              <>
                <TerminalBox title="CONTENIDO DEL PERIODO">
                  <ContentCard content={content} />
                </TerminalBox>
                <TerminalBox wide title="LO QUE MÁS FUNCIONÓ">
                  <TopPostsCard content={content} />
                </TerminalBox>
                <TerminalBox title="MEJOR MOMENTO PARA PUBLICAR">
                  <TimingCard content={content} />
                </TerminalBox>
                <TerminalBox title="RITMO DE PUBLICACIÓN">
                  <CadenceCard content={content} />
                </TerminalBox>
              </>
            )}
            <TerminalBox wide title="TODAS LAS PUBLICACIONES">
              <PostsCard days={days} />
            </TerminalBox>
          </div>
        )}
        {tab === "equipo" && (
          <div className="cx__grid">
            <Card title="EQUIPO" section={dashboard.team}>
              {(team) => <TeamCard team={team} />}
            </Card>
            <Card title="TAREAS" section={dashboard.tasks}>
              {(tasks) => <TasksCard tasks={tasks} users={users} />}
            </Card>
            <Card title="QUIÉN RESPONDE Y QUÉ TAN RÁPIDO" section={dashboard.response} wide>
              {(response) => <ResponseCard response={response} users={users} />}
            </Card>
          </div>
        )}
        {tab === "clientes" && (
          <div className="cx__grid">
            {dashboard.nps?.status === "no_survey" ? (
              <TerminalBox title="NPS">
                <NpsSetup surveys={dashboard.nps.surveys} />
              </TerminalBox>
            ) : (
              <Card title="NPS" section={dashboard.nps}>
                {(nps) => <NpsCard nps={nps} />}
              </Card>
            )}
            <Card title="RETENCIÓN Y RECOMPRA" section={dashboard.retention}>
              {(retention) => <RetentionCard retention={retention} />}
            </Card>
            <Card title="CITAS" section={dashboard.appointments}>
              {(appointments) => <AppointmentsCard appointments={appointments} />}
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}

function Headline({ dashboard }: { dashboard: Dashboard }) {
  const { leads, inbox, pipeline, sales, appointments } = dashboard;
  const days = dashboard.period.days;
  return (
    <div className="stats cx__stats">
      <StatTile
        label="Leads nuevos"
        value={isReady(leads) ? count(leads.total) : "--"}
        detail={isReady(leads) ? (change(leads.change) ? `${change(leads.change)} vs ${days} días anteriores` : `Antes: ${count(leads.previous)}`) : locked(leads)}
      />
      <StatTile
        label="Esperando respuesta"
        value={isReady(inbox) ? count(inbox.recent) : "--"}
        detail={isReady(inbox) ? `De la última semana · ${count(inbox.waiting)} en total` : locked(inbox)}
      />
      <StatTile
        label="Pipeline abierto"
        value={isReady(pipeline) ? money(pipeline.openValue) : "--"}
        detail={isReady(pipeline) ? `${count(pipeline.open)} oportunidades${pipeline.valueWarning ? " · revisa montos" : ""}` : locked(pipeline)}
      />
      <StatTile
        label="Ganado"
        value={isReady(sales) ? money(sales.wonValue) : "--"}
        detail={isReady(sales) ? `${count(sales.won)} cerradas · tasa ${share(sales.winRate)}` : locked(sales)}
      />
      <StatTile
        label="Citas próximos 7 días"
        value={isReady(appointments) ? count(appointments.upcoming) : "--"}
        detail={isReady(appointments) ? `Asistencia ${share(appointments.showRate)}` : locked(appointments)}
      />
    </div>
  );
}

function locked(section: Section<unknown>) {
  return section.status === "missing_scope" ? "Falta permiso" : "No disponible";
}

function Card<T>({ title, section, wide, children }: { title: string; section: Section<T> | undefined; wide?: boolean; children: (data: T) => ReactNode }) {
  // a copy cached before this section existed: one refresh brings it
  if (!section) {
    return (
      <TerminalBox wide={wide} title={title}>
        <p className="empty">Pulsa actualizar para ver esta sección.</p>
      </TerminalBox>
    );
  }
  return (
    <TerminalBox wide={wide} title={title} status={section.status === "partial" ? "Parcial" : undefined}>
      {section.status === "missing_scope" ? (
        <div className="cx__locked">
          <p>
            <span aria-hidden="true">🔒</span> Tu llave del CX no tiene permiso para esto.
          </p>
          <p>
            En el CX: <strong>Configuración → Integraciones privadas</strong>, edita la integración y activa <code>{section.scope}</code>. Luego pulsa
            actualizar.
          </p>
        </div>
      ) : section.status === "error" ? (
        <p className="alert alert--error">! {section.message}</p>
      ) : (
        children(section as T)
      )}
    </TerminalBox>
  );
}

function Partial({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <p className="cx__note">{children}</p> : null;
}

function InboxCard({ inbox }: { inbox: Inbox }) {
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  return (
    <div className="cx__split">
      <div className="stack">
        <p className="cx__lead">
          <strong>{count(inbox.waiting)}</strong> conversaciones donde el cliente escribió al último y nadie le ha contestado
          {inbox.waitingUnder1h > 0 && (
            <>
              {" "}
              · <strong>{count(inbox.waitingUnder1h)}</strong> en la última hora
            </>
          )}
          . {count(inbox.unread)} sin leer.
        </p>
        <RankedBars label="Cuánto llevan esperando" rows={inbox.buckets.map((b) => ({ name: b.label, value: b.count }))} />
        <RankedBars label="Por canal" rows={inbox.byChannel.map((c) => ({ name: c.name, value: c.count }))} />
        <Partial show={inbox.truncated}>Se muestran las {count(inbox.waiting)} más recientes.</Partial>
      </div>
      <div className="stack">
        <span className="cx__subtitle">Contestar primero — las más recientes, aún se pueden salvar</span>
        {inbox.toAnswer.length === 0 ? (
          <p className="empty">Nadie está esperando respuesta. ✓</p>
        ) : (
          <ul className="cx__list">
            {inbox.toAnswer.map((c) => (
              <li key={c.conversationId}>
                <button type="button" className="cx__listrow" onClick={() => setOpen({ id: c.conversationId, name: c.name })} aria-label={`Abrir la conversación con ${c.name}`}>
                  <span className="cx__list-main">
                    <strong>{c.name}</strong>
                    <span className="cx__muted">{c.preview || "(Sin texto)"}</span>
                  </span>
                  <span className="cx__list-side">
                    <span className={c.waitingHours >= 24 ? "cx__wait cx__wait--late" : "cx__wait"}>
                      {c.waitingHours >= 24 && <span aria-hidden="true">⚠ </span>}
                      {waited(c.waitingHours)}
                    </span>
                    <span className="cx__muted">
                      {c.channel}
                      {c.waitingHours >= 24 && ["whatsapp", "instagram", "facebook"].includes(c.channel) && " · 🔒 ventana cerrada"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && <ConversationPanel id={open.id} name={open.name} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LeadsCard({ leads, days }: { leads: Leads; days: number }) {
  return (
    <div className="stack">
      <p className="cx__lead">
        <strong>{count(leads.total)}</strong> en {days} días · {leads.perDay.toLocaleString("es-MX")} al día
        {change(leads.change) && <> · {change(leads.change)} vs el periodo anterior ({count(leads.previous)})</>}
      </p>
      <ColumnChart label="Leads nuevos por día" data={leads.byDay.map((d) => ({ key: d.date, value: d.count }))} dateLabel={day} />
      <Partial show={leads.truncated}>Cuenta parcial: el periodo tiene más contactos de los que se leen de una vez.</Partial>
    </div>
  );
}

function SourcesCard({ leads }: { leads: Leads }) {
  return (
    <div className="stack">
      <span className="cx__subtitle">Por canal</span>
      <RankedBars label="Leads por canal" rows={leads.byChannel.map((c) => ({ name: c.name, value: c.count }))} />
      <span className="cx__subtitle">Por anuncio</span>
      <RankedBars label="Leads por anuncio" rows={leads.byAd.map((c) => ({ name: c.name, value: c.count }))} empty="Ningún lead del periodo trae el anuncio que lo trajo" />
    </div>
  );
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  return (
    <div className="stack">
      {pipeline.valueWarning && (
        <p className="alert alert--warn" role="status">
          <span aria-hidden="true">⚠</span> <strong>Revisa {count(pipeline.valueWarning.count)} montos:</strong> son más de 100 veces la oportunidad típica (
          {money(pipeline.valueWarning.typical)}) y suman {money(pipeline.valueWarning.value)} — parecen errores de captura, como precios escritos juntos. No se
          cuentan en el valor del pipeline: {pipeline.valueWarning.examples.map((e) => `${e.name} (${money(e.value)})`).join(", ")}.
        </p>
      )}
      <div className="cx__pipelines">
        {pipeline.pipelines.map((p) => (
          <div key={p.id} className="stack">
            <span className="cx__subtitle">
              {p.name} · {count(p.open)} abiertas · {money(p.openValue)}
            </span>
            <RankedBars
              label={`Oportunidades abiertas por etapa en ${p.name}`}
              rows={p.stages.map((s) => ({ key: s.id, name: s.name, value: s.count }))}
              detail={(row) => {
                const stage = p.stages.find((s) => s.name === row.name);
                return stage?.value ? money(stage.value) : null;
              }}
              empty="Sin oportunidades abiertas"
            />
          </div>
        ))}
      </div>
      <div className="stack">
        <span className="cx__subtitle">
          Estancadas: {count(pipeline.stale)} de {count(pipeline.open)} abiertas no cambian de etapa hace {pipeline.staleDays}+ días
        </span>
        {pipeline.stale > 0 && pipeline.stale >= pipeline.open * 0.8 && (
          <p className="cx__note">
            Casi todo el pipeline está quieto: mueve las oportunidades al cerrar o perder la venta, o el pipeline deja de decir algo útil.
          </p>
        )}
        {pipeline.staleList.length > 0 && (
          <ul className="cx__list">
            {pipeline.staleList.map((d) => (
              <li key={d.id}>
                <span className="cx__list-main">
                  <strong>{d.name}</strong>
                  <span className="cx__muted">
                    {d.stage ?? "Etapa desconocida"}
                    {d.value ? ` · ${money(d.value)}` : ""}
                  </span>
                </span>
                <span className="cx__list-side cx__wait cx__wait--late">{count(d.idleDays)} días</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SalesCard({ sales }: { sales: Sales }) {
  return (
    <div className="stack">
      <dl className="cx__figures">
        <div>
          <dt>Nuevas</dt>
          <dd>{count(sales.created)}</dd>
        </div>
        <div>
          <dt>Ganadas</dt>
          <dd>{count(sales.won)}</dd>
        </div>
        <div>
          <dt>Perdidas</dt>
          <dd>{count(sales.lost)}</dd>
        </div>
        <div>
          <dt>Tasa de cierre</dt>
          <dd>{share(sales.winRate)}</dd>
        </div>
        <div>
          <dt>Ticket promedio</dt>
          <dd>{sales.averageWon === null ? "—" : money(sales.averageWon)}</dd>
        </div>
      </dl>
      {sales.won + sales.lost === 0 && (
        <p className="cx__note">Ninguna oportunidad se marcó ganada o perdida en el periodo: sin eso no hay tasa de cierre ni ventas que medir.</p>
      )}
      <span className="cx__subtitle">Nuevas oportunidades por fuente</span>
      <RankedBars
        label="Oportunidades nuevas por fuente"
        rows={sales.bySource.map((s) => ({ name: s.name, value: s.count }))}
        detail={(row) => {
          const source = sales.bySource.find((s) => s.name === row.name);
          return source?.won ? `${source.won} ganadas` : null;
        }}
      />
    </div>
  );
}

function AppointmentsCard({ appointments }: { appointments: Appointments }) {
  if (appointments.calendars === 0) return <p className="empty">La cuenta no tiene calendarios.</p>;
  return (
    <div className="stack">
      <dl className="cx__figures">
        <div>
          <dt>En el periodo</dt>
          <dd>{count(appointments.total)}</dd>
        </div>
        <div>
          <dt>Asistieron</dt>
          <dd>{count(appointments.showed)}</dd>
        </div>
        <div>
          <dt>No llegaron</dt>
          <dd>{count(appointments.noShow)}</dd>
        </div>
        <div>
          <dt>Canceladas</dt>
          <dd>{count(appointments.cancelled)}</dd>
        </div>
      </dl>
      {appointments.pending > 0 && <p className="cx__note">{count(appointments.pending)} citas pasadas siguen sin marcar si el cliente llegó.</p>}
      <span className="cx__subtitle">Próximos 7 días</span>
      {appointments.upcomingList.length === 0 ? (
        <p className="empty">Sin citas agendadas.</p>
      ) : (
        <ul className="cx__list">
          {appointments.upcomingList.map((a) => (
            <li key={a.id}>
              <span className="cx__list-main">
                <strong>{a.title}</strong>
                <span className="cx__muted">{a.status}</span>
              </span>
              <span className="cx__list-side">{when(a.start)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <div className="stack">
      {team.scope && (
        <p className="cx__note">
          Para ver nombres en vez de “Usuario 1234”, activa <code>{team.scope}</code> en la integración privada.
        </p>
      )}
      {team.members.length === 0 ? (
        <p className="empty">Nadie tiene oportunidades ni conversaciones asignadas.</p>
      ) : (
        <table className="cx__table">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Oportunidades abiertas</th>
              <th scope="col">Sin contestar</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => (
              <tr key={m.id ?? "none"}>
                <th scope="row">{person(m.id, m.name)}</th>
                <td>{count(m.openOpportunities)}</td>
                <td>{count(m.waitingConversations)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PaymentsCard({ payments }: { payments: Payments }) {
  return (
    <div className="stack">
      <p className="cx__lead">
        <strong>{money(payments.collected, payments.currency)}</strong> en {count(payments.count)} pagos
        {payments.average !== null && <> · promedio {money(payments.average, payments.currency)}</>}
      </p>
      <ColumnChart
        label="Cobrado por día"
        data={payments.byDay.map((d) => ({ key: d.date, value: d.amount }))}
        dateLabel={day}
        format={(value) => money(value, payments.currency)}
      />
      <Partial show={payments.truncated}>Total parcial: hay más pagos de los que se leen de una vez.</Partial>
    </div>
  );
}
