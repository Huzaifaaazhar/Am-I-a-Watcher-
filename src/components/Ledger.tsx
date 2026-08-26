"use client";

import type { LedgerEntry, LedgerKind } from "@/lib/types";

const KIND_STYLE: Record<LedgerKind, { tag: string; className: string }> = {
  branch: { tag: "BRANCH", className: "text-moss-200" },
  prune: { tag: "PRUNE", className: "text-gold-400 text-glow-gold" },
  rewrite: { tag: "REWRITE", className: "text-gold-300" },
  reset: { tag: "RESET", className: "text-gold-200" },
  system: { tag: "SYSTEM", className: "text-moss-400" },
  error: { tag: "FAULT", className: "text-gold-600" },
};

function stamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Newest on top, monospace, one line per custodial action. */
export default function Ledger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="panel flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b hairline px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-moss-300">
          Temporal Ledger
        </span>
        <span className="font-mono text-[9px] tabular-nums text-moss-500">
          {entries.length.toString().padStart(3, "0")}
        </span>
      </div>

      <ol className="ledger-scroll flex-1 overflow-y-auto px-3 py-2">
        {entries.map((e) => {
          const style = KIND_STYLE[e.kind];
          return (
            <li
              key={e.id}
              className="border-b border-moss-900/60 py-1.5 font-mono text-[10.5px] leading-snug last:border-0"
            >
              <span className="text-moss-600">[{stamp(e.ts)}]</span>{" "}
              <span className={`font-medium ${style.className}`}>{style.tag}</span>{" "}
              <span className="text-ash/85">{e.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
