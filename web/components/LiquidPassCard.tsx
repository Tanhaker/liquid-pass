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
    <div className="mx-auto" style={{ width: "min(100%, 340px)", perspective: "800px" }}>
      <div
        ref={ref}
        className="liquid-float relative aspect-[1.58/1] w-full rounded-none p-[1px] transition-transform duration-200 ease-out will-change-transform z-10"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 80%, transparent), var(--color-line) 40%, color-mix(in srgb, ${color} 30%, transparent))`,
          boxShadow: `${-tilt.y * 2}px ${tilt.x * 2 + 20}px 40px -10px color-mix(in srgb, ${color} 30%, transparent), 0 30px 60px -15px rgba(0,0,0,0.5)`,
        }}
      >
        <div 
          className="relative h-full w-full overflow-hidden rounded-none bg-surface/90 backdrop-blur-3xl"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Dynamic Glare */}
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-overlay transition-transform duration-200"
            style={{
              background: `radial-gradient(circle at ${50 + tilt.y * 3}% ${50 - tilt.x * 3}%, rgba(255,255,255,0.2) 0%, transparent 50%)`,
            }}
          />
          
          <div 
            className="relative flex h-full flex-col justify-between p-6"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="flex items-start justify-between">
              <div style={{ transform: "translateZ(20px)" }}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-faint font-bold drop-shadow-md">
                  Liquid Pass
                </p>
                <h3 className="mt-2 text-[20px] font-bold leading-none tracking-tight text-text drop-shadow-md">
                  {name}
                </h3>
              </div>

              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden style={{ transform: "translateZ(30px)" }}>
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
                  style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1), stroke 600ms linear", filter: `drop-shadow(0 0 8px ${color})` }}
                />
              </svg>
            </div>

            <div>
              <div className="flex items-end justify-between" style={{ transform: "translateZ(30px)" }}>
                <div>
                  <p className="tnum text-[32px] font-bold leading-none drop-shadow-lg" style={{ color, textShadow: `0 0 15px color-mix(in srgb, ${color} 50%, transparent)` }}>
                    {daysLeft}
                    <span className="ml-1.5 text-[12px] font-medium text-muted">
                      {daysLeft === 1 ? "day" : "days"} left
                    </span>
                  </p>
                </div>
                {price && (
                  <p className="tnum text-right text-[14px] font-bold text-text drop-shadow-md">
                    {price}
                    <span className="ml-1 text-[11px] text-faint">ETH</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-[4px] w-full overflow-hidden rounded-full bg-line-bright/60" style={{ transform: "translateZ(20px)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f * 100}%`,
                    background: color,
                    transition: "width 900ms cubic-bezier(.22,1,.36,1), background 600ms linear",
                    boxShadow: `0 0 15px ${color}, 0 0 5px white`,
                  }}
                />
              </div>

              <div className="mt-4 flex justify-between items-center" style={{ transform: "translateZ(10px)" }}>
                <p className="tnum text-[11px] font-bold uppercase tracking-widest text-faint drop-shadow-sm">
                  {tokenId}
                </p>
                <div className="flex space-x-1">
                  <span className="size-1.5 rounded-full bg-text/50" />
                  <span className="size-1.5 rounded-full bg-text/50" />
                  <span className="size-1.5 rounded-full bg-text/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
