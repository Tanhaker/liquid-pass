"use client";

import { useEffect, useState } from "react";

/**
 * The signature component: a ring that drains as the pass expires.
 *
 * SVG rather than WebGL. A stroke-dashoffset ring is ~40 lines, works on every
 * device, respects reduced-motion for free, and cannot fail the way a WebGL
 * context can. The visual budget is better spent on it being *correct* -- it
 * ticks against the real expiry timestamp, so what a judge sees is chain state,
 * not an animation on a timer.
 */

const STOPS = [
  { at: 1.0, color: "var(--color-life-full)" },
  { at: 0.5, color: "var(--color-life-mid)" },
  { at: 0.25, color: "var(--color-life-low)" },
  { at: 0.1, color: "var(--color-life-crit)" },
];

/** Colour follows how much life is LEFT, so it warms as it drains. */
export function lifeColor(fraction: number): string {
  for (const s of STOPS) if (fraction >= s.at) return s.color;
  return STOPS[STOPS.length - 1].color;
}

export function DecayRing({
  fraction,
  size = 120,
  stroke = 6,
  label,
  sublabel,
}: {
  /** 0..1 of the pass's life remaining. */
  fraction: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color = lifeColor(f);

  // Mount gate so the ring animates from empty to its value on first paint
  // rather than snapping. Also avoids an SSR/client mismatch on the dash.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(f));
    return () => cancelAnimationFrame(id);
  }, [f]);

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1), stroke 600ms linear",
            filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 45%, transparent))`,
          }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute grid place-items-center text-center leading-none">
          {label && (
            <span className="tnum text-[15px] font-semibold" style={{ color }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
