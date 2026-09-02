"use client";

import Link from "next/link";
import { ArrowUpRight, Cpu } from "lucide-react";
import { EXPLORER, LIQUID_PASS_ADDRESS, MARKETPLACE_ADDRESS } from "@/lib/contract";

/**
 * Protocol footer, per the team's design.
 *
 * The telemetry column reads the real deployed addresses out of lib/contract
 * rather than hard-coding them, so it cannot drift from what the rest of the
 * app is actually talking to.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-dark-border bg-surface font-mono text-xs text-zinc-grey">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Mission */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="size-2 bg-uranium" />
              <span className="font-header text-base font-bold tracking-tight text-text">
                LIQUIDPASS // SOVEREIGN SUBSCRIPTION RESALE PROTOCOL
              </span>
            </div>
            <p className="max-w-md font-body text-sm leading-relaxed text-zinc-grey">
              Buy time. Use it. Sell what&rsquo;s left. Resellable SaaS
              subscriptions on Arbitrum Stylus, with a decaying ask and
              automated 90/10 royalty settlement on every resale.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-uranium">
              <span className="border border-dark-border bg-raised px-2 py-0.5">
                RUST + STYLUS WASM &lt; 24KB
              </span>
              <span className="border border-dark-border bg-raised px-2 py-0.5">
                90% SELLER / 10% ISSUER
              </span>
            </div>
          </div>

          {/* Nodes */}
          <div>
            <h4 className="mb-3 font-header text-sm font-bold uppercase tracking-wider text-text">
              PROTOCOL NODES
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                ["/market", "01 // Secondary Market"],
                ["/dashboard", "02 // My Passes & Vault"],
                ["/explorer", "03 // Live Contract Explorer"],
                ["/analytics", "04 // Protocol Analytics"],
                ["/verify", "05 // Access Verifier"],
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

          {/* Telemetry */}
          <div>
            <h4 className="mb-3 font-header text-sm font-bold uppercase tracking-wider text-text">
              STYLUS TELEMETRY
            </h4>
            <div className="space-y-1.5 border border-dark-border bg-raised p-3 text-[11px]">
              <div className="text-zinc-grey">PASS CONTRACT:</div>
              <a
                href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-uranium hover:underline"
              >
                <span>{LIQUID_PASS_ADDRESS.slice(0, 14)}…</span>
                <ArrowUpRight className="size-3" />
              </a>
              <div className="pt-1 text-zinc-grey">MARKETPLACE:</div>
              <a
                href={`${EXPLORER}/address/${MARKETPLACE_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-uranium hover:underline"
              >
                <span>{MARKETPLACE_ADDRESS.slice(0, 14)}…</span>
                <ArrowUpRight className="size-3" />
              </a>
              <div className="pt-1 text-zinc-grey">NETWORK: Arbitrum Sepolia (421614)</div>
              <div className="text-periwinkle">TESTNET ONLY — NOT REAL FUNDS</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-dark-border pt-8 text-[11px] text-zinc-grey sm:flex-row">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-uranium" />
            <span>BUILT FOR ARBITRUM STYLUS // NON-ERC721 SOVEREIGN DESIGN</span>
          </div>
          <div>LIQUIDPASS © 2026 // TIME-BOUND NFT SUBSCRIPTION MARKETPLACE</div>
        </div>
      </div>
    </footer>
  );
}
