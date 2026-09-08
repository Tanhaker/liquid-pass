"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { Layers, ExternalLink } from "lucide-react";
import { LIQUID_PASS_ADDRESS, liquidPassAbi, type Pass, type Plan } from "@/lib/contract";
import { humanise, useFees } from "@/components/ui";
import { useTxToast } from "@/lib/useTxToast";

/**
 * Merge several passes on one plan into a single longer pass.
 *
 * Calls bundle() on the Stylus contract, which burns the inputs and mints one
 * token carrying their combined remaining time and paid value.
 *
 * Three things were wrong here beyond the styling, all found when this was
 * finally mounted on a page:
 *
 *  - No gas limit and no fee overrides. Every other write path in this app
 *    goes through useFees(), because the public Arbitrum Sepolia RPC returns a
 *    base fee that wallets routinely under-quote -- that is what produced
 *    "max fee per gas less than block base fee" before. bundle() writes a full
 *    set of storage slots per input token, so it also needs real headroom.
 *  - Failures went to console.error only, so a rejected or reverted bundle
 *    looked to the user like a button that did nothing.
 *  - The success link read "Bundled 3 passes! â†—" -- mojibake from a UTF-8
 *    arrow written through a mismatched encoding.
 */
export function PassBundler({
  passes,
  plans,
  onDone,
}: {
  passes: Pass[];
  plans: Map<string, Plan>;
  onDone?: () => void;
}) {
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const txToast = useTxToast();
  const [selected, setSelected] = useState<Set<bigint>>(new Set());
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group by plan, keeping only plans where more than one unlisted active pass
  // is held -- bundling needs at least two, and a listed pass must be unlisted
  // first since bundling burns it.
  const bundlesAvailable = Array.from(plans.values())
    .map((plan) => {
      const owned = passes.filter(
        (p) => p.planId === plan.id && p.active && p.listed === 0n,
      );
      return { plan, passes: owned };
    })
    .filter((group) => group.passes.length > 1);

  const toggle = (tokenId: bigint) => {
    const next = new Set(selected);
    if (next.has(tokenId)) next.delete(tokenId);
    else next.add(tokenId);
    setSelected(next);
  };

  const handleBundle = async (planId: bigint) => {
    const tokenIds = passes
      .filter((p) => p.planId === planId && selected.has(p.tokenId))
      .map((p) => p.tokenId);
    if (tokenIds.length < 2) return;

    setBusy(true);
    setTx(null);
    setError(null);
    try {
      const hash = await txToast(
        `Bundled ${tokenIds.length} passes`,
        async () =>
          writeContractAsync({
            address: LIQUID_PASS_ADDRESS,
            abi: liquidPassAbi,
            functionName: "bundle",
            args: [tokenIds],
            chainId: arbitrumSepolia.id,
            // Scales with the number of inputs: each one is read, burned, and
            // folded into the new token's expiry and paid value.
            gas: 1_000_000n + 600_000n * BigInt(tokenIds.length),
            ...(await fees()),
          }),
      );
      setTx({
        hash,
        what: `Bundled ${tokenIds.length} passes into one`,
      });
      setSelected(new Set());
      onDone?.();
    } catch (err) {
      setError(humanise(err as Error));
    } finally {
      setBusy(false);
    }
  };

  if (bundlesAvailable.length === 0) return null;

  return (
    <div className="space-y-6 border border-dark-border bg-dark-card p-8 shadow-grunge">
      <div className="flex flex-col gap-2 border-b border-dark-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-uranium">
            <Layers className="h-4 w-4" />
            <span>Bundle passes</span>
          </div>
          <h3 className="mt-1 font-header text-2xl font-bold text-alabaster">
            Merge shorter passes into one
          </h3>
        </div>
        <span className="font-mono text-[11px] text-zincGrey">
          Executes Stylus: <code>bundle(uint256[])</code>
        </span>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-500/10 p-3 font-mono text-[11px] text-red-400">
          {error}
        </div>
      )}

      {tx && (
        <a
          href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 border border-uranium bg-uranium/10 p-3 font-mono text-[11px] text-uranium hover:bg-uranium/20"
        >
          {tx.what}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <p className="max-w-2xl font-body text-[13px] leading-relaxed text-zincGrey">
        Pick two or more passes on the same plan. Their remaining time and paid
        value combine into one new token, and the originals are burned. A listed
        pass has to be unlisted first.
      </p>

      <div className="space-y-6">
        {bundlesAvailable.map(({ plan, passes: groupPasses }) => {
          const selectedInGroup = groupPasses.filter((p) => selected.has(p.tokenId));

          return (
            <div key={plan.id.toString()} className="border border-dark-border bg-dark p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-header text-lg font-bold text-alabaster">
                  {plan.name || `Plan #${plan.id}`}
                  <span className="ml-2 font-mono text-[11px] font-normal text-zincGrey">
                    {groupPasses.length} held
                  </span>
                </h4>
                <button
                  onClick={() => handleBundle(plan.id)}
                  disabled={selectedInGroup.length < 2 || busy}
                  className="bg-uranium px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy
                    ? "Confirm…"
                    : selectedInGroup.length < 2
                      ? "Select 2 or more"
                      : `Bundle ${selectedInGroup.length}`}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {groupPasses.map((p) => {
                  const on = selected.has(p.tokenId);
                  return (
                    <label
                      key={p.tokenId.toString()}
                      className={`flex cursor-pointer items-center justify-between border p-3 font-mono text-xs transition-all ${
                        on
                          ? "border-uranium bg-uranium/10 text-uranium"
                          : "border-dark-border bg-dark-surface text-zincGrey hover:border-uranium hover:text-alabaster"
                      }`}
                    >
                      <span className="font-bold">
                        #{p.tokenId.toString().padStart(4, "0")}
                      </span>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(p.tokenId)}
                        className="accent-uranium"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
