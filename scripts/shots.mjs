#!/usr/bin/env node
/**
 * Visual QA harness. `npm run shots`
 *
 * Starts the app, visits every route and named scene at phone and desktop
 * sizes with the animation clock pinned, and writes PNGs to /shots. Two runs
 * of the same commit produce the same pixels, which is what makes a
 * before/after comparison mean anything.
 *
 * The browser is whatever Playwright resolves by itself - no hardcoded
 * executable path. An earlier throwaway version of this script pinned
 * /opt/pw-browsers/chromium-1194, and the very next container shipped 1243.
 *
 * Usage:
 *   npm run shots                 all targets
 *   npm run shots -- --only=tree  targets whose id contains "tree"
 *   npm run shots -- --port=3100  use a port that is already serving
 */

import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import path from "node:path";
import process from "node:process";

/*
 * Resolved through CommonJS rather than `await import("playwright")`.
 * ESM resolution ignores NODE_PATH and global roots, so a Playwright that is
 * installed on the machine but not in this project is invisible to it; CJS
 * resolution finds both, which lets the harness run with no local install.
 */
let chromium;
try {
  const require = createRequire(path.join(process.cwd(), "/"));
  ({ chromium } = require("playwright"));
} catch {
  console.error(
    "playwright not found.\n" +
      "  npm i -D playwright && npx playwright install chromium",
  );
  process.exit(1);
}

const OUT = path.resolve("shots");
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "1"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

const only = args.get("only");
const externalPort = args.get("port") ? Number(args.get("port")) : null;

/**
 * Viewports from the build standard: design at 390x844, then scale up.
 * deviceScaleFactor is forced to 2 so a phone shot is comparable between
 * machines rather than inheriting whatever the host reports.
 */
const VIEWPORTS = [
  { id: "phone", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false },
];

/** `freeze` pins the clock; `wait` is extra settle time for first paint. */
const TARGETS = [
  { id: "tree", url: "/?freeze=2", wait: 2600 },
  { id: "tree-orbit", url: "/?freeze=9", wait: 2600 },
  { id: "panel", url: "/?freeze=3", wait: 2600, action: "select" },
  { id: "nav", url: "/?freeze=2", wait: 2000, action: "nav", phoneOnly: true },
  { id: "dev-scenes", url: "/dev/scenes?freeze=2", wait: 2600 },
  { id: "dev-gallery", url: "/dev/gallery", wait: 1200 },
  { id: "monitor", url: "/monitor", wait: 1200 },
];

/** Stubbed so a shot never depends on engine latency or randomness. */
async function stubRoutes(page) {
  // No egress in CI or the sandbox; let the system stack render instead of
  // holding the screenshot for a font that will never arrive.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route("**/api/causality", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.mode === "epitaph") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ epitaph: "Branch terminated.", provider: "procedural" }),
      });
    }
    const anchor = body.anchorYear ?? 1900;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [
          { year: anchor + 6, title: "Naval yards expand", consequence: "Ports overflow." },
          { year: anchor + 19, title: "Blockade collapses", consequence: "Trade reroutes." },
          { year: anchor + 34, title: "Charters rewritten", consequence: "Maps redrawn." },
        ],
        instability_delta: 16,
        provider: "procedural",
      }),
    });
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => (socket.end(), resolve(true)));
    socket.on("error", () => resolve(false));
    setTimeout(() => (socket.destroy(), resolve(false)), 1000);
  });
}

async function waitForPort(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * The dev server, not `next start`.
 *
 * /dev/scenes and /dev/gallery are deliberately unreachable in a production
 * build, so a production server could never photograph them. Dev also
 * compiles routes on demand, which is why each one is warmed before it is
 * measured.
 */
async function startServer(port) {
  // The local binary, not npx: npx is a wrapper process, and signalling it
  // leaves the real server orphaned.
  const bin = path.resolve("node_modules", ".bin", "next");
  const server = spawn(bin, ["dev", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    // Own process group, so stopIt() can signal the whole tree. Without this
    // the server survives, keeps its stdio pipes open, and the harness never
    // exits - it ran 10 minutes past its last screenshot before being killed.
    detached: true,
  });
  if (!(await waitForPort(port))) {
    stopServer(server);
    throw new Error(`dev server did not come up on ${port}`);
  }
  return server;
}

function stopServer(server) {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    try {
      server.kill("SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

/** First hit to a route in dev pays for compilation; do it before measuring. */
async function warm(browser, port, urls) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  for (const url of urls) {
    try {
      await page.goto(`http://127.0.0.1:${port}${url}`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
    } catch {
      // A route that will not even compile is reported properly below.
    }
  }
  await context.close();
}

/** Interactions that put the page into a state worth photographing. */
async function perform(page, action) {
  if (action === "select") {
    const chips = page.locator("div.absolute.left-0.top-0 > button");
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      const wrapper = chip.locator("xpath=..");
      const visible = await wrapper.evaluate((el) => parseFloat(el.style.opacity || "0"));
      if (visible < 0.5) continue;
      await chip.click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  if (action === "nav") {
    await page.getByRole("button", { name: /open navigation/i }).click();
    await page.waitForTimeout(600);
  }
}

const problems = [];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const port = externalPort ?? 3700;
  const server = externalPort ? null : await startServer(port);
  const browser = await chromium.launch();

  try {
    if (!externalPort) {
      const routes = [...new Set(TARGETS.map((t) => t.url.split("?")[0]))];
      console.log(`warming ${routes.length} routes...`);
      await warm(browser, port, routes);
    }

    for (const viewport of VIEWPORTS) {
      for (const target of TARGETS) {
        if (only && !target.id.includes(only)) continue;
        if (target.phoneOnly && viewport.id !== "phone") continue;

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: viewport.deviceScaleFactor,
          isMobile: viewport.isMobile,
          hasTouch: viewport.isMobile,
        });
        const page = await context.newPage();
        page.on("pageerror", (e) =>
          problems.push(`${target.id}/${viewport.id}: ${e.message.split("\n")[0]}`),
        );
        await stubRoutes(page);

        try {
          await page.goto(`http://127.0.0.1:${port}${target.url}`, {
            waitUntil: "networkidle",
            timeout: 45_000,
          });
          await page.waitForTimeout(target.wait);
          if (target.action) await perform(page, target.action);

          // Horizontal overflow at phone width is the defect that shipped
          // once already, so it is asserted on every run rather than eyeballed.
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          if (overflow > 0) {
            problems.push(`${target.id}/${viewport.id}: ${overflow}px horizontal overflow`);
          }

          const file = path.join(OUT, `${target.id}-${viewport.id}.png`);
          await page.screenshot({ path: file, timeout: 60_000 });
          console.log(`  ${path.relative(process.cwd(), file)}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ""}`);
        } catch (error) {
          problems.push(`${target.id}/${viewport.id}: ${error.message.split("\n")[0]}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nclean: no page errors, no horizontal overflow");
}

await main();
// Explicit: a stray handle from the server's pipes should not be able to hold
// the harness open after the work is done.
process.exit(0);
