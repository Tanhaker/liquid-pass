"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Zap, CheckCircle2, Flame } from "lucide-react";

export function DualSettlementAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const isSummaryInView = useInView(summaryRef, { once: true, amount: 0.25 });
  const shouldReduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper timing function for instant state on reduced motion
  const d = (delay: number) => (shouldReduceMotion ? 0 : delay);
  const dur = (duration: number) => (shouldReduceMotion ? 0 : duration);

  const sellerAngle = isDesktop && !shouldReduceMotion ? 16 : 0;
  const buyerAngle = isDesktop && !shouldReduceMotion ? -16 : 0;

  return (
    <section
      ref={sectionRef}
      className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
    >
      {/* ============================================================ */}
      {/* STEP 0: Section Header (0.0s – 0.5s) */}
      {/* ============================================================ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{
          duration: dur(0.5),
          delay: d(0.0),
          ease: [0.16, 1, 0.3, 1],
        }}
        className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-chip-bg border border-dark-border text-chip-text font-mono text-xs uppercase mb-3">
            <Zap className="w-3.5 h-3.5 text-accent-glow" />
            <span>// VALUE RECOVERY PROTOCOL [DUAL-SETTLEMENT SNAPSHOT: DAY 12 / 30]</span>
          </div>
          <h2 className="font-header font-bold text-3xl sm:text-5xl text-alabaster tracking-tight">
            How value transfers in real time.
          </h2>
        </div>
        <p className="font-body text-zincGrey text-sm max-w-md leading-relaxed">
          Arbitrum Stylus automatically matches sellers with excess compute time to buyers looking for discounted project sprints.
        </p>
      </motion.div>

      {/* ============================================================ */}
      {/* 3D FACE-OFF STAGE (INWARD TILT PERSPECTIVE) */}
      {/* ============================================================ */}
      <div className="relative w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-stretch relative">
          
          {/* ============================================================ */}
          {/* SELLER CARD CONTAINER (LEFT - ROTATE Y: 16deg) */}
          {/* ============================================================ */}
          <div
            className="w-full flex flex-1"
            style={{
              perspective: isDesktop ? "700px" : "none",
              perspectiveOrigin: "center center",
            }}
          >
            <motion.div
              initial={{
                opacity: 0,
                x: shouldReduceMotion ? 0 : -140,
                rotateY: sellerAngle,
              }}
              animate={
                isInView
                  ? {
                      opacity: 1,
                      x: 0,
                      rotateY: sellerAngle,
                    }
                  : {}
              }
              transition={{
                duration: dur(0.55),
                delay: d(0.0),
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "center center",
              }}
              className="w-full flex-1 p-6 sm:p-8 bg-dark-card border border-dark-border shadow-grunge flex flex-col justify-between relative overflow-visible rounded-none"
            >
              {/* Step 3: Seller Profit Slam Tag (2.7s) */}
              <motion.div
                initial={{ opacity: 0, scale: 2.8, y: -60, x: -10 }}
                animate={
                  isInView
                    ? {
                        opacity: 1,
                        scale: [2.8, 0.9, 1.05, 1],
                        y: [-60, 4, -2, 0],
                        x: 0,
                      }
                    : {}
                }
                transition={{
                  duration: dur(0.45),
                  delay: d(2.7),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute -top-4 -left-3 z-30 px-3.5 py-1.5 bg-aviation border border-aviation-glow text-black font-mono text-xs font-black uppercase tracking-wider shadow-grunge-amber pointer-events-none"
              >
                PROFIT: +0.00108 ETH
              </motion.div>

              {/* Impact Flash effect for Seller slam */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? {
                        opacity: [0, 0.9, 0],
                        scale: [0.8, 1.6, 2.0],
                      }
                    : {}
                }
                transition={{
                  duration: dur(0.5),
                  delay: d(2.75),
                  ease: "easeOut",
                }}
                className="absolute -top-4 -left-3 w-32 h-10 rounded-full bg-aviation/40 blur-md pointer-events-none z-20"
              />

              <div className="space-y-5">
                {/* Step 1: Seller Header Title Badge (0.5s – 0.9s) */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    duration: dur(0.4),
                    delay: d(0.5),
                    ease: "easeOut",
                  }}
                  className="flex items-center justify-between border-b border-dark-border pb-4 h-14"
                >
                  <span className="font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider text-uranium flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-uranium inline-block animate-pulse" />
                    <span>SELLER: PROMPTFORGE PRO PASS #842</span>
                  </span>
                  <span className="font-mono text-[10px] sm:text-xs px-2.5 py-0.5 bg-dark border border-dark-border text-zincGrey font-bold tracking-wider">
                    ORIGINAL: 0.0020 ETH
                  </span>
                </motion.div>

                {/* Step 2: Line-by-Line Content Stagger (Left) */}
                <div className="space-y-3 font-mono text-xs sm:text-sm">
                  {/* Row 1: 0.9s */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(0.9),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-dark border border-dark-border flex justify-between items-center h-12"
                  >
                    <span className="text-zincGrey">Current Progress:</span>
                    <span className="text-alabaster font-bold">Day 12 / 30 (Done Early)</span>
                  </motion.div>

                  {/* Row 2: 1.4s */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(1.4),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-dark border border-dark-border flex justify-between items-center h-12"
                  >
                    <span className="text-zincGrey">Unused Duration:</span>
                    <span className="text-uranium font-bold">18 Days Remaining (60%)</span>
                  </motion.div>

                  {/* Row 3: 1.9s (Strikethrough Red) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(1.9),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-red-950/20 border border-red-900/40 flex justify-between items-center h-12"
                  >
                    <span className="text-red-400/90">Traditional SaaS Outcome:</span>
                    <span className="text-red-400 font-bold line-through">
                      0.0012 ETH Wasted (100% Loss)
                    </span>
                  </motion.div>

                  {/* Row 4: 2.4s (Recovery Box Neon) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(2.4),
                      ease: "easeOut",
                    }}
                    className="p-3.5 sm:p-4 bg-uranium/10 border-2 border-uranium shadow-glow-uranium flex justify-between items-center h-14"
                  >
                    <span className="text-uranium font-extrabold uppercase text-xs sm:text-sm">
                      LIQUIDPASS RECOVERY:
                    </span>
                    <span className="text-uranium font-mono font-extrabold text-base sm:text-lg">
                      +0.00120 ETH
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-6 border-t border-dark-border flex items-center justify-between text-[11px] font-mono text-zincGrey h-10">
                <span>90% Escrow Payout to Seller</span>
                <span className="text-uranium font-semibold">Instant Liquidity</span>
              </div>
            </motion.div>
          </div>

          {/* ============================================================ */}
          {/* BUYER CARD CONTAINER (RIGHT - ROTATE Y: -16deg) */}
          {/* ============================================================ */}
          <div
            className="w-full flex flex-1"
            style={{
              perspective: isDesktop ? "700px" : "none",
              perspectiveOrigin: "center center",
            }}
          >
            <motion.div
              initial={{
                opacity: 0,
                x: shouldReduceMotion ? 0 : 140,
                rotateY: buyerAngle,
              }}
              animate={
                isInView
                  ? {
                      opacity: 1,
                      x: 0,
                      rotateY: buyerAngle,
                    }
                  : {}
              }
              transition={{
                duration: dur(0.55),
                delay: d(0.0),
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "center center",
              }}
              className="w-full flex-1 p-6 sm:p-8 bg-dark-card border border-dark-border shadow-grunge flex flex-col justify-between relative overflow-visible rounded-none"
            >
              {/* Step 3: Buyer Saved Slam Tag (3.1s) */}
              <motion.div
                initial={{ opacity: 0, scale: 2.8, y: -60, x: 10 }}
                animate={
                  isInView
                    ? {
                        opacity: 1,
                        scale: [2.8, 0.9, 1.05, 1],
                        y: [-60, 4, -2, 0],
                        x: 0,
                      }
                    : {}
                }
                transition={{
                  duration: dur(0.45),
                  delay: d(3.1),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute -top-4 -right-3 z-30 px-3.5 py-1.5 bg-aviation border border-aviation-glow text-black font-mono text-xs font-black uppercase tracking-wider shadow-grunge-amber pointer-events-none"
              >
                SAVED: -0.00080 ETH
              </motion.div>

              {/* Impact Flash effect for Buyer slam */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? {
                        opacity: [0, 0.9, 0],
                        scale: [0.8, 1.6, 2.0],
                      }
                    : {}
                }
                transition={{
                  duration: dur(0.5),
                  delay: d(3.15),
                  ease: "easeOut",
                }}
                className="absolute -top-4 -right-3 w-32 h-10 rounded-full bg-aviation/40 blur-md pointer-events-none z-20"
              />

              <div className="space-y-5">
                {/* Step 1: Buyer Header Title Badge (0.5s – 0.9s) */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    duration: dur(0.4),
                    delay: d(0.5),
                    ease: "easeOut",
                  }}
                  className="flex items-center justify-between border-b border-dark-border pb-4 h-14"
                >
                  <span className="font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider text-aviation flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-aviation inline-block animate-pulse" />
                    <span>BUYER: INSTANT COMPUTE ACCESS</span>
                  </span>
                  <span className="font-mono text-[10px] sm:text-xs px-2.5 py-0.5 bg-dark border border-dark-border text-zincGrey font-bold tracking-wider">
                    WANTED: 2 WEEKS
                  </span>
                </motion.div>

                {/* Step 2: Line-by-Line Content Stagger (Right) */}
                <div className="space-y-3 font-mono text-xs sm:text-sm">
                  {/* Row 1: 0.9s */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(0.9),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-dark border border-dark-border flex justify-between items-center h-12"
                  >
                    <span className="text-zincGrey">Needs Compute:</span>
                    <span className="text-alabaster font-bold">2-Week Hackathon Sprint</span>
                  </motion.div>

                  {/* Row 2: 1.4s */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(1.4),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-dark border border-dark-border flex justify-between items-center h-12"
                  >
                    <span className="text-zincGrey">Market Target:</span>
                    <span className="text-aviation font-bold">18-Day Pass (Closest Match)</span>
                  </motion.div>

                  {/* Row 3: 1.9s (Strikethrough Gray) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(1.9),
                      ease: "easeOut",
                    }}
                    className="p-3 bg-dark border border-dark-border flex justify-between items-center h-12"
                  >
                    <span className="text-zincGrey">Full Monthly Retail:</span>
                    <span className="text-zincGrey line-through font-bold">
                      0.00200 ETH (30 Days)
                    </span>
                  </motion.div>

                  {/* Row 4: 2.4s (Secondary Market Box Neon) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: dur(0.35),
                      delay: d(2.4),
                      ease: "easeOut",
                    }}
                    className="p-3.5 sm:p-4 bg-aviation/10 border-2 border-aviation shadow-glow-amber flex justify-between items-center h-14"
                  >
                    <span className="text-aviation font-extrabold uppercase text-xs sm:text-sm">
                      SECONDARY MARKET PRICE:
                    </span>
                    <span className="text-aviation font-mono font-extrabold text-base sm:text-lg">
                      0.00120 ETH
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-6 border-t border-dark-border flex items-center justify-between text-[11px] font-mono text-zincGrey h-10">
                <span>Instant Passkey WebAuthn Login</span>
                <span className="text-aviation font-semibold">40% Discount</span>
              </div>
            </motion.div>
          </div>

        </div>

        {/* ============================================================ */}
        {/* STEP 4: Inverted Chevron Arrow (3.4s – 3.8s) */}
        {/* Peak/Apex points UP (^) toward cards above, No Text */}
        {/* ============================================================ */}
        <div className="flex justify-center items-center my-8">
          <svg
            className="w-16 h-8 sm:w-24 sm:h-10 overflow-visible"
            viewBox="0 0 100 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Single clean angular V-shape with apex facing UP (peak at top-center 50, 6) */}
            <motion.path
              d="M 10 34 L 50 6 L 90 34"
              stroke="#7ED321"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={
                isInView
                  ? {
                      pathLength: 1,
                      opacity: 1,
                    }
                  : {}
              }
              transition={{
                duration: dur(0.4),
                delay: d(3.4),
                ease: "easeInOut",
              }}
            />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* STEP 5: Match Summary & Net Value Gain */}
        {/* Independently scroll-triggered when scrolled into viewport */}
        {/* ============================================================ */}
        <motion.div
          ref={summaryRef}
          initial={{ opacity: 0, y: 35 }}
          animate={isSummaryInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: dur(0.6),
            delay: d(0.1),
            ease: [0.16, 1, 0.3, 1],
          }}
          className="p-6 sm:p-8 bg-dark-surface border border-dark-border shadow-grunge"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={isSummaryInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: dur(0.4), delay: d(0.2) }}
              className="space-y-1 text-center md:text-left"
            >
              <span className="font-mono text-xs text-zincGrey uppercase tracking-widest block">
                // MATCH SUMMARY &amp; NET VALUE GAIN
              </span>
              <h3 className="font-header font-bold text-xl sm:text-2xl text-alabaster">
                Both parties win. Zero subscription waste.
              </h3>
            </motion.div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto font-mono text-xs sm:text-sm font-bold">
              
              {/* Left Pill (Seller Net Gain) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isSummaryInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: dur(0.4), delay: d(0.35), ease: "easeOut" }}
                className="px-4 py-3 bg-uranium/15 border border-uranium text-uranium flex items-center justify-center space-x-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-uranium flex-shrink-0" />
                <span>SELLER NET GAIN: +0.00108 ETH (90%)</span>
              </motion.div>

              {/* Right Pill (Buyer Savings) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isSummaryInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: dur(0.4), delay: d(0.5), ease: "easeOut" }}
                className="px-4 py-3 bg-aviation/15 border border-aviation text-aviation flex items-center justify-center space-x-2 shadow-sm"
              >
                <Flame className="w-4 h-4 text-aviation flex-shrink-0" />
                <span>BUYER SAVINGS: -0.00080 ETH (40% OFF)</span>
              </motion.div>

            </div>

          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isSummaryInView ? { opacity: 1 } : {}}
            transition={{ duration: dur(0.4), delay: d(0.65) }}
            className="mt-4 pt-4 border-t border-dark-border/60 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-zincGrey gap-2"
          >
            <span>SaaS Creator Royalty (10%): +0.00012 ETH sent automatically</span>
            <span className="text-alabaster font-semibold">100% On-Chain Stylus Verification</span>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
