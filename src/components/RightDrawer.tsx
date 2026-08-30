"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Edit3, GitBranch, Shield, Trash2 } from "lucide-react";

import type { TimelineNode } from "@/lib/types";
import { LIMITS } from "@/lib/schemas";

interface Props {
  node: TimelineNode;
  originLabel: string;
  /** Whether this event has already spawned at least one branch. */
  hasDeviation: boolean;
  busy: string | null;
  onClose: () => void;
  onSave: (newTitle: string) => void;
  onBranch: (premise: string) => void;
  onPrune: () => void;
}

/**
 * A tiny dual-line "Sacred Timeline vs. new branch" preview. Purely
 * illustrative - not a data chart - so it is plain inline SVG rather than
 * the dataviz-skill machinery, which is for real measured series.
 */
function DeviationPreview() {
  return (
    <div className="rounded-sm border border-weave/25 bg-abyss-deep/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-weave-bright">
        <Shield size={11} strokeWidth={1.75} />
        Timeline viewer
      </div>
      <svg viewBox="0 0 200 56" className="w-full">
        <line x1="0" y1="28" x2="200" y2="28" stroke="rgba(16,185,129,0.15)" strokeWidth="1" />
        {/* Shared history, then the sacred line continues flat... */}
        <path d="M0 28 L100 28 L200 20" stroke="#10B981" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* ...while the deviation peels off. */}
        <path
          d="M100 28 L200 48"
          stroke="#FF9900"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="1 4"
        />
        <circle cx="100" cy="28" r="3.5" fill="#D4AF37" />
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[7.5px] uppercase tracking-[0.14em]">
        <span className="text-weave-bright">Sacred timeline</span>
        <span className="text-warn">Deviation created</span>
      </div>
    </div>
  );
}

export default function RightDrawer({
  node,
  originLabel,
  hasDeviation,
  busy,
  onClose,
  onSave,
  onBranch,
  onPrune,
}: Props) {
  const [title, setTitle] = useState(node.title);
  const [premise, setPremise] = useState("");

  // Re-sync the form whenever a different world is selected.
  useEffect(() => {
    setTitle(node.title);
    setPremise("");
  }, [node.id, node.title]);

  const titleChanged = title.trim().length > 0 && title.trim() !== node.title;
  const canBranch = premise.trim().length > 0 && premise.trim().length <= LIMITS.maxInput;
  const disabled = Boolean(busy);

  return (
    <motion.aside
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-[320px] flex-col overflow-y-auto border-l border-weave/25 bg-abyss/95"
    >
      <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-[0.18]" />

      <div className="relative border-b border-weave/20 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-weave-bright/80">
              {node.year}
            </div>
            <h2 className="mt-0.5 font-display text-[15px] font-bold leading-snug text-brass">
              {node.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm border border-weave/30 px-1.5 py-1 font-mono text-[9px] text-ash/60 hover:border-weave-bright/60 hover:text-weave-bright"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="flex items-center gap-1.5 rounded-sm border border-weave/20 bg-abyss-panel/50 px-3 py-2 font-mono text-[9.5px] text-ash/80">
          <Clock size={13} strokeWidth={1.75} className="shrink-0 text-weave-bright" />
          <span className="uppercase tracking-[0.1em] text-ash/50">Originates from</span>
        </div>
        <div className="-mt-2.5 pl-1 font-mono text-[11px] uppercase tracking-[0.08em] text-brass">
          {originLabel}
        </div>

        {node.consequence && (
          <div className="rounded-sm border border-weave/20 bg-abyss-panel/40 px-3 py-2.5">
            <div className="mb-1 font-mono text-[7.5px] uppercase tracking-[0.2em] text-weave-bright/70">
              Case file
            </div>
            <p className="font-mono text-[10.5px] leading-relaxed text-ash/80">
              {node.consequence}
            </p>
          </div>
        )}

        {hasDeviation && <DeviationPreview />}

        <div className="border-t border-weave/15 pt-4">
          <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-weave-bright">
            <Edit3 size={12} strokeWidth={1.75} />
            Change historical event
          </div>

          <label className="mb-1 block font-mono text-[8px] uppercase tracking-[0.16em] text-ash/50">
            Title
          </label>
          <input
            value={title}
            maxLength={LIMITS.maxTitle}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled}
            className="mb-3 w-full rounded-sm border border-weave/30 bg-abyss-deep/70 px-2.5 py-1.5 font-mono text-[11px] text-ash outline-none focus:border-weave-bright/70 disabled:opacity-50"
          />

          <label className="mb-1 block font-mono text-[8px] uppercase tracking-[0.16em] text-ash/50">
            What if… (branch premise)
          </label>
          <textarea
            value={premise}
            maxLength={LIMITS.maxInput}
            rows={3}
            placeholder="the printing press was never invented"
            onChange={(e) => setPremise(e.target.value)}
            disabled={disabled}
            className="mb-1 w-full resize-none rounded-sm border border-weave/30 bg-abyss-deep/70 px-2.5 py-1.5 font-mono text-[10.5px] text-ash outline-none placeholder:text-ash/30 focus:border-weave-bright/70 disabled:opacity-50"
          />
          <div className="mb-3 text-right font-mono text-[8px] tabular-nums text-ash/35">
            {premise.length}/{LIMITS.maxInput}
          </div>

          <button
            type="button"
            disabled={disabled || !titleChanged}
            onClick={() => onSave(title.trim())}
            className="mb-3 w-full rounded-sm border border-weave-bright/50 bg-weave/10 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-weave-bright transition-colors hover:bg-weave/20 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>

      <div className="relative mt-auto space-y-2.5 border-t border-weave/20 px-4 py-4">
        <button
          type="button"
          disabled={disabled || !canBranch}
          onClick={() => onBranch(premise.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-weave-bright/60 bg-weave/15 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-weave-bright shadow-[0_0_18px_-6px_rgba(0,255,204,0.5)] transition-all hover:bg-weave/25 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
        >
          <GitBranch size={14} strokeWidth={2} />
          Branch new timeline
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onPrune}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-warn-deep/70 bg-warn-deep/15 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn shadow-[0_0_18px_-6px_rgba(255,153,0,0.45)] transition-all hover:bg-warn-deep/25 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
        >
          <Trash2 size={14} strokeWidth={2} />
          Prune timeline
        </button>

        <div className="flex items-start gap-1.5 pt-1 font-mono text-[7.5px] leading-relaxed text-ash/35">
          <AlertTriangle size={11} strokeWidth={1.75} className="mt-px shrink-0" />
          Entries are recorded as historical premise data. The archive does not
          take instructions from custodians.
        </div>
      </div>
    </motion.aside>
  );
}
