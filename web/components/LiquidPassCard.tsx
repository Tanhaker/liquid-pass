"use client";

import { useEffect, useRef, useState } from "react";
import { lifeColor } from "./DecayRing";

/**
 * The hero object: a subscription pass rendered as a physical-feeling card.
 *
 * Depth comes from layered surfaces, a light sweep, and a border gradient --
 * no WebGL, per the spec. The whole thing is CSS transforms and one SVG ring,
 * which keeps it on the compositor and means it cannot fail to acquire a
 * context the way a canvas can.
 *
 * The `fraction` prop drives colour, ring, fill bar and glow together, so
 * every visual channel says the same thing about remaining time. That is the
 * point: a judge should read "this is draining" without any label.
 */
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
  /** 0..1 of life remaining. */
  fraction: number;
  daysLeft: number;
  price?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });

  // Pointer parallax is desktop-only and opt-out. A coarse pointer means a
  // touch device, where tilt has nothing to track and just costs battery.
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
      // Capped at 6 degrees. Beyond that the text starts to distort and the
      // card stops being readable, which defeats the purpose.
      setTilt({ x: (0.5 - py) * 6, y: (px - 0.5) * 6 });
      setGlare({ x: px * 100, y: py * 100 });
    }
    function onLeave() {
      setTilt({ x: 0, y: 0 });
      setGlare({ x: 50, y: 50 });
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
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="[perspective:1200px]"
      style={{ width: "min(100%, 340px)" }}
    >
      <div
        ref={ref}
        className="liquid-float relative aspect-[1.6/1] w-full rounded-[22px] p-px transition-transform duration-300 ease-out will-change-transform z-10"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          background: `linear-gradient(145deg, color-mix(in oklab, ${color} 55%, transparent), var(--color-line) 45%, color-mix(in oklab, ${color} 22%, transparent))`,
          boxShadow: `0 24px 70px -28px color-mix(in oklab, ${color} 60%, transparent), 0 2px 10px rgba(0,0,0,.5)`,
        }}
      >
        <div 
          className="relative h-full w-full overflow-hidden rounded-[21px] bg-surface"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Depth: a soft interior light biased toward the accent. */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 90% at 15% 0%, color-mix(in oklab, ${color} 16%, transparent), transparent 60%)`,
            }}
          />
          {/* Glare tracks the pointer; parked centre when idle. */}
          <div
            className="absolute inset-0 opacity-70 transition-[background] duration-200"
            style={{
              background: `radial-gradient(50% 40% at ${glare.x}% ${glare.y}%, color-mix(in oklab, var(--color-text) 15%, transparent), transparent 70%)`,
            }}
          />

          <div 
            className="relative flex h-full flex-col justify-between p-5"
            style={{ transform: "translateZ(30px)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-faint drop-shadow-md">
                  Liquid Pass
                </p>
                <h3 className="mt-1.5 text-[19px] font-semibold leading-none tracking-[-0.01em] drop-shadow-lg text-text">
                  {name}
                </h3>
              </div>

              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
                <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-line)" strokeWidth="4" />
                <circle
                  cx="32"
                  cy="32"
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - f)}
                  transform="rotate(-90 32 32)"
                  style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1), stroke 600ms linear" }}
                />
              </svg>
            </div>

            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="tnum text-[34px] font-semibold leading-none" style={{ color }}>
                    {daysLeft}
                    <span className="ml-1 text-[13px] font-normal text-muted">
                      {daysLeft === 1 ? "day" : "days"} left
                    </span>
                  </p>
                </div>
                {price && (
                  <p className="tnum text-right text-[13px] text-muted">
                    {price}
                    <span className="ml-1 text-[10px] text-faint">ETH</span>
                  </p>
                )}
              </div>

              {/* The draining bar. Same fraction as the ring, second channel. */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f * 100}%`,
                    background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
                    transition: "width 900ms cubic-bezier(.22,1,.36,1), background 600ms linear",
                  }}
                />
              </div>

              <p className="tnum mt-3 text-[10px] uppercase tracking-[0.16em] text-faint">
                {tokenId}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
