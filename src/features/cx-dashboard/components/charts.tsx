"use client";

import { useState } from "react";

/** Plain-HTML charts for the dashboard: one series each, so no legend -- the card's title
 *  names what is plotted. Bars wear --chart-bar (the theme's accent-dim, checked against
 *  both panel surfaces); every number they show is also in text or a table. */

export function ColumnChart({
  data,
  label,
  format = (value) => value.toLocaleString("es-MX"),
  dateLabel,
}: {
  /** `partial`: a bucket still filling up -- the current month -- drawn as a wash so it
   *  is not read as a drop. */
  data: { key: string; value: number; partial?: boolean }[];
  label: string;
  format?: (value: number) => string;
  dateLabel: (key: string) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, index) => (d.value > (data[best]?.value ?? -1) ? index : best), 0);
  const ticks = [max, Math.round(max / 2), 0].filter((tick, index, all) => all.indexOf(tick) === index);
  const shown = active;

  return (
    <figure className="chart" aria-label={label}>
      <div className="chart__plot">
        <div className="chart__axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
              {format(tick)}
            </span>
          ))}
        </div>
        <div className="chart__columns" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
          {data.map((d, index) => (
            <button
              key={d.key}
              type="button"
              className={["chart__slot", index === shown && "chart__slot--active", d.partial && "chart__slot--partial"].filter(Boolean).join(" ")}
              aria-label={`${dateLabel(d.key)}: ${format(d.value)}${d.partial ? " (en curso)" : ""}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span className="chart__column" style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : 0 }} />
              {index === peak && d.value > 0 && shown === null && <span className="chart__peak">{format(d.value)}</span>}
            </button>
          ))}
          {shown !== null && data[shown] && (
            <div className="chart__tooltip" role="status" style={{ left: `${((shown + 0.5) / data.length) * 100}%` }}>
              <strong>{format(data[shown].value)}</strong>
              <span>
                {dateLabel(data[shown].key)}
                {data[shown].partial ? " · en curso" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="chart__dates" aria-hidden="true">
        <span>{data[0] && dateLabel(data[0].key)}</span>
        <span>{data.at(-1) && dateLabel(data.at(-1)!.key)}</span>
      </div>
      {/* a table cannot be shrunk to nothing itself, so its box is hidden around it */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{dateLabel(d.key)}</th>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Horizontal bars, longest first, each labeled with its value at the tip. */
export function RankedBars({
  rows,
  label,
  format = (value) => value.toLocaleString("es-MX"),
  detail,
  empty = "sin datos en este periodo",
}: {
  rows: { name: string; value: number; key?: string }[];
  label: string;
  format?: (value: number) => string;
  detail?: (row: { name: string; value: number }) => string | null;
  empty?: string;
}) {
  if (!rows.length || rows.every((row) => !row.value)) return <p className="empty">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="ranked" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key ?? row.name} className="ranked__row">
          <span className="ranked__name" title={row.name}>
            {row.name}
          </span>
          <span className="ranked__track">
            <span className="ranked__bar" style={{ width: row.value ? `${Math.max(1.5, (row.value / max) * 55)}%` : 0 }} />
            <span className="ranked__value">
              {format(row.value)}
              {detail?.(row) && <span className="ranked__detail"> · {detail(row)}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
