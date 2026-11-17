"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowUpRight, BarChart3 } from "lucide-react";
import { fetchActivity, fetchPasses, type Activity as Event } from "@/lib/data";
import { formatEthShort, type Pass } from "@/lib/contract";
import { formatUsd, toEth, useEthUsd, USD_TITLE } from "@/components/Usd";

/**
 * Two home-page sections that back the pitch with numbers.
 *
 * ProblemEvidence: the problem, in the figures the Phase 1 proposal cites,
 * each linked to its source. Nothing here is computed or rounded up.
 *
 * LiveImpact: what the contract has actually done, read from the chain on
 * load. Royalties are price / 10, exactly as Marketplace.buy() computes them.
 */

const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

const EVIDENCE = [
  {
    figure: "42%",
    label: "keep paying for a subscription they no longer use",
    source: "C+R Research, survey of 1,000 US consumers, 2022",
    href: "https://www.crresearch.com/blog/subscription-service-statistics-and-costs/",
  },
  {
    figure: "2.5×",
    label: "real monthly subscription spend ($219) versus what people estimate ($86)",
    source: "C+R Research, 2022",
    href: "https://www.crresearch.com/blog/subscription-service-statistics-and-costs/",
  },
  {
    figure: "36%",
    label: "of SaaS licences go unused, across 40M+ licences tracked",
    source: "Zylo, 2026 SaaS Management Index",
    href: "https://zylo.com/news/2026-saas-management-index",
  },
  {
    figure: "$19.8M",
    label: "wasted on unused licences per organisation, every year",
    source: "Zylo, SaaS Statistics",
    href: "https://zylo.com/blog/saas-statistics",
  },
];

export function ProblemEvidence() {
  return (
    <section className="border-t border-dark-border">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div {...REVEAL} className="mb-12 border-l-2 border-aviation pl-6">
          <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-aviation">The problem, measured</h2>
          <p className="mt-2 max-w-3xl font-header text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Unused subscription time is a real cost, and today it cannot move.
          </p>
          <p className="mt-3 max-w-2xl font-body text-sm text-zinc-grey">
            Access is tied to one email inside the provider&apos;s database, so the days you do not use are simply lost,
            while someone who needs a week still has to buy a month.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE.map((e, i) => (
            <motion.a
              key={e.figure}
              href={e.href}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group flex flex-col border border-dark-border bg-surface p-6 shadow-grunge transition-colors hover:border-aviation"
            >
              <span className="font-header text-5xl font-extrabold tracking-tight text-aviation">{e.figure}</span>
              <span className="mt-3 font-body text-sm leading-relaxed text-text">{e.label}</span>
              <span className="mt-auto flex items-center gap-1 pt-5 font-mono text-[10px] uppercase tracking-wider text-zinc-grey group-hover:text-aviation">
                {e.source}
                <ArrowUpRight className="size-3 shrink-0" />
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

type Stats = {
  issued: number;
  resales: number;
  toSellers: bigint;
  toIssuers: bigint;
  onSaleNow: number;
  daysOnSale: number;
};

function summarise(passes: Pass[], events: Event[], nowS: number): Stats {
  const bought = events.filter((e) => e.kind === "Bought" && e.price !== undefined);
  const volume = bought.reduce((sum, e) => sum + (e.price ?? 0n), 0n);
  const royalties = bought.reduce((sum, e) => sum + (e.price ?? 0n) / 10n, 0n);
  const listed = passes.filter((p) => p.listed > 0n && p.active);
  return {
    issued: passes.filter((p) => p.paid > 0n).length,
    resales: bought.length,
    toSellers: volume - royalties,
    toIssuers: royalties,
    onSaleNow: listed.length,
    daysOnSale: Math.floor(listed.reduce((sum, p) => sum + Math.max(0, Number(p.expiry) - nowS), 0) / 86400),
  };
}

export function LiveImpact() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const usd = useEthUsd();

  useEffect(() => {
    let live = true;
    Promise.all([fetchPasses(), fetchActivity(500)])
      .then(([passes, events]) => live && setStats(summarise(passes, events, Math.floor(Date.now() / 1000))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const cells = useMemo(() => {
    const eth = (wei: bigint) => (
      <>
        {formatEthShort(wei)} <span className="text-lg">ETH</span>
      </>
    );
    const dollars = (wei: bigint) => (usd !== null && wei > 0n ? `≈ ${formatUsd(toEth(wei) * usd)}` : undefined);
    return stats
      ? [
          { value: <>{stats.issued}</>, label: "Passes sold by issuers" },
          { value: <>{stats.resales}</>, label: "Resales settled on chain" },
          { value: eth(stats.toSellers), label: "Paid to sellers for unused time", hint: dollars(stats.toSellers) },
          { value: eth(stats.toIssuers), label: "Royalties paid to issuers", hint: dollars(stats.toIssuers) },
          { value: <>{stats.daysOnSale}</>, label: `Days of access on resale now, across ${stats.onSaleNow} listing${stats.onSaleNow === 1 ? "" : "s"}` },
        ]
      : [];
  }, [stats, usd]);

  return (
    <section className="border-t border-dark-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div {...REVEAL} className="mb-10 flex flex-col gap-3 border-l-2 border-uranium pl-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-uranium">
              <Activity className="size-3.5" /> Live on Arbitrum
            </h2>
            <p className="mt-2 font-header text-3xl font-bold tracking-tight text-text sm:text-4xl">What the contract has done so far.</p>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-grey">
            <BarChart3 className="size-3.5" /> Read from the chain on every visit
          </span>
        </motion.div>
        {failed ? (
          <p className="border border-dark-border bg-dark p-5 font-mono text-xs text-zinc-grey">The chain could not be read just now. Reload to try again.</p>
        ) : (
          <div className="grid grid-cols-2 gap-px border border-dark-border bg-dark-border lg:grid-cols-5">
            {(stats ? cells : Array.from({ length: 5 }, () => null)).map((c, i) => (
              <div key={i} className="flex min-h-[132px] flex-col bg-dark-card p-5">
                {c ? (
                  <>
                    <span className="font-header text-3xl font-extrabold tracking-tight text-uranium tnum">{c.value}</span>
                    {"hint" in c && c.hint && (
                      <span className="mt-1 font-mono text-[11px] text-zinc-grey" title={USD_TITLE}>
                        {c.hint}
                      </span>
                    )}
                    <span className="mt-auto pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-zinc-grey">{c.label}</span>
                  </>
                ) : (
                  <span className="h-8 w-20 animate-pulse bg-raised" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
