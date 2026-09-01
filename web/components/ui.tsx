"use client";

import { useCallback } from "react";
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
    <div className={`mt-6 rounded-xl border px-4 py-3 text-[13px] ${styles}`} role="status">
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
    <div className="mt-10 rounded-2xl border border-dashed border-line px-6 py-20 text-center">
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
          className="h-64 animate-pulse rounded-2xl border border-line bg-surface"
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
    const block = await client.getBlock();
    const base = block.baseFeePerGas ?? 100_000_000n;
    return {
      maxFeePerGas: base * 4n + 1_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
    };
  }, [client]);
}

/**
 * Contract reverts as sentences a non-technical judge can read.
 * The raw error still reaches the console for debugging.
 */
export function humanise(e: Error): string {
  const raw = (e as Error & { shortMessage?: string }).shortMessage ?? e.message;
  console.error(e);
  if (/User rejected|denied/i.test(raw)) return "You rejected the transaction.";
  if (/not listed/i.test(raw)) return "That pass is no longer for sale.";
  if (/expired/i.test(raw)) return "That pass has expired and can no longer be traded.";
  if (/plan closed/i.test(raw)) return "The issuer has closed this plan to new sales.";
  if (/wrong value/i.test(raw)) return "The price changed. Refresh and try again.";
  if (/already owner/i.test(raw)) return "You already own this pass.";
  if (/not owner/i.test(raw)) return "You don't own that pass.";
  if (/not an issuer/i.test(raw))
    return "This address isn't on the issuer allowlist. The contract admin has to add it.";
  if (/not plan issuer/i.test(raw)) return "Only the issuer who created this plan can change it.";
  if (/zero price/i.test(raw)) return "Price must be above zero.";
  if (/zero duration/i.test(raw)) return "Duration must be above zero.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH for the price plus gas.";
  return raw.split("\n")[0];
}
