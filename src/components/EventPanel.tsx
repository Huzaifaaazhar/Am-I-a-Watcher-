"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hourglass } from "lucide-react";

import type { TimelineNode } from "@/lib/types";
import { LIMITS } from "@/lib/schemas";

interface Props {
  node: TimelineNode;
  originLabel: string;
  busy: string | null;
  /** Small caption shown above the title only while a deviation is in flight. */
  eyebrow?: string;
  /** Shows the orange "DEVIATION DETECTED" bar and pulses the branch button. */
  warning?: boolean;
  onSave: (newTitle: string) => void;
  onBranch: (premise: string) => void;
  onPrune: () => void;
}

const bodyBlurb = (node: TimelineNode) =>
  node.consequence ||
  `${node.title} is woven into the history of the Sacred Timeline. The Time-Variance ` +
    `Authority records no unauthorised deviation from this event as of ${node.year}.`;

/**
 * The card: title, body copy, origin, the "Change Historical Event" form and
 * the two pill actions. This is both the default single panel and - with
 * `eyebrow`/`warning` set - panel one of the three-wide deviation view.
 */
export default function EventPanel({
  node,
  originLabel,
  busy,
  eyebrow,
  warning,
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
    <div className="w-[340px] border-2 border-brass bg-black/95 px-6 py-5">
      {eyebrow && (
        <div className="mb-2 font-sans text-[13px] font-bold uppercase tracking-[0.18em] text-brass">
          {eyebrow}
        </div>
      )}

      <h2 className="font-sans text-[26px] font-extrabold uppercase leading-tight text-brass">
        {node.title}
      </h2>
      <div className="mb-3 mt-1.5 h-[2px] w-full bg-brass" />

      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 bg-warn px-3 py-2 text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.1em] text-black"
        >
          Warning: deviation detected
        </motion.div>
      )}

      <p className="mb-4 font-sans text-[13.5px] leading-relaxed text-ash/90">
        {bodyBlurb(node)}
      </p>

      <div className="mb-4 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-brass">
        Originates from:
      </div>
      <div className="-mt-2.5 mb-4 flex items-center gap-2.5">
        <Hourglass size={22} strokeWidth={1.75} className="shrink-0 text-brass" />
        <span className="font-sans text-[15px] font-bold uppercase leading-tight text-white">
          {originLabel}
        </span>
      </div>

      <div className="mb-4 border-2 border-weave/60 px-3.5 py-3">
        <div className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-brass">
          Change historical event
        </div>

        <label className="block font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-ash/70">
          Form
        </label>
        <input
          value={title}
          maxLength={LIMITS.maxTitle}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          className="mb-2.5 w-full border-0 border-b border-weave/50 bg-transparent py-1 font-sans text-[13px] text-ash outline-none focus:border-weave-bright disabled:opacity-50"
        />

        <label className="block font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-ash/70">
          Description
        </label>
        <input
          value={premise}
          maxLength={LIMITS.maxInput}
          placeholder="the printing press was never invented"
          onChange={(e) => setPremise(e.target.value)}
          disabled={disabled}
          className="mb-2 w-full border-0 border-b border-weave/50 bg-transparent py-1 font-sans text-[13px] text-ash outline-none placeholder:text-ash/30 focus:border-weave-bright disabled:opacity-50"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled || !titleChanged}
            onClick={() => onSave(title.trim())}
            className="rounded-full border-2 border-brass px-5 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-brass transition-colors hover:bg-brass hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brass"
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
            ? { boxShadow: ["0 0 0 0 rgba(212,175,55,0.7)", "0 0 0 10px rgba(212,175,55,0)"] }
            : undefined
        }
        transition={warning ? { duration: 1.4, repeat: Infinity } : undefined}
        className="mb-3 w-full rounded-full bg-pill-blue py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.06em] text-white transition-colors hover:bg-pill-blueDark disabled:cursor-not-allowed disabled:opacity-40"
      >
        Branch New Timeline
      </motion.button>

      <button
        type="button"
        disabled={disabled}
        onClick={onPrune}
        className="w-full rounded-full bg-pill-red py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.06em] text-white transition-colors hover:bg-pill-redDark disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prune Timeline
      </button>
    </div>
  );
}
