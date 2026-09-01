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

      // 2. Scroll Storytelling Timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".story-container",
          start: "top top",
          end: "+=4000",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        }
      });

      // Stage 1: "Subscriptions expire."
      tl.to(".stage-1-text", { opacity: 1, y: 0, duration: 1 })
        .to(".story-pass", { scale: 1.1, y: -50, duration: 2 }, "<")
        // Time visually drains (this would be driven by a React state tied to scroll, 
        // but we'll simulate the text/opacity shifts here)
        .to(".stage-1-text", { opacity: 0, y: -30, duration: 1 }, "+=1")

      // Stage 2: "Unused time doesn't have to disappear."
      tl.to(".stage-2-text", { opacity: 1, y: 0, duration: 1 })
        .to(".story-pass", { x: -200, scale: 0.9, duration: 2 }, "<")
        .to(".stage-2-text", { opacity: 0, y: -30, duration: 1 }, "+=1")

      // Stage 3: Marketplace & Ownership Transfer
      tl.to(".stage-3-text", { opacity: 1, y: 0, duration: 1 })
        .to(".alice-avatar", { x: 50, opacity: 0, duration: 1 }, "<")
        .to(".bob-avatar", { x: 0, opacity: 1, duration: 1 }, "<")
        .to(".stage-3-text", { opacity: 0, y: -30, duration: 1 }, "+=1")

      // Stage 4: "Time moves. Ownership moves."
      tl.to(".stage-4-text", { opacity: 1, y: 0, duration: 1 })
        .to(".story-pass", { x: 0, scale: 1, duration: 2 }, "<")
        
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

      {/* GSAP Scroll Storytelling Section */}
      <section className="story-container relative h-screen w-full bg-ink overflow-hidden border-t border-line hidden md:block">
        <div className="absolute inset-0 flex items-center justify-center">
          
          {/* Central Interactive Pass */}
          <div className="story-pass relative z-20 w-full max-w-sm">
            <LiquidPassCard
              name="Cursor Pro"
              tokenId="PASS-0089"
              fraction={0.6}
              daysLeft={18}
              price="0.0012"
            />
            {/* Alice -> Bob avatars overlay */}
            <div className="absolute -right-16 top-1/2 -translate-y-1/2 flex items-center">
              <div className="alice-avatar absolute w-12 h-12 rounded-full bg-line-bright border-2 border-surface flex items-center justify-center text-xs font-bold">A</div>
              <div className="bob-avatar absolute w-12 h-12 rounded-full bg-life-full text-ink border-2 border-surface flex items-center justify-center text-xs font-bold opacity-0 -translate-x-10">B</div>
            </div>
          </div>

          {/* Text Layers */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <h2 className="stage-1-text absolute text-5xl font-bold tracking-tight opacity-0 translate-y-10">Subscriptions expire.</h2>
            <h2 className="stage-2-text absolute text-5xl font-bold tracking-tight opacity-0 translate-y-10">Unused time doesn&apos;t have to disappear.</h2>
            <h2 className="stage-3-text absolute text-5xl font-bold tracking-tight opacity-0 translate-y-10">Sell what&apos;s left.</h2>
            <h2 className="stage-4-text absolute text-5xl font-bold tracking-tight text-life-full opacity-0 translate-y-10">Time moves.<br/>Ownership moves.</h2>
          </div>
        </div>
      </section>

      {/* Mobile Fallback for Story (when scrolljacking is disabled) */}
      <section className="md:hidden px-6 py-24 space-y-24 border-t border-line text-center">
        <div>
          <h2 className="text-3xl font-bold">Subscriptions expire.</h2>
          <p className="mt-4 text-muted">Time visually drains from a Liquid Pass.</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold">Sell what&apos;s left.</h2>
          <p className="mt-4 text-muted">Unused time doesn&apos;t have to disappear.</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-life-full">Time moves. Ownership moves.</h2>
          <p className="mt-4 text-muted">The buyer inherits your expiry date, not a fresh term.</p>
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
