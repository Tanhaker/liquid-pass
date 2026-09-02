"use client";

import React, { useState } from "react";
import { useLiquidPass } from "@/lib/store";
import { PassCard3D } from "@/components/PassCard3D";
import { SubscriptionPass, MarketFilter } from "@/lib/types";
import {
  Search,
  Flame,
  ShoppingBag,
} from "lucide-react";

export default function MarketPage() {
  const { demoPasses, buyPass } = useLiquidPass();

  const [urgencyFilter, setUrgencyFilter] = useState<MarketFilter["urgency"]>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<MarketFilter["sortBy"]>("EXPIRY_ASC");

  const now = Math.floor(Date.now() / 1000);

  // Available passes on market
  const listedPasses = demoPasses.filter((p) => p.isListed);

  // Filter passes
  const filteredPasses = listedPasses.filter((p) => {
    const remainingSeconds = Math.max(0, p.expiryTimestamp - now);
    const remainingDays = remainingSeconds / 86400;
    const price = parseFloat(p.listingPriceEth || p.originalPriceEth);

    // Search query match
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokenId.includes(searchQuery);

    if (!matchesSearch) return false;

    if (urgencyFilter === "EXPIRING_SOON") return remainingDays < 5 && remainingSeconds > 0;
    if (urgencyFilter === "FRESH") return remainingDays >= 15;
    if (urgencyFilter === "UNDER_0_01_ETH") return price < 0.01;

    return true;
  });

  // Sort passes
  const sortedPasses = [...filteredPasses].sort((a, b) => {
    const aRem = Math.max(0, a.expiryTimestamp - now);
    const bRem = Math.max(0, b.expiryTimestamp - now);
    const aPrice = parseFloat(a.listingPriceEth || a.originalPriceEth);
    const bPrice = parseFloat(b.listingPriceEth || b.originalPriceEth);

    if (sortBy === "EXPIRY_ASC") return aRem - bRem;
    if (sortBy === "PRICE_ASC") return aPrice - bPrice;
    if (sortBy === "DISCOUNT_DESC") {
      const aDisc = (parseFloat(a.originalPriceEth) - aPrice) / parseFloat(a.originalPriceEth);
      const bDisc = (parseFloat(b.originalPriceEth) - bPrice) / parseFloat(b.originalPriceEth);
      return bDisc - aDisc;
    }
    return 0;
  });

  const handleBuy = async (pass: SubscriptionPass) => {
    const price = pass.listingPriceEth || pass.originalPriceEth;
    await buyPass(pass.tokenId, price);
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header & Market Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 mb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-aviation/10 border border-aviation text-aviation font-mono text-xs font-bold uppercase mb-2">
            <Flame className="w-3.5 h-3.5" />
            <span>SECONDARY RESALE LIQUIDITY POOL</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            Resale Marketplace
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Grab unexpired subscription time at steep dynamic discounts. Pricing decays automatically based on remaining contract seconds.
          </p>
        </div>

        {/* Live Market Telemetry Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs p-4 bg-dark-card border border-dark-border">
          <div>
            <span className="text-zincGrey block text-[10px]">ACTIVE LISTINGS</span>
            <span className="text-uranium font-bold text-base">{listedPasses.length} PASSES</span>
          </div>
          <div>
            <span className="text-zincGrey block text-[10px]">AVG DISCOUNT</span>
            <span className="text-aviation font-bold text-base">64% OFF</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-zincGrey block text-[10px]">CONTRACT SPLIT</span>
            <span className="text-alabaster font-bold text-base">90% / 10%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
        
        {/* Search Box */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-zincGrey absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service, name, or token ID..."
            className="w-full pl-9 pr-4 py-2.5 bg-dark-card border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none"
          />
        </div>

        {/* Urgency Filter Tabs */}
        <div className="md:col-span-5 flex flex-wrap gap-2">
          <button
            onClick={() => setUrgencyFilter("ALL")}
            className={`px-3 py-2 text-xs font-mono uppercase transition-all ${
              urgencyFilter === "ALL"
                ? "bg-uranium text-black font-extrabold"
                : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"
            }`}
          >
            All Listings
          </button>
          <button
            onClick={() => setUrgencyFilter("EXPIRING_SOON")}
            className={`px-3 py-2 text-xs font-mono uppercase flex items-center space-x-1 transition-all ${
              urgencyFilter === "EXPIRING_SOON"
                ? "bg-aviation text-black font-extrabold shadow-glow-amber"
                : "bg-dark-card border border-dark-border text-aviation hover:bg-dark-surface"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>🔥 Steals (&lt;5D)</span>
          </button>
          <button
            onClick={() => setUrgencyFilter("FRESH")}
            className={`px-3 py-2 text-xs font-mono uppercase transition-all ${
              urgencyFilter === "FRESH"
                ? "bg-uranium text-black font-extrabold"
                : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"
            }`}
          >
            Fresh (&gt;15D)
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="md:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MarketFilter["sortBy"])}
            className="w-full p-2.5 bg-dark-card border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none"
          >
            <option value="EXPIRY_ASC">Sort: Expiration (Soonest)</option>
            <option value="PRICE_ASC">Sort: Price (Lowest ETH)</option>
            <option value="DISCOUNT_DESC">Sort: Discount (% Highest)</option>
          </select>
        </div>

      </div>

      {/* Passes Grid */}
      {sortedPasses.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-3">
          <ShoppingBag className="w-8 h-8 mx-auto text-zincGrey opacity-50" />
          <p>No active listings match your current search and urgency filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPasses.map((pass) => (
            <PassCard3D
              key={pass.tokenId}
              pass={pass}
              interactive={true}
              onBuy={handleBuy}
              showActions={true}
            />
          ))}
        </div>
      )}

    </div>
  );
}
