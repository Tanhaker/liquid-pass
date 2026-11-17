"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { Fingerprint, Zap } from "lucide-react";
import { HorizontalThemeWipeToggle } from "@/components/ui/theme-wipe-toggle";
import { useDemo } from "@/lib/demo";

/**
 * Full-bleed tactical header, from the team's original header design.
 *
 * Two things are kept from the previous nav rather than taken from the design
 * file: the wallet control is RainbowKit's, not a static address badge, and
 * the demo switch drives the real DemoProvider. The design's versions of both
 * were mockups reading from a local store.
 */

const LINKS = [
  { href: "/market", label: "MARKET" },
  { href: "/dashboard", label: "MY PASSES" },
  { href: "/explorer", label: "EXPLORER" },
  { href: "/issuer", label: "ISSUER" },
  { href: "/analytics", label: "ANALYTICS" },
  { href: "/verify", label: "VERIFY" },
  // The gateway to what a pass opens: LiquidDesk, the QR check-in and the
  // verifier. The check-in pages live under it, so they light this link up.
  { href: "/use", label: "USE PASS", also: ["/checkin"] },
];

function isActive(pathname: string, link: { href: string; also?: string[] }) {
  return [link.href, ...(link.also ?? [])].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// The passkey verifier is a lab page, not how anyone signs in: the deployed
// wallet contract only accepts passkeys created at localhost, and sign-in on
// this site is by wallet. It is labelled as a lab so nobody reads the button
// as a login, and it is dropped on phones, where the header has no room.
const PASSKEY = { href: "/passkey", label: "PASSKEY LAB" };

export function Nav() {
  const pathname = usePathname();
  const { isConnected, chainId } = useAccount();
  const { enabled: demo, setEnabled: setDemo } = useDemo();

  // RainbowKit shows its own "Wrong network" button, but the Sepolia readout
  // beside it would still read as fine, so this keeps the two in step.
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <header className="sticky top-0 z-50 border-b border-dark-border bg-ink/90 backdrop-blur-md">
      <div className="w-full px-3 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <Image
              src="/Logo.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-9 w-auto object-contain"
            />
            <span className="hidden flex-col sm:flex">
              <span className="font-header text-lg font-extrabold tracking-tight text-text transition-colors group-hover:text-uranium">
                LIQUID<span className="text-uranium">PASS</span>
              </span>
              <span className="-mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-grey">
                STYLUS // RESELLABLE SAAS PASSES
              </span>
            </span>
          </Link>

          {/* Sections */}
          <nav className="hidden items-center gap-1 min-[1400px]:flex">
            {LINKS.map((link) => {
              const { href, label } = link;
              const active = isActive(pathname, link);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative whitespace-nowrap px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                    active
                      ? "border-b-2 border-uranium bg-raised font-semibold text-uranium"
                      : "text-zinc-grey hover:bg-raised/50 hover:text-text"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="border border-dark-border bg-surface transition-colors hover:border-uranium">
              <HorizontalThemeWipeToggle direction="left" />
            </div>

            <button
              onClick={() => setDemo(!demo)}
              title="Toggle simulated state vs live contract RPC"
              className={`flex items-center gap-2 whitespace-nowrap border px-2 py-1.5 font-mono text-xs uppercase tracking-wider transition-all sm:px-3 ${
                demo
                  ? "border-aviation bg-aviation/10 text-aviation shadow-glow-amber"
                  : "border-dark-border bg-raised text-zinc-grey hover:border-uranium"
              }`}
            >
              <Zap className={`size-3.5 ${demo ? "fill-aviation text-aviation" : "text-zinc-grey"}`} />
              <span className="hidden sm:inline">DEMO:</span>
              <span className="font-bold">{demo ? "ACTIVE" : "ON-CHAIN"}</span>
            </button>

            <Link
              href={PASSKEY.href}
              title="Experimental: verify a passkey signature against the Stylus contract"
              className={`hidden items-center gap-2 whitespace-nowrap border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all md:flex ${
                pathname === PASSKEY.href
                  ? "border-uranium bg-uranium/10 font-semibold text-uranium"
                  : "border-dark-border bg-raised text-zinc-grey hover:border-uranium hover:text-text"
              }`}
            >
              <Fingerprint className="size-3.5" />
              <span className="hidden sm:inline">{PASSKEY.label}</span>
            </Link>

            {wrongNetwork && (
              <span className="hidden border border-life-crit/40 bg-life-crit/10 px-2.5 py-1.5 font-mono text-[11px] uppercase text-life-crit lg:inline">
                Wrong network
              </span>
            )}

            {/* RainbowKit owns the connect / account / network states.
                Rebuilding them by hand is how you end up with a button that
                disagrees with the wallet it is describing. */}
            <ConnectButton
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              chainStatus="none"
            />
          </div>
        </div>
      </div>

      {/* Mobile section bar */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-dark-border bg-surface px-3 py-2 min-[1400px]:hidden">
        {LINKS.map((link) => {
          const { href, label } = link;
          const active = isActive(pathname, link);
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap px-2.5 py-1 font-mono text-[11px] uppercase ${
                active ? "bg-uranium font-bold text-black" : "bg-raised text-zinc-grey"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
