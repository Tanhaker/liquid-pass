"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu } from "lucide-react";
import { LIQUID_PASS_CONTRACT_ADDRESS } from "@/lib/abi";

export function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark-base text-zincGrey font-mono text-xs mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Col 1: Protocol Mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-uranium"></span>
              <span className="font-header font-bold text-base text-alabaster tracking-tight">
                LIQUIDPASS // SOVEREIGN SUBSCRIPTION RESALE PROTOCOL
              </span>
            </div>
            <p className="font-body text-zincGrey text-sm max-w-md leading-relaxed">
              Buy time. Use it. Sell what's left. Resellable SaaS subscriptions on Arbitrum Stylus with native WebAuthn passkeys and automated 90/10 royalty settlement.
            </p>
            <div className="pt-2 flex items-center space-x-3 text-[11px] text-uranium">
              <span className="px-2 py-0.5 border border-dark-border bg-dark-card">
                RUST + STYLUS WASM &lt; 24KB
              </span>
              <span className="px-2 py-0.5 border border-dark-border bg-dark-card">
                90% SELLER / 10% ISSUER
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Nodes */}
          <div>
            <h4 className="font-header font-bold text-alabaster text-sm uppercase tracking-wider mb-3">
              PROTOCOL NODES
            </h4>
            <ul className="space-y-2 text-xs">
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
          <div>
            <h4 className="font-header font-bold text-alabaster text-sm uppercase tracking-wider mb-3">
              STYLUS TELEMETRY
            </h4>
            <div className="p-3 bg-dark-card border border-dark-border space-y-1.5 text-[11px]">
              <div className="text-zincGrey">STYLUS TARGET:</div>
              <a
                href={`https://sepolia.arbiscan.io/address/${LIQUID_PASS_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="text-uranium hover:underline flex items-center justify-between"
              >
                <span>{LIQUID_PASS_CONTRACT_ADDRESS.slice(0, 14)}...</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
              <div className="text-zincGrey pt-1">NETWORK: Arbitrum Sepolia (421614)</div>
              <div className="text-periwinkle">P-256 SECP256R1 ON-CHAIN</div>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zincGrey">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-uranium" />
            <span>BUILT EXCLUSIVELY FOR ARBITRUM STYLUS // NON-ERC721 SOVEREIGN DESIGN</span>
          </div>
          <div>LIQUIDPASS © 2026 // TIME-BOUND NFT SUBSCRIPTION MARKETPLACE</div>
        </div>
      </div>
    </footer>
  );
}
