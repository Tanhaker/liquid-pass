"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";

const DottedSurface = dynamic(() => import("@/components/ui/dotted-surface"), {
  ssr: false,
});
import { PassCard3D } from "@/components/PassCard3D";
import { DualSettlementAnimation } from "@/components/DualSettlementAnimation";
import { SubscriptionPass } from "@/lib/types";
import {
  ArrowRight,
  Clock,
  ShieldCheck,
  Zap,
  Flame,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Sliders,
} from "lucide-react";
import { LIQUID_PASS_CONTRACT_ADDRESS } from "@/lib/abi";

export default function LandingPage() {
  // Interactive Hero Pass Lifecycle Slider state
  const [decaySliderDays, setDecaySliderDays] = useState<number>(24);
  const totalDays = 30;
  const originalPriceEth = 0.035;
  const currentPriceEth = ((decaySliderDays / totalDays) * originalPriceEth).toFixed(4);

  // Dynamic pass object constructed for the hero visual
  const heroPass: SubscriptionPass = {
    tokenId: "842",
    name: "PromptForge Pro Pass",
    service: "PromptForge",
    owner: "0x74a...8921",
    issuer: LIQUID_PASS_CONTRACT_ADDRESS,
    expiryTimestamp: Math.floor(Date.now() / 1000) + decaySliderDays * 86400,
    totalDurationSeconds: totalDays * 86400,
    originalPriceEth: originalPriceEth.toString(),
    listingPriceEth: currentPriceEth,
    isListed: true,
    tier: "PRO",
    features: [
      "Neural Prompt Optimizer",
      "WASM Stylus Benchmarking",
      "Priority Micro-Node Queue",
    ],
  };

  // 4 Lifecycle Snapshot stages for "One pass, over thirty days"
  const lifecycleSnapshots = [
    {
      stage: "STAGE 01 // FRESH MINT",
      daysLeft: "30 DAYS LEFT",
      percent: 100,
      price: "0.0020 ETH",
      discount: "0% OFF (FULL RETAIL)",
      status: "ACTIVE",
      statusColor: "text-uranium border-uranium bg-uranium/10",
      barColor: "bg-uranium",
      desc: "Purchased directly from SaaS issuer for a month-long sprint.",
    },
    {
      stage: "STAGE 02 // MID-CYCLE RESALE",
      daysLeft: "18 DAYS LEFT",
      percent: 60,
      price: "0.0012 ETH",
      discount: "40% DISCOUNT",
      status: "RESALE LISTED",
      statusColor: "text-uranium border-dark-border bg-dark-surface",
      barColor: "bg-gradient-to-r from-uranium to-aviation",
      desc: "User finished work early; listed remaining 18 days on secondary market.",
    },
    {
      stage: "STAGE 03 // DECAYING VALUE",
      daysLeft: "7 DAYS LEFT",
      percent: 23,
      price: "0.0005 ETH",
      discount: "75% DISCOUNT",
      status: "DECAYING",
      statusColor: "text-aviation border-aviation bg-aviation/10",
      barColor: "bg-aviation",
      desc: "Automated curve makes short project access extremely affordable.",
    },
    {
      stage: "STAGE 04 // FIRE SALE",
      daysLeft: "2 DAYS LEFT",
      percent: 7,
      price: "0.0001 ETH",
      discount: "95% DISCOUNT · STEAL",
      status: "🔥 STEAL",
      statusColor: "text-black bg-aviation font-bold",
      barColor: "bg-aviation shadow-glow-amber",
      desc: "Snagged by a builder for a weekend hackathon sprint.",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      
      {/* Background Hero 3D Dotted Surface Wave (Theme-Aware & Responsive) */}
      <div className="absolute top-0 left-0 right-0 h-[680px] lg:h-[780px] overflow-hidden pointer-events-none -z-20">
        <DottedSurface size={8} opacity={0.8} />
        {/* Soft fade into page background */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--bg-page)]" />
      </div>

      {/* ============================================================ */}
      {/* 1. HERO SECTION */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Column */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="font-header font-extrabold text-4xl sm:text-6xl lg:text-7xl text-alabaster leading-[1.05] tracking-tight"
            >
              Buy time. Use it. <br />
              <span className="text-uranium">
                Sell what’s left.
              </span>
            </motion.h1>

            {/* SubCopy */}
            <motion.p
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="font-body text-zincGrey text-lg sm:text-xl max-w-2xl leading-relaxed"
            >
              Turn unused subscription days into liquid value. Buy 30 days of Figma, Cursor, or Midjourney, use 10, and resell the remaining 20 on an automated decaying curve. The contract automatically pays 90% to you and 10% royalty to the SaaS creator.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4"
            >
              <Link
                href="/market"
                className="px-8 py-4 bg-uranium hover:bg-uranium-glow text-black font-mono text-sm font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-grunge-uranium hover:shadow-glow-uranium"
              >
                <span>BROWSE THE MARKET</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-dark-card border border-dark-border hover:border-uranium text-alabaster font-mono text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all hover:bg-dark-surface"
              >
                <span>MY PASSES &amp; VAULT</span>
              </Link>
            </motion.div>

            {/* Passkey note */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex items-center space-x-2 text-xs font-mono text-zincGrey pt-2"
            >
              <Fingerprint className="w-4 h-4 text-uranium" />
              <span>WebAuthn Fingerprint &amp; FaceID Native Login — Zero Seed Phrases</span>
            </motion.div>

          </motion.div>

          {/* Right Hero Column: Interactive 3D Tilting Pass Visual with Time Slider */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.92 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.3, margin: "-10% 0px -10% 0px" }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-4"
          >
            <div className="bg-dark-card border border-dark-border p-4 shadow-grunge relative">
              <div className="flex items-center justify-between font-mono text-xs text-zincGrey pb-3 border-b border-dark-border mb-4">
                <span className="flex items-center space-x-1 text-uranium font-bold">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>INTERACTIVE LIFECYCLE SCRUBBER</span>
                </span>
                <span className="text-zincGrey">{decaySliderDays} DAYS REMAINING</span>
              </div>

              {/* The 3D Decaying Pass Card */}
              <PassCard3D pass={heroPass} interactive={true} showActions={false} />

              {/* Time Decay Interactive Slider */}
              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zincGrey">SIMULATE PASS DECAY:</span>
                  <span className="text-uranium font-bold">{decaySliderDays} / 30 Days</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={decaySliderDays}
                  onChange={(e) => setDecaySliderDays(parseFloat(e.target.value))}
                  className="w-full accent-uranium bg-dark-surface cursor-pointer h-2 border border-dark-border"
                />
                <div className="flex justify-between text-[10px] font-mono text-zincGrey">
                  <span className="text-aviation font-bold">0 Days (Void)</span>
                  <span>15 Days (50% Decay)</span>
                  <span className="text-uranium font-bold">30 Days (Fresh Mint)</span>
                </div>
              </div>

              {/* Dynamic Resale Split Display */}
              <div className="mt-4 p-3 bg-dark border border-dark-border text-xs font-mono grid grid-cols-2 gap-2">
                <div>
                  <span className="text-zincGrey block text-[10px]">Seller Proceeds (90%):</span>
                  <span className="text-uranium font-bold">
                    {(parseFloat(currentPriceEth) * 0.9).toFixed(5)} ETH
                  </span>
                </div>
                <div>
                  <span className="text-zincGrey block text-[10px]">Issuer Royalty (10%):</span>
                  <span className="text-periwinkle font-bold">
                    {(parseFloat(currentPriceEth) * 0.1).toFixed(5)} ETH
                  </span>
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. STATS BAR */}
      {/* ============================================================ */}
      <section className="border-y border-dark-border bg-dark-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center font-mono">
            <div className="border-r border-dark-border/60 last:border-0">
              <span className="text-zincGrey text-xs block uppercase mb-1">PLANS LIVE</span>
              <span className="text-alabaster font-extrabold text-2xl sm:text-3xl">12 PLANS</span>
            </div>
            <div className="border-r border-dark-border/60 last:border-0">
              <span className="text-zincGrey text-xs block uppercase mb-1">PASSES ISSUED</span>
              <span className="text-uranium font-extrabold text-2xl sm:text-3xl">1,420</span>
            </div>
            <div className="border-r border-dark-border/60 last:border-0">
              <span className="text-zincGrey text-xs block uppercase mb-1">ACTIVE NOW</span>
              <span className="text-aviation font-extrabold text-2xl sm:text-3xl">892 PASSES</span>
            </div>
            <div>
              <span className="text-zincGrey text-xs block uppercase mb-1">PRIMARY VOLUME</span>
              <span className="text-alabaster font-extrabold text-2xl sm:text-3xl">42.8 ETH</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. DUAL-SETTLEMENT VALUE RECOVERY PROTOCOL ANIMATION */}
      {/* ============================================================ */}
      <DualSettlementAnimation />

      {/* ============================================================ */}
      {/* 4. HOW IT WORKS (3 STEPS) */}
      {/* ============================================================ */}
      <section className="py-20 border-t border-dark-border bg-dark-card/40 technical-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.35, margin: "-15% 0px -15% 0px" }}
            transition={{ duration: 0.65, delay: 0.15 }}
            className="mb-14"
          >
            <span className="font-mono text-xs text-uranium uppercase tracking-widest block mb-2">
              HOW IT WORKS
            </span>
            <h2 className="font-header font-bold text-3xl sm:text-5xl text-alabaster">
              Sovereign software resale in three steps.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.35, margin: "-15% 0px -15% 0px" }}
              transition={{ duration: 0.65, delay: 0.2 }}
              className="p-8 border border-dark-border bg-dark-card shadow-grunge space-y-3"
            >
              <div className="font-mono text-3xl font-extrabold text-uranium">01</div>
              <h3 className="font-header font-bold text-xl text-alabaster">
                Buy from an issuer
              </h3>
              <p className="font-body text-zincGrey text-sm leading-relaxed">
                Authorized SaaS protocols issue time-bound passes directly onto Arbitrum Stylus with an immutable duration timestamp.
              </p>
              <div className="p-2.5 bg-dark border border-dark-border font-mono text-[11px] text-zincGrey">
                <code>mint(recipient, durationSeconds)</code>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.35, margin: "-15% 0px -15% 0px" }}
              transition={{ duration: 0.65, delay: 0.35 }}
              className="p-8 border border-dark-border bg-dark-card shadow-grunge space-y-3"
            >
              <div className="font-mono text-3xl font-extrabold text-aviation">02</div>
              <h3 className="font-header font-bold text-xl text-alabaster">
                Resell what you didn’t use
              </h3>
              <p className="font-body text-zincGrey text-sm leading-relaxed">
                Finished a project in 10 days? List your remaining 20 days on the marketplace with 1 click at any price you choose.
              </p>
              <div className="p-2.5 bg-dark border border-dark-border font-mono text-[11px] text-zincGrey">
                <code>list(tokenId, priceWei)</code>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.35, margin: "-15% 0px -15% 0px" }}
              transition={{ duration: 0.65, delay: 0.5 }}
              className="p-8 border border-dark-border bg-dark-card shadow-grunge space-y-3"
            >
              <div className="font-mono text-3xl font-extrabold text-periwinkle">03</div>
              <h3 className="font-header font-bold text-xl text-alabaster">
                90/10 on every resale
              </h3>
              <p className="font-body text-zincGrey text-sm leading-relaxed">
                When a buyer purchases the pass, the smart contract atomically splits funds: 90% to the seller and 10% royalty to the SaaS creator.
              </p>
              <div className="p-2.5 bg-dark border border-dark-border font-mono text-[11px] text-zincGrey">
                <code>buy(tokenId) → 90% Seller / 10% Issuer</code>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. SMART CONTRACT TELEMETRY SECTION */}
      {/* ============================================================ */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: false, amount: 0.35, margin: "-15% 0px -15% 0px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="p-8 bg-dark-card border border-dark-border shadow-grunge space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-dark-border pb-6 gap-4">
            <div>
              <div className="text-xs font-mono text-uranium uppercase tracking-widest mb-1">
                ON-CHAIN ENFORCEMENT DISCLOSURE
              </div>
              <h3 className="font-header font-bold text-2xl text-alabaster">
                Deployed Arbitrum Stylus Smart Contract
              </h3>
            </div>

            <a
              href={`https://sepolia.arbiscan.io/address/${LIQUID_PASS_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-dark border border-dark-border hover:border-uranium text-alabaster font-mono text-xs transition-colors"
            >
              <span>{LIQUID_PASS_CONTRACT_ADDRESS}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-uranium" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs text-zincGrey">
            <div className="space-y-1">
              <span className="text-alabaster font-bold block">secp256r1 Native Passkey</span>
              <p className="text-[11px] leading-relaxed">
                Direct WebAuthn signature verification in WebAssembly without expensive EVM emulation.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-alabaster font-bold block">Non-ERC721 Sovereign Architecture</span>
              <p className="text-[11px] leading-relaxed">
                Custom time-decay transfer hooks prevent standard marketplace exploits and enforce strict expiry rules.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-alabaster font-bold block">&lt;24 KB Brotli WASM Binary</span>
              <p className="text-[11px] leading-relaxed">
                Optimized Rust bytecode engineered to meet the strict Arbitrum Stylus deployable code size envelope.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
