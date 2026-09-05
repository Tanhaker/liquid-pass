"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { parseEther, formatEther, isAddress } from "viem";
import Link from "next/link";
import {
  Wallet,
  PlusCircle,
  Loader2,
} from "lucide-react";
import {
  ESCROW_ADDRESS,
  LIQUID_PASS_ADDRESS,
  MARKETPLACE_ADDRESS,
  liquidPassAbi,
  marketplaceAbi,
  shortAddress,
  remaining,
  lifeFraction,
  formatRemaining,
  formatEthShort,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchPasses, fetchPlans, passesOf } from "@/lib/data";
import { Banner, humanise, useFees, useNow } from "@/components/ui";
import { GiftSplit } from "@/components/GiftSplit";
import { YieldDashboard } from "@/components/YieldDashboard";
import { PassBundler } from "@/components/PassBundler";
import { AutoSell } from "@/components/AutoSell";

export default function DashboardPage() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const nowMs = useNow();
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  const [passes, setPasses] = useState<Pass[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);
  const [mintDuration, setMintDuration] = useState<number>(2592000);
  const [isMinting, setIsMinting] = useState(false);
  // Which pass is mid-transaction. Per-token rather than a single `busy` flag
  // so one pending gift does not grey out the controls on every other card.
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, pl] = await Promise.all([fetchPasses(), fetchPlans()]);
      setPasses(p);
      setPlans(pl);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const planFor = (p: Pass) => plans.find((pl) => pl.id === p.planId);
  // PassBundler and AutoSell both index plans by id string.
  const plansMap = useMemo(
    () => new Map(plans.map((pl) => [pl.id.toString(), pl])),
    [plans],
  );
  const myPasses = passesOf(passes, address);
  const myListings = myPasses.filter((p) => p.listed > 0n && p.active);

  const handleBuyFromPlan = async (plan: Plan) => {
    if (!isConnected || wrongNetwork) return;
    setBusy(true); setTx(null); setError(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "buyPass",
        args: [plan.id], value: plan.price, chainId: arbitrumSepolia.id,
        gas: 800_000n,
        ...(await fees()),
      });
      setTx({ hash, what: `Bought pass from plan "${plan.name}"` });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) { setError(humanise(e as Error)); } finally { setBusy(false); }
  };

  /**
   * The three owner-only actions that had UI built for them but no page to
   * live on: gift, split and list. All three follow the same shape as the
   * handlers above -- explicit gas, fees from useFees(), receipt awaited, then
   * reload -- so a reader does not have to hold two patterns in their head.
   */
  const runOwnerAction = useCallback(
    async (tokenId: bigint, what: string, send: () => Promise<`0x${string}`>) => {
      if (!isConnected || wrongNetwork) return;
      setBusyToken(tokenId.toString());
      setTx(null);
      setError(null);
      try {
        const hash = await send();
        setTx({ hash, what });
        await client?.waitForTransactionReceipt({ hash });
        await load();
      } catch (e) {
        setError(humanise(e as Error));
      } finally {
        setBusyToken(null);
      }
    },
    [client, isConnected, load, wrongNetwork],
  );

  const handleGift = (tokenId: bigint, to: `0x${string}`) =>
    runOwnerAction(tokenId, `Gifted pass #${tokenId} to ${shortAddress(to)}`, async () =>
      writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "transferPass",
        args: [to, tokenId],
        chainId: arbitrumSepolia.id,
        gas: 800_000n,
        ...(await fees()),
      }),
    );

  const handleSplit = (tokenId: bigint, parts: bigint) =>
    runOwnerAction(tokenId, `Split pass #${tokenId} into ${parts} consecutive passes`, async () =>
      writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "split",
        args: [tokenId, parts],
        chainId: arbitrumSepolia.id,
        // Splitting writes a full set of storage slots per slice, so this
        // needs materially more headroom than a transfer.
        gas: 3_000_000n,
        ...(await fees()),
      }),
    );

  const handleList = (tokenId: bigint, price: bigint) =>
    runOwnerAction(tokenId, `Listed pass #${tokenId}`, async () =>
      writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "list",
        args: [tokenId, price],
        chainId: arbitrumSepolia.id,
        gas: 800_000n,
        ...(await fees()),
      }),
    );

  const handleMint = async () => {
    if (!isConnected || !address || wrongNetwork) return;
    setIsMinting(true); setTx(null); setError(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "mint",
        args: [address, BigInt(mintDuration)], chainId: arbitrumSepolia.id,
        gas: 800_000n,
        ...(await fees()),
      });
      setTx({ hash, what: "Minted a new pass" });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) { setError(humanise(e as Error)); } finally { setIsMinting(false); }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {error && <Banner tone="error">{error}</Banner>}
      {tx && (
        <Banner tone="ok">
          {tx.what} —{" "}
          <a className="underline underline-offset-2" href={`https://sepolia.arbiscan.io/tx/${tx.hash}`} target="_blank" rel="noreferrer">
            view on Arbiscan
          </a>
        </Banner>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-uranium/10 border border-uranium text-uranium font-mono text-xs font-bold uppercase mb-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>SOVEREIGN PASS VAULT</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            My Passes &amp; Vault
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Inspect your active software credentials, verify remaining time on-chain, and list unneeded access for secondary resale.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-zincGrey">
            <span>CONNECTED WALLET:</span>
            <span className="text-uranium font-bold">{address ? shortAddress(address) : "Not connected"}</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>HELD PASSES:</span>
            <span className="text-alabaster font-bold">{myPasses.length} Active</span>
          </div>
          <div className="flex items-center justify-between text-zincGrey">
            <span>MARKET LISTINGS:</span>
            <span className="text-aviation font-bold">{myListings.length} Offered</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-uranium" />
          Reading your passes from Arbitrum Stylus...
        </div>
      ) : (
        <>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-header font-bold text-2xl text-alabaster">MY ACTIVE PASSES ({myPasses.length})</h2>
              <span className="font-mono text-xs text-zincGrey">Time-bound credentials granting live access</span>
            </div>

            {myPasses.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-dark-border bg-dark-card font-mono text-xs text-zincGrey space-y-4">
                <p>You do not currently hold any active LiquidPasses in your vault.</p>
                <Link href="/market" className="inline-block px-4 py-2 bg-uranium text-black font-extrabold uppercase">
                  Browse Resale Marketplace →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myPasses.map((pass) => {
                  const plan = planFor(pass);
                  const left = remaining(pass.expiry, nowMs ?? Date.now());
                  const fraction = lifeFraction(pass.expiry, plan?.duration ?? 0n);
                  return (
                    <div key={pass.tokenId.toString()} className="p-5 bg-dark-card border border-dark-border shadow-grunge space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[10px] text-zincGrey">TOKEN #{pass.tokenId.toString().padStart(4, "0")}</span>
                          <h3 className="font-header font-bold text-lg text-alabaster">{plan?.name || `Pass #${pass.tokenId}`}</h3>
                        </div>
                        <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                          pass.active ? (pass.listed > 0n ? "bg-aviation/10 border-aviation text-aviation" : "bg-uranium/10 border-uranium text-uranium") : "bg-dark border-dark-border text-zincGrey"
                        }`}>{pass.active ? (pass.listed > 0n ? "LISTED" : "ACTIVE") : "EXPIRED"}</span>
                      </div>
                      <div className="font-mono text-xs space-y-1">
                        <div className="flex justify-between text-zincGrey"><span>TIME REMAINING:</span><span className="text-uranium font-bold">{formatRemaining(left)}</span></div>
                        <div className="w-full h-2 bg-dark border border-dark-border overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-uranium to-aviation" style={{ width: `${Math.round(fraction * 100)}%` }} />
                        </div>
                        {pass.paid > 0n && <div className="flex justify-between text-zincGrey"><span>ORIGINAL PRICE:</span><span className="text-alabaster">{formatEthShort(pass.paid)} ETH</span></div>}
                        {pass.listed > 0n && <div className="flex justify-between text-zincGrey"><span>LISTED AT:</span><span className="text-aviation">{formatEthShort(pass.current)} ETH</span></div>}
                      </div>
                      <div className="flex space-x-2 pt-1">
                        <Link href={`/pass/${pass.tokenId}`} className="flex-1 py-2 text-center bg-dark hover:bg-dark-surface border border-dark-border text-alabaster font-mono text-xs uppercase">
                          {pass.listed > 0n ? "Manage Listing" : "Resell Unused Days"}
                        </Link>
                        <Link href="/verify" className="px-4 py-2 bg-dark-surface border border-dark-border hover:border-uranium text-zincGrey hover:text-alabaster font-mono text-xs uppercase">
                          Verify
                        </Link>
                      </div>

                      {/* Gift and split. `split()` has been in the Stylus
                          contract all along -- this is the first page that
                          lets anyone reach it. */}
                      <GiftSplit
                        pass={pass}
                        plan={plan}
                        nowMs={nowMs}
                        busy={busyToken === pass.tokenId.toString()}
                        disabled={!isConnected || wrongNetwork || busyToken !== null}
                        onGift={(to) => handleGift(pass.tokenId, to)}
                        onSplit={(parts) => handleSplit(pass.tokenId, parts)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Escrowed sale proceeds earning Aave yield. EscrowYield.sol is
              written but not deployed, so ESCROW_ADDRESS is still "0x" and
              this renders nothing at all rather than a dead panel. It appears
              on its own the moment an escrow address is configured. */}
          {isAddress(ESCROW_ADDRESS) && <YieldDashboard />}

          {/* Merge several passes on one plan into a single longer pass.
              Calls bundle() on the Stylus contract. */}
          {myPasses.length > 1 && (
            <PassBundler passes={myPasses} plans={plansMap} />
          )}

          {/* Auto-sell watches. These evaluate locally and hand you a button --
              nothing here signs on your behalf, which the panel states. */}
          {myPasses.length > 0 && (
            <AutoSell
              passes={myPasses}
              plans={plansMap}
              nowMs={nowMs}
              onList={handleList}
              busyToken={busyToken}
            />
          )}

          {plans.filter(p => p.open).length > 0 && (
            <div className="p-8 bg-dark-card border border-dark-border space-y-6">
              <div className="flex items-center justify-between border-b border-dark-border pb-4">
                <div>
                  <div className="flex items-center space-x-2 text-uranium font-mono text-xs font-bold uppercase">
                    <PlusCircle className="w-4 h-4" /><span>BUY A PASS FROM AN OPEN PLAN</span>
                  </div>
                  <h3 className="font-header font-bold text-2xl text-alabaster mt-1">Acquire a Subscription Pass</h3>
                </div>
                <span className="font-mono text-[11px] text-zincGrey">Executes Stylus: <code>buyPass(planId)</code></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
                {plans.filter(p => p.open).map((plan) => (
                  <div key={plan.id.toString()} className="p-4 bg-dark border border-dark-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-alabaster">{plan.name || `Plan #${plan.id}`}</span>
                      <span className="text-uranium font-bold">{formatEthShort(plan.price)} ETH</span>
                    </div>
                    <div className="text-zincGrey text-[11px]">Duration: {Math.round(Number(plan.duration) / 86400)} days</div>
                    <button onClick={() => handleBuyFromPlan(plan)} disabled={busy || !isConnected || wrongNetwork}
                      className="w-full py-2.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider text-xs transition-all disabled:opacity-40">
                      {busy ? "CONFIRM IN METAMASK..." : "BUY PASS"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-8 bg-dark-card border border-dark-border space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border pb-4 gap-2">
              <div>
                <div className="flex items-center space-x-2 text-uranium font-mono text-xs font-bold uppercase">
                  <PlusCircle className="w-4 h-4" /><span>DIRECT MINT (ISSUER/ADMIN ONLY)</span>
                </div>
                <h3 className="font-header font-bold text-2xl text-alabaster mt-1">Mint a Pass to Your Wallet</h3>
              </div>
              <span className="font-mono text-[11px] text-zincGrey">Executes Stylus: <code>mint(address, duration)</code></span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div>
                <label className="text-zincGrey block mb-2 uppercase">Pass Duration:</label>
                <select value={mintDuration} onChange={(e) => setMintDuration(parseInt(e.target.value))}
                  className="w-full p-2.5 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none">
                  <option value={604800}>7 Days (Sprint Pass)</option>
                  <option value={1209600}>14 Days (Bi-Weekly)</option>
                  <option value={2592000}>30 Days (Standard Month)</option>
                  <option value={5184000}>60 Days (Bi-Monthly)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleMint} disabled={isMinting || !isConnected || wrongNetwork}
                  className="w-full py-3.5 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-grunge-uranium disabled:opacity-40">
                  <PlusCircle className="w-4 h-4 text-black" />
                  <span>{isMinting ? "CONFIRM IN METAMASK..." : "MINT PASS TO VAULT"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
