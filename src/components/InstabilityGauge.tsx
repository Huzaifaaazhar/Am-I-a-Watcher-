"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
}

/** Sweep of the analog dial, in degrees, centred on straight up. */
const SWEEP = 240;
const START = -120;

/**
 * Analog instability dial. The needle is damped so it overshoots and settles
 * rather than snapping - it needs to read as a physical instrument on camera.
 */
export default function InstabilityGauge({ value }: Props) {
  const [shown, setShown] = useState(value);
  const raf = useRef<number | null>(null);
  const velocity = useRef(0);

  useEffect(() => {
    const step = () => {
      setShown((current) => {
        const delta = value - current;
        if (Math.abs(delta) < 0.05 && Math.abs(velocity.current) < 0.05) {
          velocity.current = 0;
          return value;
        }
        // Spring toward the target: stiffness then damping.
        velocity.current = velocity.current * 0.78 + delta * 0.16;
        return current + velocity.current;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  const pct = Math.max(0, Math.min(100, shown)) / 100;
  const angle = START + pct * SWEEP;
  const critical = value >= 75;

  const ticks = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    const a = START + t * SWEEP;
    const major = i % 5 === 0;
    return { a, major, hot: t > 0.75 };
  });

  return (
    <div
      className="panel w-[188px] px-4 pb-3 pt-2"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label="Timeline instability"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-moss-300">
          Instability
        </span>
        <span
          className={`font-mono text-[10px] tabular-nums ${
            critical ? "text-gold-400 text-glow-gold" : "text-moss-200"
          }`}
        >
          {Math.round(shown)}%
        </span>
      </div>

      <svg viewBox="0 0 120 74" className="w-full">
        {/* Dial face */}
        <path
          d="M 14 62 A 46 46 0 1 1 106 62"
          fill="none"
          stroke="rgba(61,122,88,0.28)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Filled arc, gold once the sequence starts destabilising */}
        <path
          d="M 14 62 A 46 46 0 1 1 106 62"
          fill="none"
          stroke={critical ? "#f0cf68" : "#5a9c74"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="193"
          strokeDashoffset={193 * (1 - pct)}
          style={{
            filter: critical
              ? "drop-shadow(0 0 6px rgba(240,207,104,0.75))"
              : "drop-shadow(0 0 4px rgba(90,156,116,0.5))",
            transition: "stroke 400ms linear",
          }}
        />

        {ticks.map(({ a, major, hot }, i) => (
          <line
            key={i}
            x1="60"
            y1={major ? "20" : "22"}
            x2="60"
            y2={major ? "13" : "17"}
            stroke={hot ? "rgba(224,184,64,0.6)" : "rgba(142,195,162,0.4)"}
            strokeWidth={major ? 1.6 : 0.9}
            transform={`rotate(${a} 60 60)`}
          />
        ))}

        {/* Needle */}
        <g
          transform={`rotate(${angle} 60 60)`}
          style={{ filter: "drop-shadow(0 0 5px rgba(224,184,64,0.7))" }}
        >
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="24"
            stroke={critical ? "#fdf3d4" : "#e0b840"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        <circle cx="60" cy="60" r="3.6" fill="#0a0d0e" stroke="#c69a24" strokeWidth="1.4" />
      </svg>

      <div className="-mt-1 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-moss-400">
        {critical ? (
          <span className="animate-flicker text-gold-500">Sequence critical</span>
        ) : (
          <span>Nominal drift</span>
        )}
      </div>
    </div>
  );
}
