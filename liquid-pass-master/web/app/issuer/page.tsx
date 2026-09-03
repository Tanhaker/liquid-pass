"use client";

import React, { useState } from "react";
import { useLiquidPass } from "@/lib/store";
import {
  Building2,
  PlusCircle,
  ShieldCheck,
  DollarSign,
  PieChart,
  Layers,
  Sparkles,
} from "lucide-react";
import { LIQUID_PASS_CONTRACT_ADDRESS } from "@/lib/abi";

export default function IssuerPage() {
  const { mintPass, userAddress } = useLiquidPass();

  const [serviceName, setServiceName] = useState<string>("Figma");
  const [tier, setTier] = useState<"PRO" | "ENTERPRISE" | "TEAM" | "ULTRA">("PRO");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [priceEth, setPriceEth] = useState<string>("0.0020");
  const [isMinting, setIsMinting] = useState<boolean>(false);

  const activePlans = [
    { service: "Figma", tier: "PRO", duration: "30 Days", price: "0.0020 ETH", totalIssued: 480, royaltiesEarned: "2.45 ETH" },
    { service: "Cursor", tier: "PRO", duration: "30 Days", price: "0.0035 ETH", totalIssued: 390, royaltiesEarned: "2.18 ETH" },
    { service: "Midjourney", tier: "ULTRA", duration: "30 Days", price: "0.0060 ETH", totalIssued: 260, royaltiesEarned: "1.64 ETH" },
    { service: "Linear", tier: "TEAM", duration: "60 Days", price: "0.0045 ETH", totalIssued: 190, royaltiesEarned: "1.21 ETH" },
  ];

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMinting(true);
    try {
      await mintPass(serviceName, tier, durationDays, priceEth);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>SAAS ISSUER PORTAL</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            Issuer Console &amp; Royalties
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            SaaS protocols issue time-bound NFT passes and earn an immutable 10% royalty on every secondary market transaction automatically.
          </p>
        </div>

        {/* Issuer metrics badge */}
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-zincGrey">
            <span>ISSUER ADDRESS:</span>
            <span className="text-uranium font-bold">{userAddress.slice(0, 10)}...</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>TOTAL ACCRUED ROYALTIES:</span>
            <span className="text-periwinkle font-bold">7.48 ETH</span>
          </div>
        </div>
      </div>

      {/* Grid: Mint New Pass & Live Royalty Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: Issue New Pass */}
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">
              Mint New Time-Bound Pass
            </h3>
            <span className="font-mono text-xs text-uranium">STYLUS: mint()</span>
          </div>

          <form onSubmit={handleMint} className="space-y-4 font-mono text-xs">
            
            <div>
              <label className="text-zincGrey block mb-1.5 uppercase">SaaS Software Name:</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                required
                className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
                placeholder="e.g. Figma, Cursor, Linear"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-zincGrey block mb-1.5 uppercase">Tier:</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as any)}
                  className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
                >
                  <option value="PRO">PRO</option>
                  <option value="TEAM">TEAM</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                  <option value="ULTRA">ULTRA</option>
                </select>
              </div>

              <div>
                <label className="text-zincGrey block mb-1.5 uppercase">Duration (Days):</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value))}
                  className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
                >
                  <option value={7}>7 Days (Sprint)</option>
                  <option value={14}>14 Days (Bi-Weekly)</option>
                  <option value={30}>30 Days (Monthly)</option>
                  <option value={60}>60 Days (Bi-Monthly)</option>
                  <option value={90}>90 Days (Quarterly)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-zincGrey block mb-1.5 uppercase">Primary Retail Price (ETH):</label>
              <input
                type="number"
                step="0.0005"
                value={priceEth}
                onChange={(e) => setPriceEth(e.target.value)}
                required
                className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
              />
            </div>

            <div className="p-3 bg-dark border border-dark-border text-[11px] text-zincGrey space-y-1">
              <div className="flex justify-between text-alabaster">
                <span>Secondary Resale Royalty:</span>
                <span className="text-periwinkle font-bold">10% of every sale</span>
              </div>
              <p>Whenever a user resells this pass, 10% is routed to your issuer wallet in the same transaction.</p>
            </div>

            <button
              type="submit"
              disabled={isMinting}
              className="w-full py-3.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-grunge-uranium"
            >
              <PlusCircle className="w-4 h-4 text-black" />
              <span>{isMinting ? "MINTING ON STYLUS..." : "ISSUE TIME-BOUND PASS"}</span>
            </button>

          </form>
        </div>

        {/* Right: Active Issuer Plans & Revenue Stream */}
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">
              Active SaaS Plans on LiquidPass
            </h3>
            <span className="font-mono text-xs text-zincGrey">4 LIVE PLANS</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {activePlans.map((plan, i) => (
              <div key={i} className="p-4 bg-dark border border-dark-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-alabaster text-sm">{plan.service}</span>
                    <span className="px-1.5 py-0.5 bg-dark-surface border border-dark-border text-zincGrey text-[10px]">
                      {plan.tier}
                    </span>
                  </div>
                  <span className="text-uranium font-bold">{plan.price}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-zincGrey pt-1 border-t border-dark-border/60">
                  <div>
                    <span>Passes Issued: </span>
                    <span className="text-alabaster font-bold">{plan.totalIssued}</span>
                  </div>
                  <div>
                    <span>10% Royalties: </span>
                    <span className="text-periwinkle font-bold">{plan.royaltiesEarned}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
