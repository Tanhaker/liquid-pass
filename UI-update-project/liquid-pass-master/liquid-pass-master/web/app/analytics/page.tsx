"use client";

import React from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  PieChart,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function AnalyticsPage() {
  const platforms = [
    { name: "Figma", passes: 480, volume: "24.5 ETH", avgDiscount: "62%", share: 29 },
    { name: "Cursor Copilot", passes: 390, volume: "21.8 ETH", avgDiscount: "55%", share: 26 },
    { name: "Midjourney", passes: 260, volume: "16.4 ETH", avgDiscount: "48%", share: 19 },
    { name: "Linear", passes: 190, volume: "12.1 ETH", avgDiscount: "68%", share: 14 },
    { name: "Claude Pro", passes: 100, volume: "9.8 ETH", avgDiscount: "51%", share: 12 },
  ];

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      
      {/* Header */}
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>PROTOCOL HEALTH &amp; METRICS</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
          LiquidPass Protocol Analytics
        </h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Real-time measurement of secondary subscription liquidity, rescued SaaS hours from expiration, and automated 90/10 royalty flows on Arbitrum Stylus.
        </p>
      </div>

      {/* Top 4 Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
          <div className="flex items-center justify-between text-zincGrey text-xs">
            <span className="uppercase">HOURS RESCUED</span>
            <Clock className="w-4 h-4 text-uranium" />
          </div>
          <div className="text-alabaster font-extrabold text-3xl">18,420 hrs</div>
          <div className="text-[11px] text-uranium flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% this week</span>
          </div>
        </div>

        <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
          <div className="flex items-center justify-between text-zincGrey text-xs">
            <span className="uppercase">TOTAL VOLUME</span>
            <DollarSign className="w-4 h-4 text-aviation" />
          </div>
          <div className="text-alabaster font-extrabold text-3xl">84.6 ETH</div>
          <div className="text-[11px] text-zincGrey">Across 1,420 secondary resales</div>
        </div>

        <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
          <div className="flex items-center justify-between text-zincGrey text-xs">
            <span className="uppercase">10% ISSUER ROYALTIES</span>
            <PieChart className="w-4 h-4 text-periwinkle" />
          </div>
          <div className="text-alabaster font-extrabold text-3xl">8.46 ETH</div>
          <div className="text-[11px] text-periwinkle">Accrued automatically to founders</div>
        </div>

        <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
          <div className="flex items-center justify-between text-zincGrey text-xs">
            <span className="uppercase">AVG BUYER SAVINGS</span>
            <Zap className="w-4 h-4 text-uranium" />
          </div>
          <div className="text-uranium font-extrabold text-3xl">58.4% OFF</div>
          <div className="text-[11px] text-zincGrey">Compared to standard monthly retail</div>
        </div>

      </div>

      {/* Breakdown: Resale Volume per SaaS Service */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Platform Distribution */}
        <div className="lg:col-span-8 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">
              Secondary Resale Volume by SaaS Protocol
            </h3>
            <span className="font-mono text-xs text-zincGrey">LIFETIME ON-CHAIN</span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {platforms.map((p) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-zincGrey">
                  <span className="text-alabaster font-bold">{p.name}</span>
                  <div className="space-x-3">
                    <span className="text-uranium font-bold">{p.volume}</span>
                    <span>({p.passes} passes · {p.avgDiscount} avg discount)</span>
                  </div>
                </div>
                {/* Visual Bar */}
                <div className="w-full h-2.5 bg-dark border border-dark-border overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-uranium to-aviation"
                    style={{ width: `${p.share * 3}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 90/10 Split Architecture */}
        <div className="lg:col-span-4 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-4">
          <h3 className="font-header font-bold text-xl text-alabaster border-b border-dark-border pb-4">
            90% / 10% Protocol Allocation
          </h3>
          <p className="font-body text-xs text-zincGrey leading-relaxed">
            Every transaction executed through Stylus splits value atomically. Sellers recover capital while SaaS protocols establish an entirely new secondary revenue line.
          </p>

          <div className="space-y-3 font-mono text-xs pt-2">
            <div className="p-3 bg-dark border border-dark-border">
              <span className="text-zincGrey block text-[10px] uppercase">User Capital Recovered (90%)</span>
              <span className="text-uranium font-bold text-lg">76.14 ETH</span>
            </div>
            <div className="p-3 bg-dark border border-dark-border">
              <span className="text-zincGrey block text-[10px] uppercase">Issuer Royalties Disbursed (10%)</span>
              <span className="text-periwinkle font-bold text-lg">8.46 ETH</span>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2 text-[11px] font-mono text-zincGrey">
            <ShieldCheck className="w-4 h-4 text-uranium" />
            <span>Zero intermediary escrow or protocol fee skimming.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
