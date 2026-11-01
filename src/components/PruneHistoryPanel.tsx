"use client";

import Panel from "@/components/ui/Panel";
import type { LedgerEntry } from "@/lib/types";

/** The record of what the custodian has destroyed, newest first. */
export default function PruneHistoryPanel({ entries }: { entries: LedgerEntry[] }) {
  const prunes = entries.filter((e) => e.kind === "prune");
  return (
    <Panel title="Prune History" eyebrow="Custodian ledger" tone="red" className="w-full">
      {prunes.length === 0 ? (
        <p className="py-2 font-sans text-[12px] text-ash/50">
          Nothing has been pruned. Yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {prunes.map((e) => (
            <li
              key={e.id}
              className="border-l-2 border-pill-red/60 pl-3 font-sans text-[12px] leading-relaxed text-white/85"
            >
              <time className="mb-0.5 block font-sans text-[9px] uppercase tracking-[0.2em] text-ash/45">
                {new Date(e.ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
              {e.text}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
