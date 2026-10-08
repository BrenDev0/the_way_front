"use client";

import { useState } from "react";
import { Segmented } from "@/shared/ui";
import type { Ads, Comparison, Conversion, Growth, Nps, PeriodDays, ResponseTimes, Retention } from "../api";
import { change, count, money, person, share, waited } from "../format";
import { ColumnChart, RankedBars } from "./charts";
import { AdPanel } from "./DetailPanels";

function monthLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

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

// --- growth ---------------------------------------------------------------------------

type Measure = "leads" | "opportunities" | "wonValue" | "revenue";

const MEASURES: { value: Measure; label: string }[] = [
  { value: "leads", label: "leads" },
  { value: "opportunities", label: "oportunidades" },
  { value: "wonValue", label: "ganado" },
  { value: "revenue", label: "cobrado" },
];

function compared(comparison: Comparison | null, format: (value: number) => string) {
  if (!comparison || comparison.lastMonth === null) return [];
  return [
    { label: "último mes completo", value: format(comparison.lastMonth) },
    { label: "vs mes anterior", value: change(comparison.monthOverMonth) ?? "—" },
    { label: "vs mismo mes del año pasado", value: change(comparison.yearOverYear) ?? "—" },
  ];
}

export function GrowthCard({ growth }: { growth: Growth }) {
  const [measure, setMeasure] = useState<Measure>("leads");
  const isMoney = measure === "wonValue" || measure === "revenue";
  const format = isMoney ? (value: number) => money(value) : count;
  const locked = measure === "revenue" && growth.revenue === null;
  const label = MEASURES.find((m) => m.value === measure)!.label;

  return (
    <div className="stack">
      <Segmented label="medir" value={measure} options={MEASURES} onChange={setMeasure} />
      {locked ? (
        <p className="cx__note">
          Para ver lo cobrado mes a mes, activa <code>{growth.revenueScope}</code> en la integración privada.
        </p>
      ) : (
        <>
          <ColumnChart
            label={`${label} por mes`}
            data={growth.months.map((m) => ({ key: m.month, value: (m[measure] as number | null) ?? 0, partial: m.current }))}
            dateLabel={monthLabel}
            format={format}
          />
          <Figures items={compared(growth[measure], format)} />
          <p className="cx__note">el último mes está en curso: se muestra más claro y no entra en las comparaciones.</p>
          {measure === "wonValue" && growth.months.every((m) => m.won === 0) && (
            <p className="cx__note">ninguna oportunidad se marcó como ganada en este año: márcalas al cerrar para ver crecer las ventas.</p>
          )}
        </>
      )}
    </div>
  );
}

// --- conversion -----------------------------------------------------------------------

export function ConversionCard({ conversion }: { conversion: Conversion }) {
  return (
    <div className="stack">
      <span className="cx__subtitle">leads del periodo, hasta la venta</span>
      <RankedBars
        label="Embudo de conversión"
        rows={[
          { name: "leads", value: conversion.leads },
          { name: "con oportunidad", value: conversion.withOpportunity },
          { name: "compraron", value: conversion.customers },
        ]}
        detail={(row) =>
          row.name === "con oportunidad" ? share(conversion.leadToOpportunity) : row.name === "compraron" ? share(conversion.leadToCustomer) : null
        }
        empty="no entraron leads en este periodo"
      />
      <Figures
        items={[
          { label: "lead → oportunidad", value: share(conversion.leadToOpportunity) },
          { label: "oportunidad → venta", value: share(conversion.opportunityToCustomer) },
          {
            label: "ciclo de venta",
            value: conversion.cycleDays === null ? "—" : `${conversion.cycleDays.toLocaleString("es-MX")} días`,
            note: conversion.cycleSample ? `mediana de ${count(conversion.cycleSample)} ganadas en el año` : "sin ventas ganadas en el año",
          },
        ]}
      />
    </div>
  );
}

// --- first response -------------------------------------------------------------------

export function ResponseCard({ response, users = {} }: { response: ResponseTimes; users?: Record<string, string> }) {
  if (!response.messages) return <p className="empty">ningún cliente escribió en las conversaciones recientes del periodo.</p>;
  return (
    <div className="stack">
      <Figures
        items={[
          { label: "primera respuesta (mediana)", value: response.medianHours === null ? "—" : waited(response.medianHours) },
          { label: "contestadas en < 1 h", value: share(response.within1h) },
          { label: "en < 24 h", value: share(response.within24h) },
          { label: "sin contestar", value: count(response.unanswered) },
        ]}
      />
      {response.instantShare !== null && response.instantShare > 0 && (
        <p className="cx__note">
          {share(response.instantShare)} de las respuestas llegaron en menos de un minuto — casi seguro un agente de IA o una automatización respondiendo como
          usuario.{" "}
          {response.medianHoursWithoutInstant !== null
            ? `Sin contarlas, la mediana es ${waited(response.medianHoursWithoutInstant)}.`
            : "Sin contarlas no queda ninguna respuesta de una persona."}
        </p>
      )}
      <span className="cx__subtitle">mediana por canal</span>
      <RankedBars
        label="Primera respuesta por canal, en minutos"
        rows={response.byChannel.map((c) => ({ name: c.name, value: Math.round(c.medianHours * 60) }))}
        format={(minutes) => waited(minutes / 60)}
        detail={(row) => {
          const channel = response.byChannel.find((c) => c.name === row.name);
          return channel ? `${count(channel.count)} mensajes` : null;
        }}
      />
      {response.byPerson.length > 0 && (
        <table className="cx__table">
          <thead>
            <tr>
              <th scope="col">quién respondió</th>
              <th scope="col">mediana</th>
              <th scope="col">respuestas</th>
            </tr>
          </thead>
          <tbody>
            {response.byPerson.map((p) => (
              <tr key={p.id}>
                <th scope="row">{person(p.id, users[p.id] ?? null)}</th>
                <td>{waited(p.medianHours)}</td>
                <td>{count(p.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="cx__note">medido en las {count(response.sampled)} conversaciones más recientes del periodo.</p>
    </div>
  );
}

// --- ads ------------------------------------------------------------------------------

export function AdsCard({ ads, days }: { ads: Ads; days: PeriodDays }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!ads.ads.length) {
    return (
      <p className="empty">
        ninguno de los {count(ads.leads)} leads del periodo trae el anuncio que lo trajo. prueba con 90 días, o revisa que tus anuncios usen el seguimiento del
        CX.
      </p>
    );
  }
  return (
    <div className="stack">
      <p className="cx__lead">
        <strong>{share(ads.attributedShare)}</strong> de los leads vinieron de un anuncio rastreado
        {ads.best && (
          <>
            {" "}
            · el que mejor convierte: <strong>{ads.best}</strong>
          </>
        )}
        .
      </p>
      <table className="cx__table">
        <thead>
          <tr>
            <th scope="col">anuncio</th>
            <th scope="col">leads</th>
            <th scope="col">→ oportunidad</th>
            <th scope="col">ganados</th>
            <th scope="col">valor</th>
          </tr>
        </thead>
        <tbody>
          {ads.ads.map((ad) => (
            <tr key={ad.name}>
              <th scope="row">
                <button type="button" className="linkbtn cx__ad-open" onClick={() => setOpen(ad.name)}>
                  {ad.name}
                </button>
              </th>
              <td>{count(ad.leads)}</td>
              <td>{share(ad.toOpportunity)}</td>
              <td>{count(ad.won)}</td>
              <td>{ad.value ? money(ad.value) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ads.campaigns && ads.campaigns.length > 0 && (
        <>
          <span className="cx__subtitle">por campaña (utm_campaign)</span>
          <RankedBars label="Leads por campaña" rows={ads.campaigns.map((c) => ({ name: c.name, value: c.leads }))} detail={(row) => {
            const campaign = ads.campaigns?.find((c) => c.name === row.name);
            return campaign ? `${count(campaign.opportunities)} oportunidades · ${count(campaign.won)} ganados` : null;
          }} />
        </>
      )}
      <p className="cx__note">el gasto vive en la plataforma de anuncios; aquí se ve qué anuncios traen gente que compra. abre un anuncio para ver sus leads.</p>
      {open && <AdPanel name={open} days={days} onClose={() => setOpen(null)} />}
    </div>
  );
}

// --- retention ------------------------------------------------------------------------

export function RetentionCard({ retention }: { retention: Retention }) {
  return (
    <div className="stack">
      {retention.customers === 0 ? (
        <p className="empty">no hay pagos registrados en el CX este año, así que no hay clientes que medir.</p>
      ) : (
        <Figures
          items={[
            { label: "clientes en el año", value: count(retention.customers) },
            { label: "volvieron a comprar", value: share(retention.repeatRate), note: `${count(retention.repeatCustomers)} clientes` },
            { label: "valor por cliente", value: retention.valuePerCustomer === null ? "—" : money(retention.valuePerCustomer) },
            { label: "ventas de clientes que regresan", value: share(retention.returningShare), note: "del periodo" },
          ]}
        />
      )}
      {retention.subscriptions ? (
        <Figures
          items={[
            { label: "suscripciones activas", value: count(retention.subscriptions.active) },
            { label: "ingreso recurrente mensual", value: money(retention.subscriptions.mrr) },
            { label: "cancelaciones", value: count(retention.subscriptions.cancelled), note: share(retention.subscriptions.churnRate) },
          ]}
        />
      ) : (
        retention.subscriptionsScope && (
          <p className="cx__note">
            Para suscripciones, ingreso recurrente y cancelaciones, activa <code>{retention.subscriptionsScope}</code>.
          </p>
        )
      )}
    </div>
  );
}

// --- NPS ------------------------------------------------------------------------------

/** The usual reading of a score: above 50 is excellent, above 0 more fans than critics. */
function npsVerdict(score: number | null) {
  if (score === null) return null;
  return score >= 50 ? "excelente" : score >= 0 ? "bueno" : "por mejorar";
}

export function NpsCard({ nps }: { nps: Nps }) {
  if (!nps.responses) {
    return <p className="empty">la encuesta {nps.survey ? `“${nps.survey}” ` : ""}no tiene respuestas en este periodo.</p>;
  }
  return (
    <div className="stack">
      <p className="cx__nps">
        <strong>{nps.score}</strong>
        <span>
          NPS {npsVerdict(nps.score)} · {count(nps.responses)} respuestas
          {nps.change !== null && ` · ${nps.change > 0 ? "+" : ""}${nps.change} vs el periodo anterior`}
        </span>
      </p>
      <RankedBars
        label="Promotores, pasivos y detractores"
        rows={[
          { name: "promotores (9–10)", value: nps.promoters },
          { name: "pasivos (7–8)", value: nps.passives },
          { name: "detractores (0–6)", value: nps.detractors },
        ]}
        detail={(row) => share(row.value / nps.responses)}
      />
      {nps.comments.length > 0 && (
        <>
          <span className="cx__subtitle">lo que dicen</span>
          <ul className="cx__list">
            {nps.comments.map((c) => (
              <li key={`${c.date}-${c.score}`}>
                <span className="cx__list-main">
                  <span>“{c.text}”</span>
                  <span className="cx__muted">{c.name ?? "cliente"}</span>
                </span>
                <span className="cx__list-side">{c.score}/10</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {nps.byMonth.length > 1 && (
        <table className="cx__table">
          <thead>
            <tr>
              <th scope="col">mes</th>
              <th scope="col">NPS</th>
              <th scope="col">respuestas</th>
            </tr>
          </thead>
          <tbody>
            {nps.byMonth.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month)}</th>
                <td>{m.score ?? "—"}</td>
                <td>{count(m.responses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function NpsSetup({ surveys }: { surveys?: number }) {
  return (
    <div className="cx__locked">
      <p>
        {surveys
          ? "Ninguna encuesta tiene una pregunta de 0 a 10 con respuestas todavía."
          : "Para medir el NPS necesitas una encuesta en el CX."}
      </p>
      <ol className="cx__steps">
        <li>
          En <strong>Sitios → Encuestas</strong>, crea una encuesta (nómbrala “NPS”).
        </li>
        <li>Agrega la pregunta “¿Qué tan probable es que nos recomiendes?” con respuestas de 0 a 10, y una abierta: “¿Por qué?”.</li>
        <li>Envíala con un flujo de trabajo después de cada venta o cita.</li>
      </ol>
      <p className="cx__note">Mi CX encuentra la pregunta sola por sus respuestas de 0 a 10, sin importar cómo la redactes.</p>
    </div>
  );
}
