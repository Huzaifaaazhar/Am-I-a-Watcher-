import { NextResponse } from "next/server";

import { probeProviders } from "@/lib/engine";
import { LIMIT_CONFIG } from "@/lib/rateLimit";

/**
 * Liveness and readiness in one endpoint.
 *
 * `status` is the readiness signal a load balancer should key on: "ok" when
 * the configured provider answered its health check, "degraded" when it did
 * not but the procedural fallback can still serve every request. Degraded is
 * deliberately still a 200 - the app is fully functional on the fallback, and
 * pulling it out of rotation would be worse than serving it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const providers = await probeProviders();
  const primary = providers.find((p) => p.primary);
  const healthy = primary?.up ?? false;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      primaryProvider: primary?.name ?? "unknown",
      providers: providers.map(({ name, up, detail, primary: isPrimary }) => ({
        name,
        up,
        detail,
        primary: isPrimary,
      })),
      limits: {
        perWindow: LIMIT_CONFIG.MAX_PER_WINDOW,
        windowMs: LIMIT_CONFIG.WINDOW_MS,
        dailyCap: LIMIT_CONFIG.DAILY_CAP,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
