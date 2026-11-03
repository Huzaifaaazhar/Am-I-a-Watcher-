"use client";

import type { ReactNode } from "react";

/**
 * The one panel chrome in the interface.
 *
 * A dark translucent ground inside a rounded gold hairline, with a rule under
 * the heading. It used to be a hard rectangle with a bracket notched into
 * each corner; the reference the owner supplied is a rounded frame, and
 * brackets on a radiused corner read as a mistake rather than as a detail.
 *
 * Building it once means a new panel cannot quietly invent its own border
 * weight or radius - which is how an interface stops reading as one system.
 *
 * `tone` only moves the accent. Red is for a destructive surface and amber
 * for a deviation; everything else is brass.
 */

type Tone = "brass" | "red" | "warn";

const FRAME: Record<Tone, string> = {
  brass: "border-brass/70",
  red: "border-pill-red/80",
  warn: "border-warn/80",
};

const RULE: Record<Tone, string> = {
  brass: "bg-brass/55",
  red: "bg-pill-red/55",
  warn: "bg-warn/55",
};

const HEADING: Record<Tone, string> = {
  brass: "text-brass",
  red: "text-pill-red",
  warn: "text-warn",
};

export default function Panel({
  title,
  eyebrow,
  tone = "brass",
  actions,
  children,
  fill = false,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  eyebrow?: string;
  tone?: Tone;
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Take the height its column has going spare and scroll inside. Without it
   * a short list panel sits at the top of a tall rail and whatever is pinned
   * under it is marooned at the bottom with a void between.
   */
  fill?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative rounded-lg border bg-hud-green/95 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] backdrop-blur-[3px] ${
        FRAME[tone]
      } ${fill ? "flex min-h-0 flex-1 flex-col" : ""} ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5 md:px-5">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-brass/65">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                className={`line-clamp-2 font-sans text-[19px] font-extrabold uppercase leading-[1.08] tracking-[0.02em] md:text-[21px] ${HEADING[tone]}`}
              >
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}

      {title && <div className={`mx-4 h-px md:mx-5 ${RULE[tone]}`} />}

      <div
        className={`px-4 py-3 md:px-5 ${
          fill ? "ledger-scroll min-h-0 flex-1 overflow-y-auto" : ""
        } ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
