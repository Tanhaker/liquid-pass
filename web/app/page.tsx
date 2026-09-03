"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Cpu, Fingerprint, Sliders } from "lucide-react";
import { PassCard3D } from "@/components/PassCard3D";
import { LinkButton3D } from "@/components/Button3D";
import { LiveStats } from "@/components/LiveStats";
import { DualSettlementAnimation } from "@/components/DualSettlementAnimation";
import { useNow } from "@/components/ui";
import dynamic from "next/dynamic";
const DottedSurface = dynamic(() => import("@/components/ui/dotted-surface"), { ssr: false });
import { EXPLORER, LIQUID_PASS_ADDRESS, shortAddress } from "@/lib/contract";

/**
 * Landing page, in the team's tactical HUD design.
 *
 * The hero scrubber is explicitly a simulation and is labelled as one. It is
 * the only illustrative number on the page -- LiveStats below it reads the
 * chain.
 */

const HERO_TOTAL_DAYS = 30;
/** 0.035 ETH in wei. Illustrative: this pass does not exist on chain. */
const HERO_OPENING_PRICE = 35_000_000_000_000_000n;

const LIFECYCLE = [
  {
    stage: "STAGE 01 // FRESH MINT",
    daysLeft: "30 DAYS LEFT",
    percent: 100,
    price: "0.0020 ETH",
    discount: "0% OFF — FULL RETAIL",
    status: "ACTIVE",
    statusClass: "text-uranium border-uranium bg-uranium/10",
    barClass: "bg-uranium",
    desc: "Bought straight from the SaaS issuer for a month-long sprint.",
  },
  {
    stage: "STAGE 02 // MID-CYCLE RESALE",
    daysLeft: "18 DAYS LEFT",
    percent: 60,
    price: "0.0012 ETH",
    discount: "40% DISCOUNT",
    status: "RESALE LISTED",
    statusClass: "text-uranium border-dark-border bg-raised",
    barClass: "bg-gradient-to-r from-uranium to-aviation",
    desc: "Work finished early; the remaining 18 days go on the secondary market.",
  },
  {
    stage: "STAGE 03 // DECAYING VALUE",
    daysLeft: "7 DAYS LEFT",
    percent: 23,
    price: "0.0005 ETH",
    discount: "75% DISCOUNT",
    status: "DECAYING",
    statusClass: "text-aviation border-aviation bg-aviation/10",
    barClass: "bg-aviation",
    desc: "The curve makes short-project access genuinely cheap.",
  },
  {
    stage: "STAGE 04 // FIRE SALE",
    daysLeft: "2 DAYS LEFT",
    percent: 7,
    price: "0.0001 ETH",
    discount: "95% DISCOUNT · STEAL",
    status: "STEAL",
    statusClass: "text-black bg-aviation font-bold border-aviation",
    barClass: "bg-aviation shadow-glow-amber",
    desc: "Picked up by a builder for a weekend hackathon.",
  },
];

const REVEAL = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export default function Home() {
  const now = useNow(1000);
  const [days, setDays] = useState(24);

  // The scrubber must render identically on the server and on first paint, so
  // it uses a fixed epoch until the client clock arrives.
  const clock = now ?? 0;

  return (
    <div className="relative overflow-hidden">
      {/* Background Hero 3D Dotted Surface Wave */}
      <div className="absolute top-0 left-0 right-0 h-[680px] lg:h-[780px] overflow-hidden pointer-events-none z-0">
        <div className="hero-surface-fade absolute inset-0">
          <DottedSurface size={12} opacity={0.9} />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* HERO                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <motion.div {...REVEAL} className="space-y-6 lg:col-span-7">
            <h1 className="font-header text-4xl font-extrabold leading-[1.05] tracking-tight text-text sm:text-6xl lg:text-7xl">
              Buy time. Use it.
              <br />
              <span className="text-uranium">Sell what&rsquo;s left.</span>
            </h1>

            <p className="max-w-2xl font-body text-lg leading-relaxed text-zinc-grey sm:text-xl">
              Turn unused subscription days into liquid value. Buy 30 days of a
              SaaS plan, use 10, and resell the remaining 20 on an automated
              decaying curve. The contract pays 90% to you and a 10% royalty to
              the issuer, in the same transaction.
            </p>

            <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
              <LinkButton3D href="/market" size="lg">
                <span>BROWSE THE MARKET</span>
                <ArrowRight className="size-4" />
              </LinkButton3D>
              <LinkButton3D href="/dashboard" variant="ghost" size="lg">
                MY PASSES &amp; VAULT
              </LinkButton3D>
            </div>

            <div className="flex items-center gap-2 pt-2 font-mono text-xs text-zinc-grey">
              <Fingerprint className="size-4 shrink-0 text-uranium" />
              <span>
                P-256 SIGNATURE VERIFICATION IN RUST — THE REASON THIS RUNS ON
                STYLUS
              </span>
            </div>
          </motion.div>

          {/* Interactive scrubber */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.94 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative border border-dark-border bg-surface p-4 shadow-grunge">
              <div className="mb-4 flex items-center justify-between border-b border-dark-border pb-3 font-mono text-xs text-zinc-grey">
                <span className="flex items-center gap-1 font-bold text-uranium">
                  <Sliders className="size-3.5" />
                  <span>LIFECYCLE SCRUBBER</span>
                </span>
                <span>{days} DAYS REMAINING</span>
              </div>

              <PassCard3D
                pass={{
                  tokenId: "042",
                  name: "PromptForge Pro",
                  service: "PromptForge",
                  owner: "0xDEMO",
                  issuer: "0xISSUER",
                  expiryTimestamp: Math.floor(clock / 1000) + days * 86400,
                  totalDurationSeconds: HERO_TOTAL_DAYS * 86400,
                  originalPriceEth: (Number(HERO_OPENING_PRICE) / 1e18).toFixed(3),
                  listingPriceEth: ((Number(HERO_OPENING_PRICE) / 1e18) * (days / HERO_TOTAL_DAYS)).toFixed(4),
                  isListed: true,
                  tier: "PRO",
                  features: [],
                }}
                interactive={true}
                showActions={false}
              />

              <div className="mt-5 space-y-2">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-grey">SIMULATE PASS DECAY:</span>
                  <span className="font-bold text-uranium">
                    {days} / {HERO_TOTAL_DAYS} Days
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={HERO_TOTAL_DAYS}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  aria-label="Simulate pass decay"
                  className="h-1 w-full cursor-pointer appearance-none bg-dark-border accent-uranium"
                />
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-grey">
                  Illustrative. Real passes decay against their on-chain expiry.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* LIFECYCLE                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="technical-grid border-y border-dark-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <motion.div {...REVEAL} className="mb-12 border-l-2 border-uranium pl-6">
            <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-uranium">
              One pass, over thirty days
            </h2>
            <p className="mt-2 font-header text-3xl font-bold tracking-tight text-text">
              The same token, four owners, one expiry.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE.map((s, i) => (
              <motion.div
                key={s.stage}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-between border border-dark-border bg-surface p-5 transition-colors hover:border-uranium"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-grey">
                      {s.stage}
                    </span>
                    <span
                      className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${s.statusClass}`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <p className="mt-4 font-header text-2xl font-bold text-text">{s.price}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-aviation">
                    {s.discount}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="h-1.5 w-full overflow-hidden border border-dark-border bg-raised">
                    <div className={`h-full ${s.barClass}`} style={{ width: `${s.percent}%` }} />
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-grey">
                    {s.daysLeft}
                  </p>
                  <p className="mt-3 font-body text-[13px] leading-relaxed text-zinc-grey">
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* LIVE STATE                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div {...REVEAL} className="mb-12 border-l-2 border-uranium pl-6">
          <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-uranium">
            Live on-chain activity
          </h2>
          <p className="mt-2 font-header text-3xl font-bold tracking-tight text-text">
            Real state. No mock data.
          </p>
        </motion.div>
        <LiveStats />
      </section>

      {/* Dual-settlement animation, mounted where the drop places it: directly
          after the live stats. It visualises the 90/10 split the contract
          performs on every resale. */}
      <DualSettlementAnimation />

      {/* ---------------------------------------------------------------- */}
      {/* CTA                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="technical-dots border-t border-dark-border bg-surface/40">
        <div className="mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
          <motion.div {...REVEAL}>
            <h2 className="font-header text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-none tracking-tight text-text">
              Ready to liquidate your time?
            </h2>
            <Link
              href="/market"
              className="mt-10 inline-flex items-center gap-2 bg-uranium px-10 py-5 font-mono text-sm font-extrabold uppercase tracking-wider text-black shadow-grunge-uranium transition-all hover:bg-uranium-glow hover:shadow-glow-uranium"
            >
              ENTER THE MARKETPLACE
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>

          <div className="mt-20 flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] text-zinc-grey">
            <span className="flex items-center gap-1.5">
              <Cpu className="size-3.5 text-uranium" />
              ARBITRUM SEPOLIA
            </span>
            <span className="size-1 bg-uranium" />
            <a
              href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-uranium"
            >
              {shortAddress(LIQUID_PASS_ADDRESS)}
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
