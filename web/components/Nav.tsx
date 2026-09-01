"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { shortAddress } from "@/lib/contract";

const LINKS = [
  { href: "/market", label: "Market" },
  { href: "/dashboard", label: "My Passes" },
  { href: "/issuer", label: "Issuer" },
];

export function Nav() {
  const pathname = usePathname();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* The mark is the product: a ring with a piece spent. */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-line-bright)" strokeWidth="2.5" />
            <circle
              cx="9" cy="9" r="7" fill="none"
              stroke="var(--color-life-full)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 7}
              strokeDashoffset={2 * Math.PI * 7 * 0.3}
              transform="rotate(-90 9 9)"
            />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight">Liquid Pass</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  active ? "bg-raised text-text" : "text-muted hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {wrongNetwork && (
            <span className="rounded-md bg-life-crit/15 px-2 py-1 text-[11px] text-life-crit">
              Wrong network
            </span>
          )}
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="tnum rounded-lg border border-line bg-raised px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-line-bright hover:text-text"
              title="Disconnect"
            >
              {address ? shortAddress(address) : "connected"}
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              disabled={isPending || !connectors.length}
              className="rounded-lg bg-text px-3.5 py-1.5 text-[12px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
