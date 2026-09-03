"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

/**
 * Shared pieces across market / dashboard / issuer.
 *
 * Small on purpose. shadcn/ui was in the planned stack, but every component
 * here is a div with a border, and pulling in a registry plus its Radix
 * dependencies to render four of them would cost more time than it saves.
 */

export function Banner({
  tone,
  children,
}: {
  tone: "warn" | "error" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    warn: "border-life-low/30 bg-life-low/10 text-life-low",
    error: "border-life-crit/30 bg-life-crit/10 text-life-crit",
    ok: "border-life-full/30 bg-life-full/10 text-life-full",
  }[tone];
  return (
    <div className={`mt-6 rounded-none border px-4 py-3 text-[13px] ${styles}`} role="status">
      {children}
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-10 rounded-none border border-dashed border-line px-6 py-20 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">{body}</p>
      {action}
    </div>
  );
}

export function SkeletonGrid({ n = 3 }: { n?: number }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-none border border-line bg-surface"
        />
      ))}
    </div>
  );
}

/**
 * Fee cap with 4x headroom over the live base fee.
 *
 * Arbitrum Sepolia's base fee moves between the moment the wallet builds a
 * transaction and the moment the sequencer sees it. MetaMask's default cap sits
 * too close, and the node's rejection surfaces through viem as "the contract
 * function reverted" -- pointing at the contract rather than the fee, which
 * sends you debugging the wrong thing. Overpaying the cap is free: you are
 * charged the actual base fee plus tip.
 */
export function useFees() {
  const client = usePublicClient();
  return useCallback(async () => {
    if (!client) return {};
    try {
      const block = await client.getBlock();
      const base = block.baseFeePerGas ?? 100_000_000n;
      // A max fee is a CEILING, not a charge: you are billed the real base fee
      // plus the tip, so headroom is free. 4x plus a 1 gwei floor covers the
      // base fee moving between the wallet building the transaction and the
      // sequencer seeing it.
      //
      // This used to return {} so MetaMask would estimate natively. MetaMask's
      // Arbitrum estimate goes stale and gets submitted below the current base
      // fee, which the node rejects with "max fee per gas less than block base
      // fee" -- every write failing, with nothing wrong on chain. Supplying the
      // cap ourselves takes its cache out of the loop.
      return {
        maxFeePerGas: base * 4n + 1_000_000_000n,
        maxPriorityFeePerGas: 10_000_000n,
      };
    } catch {
      // No fee override beats a wrong one: fall back to the wallet.
      return {};
    }
  }, [client]);
}

/**
 * Contract reverts as sentences a non-technical judge can read.
 * The raw error still reaches the console for debugging.
 */
type Viemish = Error & {
  shortMessage?: string;
  details?: string;
  walk?: (fn: (err: unknown) => boolean) => unknown;
};

type Revertedish = {
  reason?: string;
  shortMessage?: string;
  data?: { errorName?: string };
};

/**
 * Contract failures as sentences, without losing the reason.
 *
 * The reason lives two levels down and viem formats it across two lines:
 *
 *   The contract function "list" reverted with the following reason:
 *   <the actual reason>
 *
 * This used to end in `raw.split("\n")[0]`, which kept the label and threw
 * away the only part worth reading -- so every single failure rendered as a
 * sentence ending in a colon and nothing after it, and all of them looked
 * identical no matter what actually went wrong.
 *
 * So: walk the cause chain for the decoded revert first, fall back to the
 * node's own complaint in `details` (out of gas, nonce, fee cap -- none of
 * which are contract reverts), and never drop a line.
 */
export function humanise(e: Error): string {
  const err = e as Viemish;
  console.error(e);

  let reason = "";
  try {
    const reverted = err.walk?.(
      (x) => (x as { name?: string } | null)?.name === "ContractFunctionRevertedError",
    ) as Revertedish | undefined;
    if (reverted) {
      reason = reverted.reason ?? reverted.data?.errorName ?? reverted.shortMessage ?? "";
    }
  } catch {
    // Older viem, or a non-viem error. The fallbacks below still apply.
  }

  const surface = err.shortMessage ?? err.message ?? "Transaction failed";
  const haystack = [surface, reason, err.details].filter(Boolean).join(" ");

  if (/User rejected|denied/i.test(haystack)) return "You rejected the transaction in MetaMask.";
  if (/insufficient funds/i.test(haystack)) return "Not enough ETH in your wallet to cover gas and price.";
  if (/out of gas|gas required exceeds/i.test(haystack))
    return "The transaction ran out of gas. The hard-coded gas limit is too low for this call.";
  if (/nonce too low|already known|replacement transaction/i.test(haystack))
    return "A pending transaction is blocking this one. Wait for it, or reset the account nonce in MetaMask.";
  if (/max fee per gas less than block base fee|fee cap/i.test(haystack))
    return "Your wallet's max fee is below the current base fee. Raise it, or let MetaMask estimate.";
  if (/not listed/i.test(haystack)) return "That pass is no longer for sale.";
  if (/expired/i.test(haystack)) return "That pass has expired and can no longer be traded.";
  if (/plan closed/i.test(haystack)) return "The issuer has closed this plan to new sales.";
  if (/wrong value/i.test(haystack)) return "The price changed. Refresh and try again.";
  if (/already owner/i.test(haystack)) return "You already own this pass.";
  if (/not owner/i.test(haystack)) return "You don't own that pass.";
  if (/not an issuer/i.test(haystack))
    return "This address isn't on the issuer allowlist. The contract admin has to add it.";

  // Every line, joined -- never just the first.
  const full = surface.split("\n").map((l) => l.trim()).filter(Boolean).join(" — ");
  const extra = reason && !full.includes(reason) ? ` (${reason})` : "";
  const node = err.details && !full.includes(err.details) ? ` [${err.details}]` : "";
  return `${full}${extra}${node}`;
}

/**
 * A clock that is safe to render.
 *
 * `Date.now()` called during render is impure: these pages are statically
 * prerendered, so the build-time value ships in the HTML and disagrees with
 * the client on hydration. Returning null until mounted makes the first client
 * render match the server exactly, and the time appears a frame later.
 *
 * The initial read is deferred to a timeout rather than called straight in the
 * effect body, so it arrives as an external-system update rather than a
 * synchronous cascade.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
