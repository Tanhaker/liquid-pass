"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu } from "lucide-react";
import { EXPLORER, LIQUID_PASS_ADDRESS } from "@/lib/contract";

/**
 * Protocol footer, from the UI drop.
 *
 * The telemetry column reads the deployed address out of lib/contract rather
 * than hard-coding it, so it cannot drift from what the app is actually
 * talking to.
 */
export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-dark-border bg-dark-base font-mono text-xs text-zincGrey sm:mt-40">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
        {/* 4-column protocol grid, spacious gaps */}
        <div className="mb-16 grid grid-cols-1 gap-12 sm:gap-16 md:grid-cols-4 sm:mb-20">
          {/* Col 1-2: mission */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-2.5">
              <span className="h-2.5 w-2.5 flex-shrink-0 bg-uranium" />
              <span className="font-header text-base font-bold tracking-tight text-alabaster">
                LIQUIDPASS // SOVEREIGN SUBSCRIPTION RESALE PROTOCOL
              </span>
            </div>
            <p className="max-w-md font-body text-sm leading-relaxed text-zincGrey">
              Buy time. Use it. Sell what&rsquo;s left. Resellable SaaS
              subscriptions on Arbitrum Stylus with native WebAuthn passkeys and
              automated 90/10 royalty settlement.
            </p>
            <div className="flex items-center space-x-3 pt-3 text-[11px] text-uranium">
              <span className="border border-dark-border bg-dark-card px-2.5 py-1">
                RUST + STYLUS WASM &lt; 24KB
              </span>
              <span className="border border-dark-border bg-dark-card px-2.5 py-1">
                90% SELLER / 10% ISSUER
              </span>
            </div>
          </div>

          {/* Col 3: nodes */}
          <div className="space-y-4">
            <h4 className="font-header text-sm font-bold uppercase tracking-wider text-alabaster">
              PROTOCOL NODES
            </h4>
            <ul className="space-y-2.5 text-xs">
              {[
                ["/market", "01 // Secondary Market"],
                ["/dashboard", "02 // My Passes & Vault"],
                ["/explorer", "03 // Live Contract Explorer"],
                ["/analytics", "04 // Protocol Analytics"],
                ["/verify", "05 // Access Verifier & SDK"],
                ["/issuer", "06 // Issuer Portal"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-uranium">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: telemetry */}
          <div className="space-y-4">
            <h4 className="font-header text-sm font-bold uppercase tracking-wider text-alabaster">
              STYLUS TELEMETRY
            </h4>
            <div className="space-y-2 border border-dark-border bg-dark-card p-4 text-[11px]">
              <div className="text-zincGrey">STYLUS TARGET:</div>
              <a
                href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between font-mono text-uranium hover:underline"
              >
                <span>{LIQUID_PASS_ADDRESS.slice(0, 14)}...</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <div className="pt-1 text-zincGrey">NETWORK: Arbitrum Sepolia (421614)</div>
              <div className="font-semibold text-periwinkle">P-256 SECP256R1 ON-CHAIN</div>
            </div>
          </div>
        </div>

        {/* Legal / spec row */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-dark-border/60 pt-10 text-[11px] text-zincGrey sm:flex-row sm:pt-12">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4 flex-shrink-0 text-uranium" />
            <span>BUILT EXCLUSIVELY FOR ARBITRUM STYLUS // NON-ERC721 SOVEREIGN DESIGN</span>
          </div>
          <div>LIQUIDPASS © 2026 // TIME-BOUND NFT SUBSCRIPTION MARKETPLACE</div>
        </div>
      </div>

      {/*
        Peeking architectural brand title.

        The wordmark is far taller than the strip that shows it, so the strip
        height is what crops it -- roughly the top half of the lettering stays
        visible. Both are in vw so the crop holds at every width; a fixed px
        height would swallow the letters on a narrow window and float them on a
        wide one.
      */}
      <div className="mt-6 flex h-[6.0vw] w-full select-none items-start justify-center overflow-hidden border-t border-dark-border/30 sm:mt-8 sm:h-[6.6vw] lg:h-[7.0vw]">
        <div className="footer-brand-watermark pointer-events-none -translate-y-[3%] select-none whitespace-nowrap text-center font-header text-[15.5vw] font-black uppercase leading-none tracking-tighter transition-colors sm:-translate-y-[4%]">
          LIQUIDPASS
        </div>
      </div>
    </footer>
  );
}
