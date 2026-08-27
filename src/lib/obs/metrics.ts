import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "@prometheus-io/client";

/**
 * Prometheus metrics, exposed at /api/metrics.
 *
 * Next.js reloads modules in dev, so the registry is stashed on globalThis -
 * otherwise every hot reload re-registers the same metric names and throws.
 */

declare global {
  // eslint-disable-next-line no-var
  var __watcherMetrics: WatcherMetrics | undefined;
}

export interface WatcherMetrics {
  registry: Registry;
  requests: Counter<"mode" | "provider" | "outcome">;
  duration: Histogram<"mode" | "provider">;
  validationFailures: Counter<"mode" | "stage">;
  fallbacks: Counter<"from" | "to" | "reason">;
  rejections: Counter<"reason">;
  providerUp: Gauge<"provider">;
  events: Counter<"mode">;
}

function build(): WatcherMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ app: "watcher" });
  // Process-level metrics: heap, event-loop lag, GC, file descriptors.
  collectDefaultMetrics({ register: registry, prefix: "watcher_" });

  const requests = new Counter({
    name: "watcher_causality_requests_total",
    help: "Causality requests by mode, serving provider and outcome.",
    labelNames: ["mode", "provider", "outcome"] as const,
    registers: [registry],
  });

  const duration = new Histogram({
    name: "watcher_causality_duration_seconds",
    help: "End-to-end causality generation latency.",
    labelNames: ["mode", "provider"] as const,
    // Procedural answers in microseconds; a local LLM can take many seconds.
    buckets: [0.001, 0.005, 0.02, 0.1, 0.5, 1, 2, 5, 10, 20],
    registers: [registry],
  });

  const validationFailures = new Counter({
    name: "watcher_validation_failures_total",
    help: "Engine outputs rejected, by the stage that rejected them.",
    labelNames: ["mode", "stage"] as const,
    registers: [registry],
  });

  const fallbacks = new Counter({
    name: "watcher_provider_fallbacks_total",
    help: "Times a provider failed and another answered instead.",
    labelNames: ["from", "to", "reason"] as const,
    registers: [registry],
  });

  const rejections = new Counter({
    name: "watcher_requests_rejected_total",
    help: "Requests refused before reaching the engine.",
    labelNames: ["reason"] as const,
    registers: [registry],
  });

  const providerUp = new Gauge({
    name: "watcher_provider_up",
    help: "1 when a provider passed its last health check, 0 otherwise.",
    labelNames: ["provider"] as const,
    registers: [registry],
  });

  const events = new Counter({
    name: "watcher_events_generated_total",
    help: "Timeline events produced, by mode.",
    labelNames: ["mode"] as const,
    registers: [registry],
  });

  return {
    registry,
    requests,
    duration,
    validationFailures,
    fallbacks,
    rejections,
    providerUp,
    events,
  };
}

export const metrics: WatcherMetrics = globalThis.__watcherMetrics ?? build();
if (!globalThis.__watcherMetrics) globalThis.__watcherMetrics = metrics;
