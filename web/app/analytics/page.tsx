"use client";

import React from "react";
import { useQuery, gql } from "@apollo/client";
import { formatEther } from "viem";
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  PieChart,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { SUBGRAPH_URL } from "@/lib/graph";
import { GraphPlayground } from "@/components/GraphPlayground";

const MARKETPLACE_TOTALS = gql`
  query Totals {
    marketplace(id: "global") {
      plans
      passesIssued
      passesSold
      resales
      primaryVolume
      resaleVolume
      royaltiesPaid
    }
  }
`;

export default function AnalyticsPage() {
  const { data, loading, error } = useQuery(MARKETPLACE_TOTALS);

  const platforms = [
    { name: "Figma", passes: 480, volume: "24.5 ETH", avgDiscount: "62%", share: 29 },
    { name: "Cursor Copilot", passes: 390, volume: "21.8 ETH", avgDiscount: "55%", share: 26 },
    { name: "Midjourney", passes: 260, volume: "16.4 ETH", avgDiscount: "48%", share: 19 },
    { name: "Linear", passes: 190, volume: "12.1 ETH", avgDiscount: "68%", share: 14 },
    { name: "Claude Pro", passes: 100, volume: "9.8 ETH", avgDiscount: "51%", share: 12 },
  ];

  const market = data?.marketplace;
  const resaleVol = market ? Number(formatEther(BigInt(market.resaleVolume))).toFixed(4) : "0.00";
  const primaryVol = market ? Number(formatEther(BigInt(market.primaryVolume))).toFixed(4) : "0.00";
  const royalties = market ? Number(formatEther(BigInt(market.royaltiesPaid))).toFixed(4) : "0.00";

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      
      {/* Header */}
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>PROTOCOL HEALTH &amp; METRICS (LIVE FROM THE GRAPH)</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
          LiquidPass Protocol Analytics
        </h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Real-time measurement of secondary subscription liquidity, rescued SaaS hours from expiration, and automated 90/10 royalty flows on Arbitrum Stylus. Powered by Apollo Client and The Graph.
        </p>
        <p className="font-mono text-xs text-aviation mt-2 truncate">
          Endpoint: {SUBGRAPH_URL || "Unset"}
        </p>
      </div>

      {loading && (
        <div className="p-8 text-center text-zincGrey font-mono text-sm border border-dashed border-dark-border">
          Fetching Live Graph Data via Apollo Client...
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-aviation font-mono text-sm border border-dashed border-aviation/50 bg-aviation/10">
          GraphQL Error: {error.message}
        </div>
      )}

      {data && market && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
            <div className="flex items-center justify-between text-zincGrey text-xs">
              <span className="uppercase">TOTAL PLANS ISSUED</span>
              <PieChart className="w-4 h-4 text-uranium" />
            </div>
            <div className="text-alabaster font-extrabold text-3xl">{market.plans}</div>
            <div className="text-[11px] text-zincGrey">Active SaaS subscription types</div>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
            <div className="flex items-center justify-between text-zincGrey text-xs">
              <span className="uppercase">SECONDARY VOLUME</span>
              <DollarSign className="w-4 h-4 text-aviation" />
            </div>
            <div className="text-alabaster font-extrabold text-3xl">{resaleVol} ETH</div>
            <div className="text-[11px] text-zincGrey">Across {market.resales} resales</div>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
            <div className="flex items-center justify-between text-zincGrey text-xs">
              <span className="uppercase">10% ISSUER ROYALTIES</span>
              <PieChart className="w-4 h-4 text-periwinkle" />
            </div>
            <div className="text-alabaster font-extrabold text-3xl">{royalties} ETH</div>
            <div className="text-[11px] text-periwinkle">Accrued automatically to founders</div>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-2 font-mono">
            <div className="flex items-center justify-between text-zincGrey text-xs">
              <span className="uppercase">PRIMARY VOLUME</span>
              <Zap className="w-4 h-4 text-uranium" />
            </div>
            <div className="text-uranium font-extrabold text-3xl">{primaryVol} ETH</div>
            <div className="text-[11px] text-zincGrey">Original pass mints: {market.passesIssued}</div>
          </div>

        </div>
      )}

      {/* GraphQL Playground and Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Live GraphQL Playground */}
        <div className="lg:col-span-8">
          <GraphPlayground />
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
              <span className="text-uranium font-bold text-lg">{market ? Number(formatEther(BigInt(market.resaleVolume) - BigInt(market.royaltiesPaid))).toFixed(4) : "0.00"} ETH</span>
            </div>
            <div className="p-3 bg-dark border border-dark-border">
              <span className="text-zincGrey block text-[10px] uppercase">Issuer Royalties Disbursed (10%)</span>
              <span className="text-periwinkle font-bold text-lg">{royalties} ETH</span>
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
