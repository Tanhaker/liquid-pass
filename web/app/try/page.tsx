"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight, ArrowUpRight, CheckCircle2, Circle, Compass, RefreshCw } from "lucide-react";
import { formatEther } from "viem";
import { fetchPasses, passesOf } from "@/lib/data";
import { USE_COOKIE } from "@/lib/autosell";
import { formatRemaining, remaining, shortAddress, type Pass } from "@/lib/contract";

/**
 * A guided run through the whole product, for a first-time visitor or a judge.
 *
 * Each step that the chain or the browser can confirm ticks itself: the wallet
 * is connected, it has test ETH, it holds a pass, LiquidDesk has been opened
 * with it, a pass is listed. The others link to the right page and say what to
 * look for. Nothing here signs anything.
 */

const LIQUIDDESK_URL = process.env.NEXT_PUBLIC_LIQUIDDESK_URL || "https://desk.liquidpass.xyz";
const MIN_GAS_WEI = 100_000_000_000_000n; // 0.0001 ETH: enough for several testnet transactions

const FAUCETS = [
  { name: "Alchemy faucet", href: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
  { name: "QuickNode faucet", href: "https://faucet.quicknode.com/arbitrum/sepolia" },
  { name: "Arbitrum bridge (from Sepolia)", href: "https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia" },
];

function usedOnDesk(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${USE_COOKIE}=`) && c.length > USE_COOKIE.length + 1);
}

export default function TryItPage() {
  const { address, isConnected } = useAccount();
  const balance = useBalance({ address, chainId: arbitrumSepolia.id, query: { enabled: !!address } });
  const [mine, setMine] = useState<Pass[] | null>(null);
  const [desk, setDesk] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setDesk(usedOnDesk());
    if (!address) {
      setMine(null);
      return;
    }
    setChecking(true);
    try {
      setMine(passesOf(await fetchPasses(), address));
    } catch {
      setMine(null);
    } finally {
      setChecking(false);
      void balance.refetch();
    }
    // balance.refetch is stable enough; re-running on every balance change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const active = (mine ?? []).filter((p) => p.active);
  const listed = active.filter((p) => p.listed > 0n);
  const wei = balance.data?.value ?? 0n;
  const best = [...active].sort((a, b) => Number(b.expiry - a.expiry))[0];

  const steps: Array<{
    title: string;
    body: React.ReactNode;
    done: boolean | null;
    status?: string;
    action?: React.ReactNode;
  }> = [
    {
      title: "Connect a wallet",
      body: "Use MetaMask or any browser wallet. The network is Arbitrum Sepolia, a testnet, so nothing costs real money.",
      done: isConnected,
      status: address ? `Connected as ${shortAddress(address)}` : undefined,
      action: !isConnected ? <ConnectButton /> : undefined,
    },
    {
      title: "Get free test ETH",
      body: (
        <>
          Every action is a transaction and needs a little gas. Claim test ETH from a faucet:{" "}
          {FAUCETS.map((f, i) => (
            <React.Fragment key={f.href}>
              <a href={f.href} target="_blank" rel="noreferrer" className="text-uranium hover:underline">
                {f.name}
              </a>
              {i < FAUCETS.length - 1 ? ", " : "."}
            </React.Fragment>
          ))}
        </>
      ),
      done: address ? wei >= MIN_GAS_WEI : null,
      status: address && balance.data ? `Balance ${Number(formatEther(wei)).toFixed(4)} ETH` : undefined,
    },
    {
      title: "Buy a pass",
      body: "In My Passes, under \"Buy a pass from an open plan\", pick a plan and buy it. The contract records you as the owner with a fixed expiry, and the issuer is paid in the same transaction. You can also buy someone's remaining days on the market.",
      done: address ? active.length > 0 : null,
      status: best ? `You hold pass #${best.tokenId}, ${formatRemaining(remaining(best.expiry))} left` : undefined,
      action: <StepLink href="/dashboard">Buy a pass in My Passes</StepLink>,
    },
    {
      title: "Use it: unlock LiquidDesk",
      body: "LiquidDesk is a separate sample product. Sign in with the same wallet and its Pro workspace unlocks because your wallet holds a pass. Opening it also counts as using the pass.",
      done: desk,
      status: desk ? "LiquidDesk has been opened with a pass in this browser" : undefined,
      action: <StepLink href={LIQUIDDESK_URL} external>Open LiquidDesk</StepLink>,
    },
    {
      title: "Sell the days you will not use",
      body: "In My Passes, choose Sell remaining time. Liquidity AI suggests a fair price and explains it. Once listed, the price falls every second until expiry.",
      done: address ? listed.length > 0 : null,
      status: listed.length ? `${listed.length} pass${listed.length === 1 ? "" : "es"} listed` : undefined,
      action: <StepLink href="/dashboard">Open My Passes</StepLink>,
    },
    {
      title: "Watch access move",
      body: "When someone buys your listing (try it from a second wallet), LiquidDesk locks for you within seconds and unlocks for them. You receive 90% and the issuer 10%, in one transaction.",
      done: null,
      action: <StepLink href="/verify">Check who holds access</StepLink>,
    },
    {
      title: "Check in at a venue",
      body: "Open the scanner on one screen and the holder page from its QR code on another. Sign with your wallet and the scanner admits you. A screenshot of the code cannot be reused.",
      done: null,
      action: <StepLink href="/checkin">Open the scanner</StepLink>,
    },
    {
      title: "Ask Liquidity AI",
      body: "The button in the bottom-right corner opens the assistant. Ask \"Which of my passes expire soon?\" or \"What is listed right now?\" and it answers from live chain data.",
      done: null,
    },
  ];

  const confirmed = steps.filter((s) => s.done === true).length;
  const checkable = steps.filter((s) => s.done !== null).length;

  return (
    <div className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-dark-border pb-8">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Compass className="w-3.5 h-3.5" /><span>GUIDED TOUR // ABOUT 5 MINUTES</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Try the Full Flow</h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
            Buy a pass, use it in another product, resell the days you do not need and check in at a door. Steps the
            chain can confirm tick themselves.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2 sm:min-w-[220px]">
          <div className="flex items-center justify-between gap-6 text-zincGrey">
            <span>CONFIRMED:</span>
            <span className="text-uranium font-bold">{confirmed} / {checkable}</span>
          </div>
          <button onClick={() => void refresh()} className="flex items-center gap-1.5 text-zincGrey hover:text-uranium">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} /> RE-CHECK
          </button>
        </div>
      </div>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`flex gap-4 p-5 border bg-dark-card ${s.done ? "border-uranium" : "border-dark-border"} shadow-grunge`}
          >
            <div className="flex flex-col items-center pt-0.5">
              {s.done ? <CheckCircle2 className="w-6 h-6 text-uranium" /> : <Circle className="w-6 h-6 text-zincGrey/60" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-xs font-bold text-uranium">0{i + 1}</span>
                <h2 className="font-header font-bold text-xl text-alabaster">{s.title}</h2>
              </div>
              <p className="font-body text-sm text-zincGrey leading-relaxed">{s.body}</p>
              {s.status && <p className="font-mono text-[11px] uppercase tracking-wider text-uranium">{s.status}</p>}
              {s.action && <div className="pt-1">{s.action}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls =
    "inline-flex items-center gap-2 px-4 py-2 bg-dark border border-dark-border hover:border-uranium text-alabaster hover:text-uranium font-mono text-xs uppercase tracking-wider transition-colors";
  return external ? (
    <a href={href} className={cls}>
      {children} <ArrowUpRight className="w-3.5 h-3.5" />
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children} <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}
