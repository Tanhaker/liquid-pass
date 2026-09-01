"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { DecayRing, lifeColor } from "@/components/DecayRing";
import { LiquidPassCard } from "@/components/LiquidPassCard";
import { QrPanel } from "@/components/QrPanel";
import { Banner, Empty, humanise, useFees, useNow } from "@/components/ui";
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
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-surface" />
      </div>
    );
  }

  if (id === null || !pass || pass.owner === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-14">
        <Empty
          title="This pass doesn't exist"
          body={`No pass with id ${tokenId} has been issued.`}
          action={
            <Link
              href="/market"
              className="mt-5 inline-block rounded-lg bg-text px-4 py-2 text-[13px] font-medium text-ink"
            >
              Back to market
            </Link>
          }
        />
      </div>
    );
  }

  const name = plan?.name || `Pass #${pass.tokenId}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      {error && <Banner tone="error">{error}</Banner>}
      {tx && (
        <Banner tone="ok">
          {tx.what} —{" "}
          <a className="underline underline-offset-2" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
            view on Arbiscan
          </a>
        </Banner>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
        <div className="flex justify-center lg:justify-start">
          <LiquidPassCard
            name={name}
            tokenId={`PASS-${pass.tokenId.toString().padStart(4, "0")}`}
            fraction={fraction}
            daysLeft={Math.floor(left / 86400)}
            price={pass.current > 0n ? formatEthShort(pass.current) : undefined}
          />
        </div>

        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{name}</h1>
          <p className="tnum mt-1 text-[12px] text-faint">
            token #{pass.tokenId.toString()} · issuer {shortAddress(pass.issuer)}
          </p>

          <div className="mt-6 flex items-center gap-5">
            <DecayRing fraction={fraction} size={92} label={formatRemaining(left).replace(/ days?/, "d")} sublabel="left" />
            <div>
              <p className="tnum text-[26px] font-semibold" style={{ color: lifeColor(fraction) }}>
                {formatRemaining(left)}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                expires{" "}
                {new Date(Number(pass.expiry) * 1000).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-line pt-6 text-[13px]">
            <Row k="Owner" v={shortAddress(pass.owner)} />
            <Row
              k="Status"
              v={
                pass.active
                  ? pass.listed > 0n
                    ? "Listed"
                    : "Active"
                  : left > 0
                    ? "Not started"
                    : "Expired"
              }
            />
            <Row
              k="Originally sold for"
              v={pass.paid > 0n ? `${formatEther(pass.paid)} ETH` : "issued directly"}
            />
            <Row
              k="Opening ask"
              v={pass.listed > 0n ? `${formatEthShort(pass.listed)} ETH` : "not listed"}
            />
            <Row
              k="Price now"
              v={pass.current > 0n ? `${formatEthShort(pass.current)} ETH` : "—"}
            />
          </dl>

          {off !== null && (
            <p className="mt-4 rounded-lg bg-life-full/10 px-3 py-2 text-[12px] text-life-full">
              Buying this gets you {formatRemaining(left)} of access —{" "}
              <strong>{off}% below</strong> the {formatEther(pass.paid)} ETH it
              originally sold for. You inherit the existing expiry, not a fresh
              term.
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            {!isOwner && pass.listed > 0n && pass.active && (
              <button
                onClick={() =>
                  run(`Bought pass #${pass.tokenId}`, async () =>
                    writeContractAsync({
                      address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "buy", args: [pass.tokenId], value: withBuffer(pass.current),
                      chainId: arbitrumSepolia.id,
                      ...(await fees()),
                    }),
                  )
                }
                disabled={busy || !isConnected || wrongNetwork}
                className="rounded-xl bg-text px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
              >
                {busy ? "Confirm…" : `Take over ${formatRemaining(left)}`}
              </button>
            )}

            {isOwner && pass.active && pass.listed === 0n && !listing && (
              <button
                onClick={() => setListing(true)}
                disabled={wrongNetwork}
                className="rounded-xl bg-text px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
              >
                Sell remaining time
              </button>
            )}

            {isOwner && pass.listed > 0n && (
              <button
                onClick={() =>
                  run(`Unlisted pass #${pass.tokenId}`, async () =>
                    writeContractAsync({
                      address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "unlist", args: [pass.tokenId], chainId: arbitrumSepolia.id,
                      ...(await fees()),
                    }),
                  )
                }
                disabled={busy || wrongNetwork}
                className="rounded-xl border border-line px-4 py-2 text-[13px] text-muted disabled:opacity-40"
              >
                {busy ? "Confirm…" : "Remove listing"}
              </button>
            )}

            {pass.listed > 0n && (
              <button
                onClick={() => setShowQr(true)}
                className="rounded-xl border border-line px-4 py-2 text-[13px] text-muted hover:text-text"
              >
                Generate QR
              </button>
            )}
          </div>

          {listing && (
            <div className="mt-5 max-w-sm rounded-xl border border-line bg-surface p-4">
              <label htmlFor="p" className="text-[11px] uppercase tracking-[0.12em] text-faint">
                Asking price in ETH
              </label>
              <input
                id="p"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={pass.paid > 0n ? formatEther(pass.paid / 2n) : "0.0001"}
                inputMode="decimal"
                autoFocus
                className="tnum mt-2 w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
              />
              <p className="mt-2 text-[11px] text-faint">
                On sale: 90% to you, 10% to {shortAddress(pass.issuer)} (the
                original issuer). Enforced by the contract.
              </p>
              <div className="mt-3 flex gap-2">
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
                        address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "list", args: [pass.tokenId, wei],
                        chainId: arbitrumSepolia.id,
                        ...(await fees()),
                      }),
                    );
                  }}
                  disabled={busy || wrongNetwork}
                  className="flex-1 rounded-lg bg-text px-3 py-2 text-[12px] font-medium text-ink disabled:opacity-40"
                >
                  List it
                </button>
                <button
                  onClick={() => setListing(false)}
                  className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-14">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Lifecycle — this pass&rsquo;s own events
        </h2>
        {history.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">No events recorded yet.</p>
        ) : (
          <ol className="mt-5 space-y-0">
            {[...history].reverse().map((a, i) => (
              <li key={`${a.txHash}-${i}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 rounded-full bg-life-full" />
                  {i < history.length - 1 && <span className="w-px flex-1 bg-line" />}
                </div>
                <div className="pb-6">
                  <p className="text-[13px]">{LIFECYCLE[a.kind]}</p>
                  <p className="tnum mt-0.5 text-[11px] text-faint">
                    block {a.blockNumber.toString()}
                    {a.price !== undefined && a.price > 0n && ` · ${formatEther(a.price)} ETH`}{" "}
                    ·{" "}
                    <a
                      href={`${EXPLORER}/tx/${a.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-muted"
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-faint">{k}</dt>
      <dd className="tnum mt-1 text-text">{v}</dd>
    </div>
  );
}
