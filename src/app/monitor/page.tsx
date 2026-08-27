"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  HBar,
  Histogram,
  PALETTE,
  StatTile,
  StatusPill,
  TableView,
  type Datum,
  type Status,
} from "@/components/monitor/Charts";
import {
  formatDuration,
  groupBy,
  histogram,
  parsePrometheus,
  quantile,
  sum,
  trimTail,
  type Sample,
} from "@/lib/obs/parsePrometheus";

/**
 * Operational dashboard.
 *
 * It scrapes /api/metrics - the same endpoint Prometheus would - so this view
 * and any alerting are reading identical numbers. Nothing here is a
 * dashboard-only counter.
 */

const REFRESH_MS = 5_000;

interface HealthPayload {
  status: string;
  uptimeSeconds: number;
  primaryProvider: string;
  providers: Array<{ name: string; up: boolean; detail?: string; primary: boolean }>;
  limits: { perWindow: number; windowMs: number; dailyCap: number };
}

export default function MonitorPage() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([
        fetch("/api/metrics", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
      ]);
      if (!m.ok) throw new Error(`metrics responded ${m.status}`);
      setSamples(parsePrometheus(await m.text()));
      if (h.ok) setHealth((await h.json()) as HealthPayload);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "scrape failed");
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, REFRESH_MS);
    return () => clearInterval(id);
  }, [poll]);

  const view = useMemo(() => {
    if (!samples) return null;

    const total = sum(samples, "watcher_causality_requests_total");
    const ok = sum(samples, "watcher_causality_requests_total", { outcome: "ok" });
    const fallback = sum(samples, "watcher_causality_requests_total", { outcome: "fallback" });
    const errors = sum(samples, "watcher_causality_requests_total", { outcome: "error" });
    const rejected = sum(samples, "watcher_requests_rejected_total");
    const events = sum(samples, "watcher_events_generated_total");

    const allBins = histogram(samples, "watcher_causality_duration_seconds");
    // Quantiles read the full histogram; only the chart drops the empty tail.
    const p50 = quantile(allBins, 0.5);
    const p95 = quantile(allBins, 0.95);
    const bins = trimTail(allBins);

    const byMode = groupBy(samples, "watcher_causality_requests_total", "mode");
    const byReason = groupBy(samples, "watcher_requests_rejected_total", "reason");
    const byStage = groupBy(samples, "watcher_validation_failures_total", "stage");

    const heapBytes = sum(samples, "watcher_nodejs_heap_size_used_bytes");
    const lag = sum(samples, "watcher_nodejs_eventloop_lag_mean_seconds");

    const outcomes: Datum[] = [
      { key: "served", value: ok, status: "good" as Status },
      { key: "fell back", value: fallback, status: "warning" as Status },
      { key: "errored", value: errors, status: "critical" as Status },
    ];

    const fallbackRate = total > 0 ? fallback / total : 0;
    const errorRate = total > 0 ? errors / total : 0;

    return {
      total, ok, fallback, errors, rejected, events,
      bins, p50, p95, byMode, byReason, byStage,
      heapBytes, lag, outcomes, fallbackRate, errorRate,
    };
  }, [samples]);

  const rateStatus = (rate: number): Status =>
    rate === 0 ? "good" : rate < 0.05 ? "warning" : "critical";

  return (
    <main className="min-h-screen bg-void px-6 py-6 text-ash">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[0.12em] text-gold-400 text-glow-gold">
            WATCHER / OPS
          </h1>
          <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.24em] text-moss-500">
            Scraping /api/metrics every {REFRESH_MS / 1000}s
          </p>
        </div>

        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="font-mono text-[9px] text-moss-600">
              updated {new Date(updatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="rounded-sm border border-moss-700/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-moss-300 transition-colors hover:border-gold-600/70 hover:text-gold-300"
          >
            {asTable ? "Show charts" : "Show table"}
          </button>
          <a
            href="/"
            className="rounded-sm border border-moss-700/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-moss-300 transition-colors hover:border-gold-600/70 hover:text-gold-300"
          >
            Back to the tree
          </a>
        </div>
      </header>

      {error && (
        <div
          className="mb-4 rounded-sm border px-3 py-2 font-mono text-[10px]"
          style={{ borderColor: PALETTE.critical, color: PALETTE.critical }}
        >
          ■ Scrape failed: {error}
        </div>
      )}

      {!view ? (
        <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-moss-600">
          Reading metrics…
        </p>
      ) : (
        <div className="space-y-4">
          {/* Provider health - state is written out, never colour alone. */}
          <section className="panel p-4">
            <h2 className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-moss-300">
              Engine providers
            </h2>
            <div className="flex flex-wrap gap-2">
              {(health?.providers ?? []).map((p) => (
                <StatusPill
                  key={p.name}
                  status={p.up ? "good" : p.primary ? "critical" : "warning"}
                  label={p.name + (p.primary ? " (primary)" : "")}
                  detail={p.detail}
                />
              ))}
              {health && (
                <span className="self-center font-mono text-[9px] text-moss-600">
                  uptime {Math.floor(health.uptimeSeconds / 60)}m · cap{" "}
                  {health.limits.dailyCap}/day · {health.limits.perWindow} per{" "}
                  {health.limits.windowMs / 1000}s
                </span>
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Requests" value={view.total.toLocaleString()} hint="since boot" />
            <StatTile
              label="p95 latency"
              value={formatDuration(view.p95)}
              hint={`p50 ${formatDuration(view.p50)}`}
            />
            <StatTile
              label="Fallback rate"
              value={`${(view.fallbackRate * 100).toFixed(1)}%`}
              hint={`${view.fallback} of ${view.total}`}
              status={rateStatus(view.fallbackRate)}
            />
            <StatTile
              label="Error rate"
              value={`${(view.errorRate * 100).toFixed(1)}%`}
              hint={`${view.errors} of ${view.total}`}
              status={rateStatus(view.errorRate)}
            />
            <StatTile
              label="Events made"
              value={view.events.toLocaleString()}
              hint={`${view.rejected} requests rejected`}
            />
          </section>

          {asTable ? (
            <section className="panel p-4">
              <TableView
                caption="All metrics"
                rows={[
                  { key: "Requests served", value: String(view.ok) },
                  { key: "Requests fell back", value: String(view.fallback) },
                  { key: "Requests errored", value: String(view.errors) },
                  { key: "Requests rejected", value: String(view.rejected) },
                  { key: "Events generated", value: String(view.events) },
                  { key: "Latency p50", value: formatDuration(view.p50) },
                  { key: "Latency p95", value: formatDuration(view.p95) },
                  ...view.byMode.map((m) => ({ key: `Mode: ${m.key}`, value: String(m.value) })),
                  ...view.byReason.map((r) => ({ key: `Rejected: ${r.key}`, value: String(r.value) })),
                  ...view.byStage.map((s) => ({ key: `Validation failure: ${s.key}`, value: String(s.value) })),
                  { key: "Heap used", value: `${(view.heapBytes / 1024 / 1024).toFixed(1)} MB` },
                  { key: "Event-loop lag (mean)", value: formatDuration(view.lag) },
                ]}
              />
            </section>
          ) : (
            <>
              <Histogram bins={view.bins} title="Causality latency distribution" />

              <div className="grid gap-3 md:grid-cols-2">
                <HBar data={view.outcomes} title="Request outcomes" />
                <HBar
                  data={view.byMode.map((m) => ({ key: m.key, value: m.value }))}
                  title="Requests by mode"
                  empty="No requests yet"
                />
                <HBar
                  data={view.byReason.map((r) => ({ key: r.key.replace(/_/g, " "), value: r.value }))}
                  title="Rejected before the engine"
                  empty="Nothing rejected"
                />
                <HBar
                  data={view.byStage.map((s) => ({ key: s.key, value: s.value }))}
                  title="Engine output rejected by gate"
                  empty="No validation failures"
                />
              </div>

              <section className="panel p-4">
                <h2 className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-moss-300">
                  Process
                </h2>
                <div className="flex flex-wrap gap-6 font-mono text-[10px] text-ash/85">
                  <span>
                    heap{" "}
                    <span className="tabular-nums text-moss-200">
                      {(view.heapBytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                  <span>
                    event-loop lag{" "}
                    <span className="tabular-nums text-moss-200">
                      {formatDuration(view.lag)}
                    </span>
                  </span>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
