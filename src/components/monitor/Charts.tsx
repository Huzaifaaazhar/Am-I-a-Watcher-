"use client";

import { useState } from "react";

/**
 * Chart primitives for the monitoring dashboard.
 *
 * Palette is validated against the dashboard's own dark surface (#0a0d0e) with
 * the dataviz validator: every step sits inside the dark lightness band, clears
 * the chroma floor, and passes contrast. The one WARN - critical vs good at
 * CVD ΔE 6.8 - is legal only with secondary encoding, so every status here
 * carries a glyph and a written label and is never distinguished by colour
 * alone.
 */
export const PALETTE = {
  /** Single-series data marks. Deliberately not a reserved status hue. */
  data: "#4a7fd0",
  good: "#27a065",
  warning: "#b08a1e",
  critical: "#bd3a63",
  /** Recessive chrome. */
  grid: "rgba(142,195,162,0.14)",
  ink: "#c9c3b0",
  muted: "#6f7f74",
} as const;

export type Status = "good" | "warning" | "critical";

const GLYPH: Record<Status, string> = {
  good: "●",
  warning: "▲",
  critical: "■",
};

/* ------------------------------------------------------------------ tiles */

export function StatTile({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: string;
  hint?: string;
  status?: Status;
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-moss-400">
        {label}
      </div>
      <div
        className="mt-1.5 font-mono text-2xl tabular-nums"
        style={{ color: status ? PALETTE[status] : PALETTE.ink }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 font-mono text-[8.5px] text-moss-600">{hint}</div>
      )}
    </div>
  );
}

export function StatusPill({
  status,
  label,
  detail,
}: {
  status: Status;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-moss-700/50 bg-void/80 px-2.5 py-1.5">
      {/* Glyph + written state: identity never rests on colour alone. */}
      <span aria-hidden style={{ color: PALETTE[status] }} className="text-[10px]">
        {GLYPH[status]}
      </span>
      <span className="font-mono text-[10px] text-ash">{label}</span>
      <span
        className="font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: PALETTE[status] }}
      >
        {status === "good" ? "up" : status === "warning" ? "degraded" : "down"}
      </span>
      {detail && (
        <span className="truncate font-mono text-[8.5px] text-moss-600">{detail}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- bars */

export interface Datum {
  key: string;
  value: number;
  status?: Status;
}

/**
 * Horizontal bars: category identity reads down the left edge, so labels never
 * collide however long the category names get.
 */
export function HBar({
  data,
  title,
  empty = "No data yet",
  format = (n: number) => n.toLocaleString(),
}: {
  data: Datum[];
  title: string;
  empty?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <section className="panel p-4">
      <h2 className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-moss-300">
        {title}
      </h2>

      {data.length === 0 ? (
        <p className="py-4 text-center font-mono text-[10px] text-moss-700">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => {
            const pct = (d.value / max) * 100;
            const colour = d.status ? PALETTE[d.status] : PALETTE.data;
            return (
              <li
                key={d.key}
                className="grid grid-cols-[minmax(96px,auto)_1fr_auto] items-center gap-3"
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="truncate font-mono text-[10px] text-ash/85">
                  {d.status && (
                    <span aria-hidden style={{ color: colour }} className="mr-1.5">
                      {GLYPH[d.status]}
                    </span>
                  )}
                  {d.key}
                </span>
                <span className="h-3 w-full overflow-hidden rounded-[2px] bg-moss-900/70">
                  <span
                    className="block h-full rounded-[2px] transition-[width,opacity] duration-300"
                    style={{
                      width: `${Math.max(pct, d.value > 0 ? 2 : 0)}%`,
                      background: colour,
                      opacity: hover && hover !== d.key ? 0.45 : 1,
                    }}
                  />
                </span>
                <span className="font-mono text-[10px] tabular-nums text-ash">
                  {format(d.value)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- histogram */

export interface Bin {
  label: string;
  count: number;
}

/**
 * Latency distribution. One series, so no legend - the heading names it - and
 * only non-empty bins are labelled, rather than a number on every bar.
 */
export function Histogram({ bins, title }: { bins: Bin[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const total = bins.reduce((a, b) => a + b.count, 0);

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.22em] text-moss-300">
          {title}
        </h2>
        <span className="font-mono text-[9px] tabular-nums text-moss-600">
          {total.toLocaleString()} observations
        </span>
      </div>

      {total === 0 ? (
        <p className="py-8 text-center font-mono text-[10px] text-moss-700">
          No requests recorded yet
        </p>
      ) : (
        <div className="relative">
          <div className="flex h-[132px] items-end gap-1">
            {bins.map((b, i) => {
              const pct = (b.count / max) * 100;
              return (
                <div
                  key={b.label}
                  className="group flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* Selective direct labels: only bars that carry data. */}
                  {b.count > 0 && (
                    <span className="mb-1 text-center font-mono text-[8.5px] tabular-nums text-moss-300">
                      {b.count}
                    </span>
                  )}
                  <span
                    className="w-full rounded-t-[4px] transition-[height,opacity] duration-300"
                    style={{
                      height: `${Math.max(pct, b.count > 0 ? 3 : 1)}%`,
                      background: b.count > 0 ? PALETTE.data : PALETTE.grid,
                      opacity: hover !== null && hover !== i ? 0.45 : 1,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Baseline the bars are anchored to. */}
          <div className="mt-0 h-px w-full" style={{ background: PALETTE.grid }} />

          <div className="mt-1.5 flex gap-1">
            {bins.map((b, i) => (
              <span
                key={b.label}
                className="flex-1 text-center font-mono text-[7.5px] tabular-nums"
                style={{ color: hover === i ? PALETTE.ink : PALETTE.muted }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- table view */

export function TableView({
  caption,
  rows,
}: {
  caption: string;
  rows: Array<{ key: string; value: string }>;
}) {
  return (
    <table className="w-full border-collapse font-mono text-[10px]">
      <caption className="mb-2 text-left text-[9px] uppercase tracking-[0.2em] text-moss-300">
        {caption}
      </caption>
      <thead>
        <tr className="border-b hairline text-moss-500">
          <th scope="col" className="py-1 text-left font-medium">Metric</th>
          <th scope="col" className="py-1 text-right font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-moss-900/60">
            <td className="py-1 text-ash/85">{r.key}</td>
            <td className="py-1 text-right tabular-nums text-ash">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
