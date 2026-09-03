"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useLiquidPass } from "@/lib/store";
import { PassCard3D } from "@/components/PassCard3D";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function PassDetailPage() {
  const params = useParams();
  const tokenId = params?.tokenId as string;
  const { demoPasses, buyPass, listPass, unlistPass, userAddress } = useLiquidPass();

  const [resalePriceInput, setResalePriceInput] = useState<string>("0.020");

  const pass = demoPasses.find((p) => p.tokenId === tokenId);

  if (!pass) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4 text-center font-mono text-xs">
        <p className="text-aviation text-base mb-4">TOKEN #{tokenId} NOT FOUND</p>
        <Link href="/market" className="text-uranium underline">
          ← Return to Marketplace
        </Link>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(0, pass.expiryTimestamp - now);
  const remainingDays = (remainingSeconds / 86400).toFixed(2);
  const percentLeft = Math.min(
    100,
    Math.max(0, Math.round((remainingSeconds / pass.totalDurationSeconds) * 100))
  );

  const isOwner = pass.owner.toLowerCase() === userAddress.toLowerCase();
  const effectivePrice = pass.listingPriceEth || pass.originalPriceEth;
  const parsedPrice = parseFloat(effectivePrice);
  const sellerProceeds = (parsedPrice * 0.9).toFixed(5);
  const issuerRoyalty = (parsedPrice * 0.1).toFixed(5);

  const handleBuy = async () => {
    await buyPass(pass.tokenId, effectivePrice);
  };

  const handleList = async () => {
    if (!resalePriceInput || parseFloat(resalePriceInput) <= 0) return;
    await listPass(pass.tokenId, resalePriceInput);
  };

  const handleUnlist = async () => {
    await unlistPass(pass.tokenId);
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Back button */}
      <Link
        href="/market"
        className="inline-flex items-center space-x-2 font-mono text-xs text-zincGrey hover:text-uranium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>BACK TO RESALE MARKET</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: 3D Interactive Pass Inspection */}
        <div className="lg:col-span-5 space-y-6">
          <PassCard3D pass={pass} interactive={true} showActions={false} />

          {/* On-Chain Contract Verification Box */}
          <div className="p-4 bg-dark-base border border-dark-border font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-uranium border-b border-dark-border pb-2">
              <span className="font-bold uppercase">STYLUS CONTRACT READOUT</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-zincGrey">
              <div className="flex justify-between">
                <span>ownerOf({tokenId}):</span>
                <span className="text-alabaster">{pass.owner.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span>isActive({tokenId}):</span>
                <span className="text-uranium font-bold">true</span>
              </div>
              <div className="flex justify-between">
                <span>remainingSeconds({tokenId}):</span>
                <span className="text-aviation font-bold">{remainingSeconds}s</span>
              </div>
              <div className="flex justify-between">
                <span>issuerOf({tokenId}):</span>
                <span className="text-periwinkle">{pass.issuer.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span>priceOf({tokenId}):</span>
                <span className="text-alabaster">
                  {pass.isListed ? `${pass.listingPriceEth} ETH` : "0 (Not Listed)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pass Specs, Royalty Split, & Actions */}
        <div className="lg:col-span-7 space-y-8">
          
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-dark-surface border border-dark-border text-zincGrey font-mono text-xs font-bold uppercase">
                {pass.tier} ACCESS TICKET
              </span>
              <span className="font-mono text-xs text-zincGrey">
                TOKEN #{pass.tokenId}
              </span>
            </div>
            <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster mt-2 tracking-tight">
              {pass.name}
            </h1>
            <p className="font-body text-zincGrey text-base mt-2">
              {pass.service} software pass with on-chain time decay and secondary resale rights.
            </p>
          </div>

          {/* Decay Lifetime Visual Bar */}
          <div className="p-5 bg-dark-card border border-dark-border space-y-3">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-zincGrey flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-uranium" />
                <span>CONTRACT LIFECYCLE DECAY:</span>
              </span>
              <span className="text-uranium font-bold">
                {remainingDays} Days Left ({percentLeft}% retained)
              </span>
            </div>

            <div className="w-full h-3 bg-dark-base border border-dark-border overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-uranium via-aviation to-dark-surface"
                style={{ width: `${percentLeft}%` }}
              />
            </div>

            <div className="flex justify-between font-mono text-[10px] text-zincGrey">
              <span>ISSUANCE: 100% VALUE</span>
              <span>EXPIRY: 0.000 ETH VOID</span>
            </div>
          </div>

          {/* 90/10 Payment Split Breakdown */}
          <div className="p-6 bg-dark-card border border-dark-border space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="font-header font-bold text-lg text-alabaster uppercase">
                90% / 10% Smart Contract Payout Split
              </h3>
              <DollarSign className="w-5 h-5 text-uranium" />
            </div>

            <p className="font-body text-zincGrey text-xs leading-relaxed">
              Resale proceeds are atomically disbursed at the EVM execution layer when <code className="text-uranium">buy()</code> is called:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 bg-dark border border-dark-border">
                <div className="text-zincGrey text-[10px] uppercase">Seller Take (90%)</div>
                <div className="text-uranium font-bold text-lg">{sellerProceeds} ETH</div>
                <div className="text-[10px] text-zincGrey mt-1">Paid directly to seller wallet</div>
              </div>
              <div className="p-3 bg-dark border border-dark-border">
                <div className="text-zincGrey text-[10px] uppercase">Issuer Royalty (10%)</div>
                <div className="text-periwinkle font-bold text-lg">{issuerRoyalty} ETH</div>
                <div className="text-[10px] text-zincGrey mt-1">Paid to SaaS protocol creator</div>
              </div>
            </div>
          </div>

          {/* Action Box: Buy vs Manage Listing */}
          <div className="p-6 bg-dark-card border border-dark-border space-y-4">
            {isOwner ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-uranium font-mono text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>YOU CURRENTLY OWN THIS PASS</span>
                </div>

                {pass.isListed ? (
                  <div className="space-y-3">
                    <p className="font-body text-zincGrey text-xs">
                      This pass is actively listed on the resale market for{" "}
                      <span className="text-uranium font-bold">{pass.listingPriceEth} ETH</span>.
                    </p>
                    <button
                      onClick={handleUnlist}
                      className="w-full py-3 bg-dark-card hover:bg-dark-surface border border-red-500/50 text-red-300 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      WITHDRAW LISTING (DELIST FROM MARKET)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="font-mono text-xs text-zincGrey block">
                      SET RESALE LISTING PRICE (ETH):
                    </label>
                    <div className="flex space-x-3">
                      <input
                        type="number"
                        step="0.001"
                        value={resalePriceInput}
                        onChange={(e) => setResalePriceInput(e.target.value)}
                        className="flex-1 p-2.5 bg-dark border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none"
                      />
                      <button
                        onClick={handleList}
                        className="px-6 py-2.5 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium"
                      >
                        LIST ON MARKET
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs text-zincGrey">TOTAL ACQUISITION PRICE:</span>
                  <span className="text-2xl font-bold text-uranium">{effectivePrice} ETH</span>
                </div>

                {pass.isListed ? (
                  <button
                    onClick={handleBuy}
                    className="w-full py-4 bg-uranium hover:bg-uranium-glow text-black font-mono text-sm font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-grunge-uranium"
                  >
                    <span>BUY PASS VIA ARBITRUM STYLUS ({effectivePrice} ETH)</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                ) : (
                  <div className="p-3 bg-dark border border-dark-border text-center font-mono text-xs text-zincGrey">
                    This pass is in private ownership and is not currently listed for sale.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
