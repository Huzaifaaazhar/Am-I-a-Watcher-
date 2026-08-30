"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

/** Amber TVA ticker: fires briefly when a branch splits off the timeline. */
export default function DeviationBanner({ year }: { year: number }) {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-2 border border-warn/70 bg-warn-deep/25 px-4 py-2 shadow-[0_0_24px_-4px_rgba(255,153,0,0.6)] backdrop-blur-[2px]">
        <AlertTriangle size={14} strokeWidth={2} className="animate-flicker text-warn" />
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-warn">
          Warning: deviation detected — timeline split at {year}
        </span>
      </div>
    </motion.div>
  );
}
