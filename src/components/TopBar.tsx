"use client";

import { Menu } from "@/components/icons";

import HornBadge from "./HornBadge";

/**
 * Full-width header. On phones the wordmark shrinks, "PROFILE" drops away and
 * a hamburger appears, since the sidebar collapses off-canvas at that size.
 *
 * It steps rather than jumping from 62 to 92: at 92 on a 700px-tall laptop the
 * header was thirteen per cent of the window, and the canvas pays for it.
 */
export default function TopBar({ onToggleNav }: { onToggleNav: () => void }) {
  return (
    <header className="relative z-40 flex pl-safe-l pr-safe-r pt-safe-t h-[58px] shrink-0 items-center justify-between border-b-2 border-brass bg-hud-green px-4 md:h-[70px] md:px-6 xl:h-[80px] xl:px-8 2xl:h-[92px]">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleNav}
          aria-label="Open navigation"
          className="-ml-1 shrink-0 rounded-sm border border-brass/60 p-1.5 text-brass lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate font-sans text-[19px] font-extrabold uppercase tracking-[0.04em] text-brass md:text-[24px] xl:text-[28px] xl:tracking-[0.05em] 2xl:text-[32px]">
          Am I a Watcher
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-4">
        <span className="hidden font-sans text-[13px] font-semibold uppercase tracking-[0.18em] text-brass sm:inline xl:text-[15px]">
          Profile
        </span>
        <div className="rounded-full border-2 border-brass bg-brass p-[2px] md:p-[3px]">
          <div className="rounded-full bg-hud-black p-1.5 md:p-2">
            <HornBadge size={26} ringClassName="text-brass" fillClassName="text-hud-black" />
          </div>
        </div>
      </div>
    </header>
  );
}
