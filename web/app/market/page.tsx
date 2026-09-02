"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useNow } from "@/components/ui";
import { PassCard3D } from "@/components/PassCard3D";
import { fetchPasses, fetchPlans, marketStats, type MarketStats, buy } from "@/lib/data";
import { LIQUID_PASS_ADDRESS, liquidPassAbi, type Pass, type Plan } from "@/lib/contract";
import { SubscriptionPass } from "@/lib/types";
import { Search, Flame, ShoppingBag, Zap } from "lucide-react";
import { useDemo } from "@/lib/demo";

export default function MarketPage() {
  const { isConnected, chain } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const now = useNow(15000) ?? Date.now();
  const { shiftExpiry } = useDemo(); // respects demo mode time warps

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  
  // UI Filters
  const [urgencyFilter, setUrgencyFilter] = useState<"ALL" | "EXPIRING_SOON" | "FRESH">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"EXPIRY_ASC" | "PRICE_ASC" | "DISCOUNT_DESC">("EXPIRY_ASC");

  useEffect(() => {
    let cancelled = false;
    if (!client) return;
    Promise.all([fetchPlans(client), fetchPasses(client)]).then(([pl, pa]) => {
      if (cancelled) return;
      setPlans(pl);
      setPasses(pa);
      setStats(marketStats(pl, pa, Date.now()));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [client]);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id.toString(), p])), [plans]);
  const listings = passes.filter((p) => p.listed > 0n && p.planId !== 0n && shiftExpiry(p.expiry) > BigInt(Math.floor(now / 1000)));

  // Convert our real on-chain Pass to their SubscriptionPass UI type
  const toSubscriptionPass = (p: Pass): SubscriptionPass => {
    const plan = planById.get(p.planId.toString());
    return {
      tokenId: p.tokenId.toString(),
      name: plan?.name || `Plan #${p.planId}`,
      service: plan?.name?.split(" ")[0] || "Unknown",
      owner: p.owner,
      issuer: p.issuer,
      expiryTimestamp: Number(shiftExpiry(p.expiry)),
      totalDurationSeconds: Number(plan?.duration || 0n),
      originalPriceEth: formatEther(p.paid > 0n ? p.paid : plan?.price || 0n),
      listingPriceEth: formatEther(p.current),
      isListed: p.listed > 0n,
      tier: "PRO",
      features: ["On-chain Access", "Resellable", "Fair Value Decay"],
    };
  };

  const uiListings = listings.map(toSubscriptionPass);

  const filteredPasses = uiListings.filter((p) => {
    const remainingSeconds = Math.max(0, p.expiryTimestamp - Math.floor(now / 1000));
    const remainingDays = remainingSeconds / 86400;

    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokenId.includes(searchQuery);

    if (!matchesSearch) return false;
    if (urgencyFilter === "EXPIRING_SOON") return remainingDays < 5 && remainingSeconds > 0;
    if (urgencyFilter === "FRESH") return remainingDays >= 15;
    return true;
  });

  const sortedPasses = [...filteredPasses].sort((a, b) => {
    const aRem = Math.max(0, a.expiryTimestamp - Math.floor(now / 1000));
    const bRem = Math.max(0, b.expiryTimestamp - Math.floor(now / 1000));
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

  const handleBuy = async (uiPass: SubscriptionPass) => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const priceWei = parseEther(uiPass.listingPriceEth || uiPass.originalPriceEth);
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "buy",
        args: [BigInt(uiPass.tokenId)],
        value: priceWei,
      });
      console.log("Transaction submitted:", hash);
      alert(`Transaction submitted! Hash: ${hash}`);
    } catch (e) {
      console.error("Buy failed", e);
      alert("Transaction failed. Check console.");
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-sans">
      
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
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl leading-relaxed">
            Grab unexpired subscription time at steep dynamic discounts. Pricing decays automatically block-by-block based on remaining contract seconds.
          </p>
        </div>

        {/* Live Market Telemetry Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs p-4 bg-dark-card border border-dark-border shadow-grunge">
          <div>
            <span className="text-zincGrey block text-[10px]">ACTIVE LISTINGS</span>
            <span className="text-uranium font-bold text-base">{listings.length} PASSES</span>
          </div>
          <div>
            <span className="text-zincGrey block text-[10px]">PRIMARY VOLUME</span>
            <span className="text-aviation font-bold text-base">{stats ? formatEther(stats.primaryVolume).slice(0, 5) : "--"} ETH</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-zincGrey block text-[10px]">ROYALTY SPLIT</span>
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
            className="w-full pl-9 pr-4 py-3 bg-dark-card border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none"
          />
        </div>

        {/* Urgency Filter Tabs */}
        <div className="md:col-span-5 flex flex-wrap gap-2">
          <button
            onClick={() => setUrgencyFilter("ALL")}
            className={`px-3 py-2 text-xs font-mono uppercase transition-all ${
              urgencyFilter === "ALL"
                ? "bg-uranium text-ink font-extrabold"
                : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"
            }`}
          >
            All Listings
          </button>
          <button
            onClick={() => setUrgencyFilter("EXPIRING_SOON")}
            className={`px-3 py-2 text-xs font-mono uppercase flex items-center space-x-1 transition-all ${
              urgencyFilter === "EXPIRING_SOON"
                ? "bg-aviation text-ink font-extrabold shadow-[0_0_15px_rgba(255,159,28,0.3)]"
                : "bg-dark-card border border-dark-border text-aviation hover:bg-dark-surface"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>🔥 Steals (&lt;5D)</span>
          </button>
          <button
            onClick={() => setUrgencyFilter("FRESH")}
            className={`px-3 py-2 text-xs font-mono uppercase flex items-center space-x-1 transition-all ${
              urgencyFilter === "FRESH"
                ? "bg-uranium text-ink font-extrabold"
                : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Fresh (&gt;15D)</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="md:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full p-3 bg-dark-card border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none cursor-pointer"
          >
            <option value="EXPIRY_ASC">Sort: Expiration (Soonest)</option>
            <option value="PRICE_ASC">Sort: Price (Lowest ETH)</option>
            <option value="DISCOUNT_DESC">Sort: Discount (% Highest)</option>
          </select>
        </div>

      </div>

      {/* Passes Grid */}
      {sortedPasses.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-4">
          <ShoppingBag className="w-10 h-10 mx-auto text-zincGrey opacity-30" />
          <p className="uppercase tracking-widest">No active listings match your current filters.</p>
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
