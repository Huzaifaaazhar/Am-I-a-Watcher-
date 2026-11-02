"use client";

/**
 * Static frame furniture: title block, CRT texture, vignette, and the status
 * strip. Everything here sits above the canvas and below the modals.
 */

/**
 * Monitor glass over the canvas: scanlines, grain and a slow luminance
 * sweep. The wash and the vignette belong to the canvas itself, which owns
 * the painting's own light - doubling them here only muddied it.
 */
export function Texture() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-0 crt-scanlines opacity-[0.18]" />
      <div className="absolute inset-0 crt-grain opacity-[0.045] mix-blend-overlay" />
      {/* Slow luminance sweep - sells the "live monitor" read on camera. */}
      <div className="absolute inset-x-0 top-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-moss-300/[0.04] to-transparent" />
    </div>
  );
}

export function TitleBlock() {
  return (
    <div className="pointer-events-none absolute left-5 top-4 z-30 select-none">
      {/*
        FAN ASSET SLOT
        --------------
        Drop an official title graphic here if you want one - replace this whole
        block with <img src="/fan-assets/title.png" alt="" className="h-12" />.
        Nothing copyrighted is reproduced below: this is an original styled
        wordmark in a freely-licensed slab face.
      */}
      <h1 className="font-display text-[34px] font-extrabold leading-[0.95] tracking-[0.1em] text-moss-200 text-glow-moss">
        AM I A<br />
        <span className="text-gold-400 text-glow-gold">WATCHER?</span>
      </h1>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-px w-8 bg-moss-500/70" />
        <span className="font-mono text-[8.5px] uppercase tracking-[0.3em] text-moss-400">
          Temporal Causality Engine
        </span>
      </div>
    </div>
  );
}

export function StatusStrip({
  branches,
  events,
  degraded,
}: {
  branches: number;
  events: number;
  degraded: boolean;
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-5 z-30 flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.2em] text-moss-500">
      <span>
        Branches <span className="tabular-nums text-moss-200">{branches}</span>
      </span>
      <span className="h-3 w-px bg-moss-800" />
      <span>
        Events <span className="tabular-nums text-moss-200">{events}</span>
      </span>
      <span className="h-3 w-px bg-moss-800" />
      <span className={degraded ? "text-gold-500 animate-flicker" : "text-moss-600"}>
        {degraded ? "Archive degraded" : "Archive nominal"}
      </span>
    </div>
  );
}

/**
 * The foot of the canvas: the interaction hint, with the fan-project
 * disclaimer under it.
 *
 * They are one stacked block rather than two things pinned to the same
 * corner. Pinned separately they collided at every width where the canvas
 * was narrow - the hint centred, the disclaimer right-aligned, both within
 * 20px of the bottom - and no amount of nudging one of them fixed it for all
 * seven viewports.
 */
export function CanvasFooter({ hint }: { hint: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(0.5rem+var(--safe-bottom))] z-30 flex flex-col items-center gap-2 px-4 text-center">
      {/* The painting's foot is where the dark roots are, and mono caps at
          8px over them was unreadable. A short scrim buys the contrast
          without putting a bar across the artwork. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[calc(-0.5rem-var(--safe-bottom))] -z-10 h-28 bg-gradient-to-t from-black/70 via-black/35 to-transparent"
      />
      {hint && (
        <p className="max-w-[34rem] font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.2em] text-moss-600">
          Choose a marker on the tree to branch, prune or rewrite its event
          {/* Hover is desktop-only advice. */}
          <span className="mt-1 hidden text-[8px] tracking-[0.16em] text-moss-800 md:block">
            hover a marker to name it &middot; click to open its timeline
          </span>
        </p>
      )}
      <p className="max-w-[46ch] font-mono text-[7.5px] leading-relaxed text-moss-800">
        Unofficial fan project. Not affiliated with, endorsed by, or sponsored
        by Marvel or Disney.
      </p>
    </div>
  );
}

export function Working({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-3">
      <div className="panel px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-400" />
          </span>
          <span className="animate-flicker font-mono text-[11px] uppercase tracking-[0.22em] text-gold-300 text-glow-gold">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Stamped notice shown when instability tops out and the sequence resets. */
export function ResetStamp({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="animate-stamp-in border-[3px] border-gold-500/80 px-8 py-5 text-center shadow-glow">
        <div className="font-display text-3xl font-extrabold tracking-[0.16em] text-gold-300 text-glow-gold">
          SEQUENCE RESET
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-gold-600">
          {/* Braced so the leading slashes read as copy, not a stray comment. */}
          {"// custodian privileges revoked"}
        </div>
      </div>
    </div>
  );
}

