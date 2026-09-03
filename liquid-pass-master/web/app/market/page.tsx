"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLiquidPass } from "@/lib/store";
import { PassCard3D } from "@/components/PassCard3D";
import { SubscriptionPass, MarketFilter } from "@/lib/types";
import {
  Search,
  Flame,
  ShoppingBag,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
} from "lucide-react";

export default function MarketPage() {
  const { demoPasses, buyPass } = useLiquidPass();

  const [urgencyFilter, setUrgencyFilter] = useState<MarketFilter["urgency"]>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<MarketFilter["sortBy"]>("EXPIRY_ASC");

  // View state: "CAROUSEL" (default per prompt) or "TABLE" (grid layout)
  const [viewMode, setViewMode] = useState<"CAROUSEL" | "TABLE">("CAROUSEL");
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isCursorInsideRef = useRef<boolean>(false);
  const cursorXRatioRef = useRef<number>(0.5);
  const animFrameRef = useRef<number | null>(null);

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

  const scrollGallery = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 450;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // 1. Mouse wheel automatically scrolls horizontally when hovering inside carousel
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

  // 2. Cursor inside carousel: automatically scroll horizontally based on cursor position
  useEffect(() => {
    if (viewMode !== "CAROUSEL") return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isCursorInsideRef.current && scrollContainerRef.current) {
        const ratio = cursorXRatioRef.current;
        let speed = 0; // px/sec

        if (ratio > 0.52) {
          // Accelerate rightward as cursor moves toward the right half
          const factor = Math.min(1, (ratio - 0.52) / 0.38);
          speed = factor * 700;
        } else if (ratio < 0.48) {
          // Accelerate leftward as cursor moves toward the left half
          const factor = Math.min(1, (0.48 - ratio) / 0.38);
          speed = -factor * 700;
        } else {
          // Gentle baseline ambient drift when cursor is centered
          speed = 75;
        }

        if (speed !== 0) {
          scrollContainerRef.current.scrollLeft += speed * dt;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [viewMode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    cursorXRatioRef.current = Math.max(0, Math.min(1, x / rect.width));
  };

  return (
    <div className="py-12 max-w-[1720px] mx-auto px-4 sm:px-8 xl:px-12">
      
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
          <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
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

      {/* Filter and Search Controls Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        
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

      {/* ============================================================ */}
      {/* VIEW SWITCHER & GALLERY HUD CONTROLS */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between mb-6 pb-3 border-b border-dark-border/60 gap-4 font-mono text-xs text-zincGrey">
        
        {/* View Mode Switcher: Carousel (Default) vs Table */}
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

        {/* Carousel Scroll Controls (Visible when Carousel mode is active) */}
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

      {/* Empty State */}
      {sortedPasses.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-3">
          <ShoppingBag className="w-8 h-8 mx-auto text-zincGrey opacity-50" />
          <p>No active listings match your current search and urgency filter.</p>
        </div>
      ) : viewMode === "CAROUSEL" ? (
        
        /* ============================================================ */
        /* OPTION 1: ANTI-DASHBOARD SPATIAL HORIZONTAL CAROUSEL          */
        /* ============================================================ */
        <div
          className="relative w-full"
          onMouseEnter={() => {
            isCursorInsideRef.current = true;
          }}
          onMouseLeave={() => {
            isCursorInsideRef.current = false;
            cursorXRatioRef.current = 0.5;
          }}
          onMouseMove={handleMouseMove}
        >

          {/* === TOXIC GREEN CORNER BRACKET DECORATIONS === */}
          {/* Top-Left */}
          <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-uranium z-30 pointer-events-none" />
          {/* Top-Right */}
          <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-uranium z-30 pointer-events-none" />
          {/* Bottom-Left */}
          <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-uranium z-30 pointer-events-none" />
          {/* Bottom-Right */}
          <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-uranium z-30 pointer-events-none" />

          {/* Edge fade masks for horizontal depth */}
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-[var(--bg-page)] to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-[var(--bg-page)] to-transparent z-20 pointer-events-none" />

          {/* Horizontal Scroll Track */}
          <div
            ref={scrollContainerRef}
            className="flex space-x-8 overflow-x-auto pt-16 pb-16 px-12 sm:px-20 snap-x snap-mandatory scroll-smooth no-scrollbar"
            style={{
              perspective: "1200px",
              scrollbarWidth: "none",
            }}
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
                      isAnyHovered && !isSelected
                        ? "blur(4px) opacity(0.35)"
                        : "none",
                    zIndex: isSelected ? 30 : 10,
                  }}
                >
                  {/* No bg-highlight wrapper — card renders at full fidelity */}
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

        /* ============================================================ */
        /* OPTION 2: TRADITIONAL TABLE / RESPONSIVE GRID LAYOUT */
        /* ============================================================ */
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
