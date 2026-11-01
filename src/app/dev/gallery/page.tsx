"use client";

import { useState } from "react";

import EventPanel from "@/components/EventPanel";
import CurrentDeviationsPanel from "@/components/CurrentDeviationsPanel";
import TimelineViewerPanel from "@/components/TimelineViewerPanel";
import InstabilityGauge from "@/components/InstabilityGauge";
import HornBadge from "@/components/HornBadge";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import { Working, ResetStamp, Hint } from "@/components/Chrome";
import Button, { type ButtonVariant } from "@/components/ui/Button";
import * as Icons from "@/components/icons";
import type { Branch, TimelineNode } from "@/lib/types";

/**
 * Dev-only component gallery.
 *
 * Every component in each of its states, so a state that only appears after a
 * three-step interaction can still be looked at. Excluded from production by
 * the guard in src/app/dev/layout.tsx.
 *
 * Phase 4 fills in the states that do not exist yet - loading and error on the
 * panels, and the full button and input matrix once those become real
 * components rather than inline Tailwind.
 */

const NODE: TimelineNode = {
  id: "demo",
  parentId: null,
  branchId: "prime",
  year: 1876,
  title: "Telephone patented",
  consequence:
    "The telephone is woven into the history of the Sacred Timeline. The Time-Variance Authority records no unauthorised deviation from this event.",
  status: "alive",
  origin: "seed",
  bornAt: 0,
};

const DEVIATIONS: Branch[] = [
  {
    id: "b1",
    label: "Napoleon focuses on naval supremacy",
    status: "alive",
    originNodeId: "demo",
    depth: 1,
    index: 1,
  },
  {
    id: "b2",
    label: "The printing press was never invented",
    status: "alive",
    originNodeId: "demo",
    depth: 1,
    index: 2,
  },
];

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-12 w-full rounded-sm border border-white/10 ${className}`} />
      <span className="font-mono text-[9px] text-ash/50">{name}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 border-b border-brass/25 pb-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.16em] text-brass">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function GalleryPage() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-y-auto bg-hud-black px-6 py-6 text-ash">
      <h1 className="mb-8 font-sans text-[20px] font-extrabold uppercase tracking-[0.1em] text-brass">
        Component gallery
      </h1>

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-9">
          <Swatch name="hud.green" className="bg-hud-green" />
          <Swatch name="hud.greenDark" className="bg-hud-greenDark" />
          <Swatch name="hud.panel" className="bg-hud-panel" />
          <Swatch name="hud.black" className="bg-hud-black" />
          <Swatch name="brass" className="bg-brass" />
          <Swatch name="weave" className="bg-weave" />
          <Swatch name="warn" className="bg-warn" />
          <Swatch name="pill.blue" className="bg-pill-blue" />
          <Swatch name="pill.red" className="bg-pill-red" />
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-1.5">
          {([72, 56, 40, 28, 20, 16, 14, 12] as const).map((size) => (
            <div key={size} className="flex items-baseline gap-4">
              <span className="w-10 shrink-0 font-mono text-[9px] text-ash/40">{size}</span>
              <span
                className="truncate font-sans font-extrabold uppercase leading-[0.95] text-brass"
                style={{ fontSize: `${size}px` }}
              >
                Sacred Timeline
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icons">
        <p className="mb-3 max-w-[60ch] font-sans text-[12px] leading-relaxed text-ash/50">
          One 24px grid, one stroke weight, square caps and mitred joins, to match the
          panels&rsquo; hard corners. Replaces a general-purpose library that was mixed with a
          single hand-drawn badge.
        </p>
        <div className="flex flex-wrap gap-5">
          {(
            [
              ["Close", Icons.Close],
              ["Menu", Icons.Menu],
              ["Hourglass", Icons.Hourglass],
              ["Branch", Icons.Branch],
              ["Prune", Icons.Prune],
              ["Ledger", Icons.Ledger],
              ["Alert", Icons.Alert],
              ["Spinner", Icons.Spinner],
            ] as const
          ).map(([name, Glyph]) => (
            <div key={name} className="flex w-16 flex-col items-center gap-1.5">
              <span className="flex h-11 w-11 items-center justify-center border border-brass/25 text-brass">
                <Glyph size={24} />
              </span>
              <span className="font-mono text-[9px] text-ash/45">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="space-y-4">
          {(["commit", "danger", "quiet", "ghost"] as ButtonVariant[]).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="w-16 font-mono text-[9px] text-ash/45">{variant}</span>
              <div className="w-[190px]">
                <Button variant={variant}>Default</Button>
              </div>
              <div className="w-[190px]">
                <Button variant={variant} disabled>
                  Disabled
                </Button>
              </div>
              <div className="w-[190px]">
                <Button variant={variant} loading loadingLabel="Working">
                  Loading
                </Button>
              </div>
              <Button variant={variant} size="sm">
                Small
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Instability gauge">
        <div className="flex flex-wrap gap-6">
          {[0, 35, 72, 100].map((v) => (
            <div key={v} className="flex flex-col items-center gap-1">
              <InstabilityGauge value={v} />
              <span className="font-mono text-[9px] text-ash/40">{v}%</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Horn badge">
        <div className="flex items-end gap-6">
          {[28, 44, 64].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <HornBadge size={s} ringClassName="text-brass" fillClassName="text-hud-black" />
              <span className="font-mono text-[9px] text-ash/40">{s}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Event panel">
        <div className="flex flex-wrap gap-5">
          <div>
            <p className="mb-1.5 font-mono text-[9px] text-ash/40">default</p>
            <EventPanel
              node={NODE}
              originLabel="The Sacred Timeline"
              busy={null}
              onClose={() => {}}
              onSave={() => {}}
              onBranch={() => {}}
              onPrune={() => {}}
            />
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[9px] text-ash/40">
              busy — branch in flight, spinner on the action that caused it
            </p>
            <EventPanel
              node={NODE}
              originLabel="The Sacred Timeline"
              busy="Computing causal cascade"
              onClose={() => {}}
              onSave={() => {}}
              onBranch={() => {}}
              onPrune={() => {}}
            />
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[9px] text-ash/40">deviation warning</p>
            <EventPanel
              node={NODE}
              originLabel="The Sacred Timeline"
              busy={null}
              eyebrow="Timeline editor"
              warning
              onClose={() => {}}
              onSave={() => {}}
              onBranch={() => {}}
              onPrune={() => {}}
            />
          </div>
        </div>
      </Section>

      <Section title="Deviation triptych">
        <div className="flex flex-wrap gap-5">
          <TimelineViewerPanel
            premise="Napoleon focuses on naval supremacy"
            branchLabel="Napoleon focuses on naval supremacy"
          />
          <CurrentDeviationsPanel
            branches={DEVIATIONS}
            onSelect={() => {}}
          />
        </div>
      </Section>

      <Section title="Chrome overlays">
        <div className="relative h-56 overflow-hidden rounded-sm border border-brass/25 bg-hud-greenDark">
          <Working label="Rewriting the Sacred Timeline" />
        </div>
        <div className="relative mt-4 h-56 overflow-hidden rounded-sm border border-brass/25 bg-hud-greenDark">
          <ResetStamp visible />
        </div>
        <div className="relative mt-4 h-24 overflow-hidden rounded-sm border border-brass/25 bg-hud-greenDark">
          <Hint visible />
        </div>
      </Section>

      <Section title="Navigation">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          className="mb-3 rounded-sm border border-brass/50 px-3 py-1 font-mono text-[10px] uppercase text-brass"
        >
          toggle mobile drawer
        </button>
        <div className="relative h-[460px] overflow-hidden rounded-sm border border-brass/25">
          <TopBar onToggleNav={() => setNavOpen(true)} />
          <div className="relative flex h-[calc(100%-62px)]">
            <Sidebar
              activePanel={null}
              onSelectPanel={() => {}}
              onResetView={() => {}}
              open={navOpen}
              onClose={() => setNavOpen(false)}
            />
            <div className="flex-1 bg-hud-greenDark" />
          </div>
        </div>
      </Section>
    </div>
  );
}
