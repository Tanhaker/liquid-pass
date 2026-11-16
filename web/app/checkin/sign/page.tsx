"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, CheckCircle2, Copy, Loader2, PenLine, Ticket, XCircle } from "lucide-react";
import {
  STREAM_RENTAL_ADDRESS,
  formatRemaining,
  remaining,
  shortAddress,
  streamRentalAbi,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchPasses, fetchPlans } from "@/lib/data";
import { publicClient } from "@/lib/publicClient";
import {
  CHECKIN_CHANNEL,
  checkInMessage,
  encodeResponse,
  parseChallenge,
  type Challenge,
  type CheckInResponse,
} from "@/lib/checkin";

/**
 * The pass holder's side of a QR check-in.
 *
 * Reached by scanning the venue's code. The holder picks a pass and their
 * wallet signs the venue's one-time challenge -- a free signature, not a
 * transaction. The signed answer goes back to the scanner, which does the
 * checking. Nothing on this page decides whether the holder gets in.
 */

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default function CheckInSignPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Read from the address bar in an effect rather than useSearchParams, which
  // would force this page behind a Suspense boundary for one query string.
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const [now, setNow] = useState<number | null>(null);
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<CheckInResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setChallenge(parseChallenge(window.location.search));
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  const load = useCallback(async () => {
    if (!address) return;
    setLoadError(null);
    try {
      const [all, pl] = await Promise.all([fetchPasses(), fetchPlans()]);
      const active = all.filter((p) => p.active);
      // A pass being rented out is held by the rental contract; it belongs in
      // this list for the wallet that is renting it.
      const escrowed = active.filter((p) => same(p.owner, STREAM_RENTAL_ADDRESS));
      const renters = escrowed.length
        ? await publicClient.multicall({
            allowFailure: true,
            contracts: escrowed.map((p) => ({
              address: STREAM_RENTAL_ADDRESS,
              abi: streamRentalAbi,
              functionName: "activeRenter" as const,
              args: [p.tokenId] as const,
            })),
          })
        : [];
      const rented = new Set(
        escrowed
          .filter((_, i) => renters[i].status === "success" && same(renters[i].result as string, address))
          .map((p) => p.tokenId),
      );
      const mine = active.filter((p) => same(p.owner, address) || rented.has(p.tokenId));
      setPasses(mine);
      setPlans(pl);
      setChosen((c) => c ?? (mine[0] ? mine[0].tokenId.toString() : null));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [address]);

  useEffect(() => {
    setPasses(null);
    setChosen(null);
    setSent(null);
    void load();
  }, [load]);

  const secondsLeft = challenge && now ? Math.max(0, challenge.expires - Math.floor(now / 1000)) : 0;
  const expired = !!challenge && !!now && secondsLeft === 0;

  async function sign() {
    if (!challenge || !chosen) return;
    setSigning(true);
    setError(null);
    try {
      const signature = await signMessageAsync({ message: checkInMessage(challenge, chosen) });
      const response: CheckInResponse = { nonce: challenge.nonce, tokenId: chosen, signature };
      // Two routes to the scanner; the copyable code below is the third.
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(CHECKIN_CHANNEL);
        channel.postMessage(response);
        channel.close();
      }
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(response),
      }).catch(() => undefined);
      setSent(response);
    } catch (e) {
      const err = e as { name?: string; shortMessage?: string; message?: string };
      setError(
        /reject|denied/i.test(`${err.name} ${err.message}`)
          ? "You cancelled the signature in your wallet."
          : (err.shortMessage ?? err.message ?? "Could not sign."),
      );
    } finally {
      setSigning(false);
    }
  }

  const planName = (p: Pass) => plans.find((x) => x.id === p.planId)?.name ?? `Plan #${p.planId}`;

  return (
    <div className="py-12 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <PenLine className="w-3.5 h-3.5" /><span>SECURE QR CHECK-IN // PASS HOLDER</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Sign Your Check-In</h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Your wallet signs the venue&apos;s one-time code to prove you hold the pass. It is free and sends no transaction.
        </p>
      </div>

      <div className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
        <div className="flex items-center justify-between border-b border-dark-border pb-4 gap-3">
          <div className="flex items-center space-x-2 min-w-0"><Ticket className="w-4 h-4 text-uranium flex-shrink-0" /><h3 className="font-header font-bold text-xl text-alabaster truncate">{challenge ? challenge.venue : "Check-In"}</h3></div>
          {challenge && !sent && (
            <span className={`font-mono text-[11px] uppercase whitespace-nowrap ${expired ? "text-red-400" : "text-zincGrey"}`}>
              {expired ? "CODE EXPIRED" : `CODE VALID FOR ${secondsLeft}S`}
            </span>
          )}
        </div>

        {challenge === undefined ? (
          <div className="p-5 text-center font-mono text-xs text-zincGrey">Reading the code...</div>
        ) : challenge === null ? (
          <Notice bad title="NO CHECK-IN CODE FOUND">
            Open this page by scanning the code on the venue&apos;s scanner. <Link href="/checkin" className="text-uranium hover:underline">Go to the scanner</Link>.
          </Notice>
        ) : sent ? (
          <>
            <Notice title="SIGNED AND SENT TO THE SCANNER">
              You signed for Token #{sent.tokenId}. Look at the scanner: it checks the signature and your pass on Arbitrum, then shows the result.
            </Notice>
            <div className="space-y-3 font-mono text-xs">
              <span className="text-zincGrey block uppercase">Scanner did not react? Paste this code on it:</span>
              <div className="flex space-x-2">
                <input readOnly value={encodeResponse(sent)} onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 p-3 bg-dark border border-dark-border text-zincGrey focus:border-uranium focus:outline-none" />
                <button
                  onClick={() => { void navigator.clipboard.writeText(encodeResponse(sent)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center space-x-1 px-4 py-3 bg-dark border border-dark-border hover:border-uranium text-alabaster transition-colors"
                >
                  {copied ? (<><Check className="w-3.5 h-3.5 text-uranium" /><span className="text-uranium">COPIED</span></>) : (<><Copy className="w-3.5 h-3.5" /><span>COPY</span></>)}
                </button>
              </div>
            </div>
          </>
        ) : expired ? (
          <Notice bad title="THIS CODE HAS EXPIRED">
            Codes last less than a minute. Scan the code the scanner is showing now.
          </Notice>
        ) : !isConnected ? (
          <div className="space-y-4">
            <Notice title="CONNECT THE WALLET THAT HOLDS YOUR PASS">No email and no password. Your wallet is your ticket.</Notice>
            <ConnectButton />
          </div>
        ) : passes === null ? (
          <div className="p-5 text-center font-mono text-xs text-zincGrey">
            {loadError ? (
              <span className="text-red-400">{loadError}</span>
            ) : (
              <><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-uranium" />Reading your passes from Arbitrum Stylus...</>
            )}
          </div>
        ) : passes.length === 0 ? (
          <Notice bad title="NO ACTIVE PASS IN THIS WALLET">
            {address ? shortAddress(address) : "This wallet"} does not hold an active pass. <Link href="/dashboard" className="text-uranium hover:underline">Get one</Link> or switch wallet.
          </Notice>
        ) : (
          <>
            <div className="space-y-3 font-mono text-xs">
              <span className="text-zincGrey block uppercase">Check in with:</span>
              <div className="space-y-2">
                {passes.map((p) => {
                  const id = p.tokenId.toString();
                  const on = chosen === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setChosen(id)}
                      aria-pressed={on}
                      className={`w-full flex items-center justify-between gap-4 p-3 border text-left transition-colors ${on ? "bg-dark-surface border-uranium" : "bg-dark border-dark-border hover:border-uranium"}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-alabaster font-bold truncate">{planName(p)}</span>
                        <span className="block text-[11px] text-zincGrey">Token #{id}</span>
                      </span>
                      <span className={`text-[11px] whitespace-nowrap ${on ? "text-uranium font-bold" : "text-zincGrey"}`}>
                        {formatRemaining(remaining(p.expiry, now ?? Date.now()))} left
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => void sign()}
              disabled={signing || !chosen}
              className="w-full px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium disabled:opacity-50"
            >
              {signing ? "CHECK YOUR WALLET..." : "SIGN CHECK-IN"}
            </button>
            {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ title, bad, children }: { title: string; bad?: boolean; children: React.ReactNode }) {
  return (
    <div className={`p-5 border ${bad ? "bg-dark border-red-500/50" : "bg-dark-surface border-uranium"}`}>
      <div className="flex items-start space-x-3">
        {bad ? <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-6 h-6 text-uranium flex-shrink-0 mt-0.5" />}
        <div className="space-y-1 font-mono text-xs">
          <span className={`font-bold uppercase tracking-wider text-xs block ${bad ? "text-red-400" : "text-uranium"}`}>{title}</span>
          <p className="font-body text-xs text-zincGrey leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}
