"use client";

import HornBadge from "./HornBadge";

/** Full-width HUD header: wordmark left, profile badge right. */
export default function TopBar() {
  return (
    <header className="relative z-40 flex h-[92px] shrink-0 items-center justify-between border-b-2 border-brass/80 bg-topbar px-8">
      <h1 className="font-sans text-[32px] font-extrabold uppercase tracking-[0.05em] text-brass">
        Am I a Watcher
      </h1>

      <div className="flex items-center gap-4">
        <span className="font-sans text-[15px] font-semibold uppercase tracking-[0.18em] text-brass">
          Profile
        </span>
        <div className="rounded-full border-2 border-brass bg-brass p-[3px]">
          <div className="rounded-full bg-abyss p-2">
            <HornBadge size={38} ringClassName="text-brass" fillClassName="text-abyss" />
          </div>
        </div>
      </div>
    </header>
  );
}
