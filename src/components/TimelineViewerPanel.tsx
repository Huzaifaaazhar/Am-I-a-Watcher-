"use client";

/** Dual-line "Sacred Timeline vs. new branch" chart panel from the deviation triptych. */
export default function TimelineViewerPanel({
  premise,
  branchLabel,
}: {
  premise: string;
  branchLabel: string;
}) {
  return (
    <div className="flex w-[300px] flex-col border-2 border-brass bg-black/95 px-5 py-5">
      <h3 className="mb-4 font-sans text-[19px] font-extrabold uppercase tracking-[0.04em] text-brass">
        Timeline Viewer
      </h3>

      <div className="relative">
        <svg viewBox="0 0 240 100" className="w-full">
          <line x1="16" y1="86" x2="16" y2="10" stroke="rgba(212,175,55,0.4)" strokeWidth="1" />
          <line x1="16" y1="86" x2="230" y2="86" stroke="rgba(212,175,55,0.4)" strokeWidth="1" />
          <path
            d="M16 50 L120 50 L230 30"
            stroke="#2FBE6C"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M120 50 L230 78"
            stroke="#D0402F"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="1 5"
          />
          <circle cx="120" cy="50" r="4.5" fill="#D4AF37" />
          <text x="132" y="46" className="fill-white" style={{ font: "9px sans-serif", fontWeight: 700 }}>
            Sacred Timeline
          </text>
        </svg>

        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-warn px-2 py-0.5 font-sans text-[9px] font-extrabold uppercase tracking-[0.08em] text-black">
          Deviation created
        </div>
      </div>

      <div className="mt-6 border-2 border-weave/60 bg-black px-3.5 py-3">
        <p className="font-sans text-[13px] leading-snug text-white">
          {premise}
          <span className="block font-extrabold text-warn">results in…</span>
          <span className="block font-extrabold uppercase text-brass">({branchLabel})</span>
        </p>
      </div>
    </div>
  );
}
