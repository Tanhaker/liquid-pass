"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu } from "lucide-react";
import { EXPLORER, LIQUID_PASS_ADDRESS } from "@/lib/contract";

export function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark-base text-zincGrey font-mono text-xs mt-32 sm:mt-40 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16">
        
        {/* 4-Column Protocol Information Grid with Spacious Gaps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 sm:gap-16 mb-16 sm:mb-20">
          
          {/* Col 1: Protocol Mission */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 bg-uranium flex-shrink-0"></span>
              <span className="font-header font-bold text-base text-alabaster tracking-tight">
                LIQUIDPASS // SOVEREIGN SUBSCRIPTION RESALE PROTOCOL
              </span>
            </div>
            <p className="font-body text-zincGrey text-sm max-w-md leading-relaxed">
              Buy time. Use it. Sell what's left. Resellable SaaS subscriptions on Arbitrum Stylus with native WebAuthn passkeys and automated 90/10 royalty settlement.
            </p>
            <div className="pt-3 flex items-center space-x-3 text-[11px] text-uranium">
              <span className="px-2.5 py-1 border border-dark-border bg-dark-card">
                RUST + STYLUS WASM &lt; 24KB
              </span>
              <span className="px-2.5 py-1 border border-dark-border bg-dark-card">
                90% SELLER / 10% ISSUER
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Nodes */}
          <div className="space-y-4">
            <h4 className="font-header font-bold text-alabaster text-sm uppercase tracking-wider">
              PROTOCOL NODES
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/market" className="hover:text-uranium transition-colors">
                  01 // Secondary Market
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-uranium transition-colors">
                  02 // My Passes &amp; Vault
                </Link>
              </li>
              <li>
                <Link href="/explorer" className="hover:text-uranium transition-colors">
                  03 // Live Contract Explorer
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="hover:text-uranium transition-colors">
                  04 // Protocol Analytics
                </Link>
              </li>
              <li>
                <Link href="/verify" className="hover:text-uranium transition-colors">
                  05 // Access Verifier &amp; SDK
                </Link>
              </li>
              <li>
                <Link href="/issuer" className="hover:text-uranium transition-colors">
                  06 // Issuer Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Smart Contract Telemetry */}
          <div className="space-y-4">
            <h4 className="font-header font-bold text-alabaster text-sm uppercase tracking-wider">
              STYLUS TELEMETRY
            </h4>
            <div className="p-4 bg-dark-card border border-dark-border space-y-2 text-[11px]">
              <div className="text-zincGrey">STYLUS TARGET:</div>
              <a
                href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="text-uranium hover:underline flex items-center justify-between font-mono"
              >
                <span>{LIQUID_PASS_ADDRESS.slice(0, 14)}...</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <div className="text-zincGrey pt-1">NETWORK: Arbitrum Sepolia (421614)</div>
              <div className="text-periwinkle font-semibold">P-256 SECP256R1 ON-CHAIN</div>
            </div>
          </div>

        </div>

        {/* Secondary Divider & Legal/Spec telemetry row */}
        <div className="pt-10 sm:pt-12 border-t border-dark-border/60 flex flex-col sm:flex-row items-center justify-between gap-6 text-[11px] text-zincGrey">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-uranium flex-shrink-0" />
            <span>BUILT EXCLUSIVELY FOR ARBITRUM STYLUS // NON-ERC721 SOVEREIGN DESIGN</span>
          </div>
          <div>LIQUIDPASS © 2026 // TIME-BOUND NFT SUBSCRIPTION MARKETPLACE</div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* PEEKING ARCHITECTURAL FOOTER BRAND TITLE (CABINET GROTESK) */}
      {/* Balanced ~50% crop so lettering is completely legible while peeking */}
      {/* ============================================================ */}
      <div className="w-full overflow-hidden select-none pointer-events-none border-t border-dark-border/30 h-[6.0vw] sm:h-[6.6vw] lg:h-[7.0vw] flex items-start justify-center mt-6 sm:mt-8">
        <div className="footer-brand-watermark font-header font-black text-[15.5vw] tracking-tighter leading-none text-center uppercase whitespace-nowrap -translate-y-[3%] sm:-translate-y-[4%] select-none pointer-events-none transition-colors">
          LIQUIDPASS
        </div>
      </div>
    </footer>
  );
}
