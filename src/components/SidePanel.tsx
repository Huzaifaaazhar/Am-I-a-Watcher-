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

/** Slide-in panel docked next to the sidebar - used for Branches / Prune History. */
export default function SidePanel({ title, icon: Icon, onClose, children }: Props) {
  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="pointer-events-auto absolute left-5 top-5 z-30 flex max-h-[calc(100vh-2.5rem)] w-[300px] flex-col overflow-hidden border border-weave/25 bg-abyss/95"
    >
      <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-[0.18]" />
      <div className="relative flex items-center justify-between border-b border-weave/20 px-3.5 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-weave-bright">
          <Icon size={13} strokeWidth={1.75} />
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-weave/30 px-1.5 py-0.5 font-mono text-[9px] text-ash/60 hover:border-weave-bright/60 hover:text-weave-bright"
        >
          ✕
        </button>
      </div>
      <div className="relative flex-1 overflow-y-auto ledger-scroll px-3.5 py-3">{children}</div>
    </motion.div>
  );
}
