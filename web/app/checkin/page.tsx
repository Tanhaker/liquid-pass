"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { CheckCircle2, ExternalLink, Loader2, QrCode, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { formatRemaining, remaining, shortAddress } from "@/lib/contract";
import {
  CHALLENGE_TTL_LABEL,
  CHALLENGE_TTL_S,
  CHECKIN_CHANNEL,
  ROTATE_S,
  decodeResponse,
  formatCountdown,
  isResponse,
  newChallenge,
  signUrl,
  verifyCheckIn,
  type Challenge,
  type CheckInResponse,
  type Verdict,
} from "@/lib/checkin";

/**
 * The venue's side of a QR check-in.
 *
 * This screen shows a challenge that changes every two minutes. The pass
 * holder scans it, their wallet signs it, and the signed answer comes back
 * here -- by the relay, by a same-browser channel, or pasted in by hand.
 * The decision is made on this page: recover who signed, then ask the
 * contract whether that wallet holds an active pass. See lib/checkin.ts.
 */

type Entry = { at: number; verdict: Verdict };

const VENUE_KEY = "liquid-pass-checkin-venue";

export default function CheckInScannerPage() {
  const [venue, setVenue] = useState("Main entrance");
  const [current, setCurrent] = useState<Challenge | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [latest, setLatest] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Refs, not state: the poller and the channel listener must see the live
  // set of challenges without being torn down and rebuilt on every rotation.
  const issued = useRef(new Map<string, Challenge>());
  const used = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const venueRef = useRef(venue);
  venueRef.current = venue;

  const rotate = useCallback(() => {
    const nowS = Date.now() / 1000;
    for (const [nonce, c] of issued.current) if (c.expires + 30 < nowS) issued.current.delete(nonce);
    const c = newChallenge(venueRef.current);
    issued.current.set(c.nonce, c);
    setCurrent(c);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(VENUE_KEY);
    if (saved) {
      setVenue(saved);
      venueRef.current = saved;
    }
    rotate();
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    const turn = setInterval(rotate, ROTATE_S * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(turn);
    };
  }, [rotate]);

  useEffect(() => {
    if (!current) return;
    const url = signUrl(window.location.origin, current);
    setLink(url);
    // Dark on white with a quiet zone. An inverted code looks better on this
    // theme and is exactly what phone cameras fail to read.
    QRCode.toDataURL(url, { margin: 2, width: 560, color: { dark: "#08090C", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [current]);

  const handle = useCallback(
    async (r: CheckInResponse, manual = false) => {
      // The same answer can arrive by more than one route; decide it once.
      // A pasted code is always answered, so re-using one says why it failed.
      if (!manual && seen.current.has(r.signature)) return;
      seen.current.add(r.signature);
      setVerifying(true);
      let verdict: Verdict;
      try {
        verdict = await verifyCheckIn(issued.current.get(r.nonce), used.current.has(r.nonce), r);
      } catch (e) {
        seen.current.delete(r.signature);
        verdict = { admit: false, reason: `Could not read the pass contract: ${(e as Error).message}`, tokenId: r.tokenId };
      }
      if (verdict.admit) {
        used.current.add(r.nonce);
        rotate();
      }
      const entry = { at: Date.now(), verdict };
      setLatest(entry);
      setHistory((h) => [entry, ...h].slice(0, 8));
      setVerifying(false);
    },
    [rotate],
  );

  // Route 1: the relay.
  useEffect(() => {
    const poll = setInterval(async () => {
      const nowS = Date.now() / 1000;
      const live = [...issued.current.values()].filter((c) => c.expires > nowS && !used.current.has(c.nonce));
      if (!live.length || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/checkin?nonces=${live.map((c) => c.nonce).join(",")}`, { cache: "no-store" });
        const body = (await res.json()) as { response: unknown };
        if (isResponse(body.response)) void handle(body.response);
      } catch {
        // The relay is a convenience. The other routes still work.
      }
    }, 1500);
    return () => clearInterval(poll);
  }, [handle]);

  // Route 2: another tab of this browser.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHECKIN_CHANNEL);
    channel.onmessage = (e) => {
      if (isResponse(e.data)) void handle(e.data);
    };
    return () => channel.close();
  }, [handle]);

  // Route 3: pasted by hand.
  function submitPasted() {
    const r = decodeResponse(pasted);
    if (!r) {
      setPasteError("That is not a check-in code. It starts with LP1.");
      return;
    }
    setPasteError(null);
    setPasted("");
    void handle(r, true);
  }

  const secondsLeft = current && now ? Math.max(0, current.expires - Math.floor(now / 1000)) : 0;
  const nextIn = current && now ? Math.max(0, ROTATE_S - (CHALLENGE_TTL_S - secondsLeft)) : 0;
  const v = latest?.verdict;

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="border-b border-dark-border pb-8">
        <Link href="/use" className="mb-4 block w-fit font-mono text-[11px] uppercase tracking-wider text-zincGrey hover:text-uranium">
          &larr; All the ways to use a pass
        </Link>
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <ScanLine className="w-3.5 h-3.5" /><span>SECURE QR CHECK-IN // VENUE SCANNER</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Check In With a Signed Code</h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          The pass holder scans this code and signs it with their wallet. Each code lasts {CHALLENGE_TTL_LABEL} and
          works once, so a screenshot cannot be reused.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4 gap-3">
            <div className="flex items-center space-x-2"><QrCode className="w-4 h-4 text-uranium" /><h3 className="font-header font-bold text-xl text-alabaster">Live Challenge</h3></div>
            <span className="font-mono text-[11px] uppercase text-zincGrey whitespace-nowrap">NEW CODE IN {formatCountdown(nextIn)}</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <label htmlFor="venue" className="text-zincGrey block uppercase">Venue or door name:</label>
            <input
              id="venue"
              type="text"
              value={venue}
              maxLength={40}
              onChange={(e) => {
                setVenue(e.target.value);
                venueRef.current = e.target.value;
                window.localStorage.setItem(VENUE_KEY, e.target.value);
              }}
              onBlur={rotate}
              className="w-full p-3 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-2 border border-dark-border shadow-grunge-uranium">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Check-in code for the pass holder to scan" width={280} height={280} className="block" />
              ) : (
                <div className="w-[280px] h-[280px] flex items-center justify-center text-black font-mono text-xs">Preparing code...</div>
              )}
            </div>
            <div className="w-full">
              <div className="h-1 bg-dark border border-dark-border overflow-hidden">
                <div className="h-full bg-uranium transition-[width] duration-500 ease-linear" style={{ width: `${(secondsLeft / CHALLENGE_TTL_S) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-zincGrey uppercase">
                <span>CODE VALID FOR {formatCountdown(secondsLeft)}</span>
                <span>CHALLENGE {current ? `${current.nonce.slice(0, 8)}...` : "-"}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-dark border border-dark-border text-[11px] font-mono text-zincGrey space-y-2">
            <div className="text-alabaster font-bold">No phone to hand?</div>
            <p>Open the holder&apos;s page in another window on this computer and sign there.</p>
            <a href={link || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-uranium hover:underline">
              <span>OPEN HOLDER PAGE</span><ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center space-x-2 border-b border-dark-border pb-4">
            <ShieldCheck className="w-4 h-4 text-uranium" /><h3 className="font-header font-bold text-xl text-alabaster">Scanner Result</h3>
          </div>

          {verifying ? (
            <div className="p-5 text-center font-mono text-xs text-zincGrey">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-uranium" />Checking the signature and the pass on Arbitrum...
            </div>
          ) : !v ? (
            <div className="p-5 border border-dark-border bg-dark font-mono text-xs text-zincGrey" aria-live="polite">
              <span className="font-bold uppercase tracking-wider text-alabaster block">WAITING FOR A SIGNED CODE</span>
              <p className="font-body text-xs leading-relaxed mt-1">Nobody has checked in yet. The result appears here as soon as a holder signs.</p>
            </div>
          ) : (
            <div className={`p-5 border transition-all ${v.admit ? "bg-dark-surface border-uranium" : "bg-dark border-red-500/50"}`} aria-live="assertive">
              <div className="flex items-start space-x-3">
                {v.admit ? <CheckCircle2 className="w-6 h-6 text-uranium flex-shrink-0 mt-0.5" /> : <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="space-y-1 font-mono text-xs flex-1 min-w-0">
                  <span className={`font-bold uppercase tracking-wider text-xs block ${v.admit ? "text-uranium" : "text-red-400"}`}>
                    {v.admit ? "ADMIT: VALID PASS, SIGNED BY ITS HOLDER" : "DO NOT ADMIT"}
                  </span>
                  <p className="font-body text-xs text-zincGrey leading-relaxed">
                    {v.admit ? "The signature matches the wallet that holds this pass, and the pass is active." : v.reason}
                  </p>
                  <div className="pt-3 border-t border-dark-border space-y-1 text-[11px]">
                    {v.admit ? (
                      <>
                        <div className="flex justify-between gap-4"><span className="text-zincGrey">Plan:</span><span className="text-alabaster font-bold text-right">{v.planName}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-zincGrey">Pass:</span><span className="text-alabaster font-bold">Token #{v.tokenId}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-zincGrey">{v.rented ? "Rented by:" : "Access holder:"}</span><span className="text-uranium font-bold">{shortAddress(v.holder)}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-zincGrey">Time left:</span><span className="text-uranium font-bold">{formatRemaining(remaining(BigInt(v.expiry), now ?? Date.now()))}</span></div>
                      </>
                    ) : (
                      <>
                        {v.tokenId && <div className="flex justify-between gap-4"><span className="text-zincGrey">Pass:</span><span className="text-alabaster font-bold">Token #{v.tokenId}</span></div>}
                        {v.signer && <div className="flex justify-between gap-4"><span className="text-zincGrey">Signed by:</span><span className="text-red-400 font-bold">{shortAddress(v.signer)}</span></div>}
                      </>
                    )}
                    <div className="flex justify-between gap-4"><span className="text-zincGrey">Checked at:</span><span className="text-zincGrey">{new Date(latest.at).toLocaleTimeString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 font-mono text-xs">
            <label htmlFor="code" className="text-zincGrey block uppercase">Or paste the holder&apos;s code:</label>
            <div className="flex space-x-2">
              <input
                id="code"
                type="text"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPasted()}
                placeholder="LP1..."
                className="flex-1 min-w-0 p-3 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
              />
              <button
                onClick={submitPasted}
                disabled={!pasted.trim() || verifying}
                className="px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium disabled:opacity-50"
              >
                CHECK
              </button>
            </div>
            {pasteError && <p className="text-[11px] text-red-400">{pasteError}</p>}
          </div>

          {history.length > 0 && (
            <div className="pt-4 border-t border-dark-border font-mono text-[11px] space-y-2">
              <div className="text-zincGrey uppercase">Recent check-ins on this scanner:</div>
              {history.map((h) => (
                <div key={h.at} className="flex justify-between gap-4">
                  <span className={h.verdict.admit ? "text-uranium font-bold" : "text-red-400 font-bold"}>
                    {h.verdict.admit ? "ADMITTED" : "REFUSED"}{h.verdict.tokenId ? ` // TOKEN #${h.verdict.tokenId}` : ""}
                  </span>
                  <span className="text-zincGrey">{new Date(h.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
