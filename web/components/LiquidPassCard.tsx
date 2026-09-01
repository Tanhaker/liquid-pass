"use client";

import { useEffect, useRef, useState } from "react";
import { lifeColor } from "./DecayRing";

export function LiquidPassCard({
  name,
  tokenId,
  fraction,
  daysLeft,
  price,
  interactive = true,
}: {
  name: string;
  tokenId: string;
  fraction: number;
  daysLeft: number;
  price?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!interactive) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const el = ref.current;
    if (!el) return;

    function onMove(e: PointerEvent) {
      const r = el!.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setTilt({ x: (0.5 - py) * 3, y: (px - 0.5) * 3 }); // Reduced from 6 to 3 for elegance
    }
    function onLeave() {
      setTilt({ x: 0, y: 0 });
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  const color = lifeColor(fraction);
  const f = Math.max(0, Math.min(1, fraction));
  const R = 24;
  const C = 2 * Math.PI * R;

  return (
    <div className="[perspective:1400px] mx-auto" style={{ width: "min(100%, 340px)" }}>
      <div
        ref={ref}
        className="liquid-float relative aspect-[1.58/1] w-full rounded-3xl p-[1px] transition-transform duration-500 ease-out will-change-transform z-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 40%, transparent), var(--color-line) 40%, color-mix(in srgb, ${color} 10%, transparent))`,
        }}
      >
        <div 
          className="relative h-full w-full overflow-hidden rounded-[23px] bg-surface/80 backdrop-blur-2xl"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Subtle noise/texture layer could go here */}
          
          <div 
            className="relative flex h-full flex-col justify-between p-6"
            style={{ transform: "translateZ(20px)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-faint font-medium">
                  Liquid Pass
                </p>
                <h3 className="mt-2 text-[20px] font-semibold leading-none tracking-tight text-text">
                  {name}
                </h3>
              </div>

              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
                <circle cx="28" cy="28" r={R} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - f)}
                  transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1), stroke 600ms linear" }}
                />
              </svg>
            </div>

            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="tnum text-[32px] font-medium leading-none" style={{ color }}>
                    {daysLeft}
                    <span className="ml-1.5 text-[12px] font-medium text-muted">
                      {daysLeft === 1 ? "day" : "days"} left
                    </span>
                  </p>
                </div>
                {price && (
                  <p className="tnum text-right text-[14px] font-medium text-muted">
                    {price}
                    <span className="ml-1 text-[11px] text-faint">ETH</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-line-bright/40">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f * 100}%`,
                    background: color,
                    transition: "width 900ms cubic-bezier(.22,1,.36,1), background 600ms linear",
                    boxShadow: `0 0 10px ${color}`,
                  }}
                />
              </div>

              <div className="mt-4 flex justify-between items-center">
                <p className="tnum text-[11px] font-medium uppercase tracking-widest text-faint">
                  {tokenId}
                </p>
                <div className="flex space-x-1">
                  <span className="size-1.5 rounded-full bg-line-bright" />
                  <span className="size-1.5 rounded-full bg-line-bright" />
                  <span className="size-1.5 rounded-full bg-line-bright" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
