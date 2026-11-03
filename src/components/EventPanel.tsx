"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";

import { Close, Hourglass } from "@/components/icons";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import Medallion from "@/components/ui/Medallion";
import type { Branch, TimelineNode } from "@/lib/types";
import { PRIME_BRANCH_ID } from "@/lib/seed";
import { LIMITS } from "@/lib/schemas";

/**
 * The control surface for one event: what it is, which timeline it belongs
 * to, how to change it and the two things that can be done to it.
 *
 * It is one panel in both states the references show - on its own beside the
 * tree, and as the left panel of the deviation triptych, where `warning`
 * raises the deviation bar and the branch action takes the pulsing ring.
 */

interface Props {
  node: TimelineNode;
  branch: Branch | undefined;
  /** How many events live on this node's timeline. */
  siblingCount: number;
  busy: string | null;
  warning?: boolean;
  /** Fill its column and scroll inside, so the frame stays whole. */
  fill?: boolean;
  onClose: () => void;
  onSave: (newTitle: string) => void;
  onBranch: (premise: string) => void;
  onPrune: () => void;
}

/**
 * Which action the custodian is waiting on. `busy` is the status line's own
 * copy, so naming the strings in one place keeps the spinner tied to wording
 * that exists to be read - an earlier version guessed and the spinner
 * silently never appeared.
 */
const BUSY = {
  branch: "Computing causal cascade",
  rewrite: "Regenerating downstream",
  prune: "Composing epitaph",
} as const;

/**
 * The small word beside the year. For a seeded event it names the strand it
 * came from - recorded history, the saga, or whatever the archive let
 * through - which is the only place in the interface those are told apart.
 */
function KIND(node: TimelineNode): string {
  if (node.origin === "rewritten") return "Rewritten";
  if (node.origin === "generated") return "Consequent";
  if (node.strand === "saga") return "Saga record";
  if (node.strand === "anomaly") return "Anomaly";
  return "Recorded";
}

const blurb = (node: TimelineNode) =>
  node.consequence ||
  `${node.title} is woven into the history of the Sacred Timeline. The Time-Variance ` +
    `Authority records no unauthorised deviation from this event as of ${node.year}.`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brass/70">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function EventPanel({
  node,
  branch,
  siblingCount,
  busy,
  warning,
  fill = false,
  onClose,
  onSave,
  onBranch,
  onPrune,
}: Props) {
  const ids = useId();
  const [title, setTitle] = useState(node.title);
  const [premise, setPremise] = useState("");

  useEffect(() => {
    setTitle(node.title);
    setPremise("");
  }, [node.id, node.title]);

  const titleChanged = title.trim().length > 0 && title.trim() !== node.title;
  const canBranch = premise.trim().length > 0 && premise.trim().length <= LIMITS.maxInput;
  const disabled = Boolean(busy);
  const onPrime = node.branchId === PRIME_BRANCH_ID;

  return (
    <Panel
      eyebrow={warning ? "Timeline editor" : onPrime ? "Sacred timeline" : "Deviant branch"}
      title={node.title}
      tone={warning ? "warn" : "brass"}
      fill={fill}
      actions={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-mr-1 -mt-1 shrink-0 rounded-sm p-1 text-brass/70 transition-colors hover:text-brass"
        >
          <Close size={18} />
        </button>
      }
    >
      <div className="mb-2 flex items-baseline gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.18em]">
        <span className="text-brass tabular-nums">{node.year}</span>
        <span className="text-brass/40">·</span>
        <span className="text-ash/55">{KIND(node)}</span>
      </div>

      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 bg-warn px-3 py-2 text-center font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-black md:text-[12px]"
        >
          Warning: deviation detected
        </motion.div>
      )}

      <p className="mb-3.5 font-sans text-[12.5px] leading-relaxed text-ash/90">{blurb(node)}</p>

      <Field label="Originates from:">
        <div className="flex items-center gap-3">
          <Medallion icon={Hourglass} size={40} />
          <span className="min-w-0 font-sans text-[13px] font-bold uppercase leading-tight text-white">
            {onPrime ? "The Sacred Timeline" : branch?.label ?? "Unknown branch"}
          </span>
        </div>
      </Field>

      <div className="mb-3 flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-[0.16em]">
        <span className={onPrime ? "text-weave" : "text-warn"}>
          {onPrime ? "Nominal" : "Deviant"}
        </span>
        <span className="text-brass/35">·</span>
        <span className="text-ash/55">
          <span className="tabular-nums text-ash/80">{siblingCount}</span> events on this
          timeline
        </span>
      </div>

      <div className="mb-3 rounded-md border border-brass/45 px-3.5 py-3">
        <div className="mb-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-brass">
          Change historical event
        </div>

        <label
          htmlFor={`${ids}-name`}
          className="block font-sans text-[10px] uppercase tracking-[0.14em] text-ash/60"
        >
          Event name
        </label>
        <input
          id={`${ids}-name`}
          value={title}
          maxLength={LIMITS.maxTitle}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          className="mb-2.5 w-full rounded-md border border-brass/40 bg-hud-black/50 px-2.5 py-1.5 font-sans text-[13px] text-white outline-none transition-colors focus:border-brass disabled:opacity-50"
        />

        <div className="flex justify-end">
          <Button
            variant="quiet"
            size="sm"
            disabled={disabled || !titleChanged}
            loading={busy === BUSY.rewrite}
            loadingLabel="Saving"
            onClick={() => onSave(title.trim())}
          >
            Save
          </Button>
        </div>
      </div>

      {/*
        The premise lives with the action it arms, not in the edit box above.
        It used to sit under "Event name" beside a Save button, which read as
        part of the rewrite - so Branch New Timeline looked permanently dead
        and nothing in the panel said what would wake it.
      */}
      <div className="mb-2.5 rounded-md border border-pill-blue/50 bg-pill-blue/[0.07] px-3.5 py-3">
        <div className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-brass">
          Branch a new timeline
        </div>

        <label
          htmlFor={`${ids}-premise`}
          className="block font-sans text-[10px] uppercase tracking-[0.14em] text-ash/60"
        >
          What happens instead?{" "}
          <span className="text-pill-blue" aria-hidden>
            *
          </span>
        </label>
        <input
          id={`${ids}-premise`}
          value={premise}
          maxLength={LIMITS.maxInput}
          placeholder="Napoleon wins at Waterloo"
          onChange={(e) => setPremise(e.target.value)}
          disabled={disabled}
          aria-describedby={canBranch ? undefined : `${ids}-why`}
          className="mb-3 w-full border-0 border-b border-brass/35 bg-transparent py-1 font-sans text-[13px] text-white outline-none transition-colors placeholder:italic placeholder:text-ash/30 focus:border-brass disabled:opacity-50"
        />

        <motion.div
          animate={
            warning
              ? { boxShadow: ["0 0 0 0 rgba(232,195,74,0.7)", "0 0 0 12px rgba(232,195,74,0)"] }
              : undefined
          }
          transition={warning ? { duration: 1.6, repeat: Infinity } : undefined}
          className="rounded-full"
        >
          <Button
            variant="commit"
            disabled={disabled || !canBranch}
            loading={busy === BUSY.branch}
            loadingLabel="Branching"
            onClick={() => onBranch(premise.trim())}
          >
            Branch New Timeline
          </Button>
        </motion.div>

        {/* Why the button is dark, said where the button is. */}
        {!canBranch && !busy && (
          <p
            id={`${ids}-why`}
            className="mt-2 font-sans text-[11px] leading-snug text-ash/55"
          >
            Describe the change above and this becomes available.
          </p>
        )}
      </div>

      <Button
        variant="danger"
        disabled={disabled}
        loading={busy === BUSY.prune}
        loadingLabel="Pruning"
        onClick={onPrune}
      >
        Prune Timeline
      </Button>
    </Panel>
  );
}
