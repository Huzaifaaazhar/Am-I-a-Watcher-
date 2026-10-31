"use client";

import { useGraphics } from "./GraphicsProvider";
import type { QualitySetting } from "@/lib/capabilities";

/**
 * Graphics: Auto / High / Low.
 *
 * Auto shows the tier it has settled on, because "Auto" alone tells you
 * nothing about what you are actually getting - and the tier moves on its own
 * as the frame rate is measured, so a reader deserves to see it change.
 */

const OPTIONS: { value: QualitySetting; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

export default function GraphicsSetting({ className = "" }: { className?: string }) {
  const { setting, setSetting, tier, mode } = useGraphics();

  // Nothing to tune when there is no scene to tune.
  if (mode !== "3d") return null;

  return (
    <div className={`pointer-events-auto ${className}`}>
      <div
        role="group"
        aria-label="Graphics quality"
        className="flex items-center gap-1 rounded-sm border border-brass/35 bg-hud-black/80 p-1 backdrop-blur-sm"
      >
        <span className="px-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ash/45">
          Gfx
        </span>
        {OPTIONS.map((option) => {
          const active = setting === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSetting(option.value)}
              aria-pressed={active}
              className={`rounded-[2px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brass ${
                active
                  ? "bg-brass/85 text-hud-black"
                  : "text-ash/60 hover:bg-brass/15 hover:text-brass"
              }`}
            >
              {option.label}
              {option.value === "auto" && active && (
                <span className="ml-1 text-hud-black/65">({tier})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
