"use client";

import { useEffect, useState } from "react";

/**
 * A dollar figure beside an ETH price, so a price reads at a familiar scale.
 *
 * Liquid Pass runs on Arbitrum Sepolia, where ETH has no value, so the figure
 * is today's MAINNET ETH price applied to the amount, and the tooltip says so.
 * It renders nothing until the price has loaded, and nothing if it cannot load:
 * a missing hint is better than a wrong one.
 *
 * One request per page load, shared by every <Usd> on it.
 */

let pending: Promise<number | null> | null = null;

function ethUsd(): Promise<number | null> {
  pending ??= fetch("/api/ethusd")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { usd?: number } | null) => (j?.usd && j.usd > 0 ? j.usd : null))
    .catch(() => null);
  return pending;
}

export function useEthUsd(): number | null {
  const [usd, setUsd] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void ethUsd().then((v) => live && setUsd(v));
    return () => {
      live = false;
    };
  }, []);
  return usd;
}

export function formatUsd(dollars: number): string {
  if (dollars >= 1000) return `$${Math.round(dollars).toLocaleString("en-US")}`;
  if (dollars >= 10) return `$${dollars.toFixed(0)}`;
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`;
  return dollars > 0 ? "<$0.01" : "$0";
}

/** Wei as a bigint, or ETH as a decimal string. */
export function toEth(amount: bigint | string | number): number {
  if (typeof amount === "bigint") return Number(amount) / 1e18;
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

export const USD_TITLE = "At today's mainnet ETH price. Liquid Pass runs on a testnet, so no real money moves.";

export function Usd({
  amount,
  className = "",
  prefix = "≈ ",
}: {
  amount: bigint | string | number;
  className?: string;
  prefix?: string;
}) {
  const usd = useEthUsd();
  if (usd === null) return null;
  const eth = toEth(amount);
  if (eth <= 0) return null;
  return (
    <span className={`font-mono text-[0.8em] font-normal text-zincGrey ${className}`} title={USD_TITLE}>
      {prefix}
      {formatUsd(eth * usd)}
    </span>
  );
}
