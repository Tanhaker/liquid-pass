"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { SubscriptionPass } from "@/lib/types";
import { Clock, ShieldCheck, ArrowRight, Zap, Flame } from "lucide-react";
import { Button3D, LinkButton3D } from "@/components/Button3D";

interface PassCard3DProps {
  pass: SubscriptionPass;
  interactive?: boolean;
  onBuy?: (pass: SubscriptionPass) => void;
  showActions?: boolean;
}

export function PassCard3D({
  pass,
  interactive = true,
  onBuy,
  showActions = true,
}: PassCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Time & decay calculation
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(0, pass.expiryTimestamp - now);
  const remainingDays = (remainingSeconds / 86400).toFixed(1);
  const totalDays = (pass.totalDurationSeconds / 86400).toFixed(0);
  const percentLeft = Math.min(
    100,
    Math.max(0, Math.round((remainingSeconds / pass.totalDurationSeconds) * 100))
  );

  // State determination
  const isExpired = remainingSeconds <= 0;
  const isUrgent = percentLeft < 20 && !isExpired;
  const isFresh = percentLeft >= 50;

  // Pricing calculations
  const originalPrice = parseFloat(pass.originalPriceEth);
  const calculatedFairPrice = (
    (remainingSeconds / pass.totalDurationSeconds) *
    originalPrice
  ).toFixed(4);
  const effectivePrice = pass.listingPriceEth || calculatedFairPrice;
  const discountPercent = Math.max(
    0,
    Math.round(((originalPrice - parseFloat(effectivePrice)) / originalPrice) * 100)
  );

  // Mouse physics for 3D tilt without WebGL
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 25 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <div
      style={{ perspective: "1000px" }}
      className="relative select-none"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: interactive ? rotateX : "0deg",
          rotateY: interactive ? rotateY : "0deg",
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full h-[600px] flex flex-col justify-between rounded-none border p-8 transition-all duration-200 overflow-hidden ${
          isExpired
            ? "bg-dark-card border-dark-border opacity-60"
            : isUrgent
            ? "bg-dark-card border-aviation shadow-glow-amber"
            : "bg-dark-card border-dark-border hover:border-uranium hover:shadow-glow-uranium"
        }`}
      >
        {/* Physical ticket notch simulation */}
        <div className="absolute top-1/2 -left-2.5 w-5 h-5 rounded-full bg-dark border-r border-dark-border -translate-y-1/2 z-20 pointer-events-none" />
        <div className="absolute top-1/2 -right-2.5 w-5 h-5 rounded-full bg-dark border-l border-dark-border -translate-y-1/2 z-20 pointer-events-none" />

        {/* Dynamic Specular Glare / Reflection Layer */}
        {interactive && isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-30"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(152, 255, 26, 0.12), transparent 65%)`,
            }}
          />
        )}

        {/* Header Ribbon / Status */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-dark-border bg-chip-bg text-chip-text font-bold">
                TOKEN #{pass.tokenId}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-chip-bg border border-dark-border text-chip-text font-bold">
                {pass.tier}
              </span>
            </div>
            <h3 className="font-header font-bold text-2xl text-alabaster mt-3 tracking-tight line-clamp-1 h-8">
              {pass.name}
            </h3>
          </div>

          {/* Urgency / Decay Stamp */}
          {isUrgent ? (
            <div className="rotate-[-3deg] flex items-center space-x-1 px-2.5 py-1 bg-aviation text-black font-mono text-xs font-extrabold uppercase shadow-sm">
              <Flame className="w-3.5 h-3.5 fill-black" />
              <span>STEAL // {discountPercent}% OFF</span>
            </div>
          ) : isFresh ? (
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-uranium/10 border border-uranium text-uranium font-mono text-[10px] uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              <span>HIGH TIME VALUE</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-dark-surface border border-dark-border text-zincGrey font-mono text-[10px] uppercase tracking-wider">
              <span>DECAYING</span>
            </div>
          )}
        </div>

        {/* Decay Timeline & Remaining Meter */}
        <div className="mt-6 p-4 bg-dark border border-dark-border relative z-10">
          <div className="flex items-center justify-between text-sm font-mono mb-3">
            <span className="text-zincGrey flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-uranium" />
              <span>TIME REMAINING:</span>
            </span>
            <span className={`font-bold text-sm ${isUrgent ? "text-aviation" : isFresh ? "text-uranium" : "text-alabaster"}`}>
              {remainingDays} DAYS / {totalDays}D ({percentLeft}%)
            </span>
          </div>

          {/* Custom Decay Progress Bar */}
          <div className="w-full h-2.5 bg-dark-surface border border-dark-border overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                isUrgent
                  ? "bg-aviation shadow-glow-amber"
                  : "bg-gradient-to-r from-uranium via-aviation to-uranium"
              }`}
              style={{ width: `${percentLeft}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-zincGrey mt-2">
            <span>ISSUED 100%</span>
            <span>HALF-LIFE 50%</span>
            <span>EXPIRES 0%</span>
          </div>
        </div>

        {/* Technical Data HUD */}
        <div className="mt-5 grid grid-cols-2 gap-3 font-mono relative z-10">
          <div className="p-3 border border-dark-border bg-dark">
            <span className="text-[11px] text-zincGrey block uppercase mb-1">Original Retail</span>
            <span className="text-zincGrey-light line-through text-sm">{pass.originalPriceEth} ETH</span>
          </div>
          <div className="p-3 border border-dark-border bg-dark-surface">
            <span className="text-[11px] text-uranium block uppercase mb-1">Current Value</span>
            <span className="text-uranium font-bold text-lg">{effectivePrice} ETH</span>
          </div>
        </div>

        {/* Barcode & Stylus Verification Line */}
        <div className="mt-6 pt-4 border-t border-dashed border-dark-border flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-1.5 text-xs font-mono text-zincGrey">
            <ShieldCheck className="w-4 h-4 text-periwinkle" />
            <span>STYLUS SECP256R1 VERIFIED</span>
          </div>
          {/* Faux Barcode */}
          <div className="flex space-x-[2px] h-5 items-end opacity-40">
            {[4, 2, 5, 3, 6, 2, 4, 1, 5, 3, 2, 6, 4, 2, 5].map((h, i) => (
              <div
                key={i}
                className="bg-alabaster w-[1.5px]"
                style={{ height: `${h * 3}px` }}
              />
            ))}
          </div>
        </div>

        {/* Action Controls */}
        {showActions && (
          <div className="mt-5 flex items-center space-x-2 relative z-10">
            <LinkButton3D
              href={`/pass/${pass.tokenId}`}
              variant="ghost"
              size="md"
              className="flex-1"
            >
              Inspect Detail
            </LinkButton3D>
            {pass.isListed && onBuy && (
              <Button3D onClick={() => onBuy(pass)} size="md" className="flex-1">
                <span>Acquire Pass</span>
                <ArrowRight className="w-4 h-4" />
              </Button3D>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
