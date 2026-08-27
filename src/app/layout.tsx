import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AM I A WATCHER? // Temporal Causality Engine",
  description:
    "A universe of branching timelines you can branch, prune and rewrite. An unofficial fan project - not affiliated with Marvel or Disney.",
};

export const viewport: Viewport = {
  themeColor: "#07090a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Bitter and JetBrains Mono are both OFL-licensed. Loaded via <link> so
          that an offline build still succeeds and simply falls back to the
          system serif/mono stacks declared in globals.css.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bitter:wght@600;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-ash antialiased">{children}</body>
    </html>
  );
}
