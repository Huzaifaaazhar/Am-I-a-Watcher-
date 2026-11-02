"use client";

import type { ReactNode } from "react";

/**
 * The one panel chrome in the interface.
 *
 * Every surface in the references is the same object: a dark translucent
 * ground, a hairline gold frame, a rule under the heading and a bracket
 * notched into each corner. Building that once means a new panel cannot
 * quietly invent its own border weight - which is how an interface stops
 * reading as one system.
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

const BRACKET: Record<Tone, string> = {
  brass: "border-brass",
  red: "border-pill-red",
  warn: "border-warn",
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
  const corner = `pointer-events-none absolute h-3 w-3 ${BRACKET[tone]}`;
  return (
    <section
      className={`relative border bg-hud-green/95 backdrop-blur-[3px] ${FRAME[tone]} ${
        fill ? "flex min-h-0 flex-1 flex-col" : ""
      } ${className}`}
    >
      <span className={`${corner} -left-px -top-px border-l-2 border-t-2`} />
      <span className={`${corner} -right-px -top-px border-r-2 border-t-2`} />
      <span className={`${corner} -bottom-px -left-px border-b-2 border-l-2`} />
      <span className={`${corner} -bottom-px -right-px border-b-2 border-r-2`} />

      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 px-4 pb-2.5 pt-3.5 md:px-5">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1 font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-brass/70">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                className={`line-clamp-2 font-sans text-[17px] font-extrabold uppercase leading-tight tracking-[0.03em] md:text-[19px] ${HEADING[tone]}`}
              >
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}

      {title && (
        <div
          className={`mx-4 h-px md:mx-5 ${
            tone === "brass" ? "bg-brass/60" : tone === "red" ? "bg-pill-red/60" : "bg-warn/60"
          }`}
        />
      )}

      <div
        className={`px-4 py-3.5 md:px-5 ${
          fill ? "ledger-scroll min-h-0 flex-1 overflow-y-auto" : ""
        } ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
