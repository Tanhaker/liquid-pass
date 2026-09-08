"use client";

import { useState } from "react";
import { Gift, Scissors } from "lucide-react";
import { formatRemaining, remaining, type Pass, type Plan } from "@/lib/contract";

/**
 * Gift and split, on a pass you own.
 *
 * Both are owner-only, unpaid contract calls, so neither needs a price or a
 * buyer -- which is why they sit apart from the listing controls.
 *
 * The split copy is careful to say the slices are SEQUENTIAL. A judge asked
 * "so I get twelve passes at once?" would otherwise reasonably assume yes, and
 * the answer matters: parallel slices would be twelve times the access minted
 * from nothing. The contract enforces it via a per-pass start time; this just
 * makes it legible before someone signs -- now with a segmented preview, so
 * the shape of the answer is visible before the sentence is read.
 *
 * STYLING: this was written against the earlier "premium fintech" token set
 * (line / ink / muted / faint) and then mounted inside the dashboard, which is
 * entirely grunge tokens (dark-border / dark-card / alabaster / zincGrey /
 * uranium). It read as a foreign component bolted onto the card. It now uses
 * the same language as the card that contains it: mono uppercase labels,
 * squared borders, uranium for the committing action.
 */
export function GiftSplit({
  pass,
  plan,
  nowMs,
  busy,
  disabled,
  onGift,
  onSplit,
}: {
  pass: Pass;
  plan?: Plan;
  nowMs: number | null;
  busy: boolean;
  disabled: boolean;
  onGift: (to: `0x${string}`) => void;
  onSplit: (parts: bigint) => void;
}) {
  const [mode, setMode] = useState<"none" | "gift" | "split">("none");
  const [to, setTo] = useState("");
  const [parts, setParts] = useState("4");
  const [err, setErr] = useState<string | null>(null);

  const left = remaining(pass.expiry, nowMs ?? Number(pass.expiry) * 1000);
  const isListed = pass.listed > 0n;
  const expired = left <= 0;
  if (expired) return null;

  const n = Number(parts);
  const sliceSeconds = Number.isFinite(n) && n >= 2 ? Math.floor(left / n) : 0;
  const validParts = Number.isInteger(n) && n >= 2 && n <= 24;

  const inputClass =
    "w-full p-2.5 bg-dark border border-dark-border text-alabaster font-mono text-xs focus:border-uranium focus:outline-none";
  const labelClass =
    "block font-mono text-[10px] uppercase tracking-wider text-zincGrey";
  const commitClass =
    "flex-1 py-2 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-40";
  const cancelClass =
    "px-4 py-2 bg-dark border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase transition-all";

  return (
    <div className="mt-3 border-t border-dashed border-dark-border pt-3">
      {mode === "none" && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("gift");
              setErr(null);
            }}
            disabled={disabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-dark hover:bg-dark-surface border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase transition-all disabled:opacity-40"
          >
            <Gift className="h-3.5 w-3.5" />
            Gift
          </button>
          <button
            onClick={() => {
              setMode("split");
              setErr(null);
            }}
            disabled={disabled}
            title={isListed ? "Unlist it first — a split burns the original" : undefined}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-dark hover:bg-dark-surface border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase transition-all disabled:opacity-40"
          >
            <Scissors className="h-3.5 w-3.5" />
            Split
          </button>
        </div>
      )}

      {mode === "gift" && (
        <div className="space-y-2.5">
          <label className={labelClass} htmlFor={`g-${pass.tokenId}`}>
            Send this pass to
          </label>
          <input
            id={`g-${pass.tokenId}`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoFocus
            className={inputClass}
          />
          <p className="font-body text-[11px] leading-relaxed text-zincGrey">
            They receive{" "}
            <span className="font-mono text-uranium">{formatRemaining(left)}</span> of
            access. Any listing is cleared &mdash; the new owner didn&rsquo;t set that
            price.
          </p>
          {err && <p className="font-mono text-[11px] text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const a = to.trim();
                if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
                  setErr("That doesn't look like an address.");
                  return;
                }
                setErr(null);
                setMode("none");
                onGift(a as `0x${string}`);
              }}
              disabled={busy || disabled}
              className={commitClass}
            >
              {busy ? "Confirm…" : "Send"}
            </button>
            <button onClick={() => setMode("none")} className={cancelClass}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "split" && (
        <div className="space-y-2.5">
          <label className={labelClass} htmlFor={`s-${pass.tokenId}`}>
            Split into how many?
          </label>
          <input
            id={`s-${pass.tokenId}`}
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            inputMode="numeric"
            autoFocus
            className={inputClass}
          />

          {/*
            Segmented preview. The whole risk with split() is someone reading
            it as N passes usable at once, which would be N times the access
            minted out of nothing. Showing the slices end to end -- with only
            the first lit -- says "one after another" faster than the sentence
            below it can.
          */}
          {validParts && sliceSeconds > 0 && (
            <div>
              <div className="flex h-2 w-full gap-px overflow-hidden border border-dark-border bg-dark">
                {Array.from({ length: Math.min(n, 24) }, (_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 ${
                      i === 0 ? "bg-uranium" : "bg-uranium/25"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider">
                <span className="text-uranium">usable now</span>
                <span className="text-zincGrey">then in turn &rarr;</span>
              </div>
            </div>
          )}

          <p className="font-body text-[11px] leading-relaxed text-zincGrey">
            <span className="font-mono text-alabaster">{formatRemaining(left)}</span>{" "}
            becomes{" "}
            <span className="font-mono text-alabaster">
              {Number.isFinite(n) ? n : "—"}
            </span>{" "}
            <span className="text-aviation">consecutive</span> passes of about{" "}
            <span className="font-mono text-alabaster">
              {sliceSeconds > 0 ? formatRemaining(sliceSeconds) : "—"}
            </span>{" "}
            each &mdash; one after another, not all at once. Only the first is usable
            today; the rest activate when their turn comes. This pass is burned.
          </p>

          {isListed && (
            <p className="border border-aviation bg-aviation/10 p-2 font-mono text-[11px] text-aviation">
              Remove the listing first &mdash; splitting burns the original.
            </p>
          )}
          {err && <p className="font-mono text-[11px] text-red-400">{err}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!Number.isInteger(n) || n < 2 || n > 24) {
                  setErr("Between 2 and 24.");
                  return;
                }
                if (sliceSeconds < 60) {
                  setErr("Not enough time left to split that many ways.");
                  return;
                }
                setErr(null);
                setMode("none");
                onSplit(BigInt(n));
              }}
              disabled={busy || disabled || isListed}
              className={commitClass}
            >
              {busy ? "Confirm…" : `Split into ${Number.isFinite(n) ? n : "?"}`}
            </button>
            <button onClick={() => setMode("none")} className={cancelClass}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {void plan}
    </div>
  );
}
