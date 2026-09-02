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
        stagger: 0.15,
        ease: "power3.out",
        delay: 0.1
      });

      // 2. Scroll Animations
      gsap.utils.toArray<HTMLElement>(".scroll-reveal").forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
          y: 40,
          opacity: 0,
          duration: 1,
          ease: "power3.out"
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-ink min-h-screen text-text selection:bg-life-full/30 font-sans">
      {/* Cinematic Hero */}
      <section className="relative min-h-[90vh] flex flex-col justify-center pt-24 pb-12 overflow-hidden border-b border-line">
        {/* The Constellation component acts as the tech matrix particle background */}
        <Constellation className="opacity-60" />
        
        {/* Dynamic Glows */}
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-[var(--theme-accent)]/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-[var(--theme-life-full)]/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-ink)] via-[var(--theme-ink)]/70 to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Typography */}
          <div className="text-left">
            <h1 className="hero-element text-[clamp(3.5rem,7vw,5.5rem)] font-bold tracking-tighter leading-[0.95] text-text">
              Buy time. Use it.<br/>
              <span className="text-[var(--theme-life-full)]">Sell what&rsquo;s left.</span>
            </h1>
            
            <p className="hero-element mt-8 text-[16px] md:text-[20px] font-medium text-muted max-w-xl leading-relaxed">
              Turn unused subscription days into liquid value. Buy 30 days of Figma, Cursor, or Midjourney, use 10, and resell the remaining 20 on an automated decaying curve. The contract automatically pays 90% to you and 10% royalty to the SaaS creator.
            </p>
            
            <div className="hero-element mt-12 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/market"
                className="group relative flex w-full sm:w-auto items-center justify-center bg-[var(--theme-accent)] px-8 py-4 text-[13px] uppercase tracking-widest font-bold text-ink transition-transform hover:scale-105"
              >
                BROWSE THE MARKET &rarr;
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
              </Link>
              
              <Link
                href="/dashboard"
                className="group flex w-full sm:w-auto items-center justify-center border border-line px-8 py-4 text-[13px] uppercase tracking-widest font-bold text-muted transition-colors hover:border-line-bright hover:text-text bg-surface/50 backdrop-blur-md"
              >
                MY PASSES & VAULT
              </Link>
            </div>
            
            {/* Tech Logo Stamp */}
            <div className="hero-element mt-12 flex items-center gap-2 opacity-50">
              <div className="size-6 rounded-full bg-line-bright flex items-center justify-center text-[10px] font-bold">N</div>
            </div>
          </div>

          {/* Right Column: Interactive Card */}
          <div className="hero-element relative z-10 w-full max-w-md mx-auto lg:ml-auto">
            {/* Decorative Card Wrapper */}
            <div className="relative p-[1px] rounded-[24px] bg-gradient-to-b from-line-bright/50 to-transparent">
              <div className="absolute -top-4 -left-4 text-[10px] uppercase font-mono tracking-widest text-[var(--theme-life-full)]">
                #1 INTERACTIVE LIFECYCLE SCRUBBER
              </div>
              <div className="absolute -top-4 right-0 text-[10px] uppercase font-mono tracking-widest text-muted text-right">
                24 DAYS<br/>REMAINING
              </div>
              
              <LiquidPassCard
                name="PromptForge Pro Pass"
                tokenId="TOKEN #042"
                fraction={0.8}
                daysLeft={24}
                price="0.0280"
              />
            </div>
          </div>

        </div>
      </section>

      {/* Value Proposition Cards (Scroll Animations) */}
      <section className="px-6 py-32 space-y-32 bg-surface">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="scroll-reveal group relative p-[1px] rounded-2xl bg-gradient-to-b from-line to-transparent overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--theme-life-full)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-ink p-8 rounded-[15px] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-text mb-4">Subscriptions expire.</h3>
                <p className="text-muted text-sm leading-relaxed">Time visually drains from a Liquid Pass. You can watch your asset decay block by block.</p>
              </div>
              <div className="mt-12 h-1 w-full bg-line rounded-full overflow-hidden">
                <div className="h-full bg-line-bright w-[30%]" />
              </div>
            </div>
          </div>

          <div className="scroll-reveal group relative p-[1px] rounded-2xl bg-gradient-to-b from-line to-transparent overflow-hidden" style={{ transitionDelay: "100ms" }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--theme-life-full)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-ink p-8 rounded-[15px] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-text mb-4">Sell what&apos;s left.</h3>
                <p className="text-muted text-sm leading-relaxed">Unused time doesn&apos;t have to disappear. List your pass on the Dutch Auction market instantly.</p>
              </div>
              <div className="mt-12 h-1 w-full bg-line rounded-full overflow-hidden">
                <div className="h-full bg-[var(--theme-life-full)] w-[60%] shadow-[0_0_10px_var(--theme-life-full)]" />
              </div>
            </div>
          </div>

          <div className="scroll-reveal group relative p-[1px] rounded-2xl bg-gradient-to-b from-line to-transparent overflow-hidden" style={{ transitionDelay: "200ms" }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--theme-life-full)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-full bg-ink p-8 rounded-[15px] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[var(--theme-life-full)] mb-4">Time moves.</h3>
                <p className="text-muted text-sm leading-relaxed">The buyer inherits your expiry date, not a fresh term. It&apos;s perfectly fair pricing.</p>
              </div>
              <div className="mt-12 h-1 w-full bg-line rounded-full overflow-hidden">
                <div className="h-full bg-text w-[90%]" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Live Data / Activity Section */}
      <section className="py-32 px-6 border-t border-line bg-ink">
        <div className="max-w-7xl mx-auto scroll-reveal">
          <div className="mb-12 border-l-2 border-[var(--theme-life-full)] pl-6">
            <h2 className="text-[12px] font-mono uppercase tracking-[0.2em] text-[var(--theme-life-full)] font-semibold">Live On-Chain Activity</h2>
            <p className="mt-2 text-3xl font-bold text-text tracking-tight">Real state. No mock data.</p>
          </div>
          <LiveStats />
        </div>
      </section>

      {/* Footer / Final CTA */}
      <section className="py-32 px-6 border-t border-line bg-surface text-center">
        <div className="scroll-reveal max-w-3xl mx-auto">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold tracking-tighter mb-10 text-text leading-none">
            Ready to liquidate your time?
          </h2>
          <Link
            href="/market"
            className="inline-flex items-center justify-center bg-[var(--theme-accent)] px-10 py-5 text-[15px] font-bold text-ink transition-transform hover:scale-105"
          >
            ENTER THE MARKETPLACE &rarr;
          </Link>
        </div>

        <div className="mt-24 flex items-center justify-center gap-4 text-[12px] font-mono text-faint">
          <span>ARBITRUM SEPOLIA</span>
          <span className="w-1 h-1 bg-[var(--theme-life-full)]" />
          <a href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`} target="_blank" rel="noreferrer" className="hover:text-[var(--theme-life-full)] transition-colors">
            {shortAddress(LIQUID_PASS_ADDRESS)}
          </a>
        </div>
      </section>
    </div>
  );
}
