"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

import { Alert } from "@/components/icons";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";

/**
 * Pruning is the one action here that destroys something, and it used to fire
 * the instant the button was pressed. It now asks first, names what dies and
 * says what it costs.
 *
 * Focus moves to Cancel rather than to the destructive button, and Escape
 * backs out - a confirmation whose default is "yes" is a speed bump, not a
 * confirmation.
 */
export default function PruneConfirm({
  timelineLabel,
  anchorTitle,
  eventCount,
  branchCount,
  onCancel,
  onConfirm,
}: {
  timelineLabel: string;
  anchorTitle: string;
  eventCount: number;
  branchCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Cancel prune"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[2px]"
      />
      <motion.div
        role="alertdialog"
        aria-modal
        aria-labelledby="prune-title"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-[420px]"
      >
        <Panel tone="red" title="Prune timeline" eyebrow="Irreversible" className="shadow-glow">
          <div className="mb-3 flex items-start gap-3 border border-pill-red/50 bg-pill-red/15 px-3 py-2.5">
            <Alert size={18} className="mt-px shrink-0 text-pill-red" />
            <p id="prune-title" className="font-sans text-[12.5px] leading-relaxed text-white">
              Everything downstream of{" "}
              <span className="font-bold text-brass">{anchorTitle}</span> on{" "}
              <span className="font-bold uppercase text-brass">{timelineLabel}</span> ceases to
              have happened.
            </p>
          </div>

          <dl className="mb-4 grid grid-cols-2 gap-px border border-brass/25 bg-brass/20">
            <div className="bg-hud-black/60 px-3 py-2">
              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brass/65">
                Events erased
              </dt>
              <dd className="font-sans text-[15px] font-extrabold text-pill-red tabular-nums">
                {eventCount}
              </dd>
            </div>
            <div className="bg-hud-black/60 px-3 py-2">
              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brass/65">
                Timelines ended
              </dt>
              <dd className="font-sans text-[15px] font-extrabold text-pill-red tabular-nums">
                {branchCount}
              </dd>
            </div>
          </dl>

          <p className="mb-4 font-sans text-[11.5px] leading-relaxed text-ash/70">
            The record of the prune is kept in the ledger. The events are not.
          </p>

          <div className="flex gap-2.5">
            <Button ref={cancelRef} variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              Prune it
            </Button>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
