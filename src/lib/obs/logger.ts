import pino from "pino";

/**
 * Structured JSON logging.
 *
 * One line per event, machine-parseable, shipped to stdout for whatever
 * collects it (Loki, CloudWatch, `| pino-pretty` in a terminal). No transport
 * is configured on purpose: transports run in worker threads, which Next.js
 * bundling handles badly, and stdout is what every container runtime wants.
 */

const LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

/**
 * Custodian premises are user free text. They are the single most useful thing
 * to see when debugging a bad cascade and the single thing most likely to be
 * personal, so they are redacted unless explicitly switched on.
 */
export const LOG_PREMISES = process.env.LOG_PREMISES === "1";

export const logger = pino({
  level: LEVEL,
  base: { service: "watcher", env: process.env.NODE_ENV ?? "development" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["premise", "*.premise", "newTitle", "*.newTitle", "req.headers.authorization"],
    censor: "[REDACTED]",
  },
  formatters: {
    // Emit `level: "info"` rather than `level: 30`.
    level: (label) => ({ level: label }),
  },
});

export type Logger = pino.Logger;

/** Correlation id, echoed to the client so a user report maps to a log line. */
export function newRequestId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

/** A child logger bound to one request. */
export function requestLogger(requestId: string, fields: Record<string, unknown> = {}): Logger {
  return logger.child({ requestId, ...fields });
}

/**
 * Premise text for logs: included only when LOG_PREMISES=1, and truncated even
 * then. Callers must route premises through this rather than logging them raw.
 */
export function premiseForLog(premise: string): string {
  if (!LOG_PREMISES) return "[REDACTED]";
  return premise.length > 120 ? premise.slice(0, 119) + "…" : premise;
}
