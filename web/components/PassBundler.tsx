"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { LIQUID_PASS_ADDRESS, liquidPassAbi, type Pass, type Plan } from "@/lib/contract";

export function PassBundler({ passes, plans }: { passes: Pass[]; plans: Map<string, Plan> }) {
  const { writeContractAsync } = useWriteContract();
  const [selected, setSelected] = useState<Set<bigint>>(new Set());
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  // Group passes by planId, only include plans where the user owns > 1 active pass
  const bundlesAvailable = Array.from(plans.values()).map(plan => {
    const owned = passes.filter(p => p.planId === plan.id && p.active && p.listed === 0n);
    return { plan, passes: owned };
  }).filter(group => group.passes.length > 1);

  const toggle = (tokenId: bigint) => {
    const next = new Set(selected);
    if (next.has(tokenId)) next.delete(tokenId);
    else next.add(tokenId);
    setSelected(next);
  };

  const handleBundle = async (planId: bigint) => {
    const tokenIds = passes.filter(p => p.planId === planId && selected.has(p.tokenId)).map(p => p.tokenId);
    if (tokenIds.length < 2) return;

    setBusy(true);
    setTx(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "bundle",
        args: [tokenIds],
        chainId: arbitrumSepolia.id,
      });
      setTx({ hash, what: `Bundled ${tokenIds.length} passes!` });
      // Reset selection after tx
      setSelected(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (bundlesAvailable.length === 0) return null;

  return (
    <section className="mt-12 rounded-none border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-none bg-life-mid/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-life-mid">
            Feature
          </span>
          <h2 className="text-[15px] font-medium">Bundle Passes</h2>
        </div>
        {tx && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-life-mid hover:underline"
          >
            {tx.what} â†—
          </a>
        )}
      </div>
      
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Select multiple passes from the same plan to merge them into a single pass. 
        The time remaining and intrinsic value will be combined into a brand new token.
      </p>

      <div className="mt-6 space-y-6">
        {bundlesAvailable.map(({ plan, passes: groupPasses }) => {
          const selectedInGroup = groupPasses.filter(p => selected.has(p.tokenId));
          
          return (
            <div key={plan.id.toString()} className="rounded-none border border-line bg-ink p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-medium text-text">{plan.name} Passes</h3>
                <button
                  onClick={() => handleBundle(plan.id)}
                  disabled={selectedInGroup.length < 2 || busy}
                  className="rounded-none bg-white px-4 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Bundling..." : `Bundle ${selectedInGroup.length} Passes`}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {groupPasses.map(p => (
                  <label 
                    key={p.tokenId.toString()} 
                    className={`flex cursor-pointer items-center justify-between rounded-none border p-3 transition-colors ${
                      selected.has(p.tokenId) ? "border-life-mid bg-life-mid/5" : "border-line bg-surface hover:bg-line/50"
                    }`}
                  >
                    <span className="text-[12px] text-text font-medium">Pass #{p.tokenId.toString()}</span>
                    <input 
                      type="checkbox" 
                      checked={selected.has(p.tokenId)}
                      onChange={() => toggle(p.tokenId)}
                      className="accent-[var(--color-life-mid)]"
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
