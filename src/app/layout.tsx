import type { Metadata, Viewport } from "next";
import { Bitter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

/*
 * Self-hosted at build time.
 *
 * These used to be <link> tags to Google's CDN, which cost a preconnect, a
 * stylesheet round trip and a font round trip before any text could paint,
 * leaked every visitor to a third party, and forced the CSP to allow
 * fonts.googleapis.com and fonts.gstatic.com. next/font downloads the files
 * during the build and serves them from this origin, so all three problems go
 * away together and the CSP tightens to 'self'.
 *
 * `display: swap` so text is readable immediately in the fallback and reflows
 * once, rather than holding the first paint for a webfont.
 *
 * Both faces are OFL-licensed. No official or copyrighted title font is
 * reproduced anywhere in this project.
 */
const bitter = Bitter({
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Roboto Slab", "Georgia", "Times New Roman", "serif"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "AM I A WATCHER? // Temporal Causality Engine",
  description:
    "A universe of branching timelines you can branch, prune and rewrite. An unofficial fan project - not affiliated with Marvel or Disney.",
};

export const viewport: Viewport = {
  themeColor: "#07090a",
  width: "device-width",
  initialScale: 1,
  // No maximumScale. Pinch-zoom was capped at 1, which silently takes
  // magnification away from anyone who needs it - and the canvas has its own
  // gesture handling, so it was never buying anything.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bitter.variable} ${jetbrains.variable}`}>
      <body className="bg-void text-ash antialiased">{children}</body>
    </html>
  );
}
