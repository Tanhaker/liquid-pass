"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useFees, useNow } from "@/components/ui";
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
  const fees = useFees();
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

  // Drift state. Kept in refs because the animation loop must not re-render.
  const posRef = useRef<number>(0);        // float position, so 0.6px/frame accumulates
  const dirRef = useRef<1 | -1>(1);        // travel direction; flips at either end
  const pauseUntilRef = useRef<number>(0); // drift yields after a user gesture
  const draggedPxRef = useRef<number>(0);  // to tell a drag from a click
  const onScreenRef = useRef<boolean>(true);

  // Only this is state: the arrows and edge fades need to re-render on it.
  const [rail, setRail] = useState({ overflow: false, atStart: true, atEnd: false });

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
      // Only meaningful for a live listing: listedAt is 0 otherwise, and the
      // curve is undefined without it.
      decay:
        p.listed > 0n && p.listedAt > 0n
          ? {
              openingWei: p.listed.toString(),
              listedAt: Number(p.listedAt),
              expiry: Number(shiftExpiry(p.expiry)),
            }
          : undefined,
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

  /** Hand the rail back to the user for a moment after they gesture at it. */
  const yieldDrift = (ms: number) => {
    pauseUntilRef.current = Date.now() + ms;
  };

  const scrollGallery = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Step by what is actually on screen rather than a hardcoded 480px, which
    // was either one card or two depending on the viewport.
    const amount = Math.max(300, el.clientWidth * 0.8);
    dirRef.current = direction === "left" ? -1 : 1;
    yieldDrift(1400); // let the smooth scroll land before the drift resumes
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  /*
   * Auto-drift.
   *
   * The old loop wrote el.scrollLeft every frame while the element carried
   * `scroll-behavior: smooth`, so each write started a fresh smooth-scroll
   * animation towards a target 0.6px away and cancelled the previous one --
   * the rail crawled, stuttered, and dragging felt like wading. The inline
   * style read that flag from a ref, which never re-renders, so the element
   * was smooth-scrolling always, including mid-drag.
   *
   * The behaviour lives here now: this loop writes an explicit float position
   * with no CSS scroll animation in the way, and the only smooth scrolls left
   * are the ones the arrow buttons ask for by name.
   */
  useEffect(() => {
    if (viewMode !== "CAROUSEL") return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const SPEED = 40; // px/sec
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const syncRail = () => {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 4;
      const atStart = el.scrollLeft <= 2;
      const atEnd = el.scrollLeft >= max - 2;
      setRail((prev) =>
        prev.overflow === overflow && prev.atStart === atStart && prev.atEnd === atEnd
          ? prev // same object back -> React bails out, so drifting is free
          : { overflow, atStart, atEnd },
      );
    };

    let raf = 0;
    let last = performance.now();

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((t - last) / 1000, 0.05); // clamp a background-tab stall
      last = t;

      const max = el.scrollWidth - el.clientWidth;
      syncRail();

      // Nothing to drift through, or the user is busy with it.
      if (
        max <= 4 ||
        reduced ||
        document.hidden ||
        !onScreenRef.current ||
        isHoveredRef.current ||
        isDraggingRef.current ||
        Date.now() < pauseUntilRef.current
      ) {
        posRef.current = el.scrollLeft; // stay in step with whatever they did
        return;
      }

      // Resync if something else moved the rail (keyboard, trackpad, anchor).
      if (Math.abs(el.scrollLeft - posRef.current) > 2) posRef.current = el.scrollLeft;

      let next = posRef.current + SPEED * dt * dirRef.current;
      if (next >= max) {
        next = max;
        dirRef.current = -1;
        yieldDrift(900); // a beat at the end, then back the other way
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
        yieldDrift(900);
      }
      posRef.current = next;
      el.scrollLeft = next;
    };

    // Don't animate a rail nobody is looking at.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(el);

    const ro = new ResizeObserver(syncRail);
    ro.observe(el);

    syncRail();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [viewMode, sortedPasses.length]);

  // Vertical wheel drives the rail horizontally.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || viewMode !== "CAROUSEL") return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      // At either end, let the page scroll instead of swallowing the gesture.
      const atEdge = (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max);
      if (atEdge) return;
      e.preventDefault();
      yieldDrift(1200);
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // sortedPasses.length matters: on the first render the rail is not mounted
    // yet (loading state), so the ref is null and there is nothing to bind to.
    // Without this the wheel listener was never attached at all.
  }, [viewMode, sortedPasses.length]);

  /*
   * Drag to pan. Mouse only -- touch keeps the browser's own momentum
   * scrolling, which beats anything reimplemented here.
   *
   * No pointer capture: capturing retargets the mouseup, which moves the
   * synthesised click up to this container and would stop the Buy button
   * inside a card from ever firing.
   */
  const handleMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    isDraggingRef.current = true;
    draggedPxRef.current = 0;
    startXRef.current = e.clientX;
    scrollLeftRef.current = scrollContainerRef.current?.scrollLeft ?? 0;
  };

  const handleMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    const dx = e.clientX - startXRef.current;
    draggedPxRef.current = Math.max(draggedPxRef.current, Math.abs(dx));
    // 1:1, not 1.5:1 -- the cards should stay under the cursor.
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - dx;
  };

  const handleMouseUpOrLeave = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    yieldDrift(1800);
  };

  /*
   * A drag that ended over the Buy button used to fire it -- which opens a
   * wallet and asks for money. Swallow the click if the rail actually moved.
   */
  const handleRailClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggedPxRef.current > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
    draggedPxRef.current = 0;
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
        ...(await fees()),
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
          {/* Edge fades. They sit over the rail, so they must not eat clicks. */}
          {rail.overflow && (
            <>
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-bg-page to-transparent transition-opacity duration-300 ${
                  rail.atStart ? "opacity-0" : "opacity-100"
                }`}
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-bg-page to-transparent transition-opacity duration-300 ${
                  rail.atEnd ? "opacity-0" : "opacity-100"
                }`}
              />
            </>
          )}

          {/* Navigation arrows. Hidden outright when everything already fits. */}
          {rail.overflow && (
            <>
              <button
                type="button"
                onClick={() => scrollGallery("left")}
                disabled={rail.atStart}
                className="absolute left-0 top-1/2 z-30 -translate-x-3 -translate-y-1/2 border border-dark-border bg-dark/90 p-3 text-alabaster shadow-grunge backdrop-blur-md transition-all hover:bg-dark-surface hover:text-uranium disabled:pointer-events-none disabled:opacity-25"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => scrollGallery("right")}
                disabled={rail.atEnd}
                className="absolute right-0 top-1/2 z-30 translate-x-3 -translate-y-1/2 border border-dark-border bg-dark/90 p-3 text-alabaster shadow-grunge backdrop-blur-md transition-all hover:bg-dark-surface hover:text-uranium disabled:pointer-events-none disabled:opacity-25"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Carousel rail */}
          <div
            ref={scrollContainerRef}
            role="region"
            aria-label="Listed passes"
            tabIndex={0}
            onMouseEnter={() => { isHoveredRef.current = true; }}
            onMouseLeave={() => { isHoveredRef.current = false; handleMouseUpOrLeave(); }}
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUpOrLeave}
            onPointerCancel={handleMouseUpOrLeave}
            onClickCapture={handleRailClickCapture}
            onDragStart={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              scrollGallery(e.key === "ArrowLeft" ? "left" : "right");
            }}
            className={`flex gap-8 overflow-x-auto overscroll-x-contain px-4 py-8 scrollbar-none select-none focus:outline-none ${
              rail.overflow ? "cursor-grab active:cursor-grabbing" : ""
            }`}
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

          <div className="flex items-center justify-between gap-4 px-2 pt-2 font-mono text-[11px] text-zincGrey">
            <span>
              {rail.overflow
                ? "← Drag, scroll or use the arrows to explore →"
                : "Every live listing fits on screen"}
            </span>
            <span>
              {sortedPasses.length} live {sortedPasses.length === 1 ? "pass" : "passes"}
            </span>
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
