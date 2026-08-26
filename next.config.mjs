/**
 * Content-Security-Policy notes:
 * - `style-src` needs 'unsafe-inline' because the scene writes element styles
 *   directly (the label projector sets style.transform every frame) and React
 *   inline styles are used throughout the chrome.
 * - `script-src` needs 'unsafe-inline' because Next.js App Router inlines its
 *   hydration payload into <script> tags on statically prerendered pages. A
 *   nonce would force every page dynamic. The risk is bounded here: the app has
 *   no HTML injection sink (no dangerouslySetInnerHTML / innerHTML anywhere),
 *   and all model output renders as escaped React text.
 * - Fonts are the only permitted third-party origin.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" +
    (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // The browser only ever talks to this origin - the Anthropic call is server-side.
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Don't advertise the framework version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
