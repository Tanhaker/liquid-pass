"use client";

import { useState } from "react";
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
 * makes it legible before someone signs.
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

  return (
    <div className="mt-2 border-t border-line pt-3">
      {mode === "none" && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("gift");
              setErr(null);
            }}
            disabled={disabled}
            className="flex-1 rounded-none border border-line px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            Gift
          </button>
          <button
            onClick={() => {
              setMode("split");
              setErr(null);
            }}
            disabled={disabled}
            title={isListed ? "Unlist it first — a split burns the original" : undefined}
            className="flex-1 rounded-none border border-line px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            Split
          </button>
        </div>
      )}

      {mode === "gift" && (
        <div className="space-y-2">
          <label className="block text-[11px] text-faint" htmlFor={`g-${pass.tokenId}`}>
            Send this pass to
          </label>
          <input
            id={`g-${pass.tokenId}`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoFocus
            className="tnum w-full rounded-none border border-line bg-ink px-3 py-2 text-[12px] outline-none focus:border-line-bright"
          />
          <p className="text-[10px] text-faint">
            They receive {formatRemaining(left)} of access. Any listing is
            cleared — the new owner didn&rsquo;t set that price.
          </p>
          {err && <p className="text-[11px] text-life-crit">{err}</p>}
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
              className="flex-1 rounded-none bg-text px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-40"
            >
              {busy ? "Confirm…" : "Send"}
            </button>
            <button
              onClick={() => setMode("none")}
              className="rounded-none border border-line px-3 py-1.5 text-[11px] text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "split" && (
        <div className="space-y-2">
          <label className="block text-[11px] text-faint" htmlFor={`s-${pass.tokenId}`}>
            Split into how many?
          </label>
          <input
            id={`s-${pass.tokenId}`}
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            inputMode="numeric"
            autoFocus
            className="tnum w-full rounded-none border border-line bg-ink px-3 py-2 text-[12px] outline-none focus:border-line-bright"
          />
          <p className="text-[10px] leading-relaxed text-faint">
            {formatRemaining(left)} becomes {Number.isFinite(n) ? n : "—"}{" "}
            <span className="text-muted">consecutive</span> passes of about{" "}
            {sliceSeconds > 0 ? formatRemaining(sliceSeconds) : "—"} each — one
            after another, not all at once. Only the first is usable today; the
            rest activate when their turn comes. This pass is burned.
          </p>
          {isListed && (
            <p className="text-[11px] text-life-low">
              Remove the listing first — splitting burns the original.
            </p>
          )}
          {err && <p className="text-[11px] text-life-crit">{err}</p>}
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
              className="flex-1 rounded-none bg-text px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-40"
            >
              {busy ? "Confirm…" : `Split into ${Number.isFinite(n) ? n : "?"}`}
            </button>
            <button
              onClick={() => setMode("none")}
              className="rounded-none border border-line px-3 py-1.5 text-[11px] text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {void plan}
    </div>
  );
}
