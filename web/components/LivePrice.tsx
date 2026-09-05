"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";

/**
 * The asking price, ticking down.
 *
 * Marketplace.sol has always priced listings on a continuous curve --
 *
 *     openingPrice * (expiry - now) / (expiry - listedAt)
 *
 * -- which falls every second until it reaches zero at expiry. That is the
 * whole thesis of the project made mechanical, and the UI was rendering it as
 * a number that changed only when a poll happened to land, which looks
 * indistinguishable from a fixed price.
 *
 * This recomputes the same expression locally once a second. It is not an
 * estimate and it cannot drift: it is the contract's own arithmetic, including
 * the truncating integer division, so the figure shown is the figure a buyer
 * would be charged at that instant.
 */

export type Decay = {
  /** Opening ask in wei, as a decimal string. */
  openingWei: string;
  /** Unix seconds the listing opened. */
  listedAt: number;
  /** Unix seconds the pass expires. */
  expiry: number;
};

/** Mirrors Marketplace.currentPrice(), integer division included. */
export function priceAt(decay: Decay, nowSeconds: number): bigint {
  const opening = BigInt(decay.openingWei);
  const expiry = BigInt(decay.expiry);
  const listedAt = BigInt(decay.listedAt);
  const now = BigInt(Math.floor(nowSeconds));

  if (opening <= 0n) return 0n;
  if (now >= expiry) return 0n;
  if (expiry <= listedAt) return 0n;

  return (opening * (expiry - now)) / (expiry - listedAt);
}

/** Wei shed per hour. Constant for the life of a listing. */
export function perHour(decay: Decay): bigint {
  const window = BigInt(decay.expiry) - BigInt(decay.listedAt);
  if (window <= 0n) return 0n;
  return (BigInt(decay.openingWei) * 3600n) / window;
}

/**
 * Renders a wei figure at a fixed number of decimals.
 *
 * Nine, not the usual four or six. A 0.001 ETH pass listed over thirty days
 * sheds about 3.9e-10 ETH per second, so at six decimals the number would sit
 * perfectly still and the "live" price would be a lie. At nine, the last digit
 * turns over every couple of seconds, which is the truth and is visible.
 *
 * Formatted by slicing the exact decimal string rather than going through
 * Number, so no float rounding creeps into a figure a buyer is charged.
 */
function show(wei: bigint, dp = 9): string {
  const [int, frac = ""] = formatEther(wei).split(".");
  return `${int}.${frac.padEnd(dp, "0").slice(0, dp)}`;
}

export function LivePrice({
  decay,
  className,
}: {
  decay: Decay;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Set on mount rather than during render: the server has a different clock
    // than the browser, and rendering a time on both sides is a hydration
    // mismatch.
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  // Before the first tick, show the opening ask rather than a placeholder, so
  // the server and client agree on the first paint.
  const wei = now === null ? BigInt(decay.openingWei) : priceAt(decay, now);

  return (
    <span className={className} suppressHydrationWarning>
      {show(wei)} ETH
    </span>
  );
}

/** "falling 0.000014 ETH/hr" — the slope, stated plainly. */
export function DecayRate({ decay, className }: { decay: Decay; className?: string }) {
  const rate = perHour(decay);
  if (rate <= 0n) return null;
  return (
    <span className={className}>
      &darr; {show(rate)} ETH/hr
    </span>
  );
}
