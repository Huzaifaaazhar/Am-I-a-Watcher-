"use client";

import Panel from "@/components/ui/Panel";
import type { LedgerEntry } from "@/lib/types";

const COLOUR: Record<string, string> = {
  branch: "text-pill-blue",
  prune: "text-pill-red",
  rewrite: "text-warn",
  reset: "text-brass",
  error: "text-pill-red",
  system: "text-weave",
};

/**
 * The last few things that happened, pinned to the foot of the rail.
 *
 * It earns its place twice: the column below a short panel was otherwise a
 * black void on every desktop screenshot, and an interface that performs
 * irreversible acts should show its own recent history without being asked.
 */
export default function LedgerStrip({ entries }: { entries: LedgerEntry[] }) {
  return (
    <Panel title="Ledger" className="w-full" bodyClassName="py-2.5">
      <ul className="space-y-1.5">
        {entries.slice(0, 5).map((e) => (
          <li
            key={e.id}
            className="flex gap-2 font-sans text-[10.5px] leading-snug text-ash/65"
          >
            <span
              aria-hidden
              className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
                COLOUR[e.kind] ?? "text-ash"
              }`}
            />
            <span className="line-clamp-2">{e.text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
