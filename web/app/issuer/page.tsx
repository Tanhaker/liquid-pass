"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { parseEther } from "viem";
import { Building2, PlusCircle, Loader2 } from "lucide-react";
import {
  LIQUID_PASS_ADDRESS, EXPLORER, liquidPassAbi,
  shortAddress, formatEthShort, type Plan,
} from "@/lib/contract";
import { fetchPlans } from "@/lib/data";
import { Banner, humanise, useFees } from "@/components/ui";

export default function IssuerPage() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  const [planName, setPlanName] = useState("Claude Pro");
  const [planPrice, setPlanPrice] = useState("0.002");
  const [planDays, setPlanDays] = useState(30);

  const load = useCallback(async () => {
    try { const pl = await fetchPlans(); setPlans(pl); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || wrongNetwork) return;
    setBusy(true); setTx(null); setError(null);
    try {
      let uri = "";
      try {
        const res = await fetch("/api/ipfs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: planName, description: `${planName} subscription pass`, durationDays: planDays, issuer: address }),
        });
        if (res.ok) { const json = await res.json(); uri = `ipfs://${json.cid}`; }
      } catch { /* IPFS optional */ }

      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "createPlan",
        args: [planName, uri, parseEther(planPrice), BigInt(planDays * 86400)],
        chainId: arbitrumSepolia.id, ...(await fees()),
      });
      setTx({ hash, what: `Created plan "${planName}"` });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) { setError(humanise(e as Error)); } finally { setBusy(false); }
  };

  const handleTogglePlan = async (plan: Plan) => {
    if (!isConnected || wrongNetwork) return;
    setBusy(true); setTx(null); setError(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "setPlanOpen",
        args: [plan.id, !plan.open], chainId: arbitrumSepolia.id, ...(await fees()),
      });
      setTx({ hash, what: `${plan.open ? "Closed" : "Opened"} plan "${plan.name}"` });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) { setError(humanise(e as Error)); } finally { setBusy(false); }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {error && <Banner tone="error">{error}</Banner>}
      {tx && (
        <Banner tone="ok">
          {tx.what} —{" "}
          <a className="underline underline-offset-2" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">view on Arbiscan</a>
        </Banner>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Building2 className="w-3.5 h-3.5" /><span>SAAS ISSUER PORTAL</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Issuer Console &amp; Plans</h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Create subscription plans on-chain and earn an immutable 10% royalty on every secondary market transaction.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-zincGrey">
            <span>ISSUER ADDRESS:</span>
            <span className="text-uranium font-bold">{address ? shortAddress(address) : "Not connected"}</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>TOTAL PLANS:</span><span className="text-alabaster font-bold">{plans.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">Create New Subscription Plan</h3>
            <span className="font-mono text-xs text-uranium">STYLUS: createPlan()</span>
          </div>
          <form onSubmit={handleCreatePlan} className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-zincGrey block mb-1.5 uppercase">Plan Name:</label>
              <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} required
                className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
                placeholder="e.g. Claude Pro, Figma Team" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-zincGrey block mb-1.5 uppercase">Duration (Days):</label>
                <select value={planDays} onChange={(e) => setPlanDays(parseInt(e.target.value))}
                  className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none">
                  <option value={7}>7 Days (Sprint)</option><option value={14}>14 Days</option>
                  <option value={30}>30 Days (Monthly)</option><option value={60}>60 Days</option><option value={90}>90 Days</option>
                </select>
              </div>
              <div>
                <label className="text-zincGrey block mb-1.5 uppercase">Price (ETH):</label>
                <input type="number" step="0.0005" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} required
                  className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none" />
              </div>
            </div>
            <div className="p-3 bg-dark border border-dark-border text-[11px] text-zincGrey space-y-1">
              <div className="flex justify-between text-alabaster"><span>Secondary Resale Royalty:</span><span className="text-periwinkle font-bold">10% of every sale</span></div>
              <p>Metadata will be automatically pinned to IPFS via Pinata.</p>
            </div>
            <button type="submit" disabled={busy || !isConnected || wrongNetwork}
              className="w-full py-3.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-grunge-uranium disabled:opacity-40">
              <PlusCircle className="w-4 h-4 text-black" />
              <span>{busy ? "CONFIRM IN METAMASK..." : "CREATE PLAN ON-CHAIN"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h3 className="font-header font-bold text-xl text-alabaster">Live On-Chain Plans</h3>
            <span className="font-mono text-xs text-zincGrey">{plans.length} PLANS</span>
          </div>
          {loading ? (
            <div className="p-8 text-center font-mono text-xs text-zincGrey">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-uranium" />Reading plans from Stylus contract...
            </div>
          ) : plans.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-zincGrey">No plans created yet. Be the first issuer!</div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {plans.map((plan) => (
                <div key={plan.id.toString()} className="p-4 bg-dark border border-dark-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-alabaster text-sm">{plan.name || `Plan #${plan.id}`}</span>
                      <span className={`px-1.5 py-0.5 border text-[10px] ${plan.open ? "bg-uranium/10 border-uranium text-uranium" : "bg-dark border-dark-border text-zincGrey"}`}>
                        {plan.open ? "OPEN" : "CLOSED"}
                      </span>
                    </div>
                    <span className="text-uranium font-bold">{formatEthShort(plan.price)} ETH</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zincGrey pt-1 border-t border-dark-border/60">
                    <div><span>Duration: </span><span className="text-alabaster font-bold">{Math.round(Number(plan.duration) / 86400)} days</span></div>
                    <div><span>Issuer: </span><span className="text-alabaster">{shortAddress(plan.issuer)}</span></div>
                  </div>
                  {address && plan.issuer.toLowerCase() === address.toLowerCase() && (
                    <button onClick={() => handleTogglePlan(plan)} disabled={busy || wrongNetwork}
                      className="mt-1 w-full py-1.5 text-center bg-dark-surface border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase disabled:opacity-40">
                      {plan.open ? "Close Plan" : "Re-open Plan"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
