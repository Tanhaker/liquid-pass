"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
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

  /**
   * Spatial carousel, from the UI drop.
   *
   * Presentation only -- it reorders and reveals the same `sortedPasses`
   * array the grid renders. No data, no contract call and no filter logic is
   * touched by any of it.
   */
  const [viewMode, setViewMode] = useState<"CAROUSEL" | "TABLE">("CAROUSEL");
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isCursorInsideRef = useRef<boolean>(false);
  const cursorXRatioRef = useRef<number>(0.5);
  const animFrameRef = useRef<number | null>(null);

  const scrollGallery = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -450 : 450,
      behavior: "smooth",
    });
  };

  // Vertical wheel drives horizontal travel while the pointer is over the rail.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || viewMode !== "CAROUSEL") return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.5;
      }
    };

    // Not passive: the handler calls preventDefault.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode]);

  // Cursor position steers an ambient drift. Frame-rate independent via dt, so
  // it travels at the same speed on a 60Hz and a 144Hz display.
  useEffect(() => {
    if (viewMode !== "CAROUSEL") return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isCursorInsideRef.current && scrollContainerRef.current) {
        const ratio = cursorXRatioRef.current;
        let speed = 0; // px/sec
        if (ratio > 0.52) {
          speed = Math.min(1, (ratio - 0.52) / 0.38) * 700;
        } else if (ratio < 0.48) {
          speed = -Math.min(1, (0.48 - ratio) / 0.38) * 700;
        } else {
          speed = 75; // gentle drift when centred
        }
        scrollContainerRef.current.scrollLeft += speed * dt;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [viewMode]);

  const handleGalleryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    cursorXRatioRef.current = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
  };

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
  const listings = passes.filter((p) => p.listed > 0n && shiftExpiry(p.expiry) > BigInt(Math.floor(now / 1000)));

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
      // formatEthShort, not formatEther: raw wei formatting renders a decaying
      // price as 0.000972731682277632 ETH on the card. Display only -- the
      // value sent to the contract still comes from the unrounded bigint.
      originalPriceEth: formatEthShort(p.paid > 0n ? p.paid : plan?.price || 0n),
      listingPriceEth: formatEthShort(p.current),
      isListed: p.listed > 0n,
      tier: "PRO",
      features: ["On-chain Access", "Resellable", "Fair Value Decay"],
    };
  };

const CURATED_DEMO_LISTINGS: SubscriptionPass[] = [
  {
    tokenId: "101",
    name: "Cursor Pro (AI Code Editor)",
    service: "Cursor",
    owner: "0x71C849A29381710928aBc8910283719028371902" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 18 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0020",
    listingPriceEth: "0.0011",
    isListed: true,
    tier: "PRO",
    features: ["GPT-4o & Claude 3.5 Sonnet", "Unlimited Fast Requests", "Composer Multi-file"],
  },
  {
    tokenId: "102",
    name: "Figma Organization Suite",
    service: "Figma",
    owner: "0x34B88C19283719028aBc89102837190283719028" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 24 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0045",
    listingPriceEth: "0.0034",
    isListed: true,
    tier: "TEAM",
    features: ["Dev Mode Enabled", "Unlimited Version History", "Custom Design Systems"],
  },
  {
    tokenId: "103",
    name: "GitHub Copilot Enterprise",
    service: "GitHub",
    owner: "0x98E23109283719028aBc89102837190283719028" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 4 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0030",
    listingPriceEth: "0.0006",
    isListed: true,
    tier: "ENTERPRISE",
    features: ["Fine-tuned Models", "PR Summaries", "CLI Code Completion"],
  },
  {
    tokenId: "104",
    name: "Claude 3.5 Sonnet API Tier",
    service: "Claude",
    owner: "0x44D901B9283719028aBc89102837190283719028" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 12 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0025",
    listingPriceEth: "0.0010",
    isListed: true,
    tier: "DEVELOPER",
    features: ["200k Context Window", "Artifacts Rendering", "Computer Use Capabilities"],
  },
  {
    tokenId: "105",
    name: "Notion AI Workspace",
    service: "Notion",
    owner: "0x12A99449283719028aBc89102837190283719028" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 27 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0015",
    listingPriceEth: "0.0013",
    isListed: true,
    tier: "PLUS",
    features: ["Q&A with Workspace", "Automated Summaries", "Unlimited Blocks"],
  },
  {
    tokenId: "106",
    name: "Midjourney v6 Unlimited",
    service: "Midjourney",
    owner: "0x88C33219283719028aBc89102837190283719028" as `0x${string}`,
    issuer: "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174" as `0x${string}`,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 3 * 86400,
    totalDurationSeconds: 30 * 86400,
    originalPriceEth: "0.0035",
    listingPriceEth: "0.0005",
    isListed: true,
    tier: "CREATOR",
    features: ["Relaxed GPU Hours", "Stealth Image Gen", "15 Fast GPU Hours"],
  },
];

  const onChainListings = listings.map(toSubscriptionPass);
  // Merge live on-chain passes with rich curated demo passes
  const uiListings = [
    ...onChainListings,
    ...CURATED_DEMO_LISTINGS.filter(d => !onChainListings.some(o => o.tokenId === d.tokenId))
  ];

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
      const isCuratedDemo = parseInt(uiPass.tokenId) >= 100;
      if (isCuratedDemo) {
        alert(`Demo purchase simulated successfully! Pass #${uiPass.tokenId} (${uiPass.name}) acquired.`);
        return;
      }
      // The price must come from the unrounded on-chain bigint, never from the
      // formatted card string: the card shows 6 significant figures, and a
      // rounded-down value underpays a decaying ask and reverts.
      const onChain = listings.find((p) => p.tokenId.toString() === uiPass.tokenId);
      if (!onChain) throw new Error("That listing is no longer on chain.");
      const priceWei = withBuffer(onChain.current);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
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
    <div className="py-12 max-w-[1720px] mx-auto px-4 sm:px-8 xl:px-12 font-sans">
      
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

      {/* View switcher & gallery HUD controls */}
      <div className="flex flex-wrap items-center justify-between mb-6 pb-3 border-b border-dark-border/60 gap-4 font-mono text-xs text-zincGrey">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-zincGrey uppercase tracking-wider mr-1">VIEW:</span>
          <div className="inline-flex p-1 bg-dark-card border border-dark-border">
            <button
              onClick={() => setViewMode("CAROUSEL")}
              className={`px-3 py-1.5 text-xs font-mono uppercase flex items-center space-x-1.5 transition-all ${
                viewMode === "CAROUSEL"
                  ? "bg-uranium text-black font-extrabold shadow-glow-uranium"
                  : "text-zincGrey hover:text-alabaster"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Carousel (Spatial)</span>
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`px-3 py-1.5 text-xs font-mono uppercase flex items-center space-x-1.5 transition-all ${
                viewMode === "TABLE"
                  ? "bg-uranium text-black font-extrabold shadow-glow-uranium"
                  : "text-zincGrey hover:text-alabaster"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Table (Grid)</span>
            </button>
          </div>
        </div>

        {viewMode === "CAROUSEL" && sortedPasses.length > 0 && (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1 text-[11px] text-zincGrey">
              <Sparkles className="w-3 h-3 text-uranium" />
              <span>SPATIAL GALLERY ({sortedPasses.length} PASSES)</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => scrollGallery("left")}
                aria-label="Scroll left"
                className="p-2 bg-dark-card border border-dark-border hover:border-uranium hover:text-uranium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollGallery("right")}
                aria-label="Scroll right"
                className="p-2 bg-dark-card border border-dark-border hover:border-uranium hover:text-uranium transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Passes */}
      {sortedPasses.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-4">
          <ShoppingBag className="w-10 h-10 mx-auto text-zincGrey opacity-30" />
          <p className="uppercase tracking-widest">No active listings match your current filters.</p>
        </div>
      ) : viewMode === "CAROUSEL" ? (
        <div
          className="relative w-full"
          onMouseEnter={() => {
            isCursorInsideRef.current = true;
          }}
          onMouseLeave={() => {
            isCursorInsideRef.current = false;
            cursorXRatioRef.current = 0.5;
          }}
          onMouseMove={handleGalleryMouseMove}
        >
          {/* Corner brackets */}
          <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-uranium z-30 pointer-events-none" />
          <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-uranium z-30 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-uranium z-30 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-uranium z-30 pointer-events-none" />

          {/* Edge fades */}
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-[var(--bg-page)] to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-[var(--bg-page)] to-transparent z-20 pointer-events-none" />

          <div
            ref={scrollContainerRef}
            className="flex space-x-8 overflow-x-auto pt-16 pb-16 px-12 sm:px-20 snap-x snap-mandatory scroll-smooth no-scrollbar"
            style={{ perspective: "1200px", scrollbarWidth: "none" }}
          >
            {sortedPasses.map((pass) => {
              const isSelected = hoveredTokenId === pass.tokenId;
              const isAnyHovered = hoveredTokenId !== null;
              return (
                <div
                  key={pass.tokenId}
                  onMouseEnter={() => setHoveredTokenId(pass.tokenId)}
                  onMouseLeave={() => setHoveredTokenId(null)}
                  className="flex-shrink-0 w-[480px] xl:w-[520px] snap-center transition-all duration-500 ease-out"
                  style={{
                    transform: isSelected
                      ? "scale(1.04) translateZ(28px)"
                      : isAnyHovered
                        ? "scale(0.95) translateZ(-8px)"
                        : "scale(1.0) translateZ(0px)",
                    filter:
                      isAnyHovered && !isSelected ? "blur(4px) opacity(0.35)" : "none",
                    zIndex: isSelected ? 30 : 10,
                  }}
                >
                  <PassCard3D
                    pass={pass}
                    interactive={true}
                    onBuy={handleBuy}
                    showActions={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
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
