"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { fetchPasses, fetchPlans, marketStats, type MarketStats } from "@/lib/data";

/**
 * The live strip under the hero.
 *
 * Every figure is read from the deployed contract. When the RPC is unreachable
 * the row says so and shows dashes -- it never falls back to plausible numbers,
 * because a stat strip is exactly where an invented figure would go unnoticed.
 */
export function LiveStats() {
  const client = usePublicClient();
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!client) return;
    (async () => {
      try {
        const [plans, passes] = await Promise.all([fetchPlans(client), fetchPasses(client)]);
        if (!cancelled) setStats(marketStats(plans, passes));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const cells = [
    { label: "Plans live", value: stats ? String(stats.plans) : null, tone: "var(--color-life-full)" },
    { label: "Passes issued", value: stats ? String(stats.issued) : null, tone: "var(--color-life-mid)" },
    { label: "Active now", value: stats ? String(stats.active) : null, tone: "var(--color-life-low)" },
    {
      label: "Primary volume",
      value: stats ? `${trim(formatEther(stats.primaryVolume))} ETH` : null,
      tone: "var(--color-text)",
    },
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
        <span className="relative flex size-1.5">
          {!failed && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-life-full opacity-60" />
          )}
          <span
            className="relative inline-flex size-1.5 rounded-full"
            style={{ background: failed ? "var(--color-life-crit)" : "var(--color-life-full)" }}
          />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-faint">
          {failed ? "Chain unreachable" : "Live from Arbitrum Sepolia"}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        {cells.map((c) => (
          <div key={c.label} className="px-5 py-4">
            <p className="tnum text-[24px] font-semibold leading-none" style={{ color: c.tone }}>
              {c.value ?? (failed ? "—" : <span className="text-faint">···</span>)}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-faint">
              {c.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 0.00065000 -> 0.00065, without turning small values into 0. */
function trim(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
