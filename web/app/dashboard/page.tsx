"use client";

import React, { useState } from "react";
import { useLiquidPass } from "@/lib/store";
import { PassCard3D } from "@/components/PassCard3D";
import Link from "next/link";
import {
  Wallet,
  PlusCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function DashboardPage() {
  const { demoPasses, userAddress, mintPass } = useLiquidPass();

  const [mintServiceName, setMintServiceName] = useState<string>("Claude");
  const [mintDays, setMintDays] = useState<number>(30);
  const [mintPriceEth, setMintPriceEth] = useState<string>("0.0035");
  const [isMinting, setIsMinting] = useState<boolean>(false);

  // Passes owned by current user
  const myPasses = demoPasses.filter(
    (p) => p.owner.toLowerCase() === userAddress.toLowerCase()
  );

  // Active listings by current user
  const myListings = myPasses.filter((p) => p.isListed);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMinting(true);
    try {
      await mintPass(mintServiceName, "PRO", mintDays, mintPriceEth);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      
      {/* Header & Vault Telemetry */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-uranium/10 border border-uranium text-uranium font-mono text-xs font-bold uppercase mb-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>SOVEREIGN PASS VAULT</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            User Passes &amp; Vault
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Inspect your active software credentials, verify remaining time on-chain, and list unneeded access for secondary resale.
          </p>
        </div>

        {/* User telemetry widget */}
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-zincGrey">
            <span>CONNECTED WALLET:</span>
            <span className="text-uranium font-bold">{userAddress.slice(0, 10)}...</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>HELD PASSES:</span>
            <span className="text-alabaster font-bold">{myPasses.length} Active</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>MARKET LISTINGS:</span>
            <span className="text-aviation font-bold">{myListings.length} Offered</span>
          </div>
        </div>
      </div>

      {/* Grid: My Passes */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-header font-bold text-2xl text-alabaster flex items-center space-x-2">
            <span>MY ACTIVE PASSES ({myPasses.length})</span>
          </h2>
          <span className="font-mono text-xs text-zincGrey">
            Time-bound credentials granting live access
          </span>
        </div>

        {myPasses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-4">
            <p>You do not currently hold any active LiquidPasses in your vault.</p>
            <Link
              href="/market"
              className="inline-block px-4 py-2 bg-uranium text-black font-extrabold uppercase"
            >
              Browse Resale Marketplace →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myPasses.map((pass) => (
              <div key={pass.tokenId} className="space-y-3">
                <PassCard3D pass={pass} interactive={true} showActions={false} />
                <div className="flex space-x-2">
                  <Link
                    href={`/pass/${pass.tokenId}`}
                    className="flex-1 py-2 text-center bg-dark hover:bg-dark-surface border border-dark-border text-alabaster font-mono text-xs uppercase"
                  >
                    {pass.isListed ? "Manage Listing" : "Resell Unused Days"}
                  </Link>
                  <Link
                    href="/verify"
                    className="px-4 py-2 bg-dark-surface border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase"
                  >
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Sandbox Pass Generation */}
      <div className="p-8 bg-dark-card border border-dark-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border pb-4 gap-2">
          <div>
            <div className="flex items-center space-x-2 text-uranium font-mono text-xs font-bold uppercase">
              <PlusCircle className="w-4 h-4" />
              <span>TEST SANDBOX // PASS MINT SIMULATOR</span>
            </div>
            <h3 className="font-header font-bold text-2xl text-alabaster mt-1">
              Acquire a New Subscription Pass for Testing
            </h3>
          </div>
          <span className="font-mono text-[11px] text-zincGrey">
            Executes Stylus: <code>mint(user, duration)</code>
          </span>
        </div>

        <form onSubmit={handleMint} className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          
          <div>
            <label className="text-zincGrey block mb-2 uppercase">SaaS Service Name:</label>
            <input
              type="text"
              value={mintServiceName}
              onChange={(e) => setMintServiceName(e.target.value)}
              required
              className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
              placeholder="e.g. Figma, Cursor, Linear"
            />
          </div>

          <div>
            <label className="text-zincGrey block mb-2 uppercase">Pass Duration (Days):</label>
            <select
              value={mintDays}
              onChange={(e) => setMintDays(parseInt(e.target.value))}
              className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
            >
              <option value={7}>7 Days (Sprint Pass)</option>
              <option value={14}>14 Days (Bi-Weekly)</option>
              <option value={30}>30 Days (Standard Month)</option>
              <option value={60}>60 Days (Bi-Monthly)</option>
            </select>
          </div>

          <div>
            <label className="text-zincGrey block mb-2 uppercase">Retail Value (ETH):</label>
            <input
              type="number"
              step="0.0005"
              value={mintPriceEth}
              onChange={(e) => setMintPriceEth(e.target.value)}
              required
              className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 pt-2">
            <button
              type="submit"
              disabled={isMinting}
              className="px-6 py-3.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-grunge-uranium"
            >
              <PlusCircle className="w-4 h-4 text-black" />
              <span>{isMinting ? "MINTING ON STYLUS..." : "MINT SAMPLE PASS TO VAULT"}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
