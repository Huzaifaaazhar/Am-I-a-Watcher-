"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
}

/** Slide-in card docked top-left of the canvas - used for Branches / Prune History. */
export default function SidePanel({ title, icon: Icon, onClose, children }: Props) {
  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="pointer-events-auto absolute left-6 top-6 z-30 flex max-h-[calc(100vh-3rem)] w-[300px] flex-col overflow-hidden border-2 border-brass bg-black/95"
    >
      <div className="flex items-center justify-between border-b-2 border-brass/70 px-4 py-3">
        <div className="flex items-center gap-2 font-sans text-[15px] font-extrabold uppercase tracking-[0.08em] text-brass">
          <Icon size={16} strokeWidth={2} />
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-brass/60 px-2 py-0.5 font-sans text-[11px] font-bold text-brass hover:bg-brass hover:text-black"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto ledger-scroll px-4 py-3.5">{children}</div>
    </motion.div>
  );
}
