"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { PassCard3D } from "@/components/PassCard3D";
import { QrPanel } from "@/components/QrPanel";
import { humanise, useFees, useNow } from "@/components/ui";
import type { SubscriptionPass } from "@/lib/types";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  QrCode,
  Send,
  ShieldCheck,
  Tag,
  XCircle,
} from "lucide-react";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS, MARKETPLACE_ADDRESS, marketplaceAbi,
  discountPct,
  formatEthShort,
  withBuffer,
  formatRemaining,
  lifeFraction,
  liquidPassAbi,
  remaining,
  shortAddress,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchActivity, fetchPasses, fetchPlans, type Activity } from "@/lib/data";
import { useDemo } from "@/lib/demo";

/**
 * A single pass, with everything the chain knows about it.
 *
 * The lifecycle strip at the bottom is built from that pass's own events, so
 * it is a real history rather than a generic diagram -- if a pass has been
 * resold twice, two resales appear.
 */
export default function PassDetail({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = use(params);
  const id = useMemo(() => {
    try {
      return BigInt(tokenId);
    } catch {
      return null;
    }
  }, [tokenId]);

  const client = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const nowMs = useNow();
  const { shiftExpiry } = useDemo();

  const [pass, setPass] = useState<Pass | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);
  const [listing, setListing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [price, setPrice] = useState("");
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(async () => {
    if (id === null) {
      setLoading(false);
      return;
    }
    try {
      const [passes, plans, acts] = await Promise.all([
        fetchPasses(),
        fetchPlans(),
        fetchActivity(500),
      ]);
      const p = passes.find((x) => x.tokenId === id) ?? null;
      setPass(p);
      setPlan(p ? (plans.find((x) => x.id === p.planId) ?? null) : null);
      setHistory(acts.filter((a) => a.tokenId === id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;
  const isOwner =
    !!address && !!pass && pass.owner.toLowerCase() === address.toLowerCase();
  const expiry = pass ? shiftExpiry(pass.expiry) : 0n;
  const left = pass ? remaining(expiry, nowMs ?? Number(expiry) * 1000) : 0;
  const fraction = pass ? lifeFraction(expiry, plan?.duration ?? 0n) : 0;
  const off = pass ? discountPct(pass.paid, pass.current) : null;

  async function run(what: string, fn: () => Promise<`0x${string}`>) {
    setBusy(true);
    setTx(null);
    setError(null);
    try {
      const hash = await fn();
      setTx({ hash, what });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse border border-dark-border bg-dark-card" />
      </div>
    );
  }

  if (id === null || !pass || pass.owner === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center font-mono text-xs">
        <p className="mb-4 text-base text-aviation">TOKEN #{tokenId} NOT FOUND</p>
        <p className="mb-6 text-zincGrey">No pass with that id has been issued.</p>
        <Link href="/market" className="text-uranium underline">
          &larr; Return to Marketplace
        </Link>
      </div>
    );
  }

  const name = plan?.name || `Pass #${pass.tokenId}`;
  const percentLeft = Math.round(fraction * 100);

  /**
   * The chain's Pass, in the shape PassCard3D wants.
   *
   * Purely a view adapter -- the same one the market uses. Nothing about how
   * the pass is read or written changes; this only feeds the card.
   */
  const cardPass: SubscriptionPass = {
    tokenId: pass.tokenId.toString(),
    name,
    service: name.split(" ")[0] || "Pass",
    owner: pass.owner,
    issuer: pass.issuer,
    expiryTimestamp: Number(expiry),
    totalDurationSeconds: Number(plan?.duration ?? 0n),
    originalPriceEth: formatEther(pass.paid > 0n ? pass.paid : (plan?.price ?? 0n)),
    listingPriceEth: pass.listed > 0n ? formatEthShort(pass.current) : undefined,
    isListed: pass.listed > 0n,
    tier: "PRO",
    features: [],
  };

  // Displayed only. The contract computes the real split at execution time.
  const priceForSplit = pass.current > 0n ? pass.current : pass.paid;
  const sellerProceeds = formatEthShort((priceForSplit * 90n) / 100n);
  const issuerRoyalty = formatEthShort((priceForSplit * 10n) / 100n);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/market"
        className="mb-8 inline-flex items-center space-x-2 font-mono text-xs text-zincGrey transition-colors hover:text-uranium"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>BACK TO RESALE MARKET</span>
      </Link>

      {error && (
        <div className="mb-6 flex items-start space-x-2 border border-red-500/50 bg-red-500/10 p-4 font-mono text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {tx && (
        <div className="mb-6 flex items-start space-x-2 border border-uranium/50 bg-uranium/10 p-4 font-mono text-xs text-uranium">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            {tx.what} &mdash;{" "}
            <a
              className="underline underline-offset-2"
              href={`${EXPLORER}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              view on Arbiscan
            </a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Left: the ticket + raw contract readout */}
        <div className="space-y-6 lg:col-span-5">
          <PassCard3D pass={cardPass} interactive={true} showActions={false} />

          <div className="space-y-2 border border-dark-border bg-dark-base p-4 font-mono text-[11px]">
            <div className="flex items-center justify-between border-b border-dark-border pb-2 text-uranium">
              <span className="font-bold uppercase">STYLUS CONTRACT READOUT</span>
              <ShieldCheck className="h-4 w-4" />
            </div>
            {/* Every row below is a real return value, not a placeholder. */}
            <div className="space-y-1 text-zincGrey">
              <div className="flex justify-between">
                <span>ownerOf({pass.tokenId.toString()}):</span>
                <span className="text-alabaster">{shortAddress(pass.owner)}</span>
              </div>
              <div className="flex justify-between">
                <span>isActive({pass.tokenId.toString()}):</span>
                <span className={pass.active ? "font-bold text-uranium" : "font-bold text-aviation"}>
                  {String(pass.active)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>remainingSeconds({pass.tokenId.toString()}):</span>
                <span className="font-bold text-aviation">{left}s</span>
              </div>
              <div className="flex justify-between">
                <span>issuerOf({pass.tokenId.toString()}):</span>
                <span className="text-periwinkle">{shortAddress(pass.issuer)}</span>
              </div>
              <div className="flex justify-between">
                <span>currentPrice({pass.tokenId.toString()}):</span>
                <span className="text-alabaster">
                  {pass.listed > 0n ? `${formatEthShort(pass.current)} ETH` : "0 (Not Listed)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>paidOf({pass.tokenId.toString()}):</span>
                <span className="text-alabaster">
                  {pass.paid > 0n ? `${formatEther(pass.paid)} ETH` : "issued directly"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: specs, split, actions */}
        <div className="space-y-8 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-dark-border bg-chip-bg px-2 py-0.5 font-mono text-xs font-bold uppercase text-chip-text">
                ACCESS TICKET
              </span>
              <span className="font-mono text-xs text-zincGrey">
                TOKEN #{pass.tokenId.toString()}
              </span>
              <span
                className={`border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  pass.active
                    ? pass.listed > 0n
                      ? "border-aviation bg-aviation/10 text-aviation"
                      : "border-uranium bg-uranium/10 text-uranium"
                    : "border-dark-border bg-dark-surface text-zincGrey"
                }`}
              >
                {pass.active ? (pass.listed > 0n ? "LISTED" : "ACTIVE") : left > 0 ? "NOT STARTED" : "EXPIRED"}
              </span>
            </div>
            <h1 className="mt-2 font-header text-3xl font-extrabold tracking-tight text-alabaster sm:text-5xl">
              {name}
            </h1>
            <p className="mt-2 font-body text-base text-zincGrey">
              Issued by {shortAddress(pass.issuer)} &middot; expires{" "}
              {new Date(Number(pass.expiry) * 1000).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>

          {/* Decay */}
          <div className="space-y-3 border border-dark-border bg-dark-card p-5">
            <div className="flex justify-between font-mono text-xs">
              <span className="flex items-center space-x-1.5 text-zincGrey">
                <Clock className="h-4 w-4 text-uranium" />
                <span>CONTRACT LIFECYCLE DECAY:</span>
              </span>
              <span className="font-bold text-uranium">
                {formatRemaining(left)} left ({percentLeft}% retained)
              </span>
            </div>

            <div className="relative h-3 w-full overflow-hidden border border-dark-border bg-dark-base">
              <div
                className="h-full bg-gradient-to-r from-uranium via-aviation to-dark-surface"
                style={{ width: `${percentLeft}%` }}
              />
            </div>

            <div className="flex justify-between font-mono text-[10px] text-zincGrey">
              <span>ISSUANCE: 100% VALUE</span>
              <span>EXPIRY: 0.000 ETH VOID</span>
            </div>
          </div>

          {off !== null && (
            <p className="border border-uranium/40 bg-uranium/10 px-4 py-3 font-body text-xs leading-relaxed text-uranium">
              Buying this gets you {formatRemaining(left)} of access &mdash;{" "}
              <strong>{off}% below</strong> the {formatEther(pass.paid)} ETH it
              originally sold for. You inherit the existing expiry, not a fresh
              term.
            </p>
          )}

          {/* 90/10 */}
          <div className="space-y-4 border border-dark-border bg-dark-card p-6">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="font-header text-lg font-bold uppercase text-alabaster">
                90% / 10% Smart Contract Payout Split
              </h3>
              <DollarSign className="h-5 w-5 text-uranium" />
            </div>
            <p className="font-body text-xs leading-relaxed text-zincGrey">
              Resale proceeds are disbursed atomically when{" "}
              <code className="text-uranium">buy()</code> executes.
            </p>
            <div className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-2">
              <div className="border border-dark-border bg-dark p-3">
                <div className="text-[10px] uppercase text-zincGrey">Seller Take (90%)</div>
                <div className="text-lg font-bold text-uranium">{sellerProceeds} ETH</div>
                <div className="mt-1 text-[10px] text-zincGrey">Paid directly to seller wallet</div>
              </div>
              <div className="border border-dark-border bg-dark p-3">
                <div className="text-[10px] uppercase text-zincGrey">Issuer Royalty (10%)</div>
                <div className="text-lg font-bold text-periwinkle">{issuerRoyalty} ETH</div>
                <div className="mt-1 text-[10px] text-zincGrey">Paid to the original issuer</div>
              </div>
            </div>
          </div>

          {/* Actions -- every handler below is unchanged from before. */}
          <div className="space-y-4 border border-dark-border bg-dark-card p-6">
            {wrongNetwork && (
              <p className="border border-aviation/50 bg-aviation/10 px-3 py-2 font-mono text-xs text-aviation">
                Switch your wallet to Arbitrum Sepolia to transact.
              </p>
            )}

            {isOwner && (
              <div className="flex items-center space-x-2 font-mono text-xs font-bold text-uranium">
                <CheckCircle2 className="h-4 w-4" />
                <span>YOU CURRENTLY OWN THIS PASS</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!isOwner && pass.listed > 0n && pass.active && (
                <button
                  onClick={() =>
                    run(`Bought pass #${pass.tokenId}`, async () =>
                      writeContractAsync({
                        address: MARKETPLACE_ADDRESS,
                        abi: marketplaceAbi,
                        functionName: "buy",
                        args: [pass.tokenId],
                        value: withBuffer(pass.current),
                        chainId: arbitrumSepolia.id,
                        gas: 800_000n,
                      }),
                    )
                  }
                  disabled={busy || !isConnected || wrongNetwork}
                  className="flex flex-1 items-center justify-center space-x-2 bg-uranium px-4 py-3.5 font-mono text-sm font-extrabold uppercase tracking-wider text-black shadow-grunge-uranium transition-all hover:bg-uranium-glow disabled:opacity-40"
                >
                  <span>
                    {busy ? "CONFIRM IN WALLET…" : `TAKE OVER ${formatRemaining(left)} · ${formatEthShort(pass.current)} ETH`}
                  </span>
                  {!busy && <ArrowRight className="h-4 w-4" />}
                </button>
              )}

              {isOwner && pass.active && pass.listed === 0n && !listing && (
                <button
                  onClick={() => setListing(true)}
                  disabled={wrongNetwork}
                  className="flex items-center space-x-2 bg-uranium px-4 py-2.5 font-mono text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>Sell remaining time</span>
                </button>
              )}

              {isOwner && pass.active && !listing && !transferring && (
                <button
                  onClick={() => setTransferring(true)}
                  disabled={wrongNetwork}
                  className="flex items-center space-x-2 border border-dark-border bg-dark px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-alabaster transition-colors hover:border-uranium hover:text-uranium disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Transfer / Discard</span>
                </button>
              )}

              {isOwner && pass.listed > 0n && (
                <button
                  onClick={() =>
                    run(`Unlisted pass #${pass.tokenId}`, async () =>
                      writeContractAsync({
                        address: MARKETPLACE_ADDRESS,
                        abi: marketplaceAbi,
                        functionName: "unlist",
                        args: [pass.tokenId],
                        chainId: arbitrumSepolia.id,
                        gas: 800_000n,
                      }),
                    )
                  }
                  disabled={busy || wrongNetwork}
                  className="flex items-center space-x-2 border border-red-500/50 bg-dark px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-red-300 transition-colors hover:bg-dark-surface disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>{busy ? "Confirm…" : "Withdraw listing"}</span>
                </button>
              )}

              {pass.listed > 0n && (
                <button
                  onClick={() => setShowQr(true)}
                  className="flex items-center space-x-2 border border-dark-border bg-dark px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-zincGrey transition-colors hover:border-uranium hover:text-uranium"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Generate QR</span>
                </button>
              )}

              {!isOwner && pass.listed === 0n && (
                <p className="w-full border border-dark-border bg-dark p-3 text-center font-mono text-xs text-zincGrey">
                  This pass is in private ownership and is not currently listed
                  for sale.
                </p>
              )}
            </div>

            {listing && (
              <div className="max-w-sm space-y-3 border border-dark-border bg-dark p-4 font-mono text-xs">
                <label htmlFor="p" className="block uppercase text-zincGrey">
                  Asking price in ETH
                </label>
                <input
                  id="p"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={pass.paid > 0n ? formatEther(pass.paid / 2n) : "0.0001"}
                  inputMode="decimal"
                  autoFocus
                  className="w-full border border-dark-border bg-dark-base px-3 py-2 text-alabaster outline-none focus:border-uranium"
                />
                <p className="text-[11px] text-zincGrey">
                  On sale: 90% to you, 10% to {shortAddress(pass.issuer)} (the
                  original issuer). Enforced by the contract.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      let wei: bigint;
                      try {
                        wei = parseEther(price.trim() || "0");
                      } catch {
                        setError("Enter a number, like 0.0001");
                        return;
                      }
                      if (wei <= 0n) {
                        setError("Price must be above zero.");
                        return;
                      }
                      setListing(false);
                      void run(`Listed pass #${pass.tokenId}`, async () =>
                        writeContractAsync({
                          address: MARKETPLACE_ADDRESS,
                          abi: marketplaceAbi,
                          functionName: "list",
                          args: [pass.tokenId, wei],
                          chainId: arbitrumSepolia.id,
                          gas: 800_000n,
                        }),
                      );
                    }}
                    disabled={busy || wrongNetwork}
                    className="flex-1 bg-uranium px-3 py-2 font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
                  >
                    List it
                  </button>
                  <button
                    onClick={() => setListing(false)}
                    className="border border-dark-border px-3 py-2 uppercase text-zincGrey hover:text-alabaster"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {transferring && (
              <div className="max-w-sm space-y-3 border border-dark-border bg-dark p-4 font-mono text-xs">
                <label htmlFor="recip" className="block uppercase text-zincGrey">
                  Recipient wallet (or 0x00…dead to burn)
                </label>
                <input
                  id="recip"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x… or 0x000000000000000000000000000000000000dead"
                  autoFocus
                  className="w-full border border-dark-border bg-dark-base px-3 py-2 text-alabaster outline-none focus:border-uranium"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const target = (recipient.trim() ||
                        "0x000000000000000000000000000000000000dead") as `0x${string}`;
                      setTransferring(false);
                      void run(`Transferred pass #${pass.tokenId}`, async () =>
                        writeContractAsync({
                          address: LIQUID_PASS_ADDRESS,
                          abi: liquidPassAbi,
                          functionName: "transferPass",
                          args: [target, pass.tokenId],
                          chainId: arbitrumSepolia.id,
                          gas: 800_000n,
                        }),
                      );
                    }}
                    disabled={busy || wrongNetwork}
                    className="flex-1 bg-uranium px-3 py-2 font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
                  >
                    Confirm transfer
                  </button>
                  <button
                    onClick={() => setTransferring(false)}
                    className="border border-dark-border px-3 py-2 uppercase text-zincGrey hover:text-alabaster"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lifecycle — this pass's own events */}
      <section className="mt-16 border-t border-dark-border pt-10">
        <div className="mb-6 flex items-center space-x-2">
          <ActivityIcon className="h-4 w-4 text-uranium" />
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-uranium">
            Lifecycle &mdash; this pass&rsquo;s own events
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="font-mono text-xs text-zincGrey">No events recorded yet.</p>
        ) : (
          <ol className="space-y-0">
            {[...history].reverse().map((a, i) => (
              <li key={`${a.txHash}-${i}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 bg-uranium" />
                  {i < history.length - 1 && (
                    <span className="w-px flex-1 bg-dark-border" />
                  )}
                </div>
                <div className="pb-6">
                  <p className="font-body text-sm text-alabaster">{LIFECYCLE[a.kind]}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-zincGrey">
                    block {a.blockNumber.toString()}
                    {a.price !== undefined && a.price > 0n && ` · ${formatEther(a.price)} ETH`}{" "}
                    ·{" "}
                    <a
                      href={`${EXPLORER}/tx/${a.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-uranium"
                    >
                      tx
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {showQr && pass.listed > 0n && (
        <QrPanel
          tokenId={pass.tokenId}
          name={name}
          price={formatEthShort(pass.current)}
          remainingLabel={formatRemaining(left)}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}

const LIFECYCLE: Record<Activity["kind"], string> = {
  Minted: "Issued directly by the issuer",
  PassPurchased: "Bought new from its plan",
  Listed: "Listed for resale",
  Unlisted: "Listing withdrawn",
  Bought: "Resold — the buyer inherited the remaining time",
  PlanCreated: "Plan published",
  // Gifts and split slices emit only this. Without it, a slice's lifecycle
  // strip read "No events recorded yet" despite having been minted on chain.
  PassTransferred: "Changed hands",
};
