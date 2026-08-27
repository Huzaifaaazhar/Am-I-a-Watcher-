import { metrics } from "@/lib/obs/metrics";
import { probeProviders } from "@/lib/engine";

/**
 * Prometheus scrape endpoint.
 *
 * In a real deployment this is bound to an internal interface. Where it cannot
 * be, set METRICS_TOKEN and the scrape config sends a bearer token - metrics
 * leak traffic shape and error rates, which is reconnaissance.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.METRICS_TOKEN;

export async function GET(req: Request) {
  if (TOKEN) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${TOKEN}`) {
      return new Response("Unauthorized\n", { status: 401 });
    }
  }

  // Refresh the provider gauges so a scrape reflects reachability now, not at
  // whenever the last health check happened to run.
  await probeProviders();

  const body = await metrics.registry.metrics();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": metrics.registry.contentType,
      "cache-control": "no-store",
    },
  });
}
