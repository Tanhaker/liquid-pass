"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Briefcase, Building2, Code2, CreditCard, Percent, Rocket, Store } from "lucide-react";
import { fetchActivity } from "@/lib/data";
import { formatEthShort } from "@/lib/contract";
import { formatUsd, toEth, useEthUsd, USD_TITLE } from "@/components/Usd";

/**
 * How Liquid Pass makes money, as set out in the Phase 1 proposal.
 *
 * Each stream is marked for what it is today -- live, a preview of it, or
 * planned -- and nothing planned is shown as working. The live figures come
 * from the chain: real resale volume and the royalties issuers were really
 * paid. The 2.5% platform fee is planned, not charged: the deployed marketplace
 * splits every resale 90% seller / 10% issuer, and changing that means a new
 * marketplace contract (stage 2, after an audit).
 */

type Status = "LIVE" | "PREVIEW" | "PLANNED";

const STREAMS: Array<{ icon: React.ReactNode; name: string; how: string; status: Status; note: string; href?: string; cta?: string }> = [
  {
    icon: <Percent className="w-4 h-4 text-uranium" />,
    name: "Marketplace fee",
    how: "A small fee, planned at 2.5%, on each resale, taken in the same transaction as the seller's share and the issuer's 10% royalty.",
    status: "PLANNED",
    note: "Today the contract pays 90% to the seller and 10% to the issuer, with no platform fee. The fee arrives with the audited marketplace v2.",
  },
  {
    icon: <BarChart3 className="w-4 h-4 text-uranium" />,
    name: "Issuer Pro plans",
    how: "Listing plans stays free. A monthly Pro tier adds revenue analytics, custom branding and promoted plans on the market.",
    status: "PREVIEW",
    note: "The analytics an issuer would pay for already run on live chain data.",
    href: "/analytics",
    cta: "See the analytics",
  },
  {
    icon: <Code2 className="w-4 h-4 text-uranium" />,
    name: "Access Gateway API",
    how: "Basic on-chain verification stays free forever. Paid tiers offer a hosted, high-volume API with webhooks for large apps.",
    status: "PREVIEW",
    note: "The free tier is live: three contract reads, documented in the developer guide and used by LiquidDesk.",
    href: "/developers",
    cta: "Open the developer guide",
  },
  {
    icon: <CreditCard className="w-4 h-4 text-uranium" />,
    name: "Payment partnerships",
    how: "A revenue share from card on-ramp providers once people can pay by card, without holding crypto first.",
    status: "PLANNED",
    note: "Stage 4, alongside passkey sign-in for people without a wallet.",
  },
  {
    icon: <Building2 className="w-4 h-4 text-uranium" />,
    name: "Enterprise licence exchange",
    how: "Companies resell unused team seats to each other through a B2B market. 36% of SaaS licences go unused today.",
    status: "PLANNED",
    note: "The same contracts, with team accounts and invoicing on top.",
  },
];

const STAGES = [
  { n: "01", name: "Hackathon MVP", what: "Public testnet: the pass lifecycle, resale, access checks, LiquidDesk, QR check-in and Liquidity AI.", now: true },
  { n: "02", name: "Hardening", what: "Independent contract audit, stablecoin (USDC) pricing, the 2.5% fee, expiry and sale notifications." },
  { n: "03", name: "Mainnet pilot", what: "Launch on Arbitrum One with 2–3 partner SaaS and AI-tool issuers; Issuer SDK and first royalty revenue." },
  { n: "04", name: "Mass adoption", what: "Card payments, passkey sign-in, a mobile app, and courses, gyms, co-working and events." },
];

const FEE = 0.025;
const ROYALTY = 0.1;

const BADGE: Record<Status, string> = {
  LIVE: "border-uranium text-uranium",
  PREVIEW: "border-periwinkle text-periwinkle",
  PLANNED: "border-dark-border text-zincGrey",
};

export default function BusinessPage() {
  const usd = useEthUsd();
  const [volume, setVolume] = useState(100_000);
  const [chain, setChain] = useState<{ volume: bigint; royalties: bigint; resales: number } | null>(null);

  useEffect(() => {
    let live = true;
    fetchActivity(500)
      .then((events) => {
        const bought = events.filter((e) => e.kind === "Bought" && e.price !== undefined);
        const vol = bought.reduce((s, e) => s + (e.price ?? 0n), 0n);
        if (live) setChain({ volume: vol, royalties: bought.reduce((s, e) => s + (e.price ?? 0n) / 10n, 0n), resales: bought.length });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const split = useMemo(
    () => ({ platform: volume * FEE, issuers: volume * ROYALTY, sellers: volume * (1 - FEE - ROYALTY) }),
    [volume],
  );
  const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const ethAndUsd = (wei: bigint) => (
    <>
      {formatEthShort(wei)} ETH
      {usd !== null && wei > 0n && (
        <span className="ml-2 text-sm font-normal text-zincGrey" title={USD_TITLE}>≈ {formatUsd(toEth(wei) * usd)}</span>
      )}
    </>
  );
  const plannedFee = chain ? chain.volume / 40n : 0n; // 2.5% = 1/40

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <Briefcase className="w-3.5 h-3.5" /><span>BUSINESS MODEL // HOW LIQUID PASS EARNS</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">We Earn When Time Moves</h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Liquid Pass makes money only when it creates value: when unused time finds a buyer. Subscribers recover money
          they would have lost, and issuers earn a royalty on demand that account sharing used to take from them.
        </p>
      </div>

      {/* ---- the split of one resale */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-dark-border pb-4">
            <div className="flex items-center space-x-2"><Store className="w-4 h-4 text-uranium" /><h3 className="font-header font-bold text-xl text-alabaster">Monthly Resale Volume</h3></div>
            <span className="font-mono text-[11px] uppercase text-zincGrey whitespace-nowrap">PLANNED SPLIT</span>
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="volume" className="text-zincGrey uppercase">Passes resold per month:</label>
              <span className="font-header text-3xl font-extrabold text-alabaster tnum">{dollars(volume)}</span>
            </div>
            <input
              id="volume"
              type="range"
              min={10_000}
              max={1_000_000}
              step={10_000}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-[#98FF1A]"
            />
            <div className="flex justify-between text-[10px] text-zincGrey"><span>$10,000</span><span>$1,000,000</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px border border-dark-border bg-dark-border">
            {[
              { label: "Sellers recover", pct: "87.5%", value: split.sellers, tone: "text-alabaster" },
              { label: "Issuers earn", pct: "10% royalty", value: split.issuers, tone: "text-periwinkle" },
              { label: "Liquid Pass earns", pct: "2.5% fee", value: split.platform, tone: "text-uranium" },
            ].map((c) => (
              <div key={c.label} className="bg-dark p-4 font-mono">
                <div className="text-[10px] uppercase text-zincGrey">{c.label}</div>
                <div className={`mt-1 font-header text-2xl font-extrabold tnum ${c.tone}`}>{dollars(c.value)}</div>
                <div className="text-[10px] text-zincGrey">{c.pct}</div>
              </div>
            ))}
          </div>
          <p className="font-body text-xs text-zincGrey leading-relaxed">
            At the proposal&apos;s example of $100,000 resold in a month, Liquid Pass earns $2,500 while issuers earn
            $10,000 in royalties from demand they used to lose to account sharing.
          </p>
        </div>

        <div className="lg:col-span-5 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">On Chain So Far</h3>
            <span className="font-mono text-[11px] uppercase text-uranium whitespace-nowrap">LIVE // TESTNET</span>
          </div>
          {chain === null ? (
            <div className="h-40 animate-pulse bg-raised" />
          ) : (
            <dl className="space-y-4 font-mono">
              <div>
                <dt className="text-[10px] uppercase text-zincGrey">Resale volume settled ({chain.resales} resale{chain.resales === 1 ? "" : "s"})</dt>
                <dd className="mt-1 font-header text-2xl font-extrabold text-alabaster tnum">{ethAndUsd(chain.volume)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-zincGrey">Royalties paid to issuers (10%, live)</dt>
                <dd className="mt-1 font-header text-2xl font-extrabold text-periwinkle tnum">{ethAndUsd(chain.royalties)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-zincGrey">What a 2.5% fee would have earned (not charged)</dt>
                <dd className="mt-1 font-header text-2xl font-extrabold text-uranium tnum">{ethAndUsd(plannedFee)}</dd>
              </div>
            </dl>
          )}
          <p className="font-mono text-[10px] leading-relaxed text-zincGrey">
            Read from the marketplace&apos;s Bought events. Testnet ETH has no value; dollar figures use today&apos;s
            mainnet ETH price for scale.
          </p>
        </div>
      </section>

      {/* ---- revenue streams */}
      <section className="space-y-6">
        <h2 className="font-header font-bold text-2xl sm:text-3xl text-alabaster tracking-tight">Five Revenue Streams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STREAMS.map((s) => (
            <div key={s.name} className="flex flex-col p-6 bg-dark-card border border-dark-border shadow-grunge space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">{s.icon}<h3 className="font-header font-bold text-lg text-alabaster truncate">{s.name}</h3></div>
                <span className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap ${BADGE[s.status]}`}>{s.status}</span>
              </div>
              <p className="font-body text-sm text-text leading-relaxed">{s.how}</p>
              <p className="font-mono text-[11px] text-zincGrey leading-relaxed grow">{s.note}</p>
              {s.href && (
                <Link href={s.href} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-uranium hover:underline">
                  {s.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- roadmap */}
      <section className="space-y-6">
        <h2 className="flex items-center gap-2 font-header font-bold text-2xl sm:text-3xl text-alabaster tracking-tight">
          <Rocket className="w-6 h-6 text-uranium" /> From Hackathon to Revenue
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((s) => (
            <li key={s.n} className={`p-5 border bg-dark-card ${s.now ? "border-uranium" : "border-dark-border"}`}>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-uranium">{s.n}</span>
                {s.now && <span className="border border-uranium px-1.5 py-0.5 text-[10px] uppercase text-uranium">We are here</span>}
              </div>
              <h3 className="mt-3 font-header font-bold text-lg text-alabaster">{s.name}</h3>
              <p className="mt-2 font-body text-xs text-zincGrey leading-relaxed">{s.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="p-4 bg-dark-card border border-dark-border font-mono text-[11px] text-zincGrey space-y-1">
        <div className="text-alabaster font-bold uppercase">Why issuers say yes</div>
        <p>
          Account sharing earns a company nothing. On Liquid Pass every resale of its plan pays it 10%, enforced by the
          contract, so it has a reason to support resale instead of blocking it.{" "}
          <Link href="/issuer" className="text-uranium hover:underline">Publish a plan</Link> or{" "}
          <Link href="/developers" className="text-uranium hover:underline">see how to integrate</Link>.
        </p>
      </div>
    </div>
  );
}
