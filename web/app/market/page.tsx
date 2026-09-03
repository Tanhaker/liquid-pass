"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useNow } from "@/components/ui";
import { PassCard3D } from "@/components/PassCard3D";
import { fetchPasses, fetchPlans, marketStats, type MarketStats } from "@/lib/data";
import {
  MARKETPLACE_ADDRESS,
  marketplaceAbi,
  formatEthShort,
  withBuffer,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { SubscriptionPass } from "@/lib/types";
import {
  Search,
  Flame,
  ShoppingBag,
  Zap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useDemo } from "@/lib/demo";

export default function MarketPage() {
  const { isConnected, address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const now = useNow(15000) ?? Date.now();
  const { shiftExpiry } = useDemo();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingTokenId, setBuyingTokenId] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // UI Filters
  const [urgencyFilter, setUrgencyFilter] = useState<"ALL" | "EXPIRING_SOON" | "FRESH" | "UNDER_0_01_ETH">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"EXPIRY_ASC" | "PRICE_ASC" | "DISCOUNT_DESC">("EXPIRY_ASC");

  // View state: "CAROUSEL" or "TABLE" (grid layout)
  const [viewMode, setViewMode] = useState<"CAROUSEL" | "TABLE">("CAROUSEL");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const scrollLeftRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    if (!client) return;
    try {
      setLoading(true);
      const [pl, pa] = await Promise.all([fetchPlans(client), fetchPasses(client)]);
      setPlans(pl);
      setPasses(pa);
      setStats(marketStats(pl, pa, Date.now()));
    } catch (e) {
      console.error("Failed to load market data:", e);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id.toString(), p])), [plans]);
  
  // Real on-chain listed passes only (no fake demo passes)
  const listings = useMemo(() => {
    return passes.filter((p) => p.listed > 0n && shiftExpiry(p.expiry) > BigInt(Math.floor(now / 1000)));
  }, [passes, shiftExpiry, now]);

  // Convert real on-chain Pass to SubscriptionPass UI type
  const toSubscriptionPass = useCallback((p: Pass): SubscriptionPass => {
    const plan = planById.get(p.planId.toString());
    return {
      tokenId: p.tokenId.toString(),
      name: plan?.name || `Pass #${p.tokenId}`,
      service: plan?.name?.split(" ")[0] || "SaaS",
      owner: p.owner,
      issuer: p.issuer,
      expiryTimestamp: Number(shiftExpiry(p.expiry)),
      totalDurationSeconds: Number(plan?.duration || 2592000n),
      originalPriceEth: formatEthShort(p.paid > 0n ? p.paid : plan?.price || 0n),
      listingPriceEth: formatEthShort(p.current),
      isListed: p.listed > 0n,
      tier: "PRO",
      features: ["On-chain Access", "Resellable", "Fair Value Decay"],
    };
  }, [planById, shiftExpiry]);

  const uiListings = useMemo(() => listings.map(toSubscriptionPass), [listings, toSubscriptionPass]);

  const filteredPasses = useMemo(() => {
    return uiListings.filter((p) => {
      const remainingSeconds = Math.max(0, p.expiryTimestamp - Math.floor(now / 1000));
      const remainingDays = remainingSeconds / 86400;
      const price = parseFloat(p.listingPriceEth || p.originalPriceEth || "0");

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
  }, [uiListings, now, searchQuery, urgencyFilter]);

  const sortedPasses = useMemo(() => {
    return [...filteredPasses].sort((a, b) => {
      const aRem = Math.max(0, a.expiryTimestamp - Math.floor(now / 1000));
      const bRem = Math.max(0, b.expiryTimestamp - Math.floor(now / 1000));
      const aPrice = parseFloat(a.listingPriceEth || a.originalPriceEth || "0");
      const bPrice = parseFloat(b.listingPriceEth || b.originalPriceEth || "0");

      if (sortBy === "EXPIRY_ASC") return aRem - bRem;
      if (sortBy === "PRICE_ASC") return aPrice - bPrice;
      if (sortBy === "DISCOUNT_DESC") {
        const aDisc = (parseFloat(a.originalPriceEth) - aPrice) / (parseFloat(a.originalPriceEth) || 1);
        const bDisc = (parseFloat(b.originalPriceEth) - bPrice) / (parseFloat(b.originalPriceEth) || 1);
        return bDisc - aDisc;
      }
      return 0;
    });
  }, [filteredPasses, now, sortBy]);

  // Smooth carousel buttons
  const scrollGallery = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 480;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Continuous auto-drifting / moving animation for the carousel
  useEffect(() => {
    if (viewMode !== "CAROUSEL") return;
    
    let lastTime = performance.now();
    const speed = 40; // px per second continuous smooth travel

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const el = scrollContainerRef.current;
      if (el && !isHoveredRef.current && !isDraggingRef.current) {
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
          // Wrap around gently when reaching the end
          el.scrollLeft = 0;
        } else {
          el.scrollLeft += speed * dt;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [viewMode, sortedPasses.length]);

  // Mouse wheel horizontal scroll support
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || viewMode !== "CAROUSEL") return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.5;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode]);

  // Mouse Drag Scroll Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Real On-Chain Buy Pass
  const handleBuy = async (pass: SubscriptionPass) => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    setBuyingTokenId(pass.tokenId);
    setTxError(null);
    setTxSuccess(null);

    try {
      const tokenIdBig = BigInt(pass.tokenId);
      const onChainPass = passes.find((p) => p.tokenId === tokenIdBig);
      const rawCurrent = onChainPass?.current ?? 0n;
      const valueToSend = withBuffer(rawCurrent);

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "buy",
        args: [tokenIdBig],
        value: valueToSend,
        gas: 800_000n,
      });

      setTxSuccess(`Successfully purchased Pass #${pass.tokenId}! Tx: ${hash.slice(0, 10)}...`);
      await client?.waitForTransactionReceipt({ hash });
      await loadData();
    } catch (e) {
      console.error("Buy failed:", e);
      setTxError((e as Error).message || "Transaction failed");
    } finally {
      setBuyingTokenId(null);
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 min-h-screen">
      
      {/* Toast banners */}
      {txSuccess && (
        <div className="p-4 bg-uranium/10 border border-uranium text-uranium font-mono text-xs flex justify-between items-center">
          <span>{txSuccess}</span>
          <button onClick={() => setTxSuccess(null)} className="font-bold underline uppercase">Dismiss</button>
        </div>
      )}
      {txError && (
        <div className="p-4 bg-red-500/10 border border-red-500 text-red-400 font-mono text-xs flex justify-between items-center">
          <span>{txError}</span>
          <button onClick={() => setTxError(null)} className="font-bold underline uppercase">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-uranium/10 border border-uranium text-uranium font-mono text-xs font-bold uppercase mb-2">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>ARBITRUM STYLUS SECONDARY MARKET</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            Resale Marketplace
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Live time-decaying software passes listed by other users. 90% goes to the seller, 10% royalty goes to the SaaS issuer.
          </p>
        </div>

        {/* Live Market Metrics HUD */}
        <div className="flex items-center gap-6">
          <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-1">
            <div className="text-zincGrey text-[10px] uppercase">ACTIVE LISTINGS</div>
            <div className="text-uranium font-bold text-lg">{uiListings.length}</div>
          </div>
          <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-1">
            <div className="text-zincGrey text-[10px] uppercase">CREATOR ROYALTY</div>
            <div className="text-alabaster font-bold text-lg">10% Immutable</div>
          </div>
        </div>
      </div>

      {/* Filters & Mode Switcher */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-grow md:w-64">
            <Search className="w-4 h-4 text-zincGrey absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search passes..."
              className="w-full pl-9 pr-4 py-2 bg-dark-card border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
            />
          </div>

          {/* Urgency filters */}
          <div className="flex items-center space-x-1">
            {[
              { id: "ALL", label: "All" },
              { id: "EXPIRING_SOON", label: "⚡ Expiring Soon" },
              { id: "FRESH", label: "🌱 Fresh (>15d)" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setUrgencyFilter(f.id as any)}
                className={`px-3 py-2 uppercase border transition-all ${
                  urgencyFilter === f.id
                    ? "bg-uranium text-black font-extrabold border-uranium"
                    : "bg-dark-card border-dark-border text-zincGrey hover:text-alabaster"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center space-x-2 self-end md:self-auto">
          <button
            onClick={() => setViewMode("CAROUSEL")}
            className={`p-2 border transition-all ${
              viewMode === "CAROUSEL"
                ? "bg-uranium text-black border-uranium"
                : "bg-dark-card border-dark-border text-zincGrey hover:text-alabaster"
            }`}
            title="3D Spatial Carousel View"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("TABLE")}
            className={`p-2 border transition-all ${
              viewMode === "TABLE"
                ? "bg-uranium text-black border-uranium"
                : "bg-dark-card border-dark-border text-zincGrey hover:text-alabaster"
            }`}
            title="Grid Gallery View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-uranium" />
          Reading active listings from Stylus Marketplace contract...
        </div>
      ) : sortedPasses.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-4">
          <p className="text-base text-alabaster font-header font-bold">No passes are currently listed on the resale market.</p>
          <p className="max-w-md mx-auto">
            You can buy a brand new subscription pass from the Issuer portal or list any pass you hold in your vault.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase transition-all shadow-grunge-uranium"
            >
              Go to My Passes Vault →
            </Link>
            <Link
              href="/issuer"
              className="px-5 py-2.5 bg-dark border border-dark-border hover:border-uranium text-alabaster uppercase transition-all"
            >
              View Issuer Plans
            </Link>
          </div>
        </div>
      ) : viewMode === "CAROUSEL" ? (
        <div className="relative py-4">
          {/* Navigation arrow buttons */}
          <button
            onClick={() => scrollGallery("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30 p-3 bg-dark/90 hover:bg-dark-surface border border-dark-border text-alabaster hover:text-uranium transition-all shadow-grunge backdrop-blur-md"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => scrollGallery("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-30 p-3 bg-dark/90 hover:bg-dark-surface border border-dark-border text-alabaster hover:text-uranium transition-all shadow-grunge backdrop-blur-md"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Carousel rail container */}
          <div
            ref={scrollContainerRef}
            onMouseEnter={() => { isHoveredRef.current = true; }}
            onMouseLeave={() => { isHoveredRef.current = false; handleMouseUpOrLeave(); }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            className="flex gap-8 overflow-x-auto py-8 px-4 scrollbar-none select-none cursor-grab active:cursor-grabbing"
            style={{ scrollBehavior: isDraggingRef.current ? "auto" : "smooth" }}
          >
            {sortedPasses.map((pass) => (
              <div key={pass.tokenId} className="w-[340px] sm:w-[380px] flex-shrink-0">
                <PassCard3D
                  pass={pass}
                  onBuy={handleBuy}
                  interactive={true}
                  showActions={true}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-zincGrey px-2 pt-2">
            <span>← Drag or use scroll buttons to explore →</span>
            <span>{sortedPasses.length} live passes</span>
          </div>
        </div>
      ) : (
        /* Grid Table View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPasses.map((pass) => (
            <div key={pass.tokenId} className="w-full">
              <PassCard3D
                pass={pass}
                onBuy={handleBuy}
                interactive={true}
                showActions={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
