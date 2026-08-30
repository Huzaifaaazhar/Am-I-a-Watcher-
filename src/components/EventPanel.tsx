"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hourglass, X } from "lucide-react";

import type { TimelineNode } from "@/lib/types";
import { LIMITS } from "@/lib/schemas";

interface Props {
  node: TimelineNode;
  originLabel: string;
  busy: string | null;
  eyebrow?: string;
  warning?: boolean;
  onClose: () => void;
  onSave: (newTitle: string) => void;
  onBranch: (premise: string) => void;
  onPrune: () => void;
}

const blurb = (node: TimelineNode) =>
  node.consequence ||
  `${node.title} is woven into the history of the Sacred Timeline. The Time-Variance ` +
    `Authority records no unauthorised deviation from this event as of ${node.year}.`;

/**
 * The control card for one event: description, origin, the edit form and the
 * two actions. Doubles as panel one of the deviation triptych when `eyebrow`
 * and `warning` are set.
 */
export default function EventPanel({
  node,
  originLabel,
  busy,
  eyebrow,
  warning,
  onClose,
  onSave,
  onBranch,
  onPrune,
}: Props) {
  const [title, setTitle] = useState(node.title);
  const [premise, setPremise] = useState("");

  useEffect(() => {
    setTitle(node.title);
    setPremise("");
  }, [node.id, node.title]);

  const titleChanged = title.trim().length > 0 && title.trim() !== node.title;
  const canBranch = premise.trim().length > 0 && premise.trim().length <= LIMITS.maxInput;
  const disabled = Boolean(busy);

  return (
    <div className="w-full border-2 border-brass bg-hud-green/95 px-5 py-4 backdrop-blur-sm md:w-[340px] md:px-6 md:py-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 font-sans text-[12px] font-bold uppercase tracking-[0.18em] text-brass md:text-[13px]">
              {eyebrow}
            </div>
          )}
          <h2 className="font-sans text-[21px] font-extrabold uppercase leading-tight text-brass md:text-[26px]">
            {node.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-mr-1 -mt-1 shrink-0 rounded-sm p-1 text-brass/70 hover:text-brass"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      </div>
      <div className="mb-3 mt-1.5 h-[2px] w-full bg-brass" />

      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 bg-warn px-3 py-2 text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.08em] text-black"
        >
          Warning: deviation detected
        </motion.div>
      )}

      <p className="mb-4 font-sans text-[13px] leading-relaxed text-ash md:text-[13.5px]">
        {blurb(node)}
      </p>

      <div className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-brass">
        Originates from:
      </div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brass bg-hud-black">
          <Hourglass size={17} strokeWidth={2} className="text-brass" />
        </span>
        <span className="font-sans text-[14px] font-bold uppercase leading-tight text-white md:text-[15px]">
          {originLabel}
        </span>
      </div>

      <div className="mb-4 border-2 border-brass/60 px-3.5 py-3">
        <div className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-brass">
          Change historical event
        </div>

        <label className="block font-sans text-[11px] text-ash/75">Form</label>
        <input
          value={title}
          maxLength={LIMITS.maxTitle}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          className="mb-2.5 w-full border border-brass/50 bg-hud-black/40 px-2 py-1.5 font-sans text-[13px] text-white outline-none focus:border-brass disabled:opacity-50"
        />

        <label className="block font-sans text-[11px] text-ash/75">Description</label>
        <input
          value={premise}
          maxLength={LIMITS.maxInput}
          placeholder="the printing press was never invented"
          onChange={(e) => setPremise(e.target.value)}
          disabled={disabled}
          className="mb-2.5 w-full border-0 border-b border-brass/40 bg-transparent py-1 font-sans text-[13px] text-white outline-none placeholder:text-ash/35 focus:border-brass disabled:opacity-50"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled || !titleChanged}
            onClick={() => onSave(title.trim())}
            className="rounded-full border-2 border-brass px-6 py-1 font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-brass transition-colors hover:bg-brass hover:text-hud-black disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-brass"
          >
            Save
          </button>
        </div>
      </div>

      <motion.button
        type="button"
        disabled={disabled || !canBranch}
        onClick={() => onBranch(premise.trim())}
        animate={
          warning
            ? { boxShadow: ["0 0 0 0 rgba(232,195,74,0.75)", "0 0 0 12px rgba(232,195,74,0)"] }
            : undefined
        }
        transition={warning ? { duration: 1.5, repeat: Infinity } : undefined}
        className="mb-2.5 w-full rounded-full border border-brass/40 bg-pill-blue py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pill-blueDark disabled:cursor-not-allowed disabled:opacity-45"
      >
        Branch New Timeline
      </motion.button>

      <button
        type="button"
        disabled={disabled}
        onClick={onPrune}
        className="w-full rounded-full border border-brass/40 bg-pill-red py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pill-redDark disabled:cursor-not-allowed disabled:opacity-45"
      >
        Prune Timeline
      </button>
    </div>
  );
}
