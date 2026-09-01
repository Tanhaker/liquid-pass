"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DecayRing, lifeColor } from "@/components/DecayRing";
import { Constellation } from "@/components/Constellation";
import { LiveStats } from "@/components/LiveStats";
import { LiquidPassCard } from "@/components/LiquidPassCard";
import gsap from "gsap";
import { EXPLORER, LIQUID_PASS_ADDRESS, shortAddress } from "@/lib/contract";

/**
 * The landing page has one job: make the idea obvious in ten seconds.
 *
 * It does that by showing the same pass at four points in its life, side by
 * side, so "the thing you own is draining" is visible before any text is read.
 */

const STAGES = [
  { days: 30, total: 30, price: "0.0020" },
  { days: 18, total: 30, price: "0.0012" },
  { days: 7, total: 30, price: "0.0005" },
  { days: 2, total: 30, price: "0.0001" },
];

export default function Home() {
  // Cycles the highlighted stage so the decay reads as motion, not a static
  // row of four cards. Paused for reduced-motion users via the CSS guard.
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  /**
   * Hero choreography.
   *
   * GSAP earns its place here because this is a coordinated multi-element
   * sequence, which is exactly what a timeline is for -- the CSS `rise`
   * classes elsewhere handle the single-element cases.
   *
   * Two rules this obeys, both from hard experience earlier in this build:
   * it only animates elements that are ALREADY painted (no opacity-0 start
   * state that can strand content invisible), and it is scoped + reverted on
   * unmount so no timeline outlives the component.
   */
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero='card']", { yPercent: 8, scale: 0.96, duration: 0.9 }, 0.15)
        .from("[data-hero='stats']", { yPercent: 12, duration: 0.7 }, 0.35);
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <section className="aurora relative overflow-hidden border-b border-line">
        <Constellation className="opacity-70" />
        {/* Fades the particle field out under the copy so text stays legible. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-ink/50 to-ink" />
        {/*
          The hero renders at full opacity with no JS gate.

          It was briefly built with framer-motion entrance animations, and the
          headline got stuck at 8% opacity whenever requestAnimationFrame was
          throttled -- a backgrounded tab is enough to trigger it. An animation
          that can leave the entire pitch invisible is not worth the polish, so
          entrance motion here is CSS-only and additive: it moves elements that
          are already painted. Framer Motion still drives the decay cards below,
          where the animation IS the content rather than a reveal.
        */}
        <div ref={heroRef} className="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 pb-16 pt-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-10">
          <div>
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
            <span className="size-1.5 rounded-full bg-life-full" />
            Arbitrum Stylus · Rust
          </p>

          <h1
            className="rise max-w-4xl text-[clamp(2.9rem,8vw,5.8rem)] font-semibold leading-[0.94] tracking-[-0.04em]"
            style={{ animationDelay: "60ms" }}
          >
            Buy time.
            <br />
            Use it.{" "}
            <span className="bg-gradient-to-r from-life-full via-life-mid to-life-low bg-clip-text text-transparent">
              Sell what&rsquo;s left.
            </span>
          </h1>

          <p
            className="rise mt-7 max-w-xl text-[16px] leading-relaxed text-muted"
            style={{ animationDelay: "130ms" }}
          >
            A subscription is time you paid for. Cancel halfway and the rest just
            evaporates. Liquid Pass makes that remaining time an asset you can
            hand to someone else — and the buyer inherits your expiry date, not a
            fresh one.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/market"
              className="rounded-xl bg-text px-5 py-2.5 text-[14px] font-medium text-ink transition-opacity hover:opacity-90"
            >
              Browse the market
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-line bg-raised px-5 py-2.5 text-[14px] text-muted transition-colors hover:border-line-bright hover:text-text"
            >
              My passes
            </Link>
          </div>

          </div>

          <div data-hero="card" className="flex justify-center lg:justify-end">
            <LiquidPassCard
              name="Figma Pro"
              tokenId="PASS-0042"
              fraction={19 / 30}
              daysLeft={19}
              price="0.0012"
            />
          </div>
        </div>

        <div
          data-hero="stats"
          className="relative mx-auto max-w-6xl px-6 pb-16"
        >
          <LiveStats />
        </div>
      </section>

      {/* The idea, shown rather than described. */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
          One pass, over thirty days
        </h2>
        <p className="mt-3 max-w-lg text-[14px] text-muted">
          The same pass as it ages. As the time drains, so does what it&rsquo;s
          worth on resale — priced against what it originally sold for.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STAGES.map((s, i) => {
            const fraction = s.days / s.total;
            const isActive = i === active;
            return (
              <motion.div
                key={s.days}
                animate={{
                  scale: isActive ? 1 : 0.975,
                  opacity: isActive ? 1 : 0.55,
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="hairline rounded-2xl border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">Figma Pro</span>
                  <span className="tnum text-[11px] text-faint">#{i + 1}</span>
                </div>
                <div className="mt-5 grid place-items-center">
                  <DecayRing
                    fraction={fraction}
                    size={104}
                    label={`${s.days}d`}
                    sublabel="left"
                  />
                </div>
                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-[11px] text-faint">resale</span>
                  <span
                    className="tnum text-[13px] font-medium"
                    style={{ color: lifeColor(fraction) }}
                  >
                    {s.price} ETH
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-6 text-[12px] text-faint">
          Illustration of the lifecycle. Every number on{" "}
          <Link href="/market" className="underline underline-offset-2 hover:text-muted">
            the market
          </Link>{" "}
          is read from the contract.
        </p>
      </section>

      {/* How the split works -- the part judges ask about. */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
          {[
            {
              k: "01",
              t: "Buy from an issuer",
              d: "A plan sets a price and a duration. Buying mints a pass that expires at exactly that time from now. The issuer receives the full price.",
            },
            {
              k: "02",
              t: "Resell what you didn't use",
              d: "List it at whatever you like. Ten days in on a thirty-day pass, you're selling twenty days — and the market prices it against the original.",
            },
            {
              k: "03",
              t: "90 / 10 on every resale",
              d: "The seller takes 90%. The original issuer keeps 10%, forever, on every hand it passes through. Enforced in the contract, not by policy.",
            },
          ].map((c) => (
            <div key={c.k}>
              <span className="tnum text-[11px] text-faint">{c.k}</span>
              <h3 className="mt-3 text-[15px] font-medium">{c.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Contract
            </p>
            <a
              href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="tnum mt-1 block text-[13px] text-muted underline underline-offset-4 hover:text-text"
            >
              {shortAddress(LIQUID_PASS_ADDRESS)}
            </a>
          </div>
          <p className="max-w-md text-[12px] leading-relaxed text-faint">
            Written in Rust and deployed to Arbitrum Sepolia with Stylus. The
            expiry rule, the payment split, and the original sale price are all
            enforced on-chain — the frontend cannot fake any of them.
          </p>
        </div>
      </section>
    </>
  );
}
