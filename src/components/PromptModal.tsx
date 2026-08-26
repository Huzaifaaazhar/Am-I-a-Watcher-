"use client";

import { useEffect, useRef, useState } from "react";

import { LIMITS } from "@/lib/schemas";

interface Props {
  open: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** Text entry for BRANCH premises and REWRITE edits. */
export default function PromptModal({
  open,
  title,
  subtitle,
  placeholder,
  initialValue = "",
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // Defer so the element exists and the browser honours the focus.
      const id = requestAnimationFrame(() => input.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= LIMITS.maxInput;

  const submit = () => {
    if (valid) onConfirm(trimmed);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-void/80 backdrop-blur-sm">
      <div className="panel w-[min(520px,92vw)] animate-stamp-in p-5" style={{ transform: "none" }}>
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-gold-600">
          {subtitle}
        </div>
        <h2 className="mb-4 font-display text-xl font-bold text-moss-200 text-glow-moss">
          {title}
        </h2>

        <textarea
          ref={input}
          value={value}
          rows={3}
          maxLength={LIMITS.maxInput}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none rounded-sm border border-moss-600/50 bg-void/90 px-3 py-2 font-mono text-[13px] text-ash placeholder:text-moss-700 focus:border-gold-600/70 focus:outline-none focus:ring-1 focus:ring-gold-700/40"
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[9px] tabular-nums text-moss-600">
            {trimmed.length} / {LIMITS.maxInput}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-sm border border-moss-700/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-moss-400 transition-colors hover:border-moss-500 hover:text-moss-200"
            >
              Abort
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!valid}
              className="rounded-sm border border-gold-600/70 bg-gold-900/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300 transition-all hover:border-gold-400 hover:bg-gold-800/50 hover:text-gold-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {confirmLabel}
            </button>
          </div>
        </div>

        <p className="mt-3 border-t hairline pt-2 font-mono text-[8.5px] leading-relaxed text-moss-700">
          Entries are recorded as historical premise data. The archive does not
          take instructions from custodians.
        </p>
      </div>
    </div>
  );
}
