"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { AppWindow, ArrowRight, ArrowUpRight, DoorOpen, KeyRound, ShieldCheck } from "lucide-react";
import { shortAddress } from "@/lib/contract";
import { fetchPasses, passesOf } from "@/lib/data";

/**
 * The gateway to everything a pass opens.
 *
 * Buying and reselling live on the Market and in My Passes. This page is the
 * third thing a pass is for: USING it. It gathers the places that accept a
 * Liquid Pass -- an online product (LiquidDesk, a separate app on its own
 * address), a physical door (the QR check-in) and the raw lookup (Verify) --
 * so nobody has to remember three addresses.
 */

const LIQUIDDESK_URL = process.env.NEXT_PUBLIC_LIQUIDDESK_URL || "https://desk.liquidpass.xyz";

export default function UsePassPage() {
  const { address, isConnected } = useAccount();
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setActive(null);
    if (!address) return;
    let cancelled = false;
    fetchPasses()
      .then((all) => {
        if (!cancelled) setActive(passesOf(all, address).filter((p) => p.active).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <KeyRound className="w-3.5 h-3.5" /><span>USE YOUR PASS // ACCESS GATEWAY</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Where Your Pass Works</h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
            Holding a pass is the access. Open a product with it online, or check in at a door in person. Both read the
            same contract, so access moves the moment the pass does.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2 md:min-w-[260px]">
          <div className="flex items-center justify-between gap-6 text-zincGrey">
            <span>CONNECTED WALLET:</span>
            <span className="text-uranium font-bold">{address ? shortAddress(address) : "Not connected"}</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-zincGrey">
            <span>ACTIVE PASSES:</span>
            <span className="text-alabaster font-bold">{!isConnected ? "-" : active === null ? "..." : active}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Door
          icon={<AppWindow className="w-4 h-4 text-uranium" />}
          tag="ONLINE PRODUCT"
          title="Unlock an App"
          name="LiquidDesk"
          body="A sample SaaS workspace on its own address. Sign in with your wallet and its Pro tools unlock if the wallet holds a valid pass. Sell the pass and it locks again within seconds."
          steps={["Open LiquidDesk", "Sign in with your wallet", "Pro unlocks while you hold the pass"]}
        >
          <a
            href={LIQUIDDESK_URL}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium"
          >
            <span>OPEN LIQUIDDESK</span><ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </Door>

        <Door
          icon={<DoorOpen className="w-4 h-4 text-uranium" />}
          tag="PHYSICAL DOOR"
          title="Check In at a Venue"
          name="QR Check-In"
          body="For gyms, co-working spaces and events. The door shows a one-time code, your wallet signs it, and the door admits you. A screenshot of the code is useless to anyone else."
          steps={["The venue opens the scanner", "You scan and sign with your wallet", "The scanner shows admit or refuse"]}
        >
          <Link
            href="/checkin"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium"
          >
            <span>OPEN THE SCANNER</span><ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Door>

        <Door
          icon={<ShieldCheck className="w-4 h-4 text-uranium" />}
          tag="FOR ANY APP"
          title="Verify Any Pass"
          name="Access Verifier"
          body="Look up a pass number and see who holds access right now, read straight from the contract. This is the same check LiquidDesk and the scanner run, in a form any developer can copy."
          steps={["Enter a pass number", "See the holder and the time left", "Copy the three-line check"]}
        >
          <Link
            href="/verify"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-dark border border-dark-border hover:border-uranium text-alabaster hover:text-uranium font-mono text-xs uppercase tracking-wider transition-colors"
          >
            <span>OPEN THE VERIFIER</span><ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Door>
      </div>

      <div className="p-4 bg-dark-card border border-dark-border font-mono text-[11px] text-zincGrey space-y-1">
        <div className="text-alabaster font-bold uppercase">Access follows the pass</div>
        <p>
          Resell or gift a pass and both doors close for you and open for the new holder, with the same expiry date.
          New here? <Link href="/try" className="text-uranium hover:underline">Take the guided tour</Link>. No pass yet?{" "}
          <Link href="/dashboard" className="text-uranium hover:underline">Get one in My Passes</Link> or
          buy someone&apos;s remaining days on the <Link href="/market" className="text-uranium hover:underline">Market</Link>.
        </p>
      </div>
    </div>
  );
}

function Door({
  icon,
  tag,
  title,
  name,
  body,
  steps,
  children,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  name: string;
  body: string;
  steps: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col p-6 bg-dark-card border border-dark-border shadow-grunge space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-dark-border pb-4">
        <div className="flex items-center space-x-2 min-w-0">{icon}<h3 className="font-header font-bold text-xl text-alabaster truncate">{title}</h3></div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zincGrey border border-dark-border px-1.5 py-0.5 whitespace-nowrap">{tag}</span>
      </div>
      <div className="font-mono text-xs font-bold uppercase tracking-wider text-uranium">{name}</div>
      <p className="font-body text-xs text-zincGrey leading-relaxed">{body}</p>
      <ol className="space-y-1.5 font-mono text-[11px] text-zincGrey grow">
        {steps.map((s, i) => (
          <li key={s} className="flex space-x-3">
            <span className="text-uranium font-bold">0{i + 1}</span><span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="pt-2">{children}</div>
    </div>
  );
}
