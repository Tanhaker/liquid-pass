"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LiquidPassCard } from "@/components/LiquidPassCard";
import { LiveStats } from "@/components/LiveStats";
import { Constellation } from "@/components/Constellation";
import { EXPLORER, LIQUID_PASS_ADDRESS, shortAddress } from "@/lib/contract";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Disable heavy scroll effects on mobile/reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.innerWidth < 768) {
      return;
    }

    const ctx = gsap.context(() => {
      // 1. Hero Reveal
      gsap.from(".hero-element", {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.2,
        ease: "power3.out",
        delay: 0.1
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-ink min-h-screen text-text selection:bg-life-full/30">
      {/* Cinematic Hero */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden">
        <Constellation className="opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/20 to-ink pointer-events-none" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h1 className="hero-element text-[clamp(3.5rem,10vw,8rem)] font-bold tracking-tighter leading-[0.9] text-text">
            STOP PAYING<br/>
            <span className="text-muted">FOR UNUSED</span><br/>
            TIME.
          </h1>
          
          <p className="hero-element mt-10 text-[20px] md:text-[24px] font-medium text-muted max-w-2xl mx-auto leading-snug">
            Buy a subscription.<br/>
            Use what you need.<br/>
            <span className="text-life-full">Sell what&rsquo;s left.</span>
          </p>
          
          <div className="hero-element mt-12 flex justify-center">
            <Link
              href="/market"
              className="group relative inline-flex items-center justify-center rounded-full bg-text px-8 py-4 text-[15px] font-semibold text-ink transition-all hover:scale-105"
            >
              EXPLORE MARKETPLACE
              <div className="absolute inset-0 rounded-full bg-text blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
            </Link>
          </div>
        </div>

        <div className="hero-element mt-20 relative z-10 w-full max-w-sm mx-auto">
          <LiquidPassCard
            name="Figma Pro"
            tokenId="PASS-0042"
            fraction={1}
            daysLeft={30}
            price="0.0020"
          />
        </div>
      </section>

      {/* Static Story Section (Replacing pinned scroll) */}
      <section className="px-6 py-24 space-y-24 border-t border-line text-center bg-ink">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-text">Subscriptions expire.</h2>
          <p className="mt-4 text-muted text-lg">Time visually drains from a Liquid Pass.</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-text">Sell what&apos;s left.</h2>
          <p className="mt-4 text-muted text-lg">Unused time doesn&apos;t have to disappear.</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-life-full">Time moves. Ownership moves.</h2>
          <p className="mt-4 text-muted text-lg">The buyer inherits your expiry date, not a fresh term.</p>
        </div>
      </section>

      {/* Live Data / Activity Section */}
      <section className="py-24 px-6 border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-[12px] uppercase tracking-[0.2em] text-life-full font-semibold">Live On-Chain Activity</h2>
            <p className="mt-2 text-2xl font-semibold text-text tracking-tight">Real state. No mock data.</p>
          </div>
          <LiveStats />
        </div>
      </section>

      {/* Footer / Final CTA */}
      <section className="py-32 px-6 border-t border-line bg-ink text-center">
        <h2 className="text-4xl font-bold tracking-tight mb-8">Ready to liquidate your time?</h2>
        <Link
          href="/market"
          className="inline-block rounded-full bg-line-bright px-8 py-4 text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-ink"
        >
          ENTER MARKETPLACE
        </Link>

        <div className="mt-24 flex items-center justify-center gap-4 text-[12px] text-faint">
          <span>Arbitrum Sepolia</span>
          <span className="w-1 h-1 rounded-full bg-line-bright" />
          <a href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`} target="_blank" rel="noreferrer" className="hover:text-muted transition-colors">
            {shortAddress(LIQUID_PASS_ADDRESS)}
          </a>
        </div>
      </section>
    </div>
  );
}
