"use client";

import type { Branch } from "@/lib/types";

/** Right-most panel of the deviation triptych: every branch off the sacred line. */
export default function CurrentDeviationsPanel({
  branches,
  onSelect,
}: {
  branches: Branch[];
  onSelect: (branchId: string) => void;
}) {
  return (
    <div className="w-full border-2 border-brass bg-hud-green/95 px-5 py-5 backdrop-blur-sm md:w-[280px]">
      <h3 className="mb-4 font-sans text-[19px] font-extrabold uppercase tracking-[0.04em] text-brass">
        Current Deviations
      </h3>

      {branches.length === 0 ? (
        <p className="font-sans text-[12px] text-ash/50">No active deviations.</p>
      ) : (
        <ul className="space-y-3">
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className="flex w-full items-center gap-2.5 text-left transition-opacity hover:opacity-80"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pill-red" />
                <span className="font-sans text-[13px] font-bold uppercase tracking-[0.03em] text-white">
                  {b.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
