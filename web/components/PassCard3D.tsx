"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Clock, ShieldCheck, ArrowRight, Zap, Flame } from "lucide-react";
import { formatEthShort } from "@/lib/contract";

/**
 * The pass, as a physical ticket.
 *
 * Ported from the team's design file, with the props changed from their mock
 * `SubscriptionPass` type to the shapes this app actually holds: expiry and
 * duration in seconds as the contract stores them, and prices in wei as
 * `paidOf` / `currentPrice` return them. Formatting happens here so no caller
 * has to convert before it can render a card.
 *
 * `now` is passed in rather than read from `Date.now()` during render. These
 * pages are statically prerendered; a clock read at render time ships the
 * build's value in the HTML and mismatches on hydration.
 */

export type PassCard3DProps = {
  name: string;
  tokenId: string | bigint;
  /** Short badge beside the token id -- plan name, tier, "SLICE". */
  tier?: string;
  /** Unix seconds, as `expiryOf` returns. */
  expiry: number;
  /** Seconds, as `planDurationOf` returns. */
  duration: number;
  /** Wei. The original sale price -- `paidOf`. */
  originalPrice: bigint;
  /** Wei. The live ask when listed; null or undefined when it is not. */
  listingPrice?: bigint | null;
  /** Milliseconds. Null before the client clock has mounted. */
  now?: number | null;
  interactive?: boolean;
  showActions?: boolean;
  /** Omitted entirely when there is nothing to link to. */
  href?: string;
  onBuy?: () => void;
  buyLabel?: string;
  busy?: boolean;
};

export function PassCard3D({
  name,
  tokenId,
  tier,
  expiry,
  duration,
  originalPrice,
  listingPrice,
  now,
  interactive = true,
  showActions = true,
  href,
  onBuy,
  buyLabel = "Acquire Pass",
  busy = false,
}: PassCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const nowSec = Math.floor((now ?? 0) / 1000);
  const remainingSeconds = now === null ? 0 : Math.max(0, expiry - nowSec);
  const remainingDays = (remainingSeconds / 86400).toFixed(1);
  const totalDays = (duration / 86400).toFixed(0);
  const percentLeft = duration
    ? Math.min(100, Math.max(0, Math.round((remainingSeconds / duration) * 100)))
    : 0;

  // Before the clock mounts, `now` is null and every card would otherwise
  // claim to be expired. Held in a neutral state until it arrives.
  const pending = now === null || now === undefined;
  const expired = !pending && remainingSeconds <= 0;
  const urgent = !pending && !expired && percentLeft < 20;
  const fresh = !pending && percentLeft >= 50;

  // The fair price of what is left, used only when nothing is listed. Integer
  // math throughout: wei is not a float.
  const fair =
    duration > 0
      ? (originalPrice * BigInt(Math.min(remainingSeconds, duration))) / BigInt(duration)
      : 0n;
  const effective = listingPrice ?? fair;
  const discountPercent =
    originalPrice > 0n && effective < originalPrice
      ? Number(((originalPrice - effective) * 100n) / originalPrice)
      : 0;

  // Mouse physics for the 3D tilt -- no WebGL.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 25 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    setHovered(false);
    x.set(0);
    y.set(0);
  }

  return (
    <div style={{ perspective: "1000px" }} className="relative select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: interactive ? rotateX : "0deg",
          rotateY: interactive ? rotateY : "0deg",
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full overflow-hidden border p-6 transition-all duration-200 ${
          expired
            ? "border-dark-border bg-surface opacity-60"
            : urgent
              ? "border-aviation bg-surface shadow-glow-amber"
              : "border-dark-border bg-surface hover:border-uranium hover:shadow-glow-uranium"
        }`}
      >
        {/* Physical ticket notches */}
        <div className="pointer-events-none absolute -left-2.5 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border-r border-dark-border bg-ink" />
        <div className="pointer-events-none absolute -right-2.5 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border-l border-dark-border bg-ink" />

        {interactive && hovered && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(152, 255, 26, 0.12), transparent 65%)`,
            }}
          />
        )}

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-dark-border bg-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-uranium">
                TOKEN #{tokenId.toString()}
              </span>
              {tier && (
                <span className="max-w-[14ch] truncate border border-dark-border bg-raised px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-grey">
                  {tier}
                </span>
              )}
            </div>
            <h3 className="mt-2 truncate font-header text-xl font-bold tracking-tight text-text">
              {name}
            </h3>
          </div>

          {urgent ? (
            <div className="flex shrink-0 rotate-[-3deg] items-center gap-1 bg-aviation px-2.5 py-1 font-mono text-xs font-extrabold uppercase text-black">
              <Flame className="size-3.5 fill-black" />
              <span>STEAL // {discountPercent}% OFF</span>
            </div>
          ) : fresh ? (
            <div className="flex shrink-0 items-center gap-1 border border-uranium bg-uranium/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-uranium">
              <Zap className="size-3" />
              <span>HIGH TIME VALUE</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1 border border-dark-border bg-raised px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-grey">
              <span>{expired ? "EXPIRED" : "DECAYING"}</span>
            </div>
          )}
        </div>

        {/* Decay meter */}
        <div className="relative z-10 mt-5 border border-dark-border bg-ink p-3.5">
          <div className="mb-2 flex items-center justify-between font-mono text-xs">
            <span className="flex items-center gap-1.5 text-zinc-grey">
              <Clock className="size-3.5 text-uranium" />
              <span>TIME REMAINING:</span>
            </span>
            <span
              className={`font-bold ${urgent ? "text-aviation" : fresh ? "text-uranium" : "text-text"}`}
            >
              {pending ? "—" : `${remainingDays} DAYS / ${totalDays}D (${percentLeft}%)`}
            </span>
          </div>

          <div className="relative h-2 w-full overflow-hidden border border-dark-border bg-raised">
            <div
              className={`h-full transition-all duration-300 ${
                urgent ? "bg-aviation shadow-glow-amber" : "bg-decay-bar"
              }`}
              style={{ width: `${percentLeft}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-zinc-grey">
            <span>ISSUED 100%</span>
            <span>HALF-LIFE 50%</span>
            <span>EXPIRES 0%</span>
          </div>
        </div>

        {/* Price HUD */}
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="border border-dark-border bg-ink p-2">
            <span className="block text-[10px] uppercase text-zinc-grey">
              Opening price
            </span>
            <span className="text-zinc-grey-light line-through">
              {formatEthShort(originalPrice)} ETH
            </span>
          </div>
          <div className="border border-dark-border bg-raised p-2">
            <span className="block text-[10px] uppercase text-uranium">
              {listingPrice != null ? "Current ask" : "Fair value now"}
            </span>
            <span className="text-sm font-bold text-uranium">
              {formatEthShort(effective)} ETH
            </span>
          </div>
        </div>

        {/* Verification line */}
        <div className="relative z-10 mt-5 flex items-center justify-between border-t border-dashed border-dark-border pt-3">
          <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-grey">
            <ShieldCheck className="size-3.5 text-periwinkle" />
            <span>STYLUS · ARBITRUM SEPOLIA</span>
          </div>
          <div className="flex h-4 items-end gap-[2px] opacity-40">
            {[4, 2, 5, 3, 6, 2, 4, 1, 5, 3, 2, 6, 4, 2, 5].map((h, i) => (
              <div key={i} className="w-[1.5px] bg-text" style={{ height: `${h * 2.5}px` }} />
            ))}
          </div>
        </div>

        {/* Actions */}
        {showActions && (href || onBuy) && (
          <div className="relative z-10 mt-5 flex items-center gap-2">
            {href && (
              <Link
                href={href}
                className="flex-1 border border-dark-border bg-ink px-3 py-2 text-center font-mono text-xs uppercase tracking-wider text-text transition-colors hover:bg-raised"
              >
                Inspect Detail
              </Link>
            )}
            {onBuy && (
              <button
                onClick={onBuy}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1 bg-uranium px-3 py-2 font-mono text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow hover:shadow-glow-uranium disabled:opacity-50"
              >
                <span>{busy ? "Confirm in wallet…" : buyLabel}</span>
                {!busy && <ArrowRight className="size-3.5" />}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
