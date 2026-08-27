/**
 * Minimal Prometheus text-exposition parser.
 *
 * The dashboard scrapes the same endpoint Prometheus would, rather than a
 * bespoke JSON summary - so what the dashboard shows and what an alert fires on
 * come from one source, and the two can never drift apart.
 */

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(.+)$/;

export function parsePrometheus(text: string): Sample[] {
  const out: Sample[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const m = LINE.exec(line);
    if (!m) continue;

    const [, name, , labelBlob, rawValue] = m;
    const value = Number(rawValue.split(/\s+/)[0]);
    if (!Number.isFinite(value)) continue;

    const labels: Record<string, string> = {};
    if (labelBlob) {
      // Label values may contain commas, so split on `,` only outside quotes.
      for (const pair of labelBlob.match(/[a-zA-Z_][a-zA-Z0-9_]*="(?:\\.|[^"\\])*"/g) ?? []) {
        const eq = pair.indexOf("=");
        labels[pair.slice(0, eq)] = pair
          .slice(eq + 2, -1)
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");
      }
    }

    out.push({ name, labels, value });
  }

  return out;
}

const matches = (s: Sample, where: Record<string, string>) =>
  Object.entries(where).every(([k, v]) => s.labels[k] === v);

/** Total of every sample of `name` whose labels match. */
export function sum(
  samples: Sample[],
  name: string,
  where: Record<string, string> = {},
): number {
  return samples
    .filter((s) => s.name === name && matches(s, where))
    .reduce((acc, s) => acc + s.value, 0);
}

/** Distinct values of one label across a metric, with their totals. */
export function groupBy(
  samples: Sample[],
  name: string,
  label: string,
): Array<{ key: string; value: number }> {
  const totals = new Map<string, number>();
  for (const s of samples) {
    if (s.name !== name) continue;
    const key = s.labels[label];
    if (key === undefined) continue;
    totals.set(key, (totals.get(key) ?? 0) + s.value);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);
}

export interface Bucket {
  /** Upper bound in seconds; Infinity for the overflow bucket. */
  le: number;
  label: string;
  /** Observations that fell in this bucket alone, not cumulative. */
  count: number;
}

function formatBound(seconds: number): string {
  if (!Number.isFinite(seconds)) return "slower";
  if (seconds < 1) return `≤${Math.round(seconds * 1000)}ms`;
  return `≤${seconds}s`;
}

/**
 * Converts a histogram's cumulative `_bucket` series into per-bucket counts,
 * which is what a distribution chart needs. Prometheus buckets are cumulative:
 * each `le` counts everything at or below it.
 */
export function histogram(samples: Sample[], name: string): Bucket[] {
  const cumulative = new Map<number, number>();

  for (const s of samples) {
    if (s.name !== `${name}_bucket`) continue;
    const raw = s.labels.le;
    if (raw === undefined) continue;
    const le = raw === "+Inf" ? Infinity : Number(raw);
    if (Number.isNaN(le)) continue;
    cumulative.set(le, (cumulative.get(le) ?? 0) + s.value);
  }

  const bounds = [...cumulative.keys()].sort((a, b) => a - b);
  let previous = 0;

  return bounds.map((le) => {
    const total = cumulative.get(le) ?? 0;
    const count = Math.max(0, total - previous);
    previous = total;
    return { le, label: formatBound(le), count };
  });
}

/**
 * Drops empty tail buckets so a fast engine does not render as one bar and ten
 * slivers of nothing. Keeps `headroom` empty bins past the last populated one,
 * so the chart still shows there is room above the current worst case.
 */
export function trimTail(buckets: Bucket[], headroom = 3): Bucket[] {
  let last = -1;
  buckets.forEach((b, i) => {
    if (b.count > 0) last = i;
  });
  if (last === -1) return buckets.slice(0, Math.max(headroom, 4));
  return buckets.slice(0, Math.min(buckets.length, last + 1 + headroom));
}

/**
 * Approximates a quantile from bucket boundaries. This is the same
 * interpolation `histogram_quantile` performs, and inherits the same caveat:
 * resolution is limited by bucket width.
 */
export function quantile(buckets: Bucket[], q: number): number {
  const total = buckets.reduce((acc, b) => acc + b.count, 0);
  if (total === 0) return 0;

  const target = total * q;
  let seen = 0;
  for (const b of buckets) {
    seen += b.count;
    if (seen >= target) return b.le;
  }
  return buckets[buckets.length - 1]?.le ?? 0;
}

/** Seconds -> a compact human string. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 0.001) return "<1ms";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}
