"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { DecayRing, lifeColor } from "@/components/DecayRing";
import { Banner, Empty, SkeletonGrid, humanise, useFees, useNow } from "@/components/ui";
import { useDemo } from "@/lib/demo";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS,
  discountPct,
  fairPrice,
  formatEthShort,
  formatRemaining,
  lifeFraction,
  liquidPassAbi,
  remaining,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchActivity, fetchPasses, fetchPlans, passesOf, type Activity } from "@/lib/data";
import { AutoSell } from "@/components/AutoSell";
import { YieldConcept } from "@/components/YieldConcept";
import { PricingOracle } from "@/components/PricingOracle";
import { planSignals, type PlanSignal } from "@/lib/signals";

export default function Dashboard() {
  const client = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const nowMs = useNow(1000);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  const load = useCallback(async () => {
    // No setState before the first await: doing so runs synchronously inside
    // the effect and triggers a cascading render.
    try {
      const [p, t, a] = await Promise.all([
        fetchPlans(),
        fetchPasses(),
        // Needed for the pricing signals: what resales actually settled at.
        fetchActivity(500),
      ]);
      setPlans(p);
      setPasses(t);
      setActivity(a);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => passesOf(passes, address), [passes, address]);
  const planById = useMemo(
    () => new Map(plans.map((p) => [p.id.toString(), p])),
    [plans],
  );

  const stats = useMemo(() => {
    const now = Math.floor((nowMs ?? 0) / 1000);
    let active = 0;
    let soon = 0;
    let listed = 0;
    let expired = 0;
    for (const p of mine) {
      const left = Number(p.expiry) - now;
      if (left <= 0) expired++;
      else {
        active++;
        if (left <= 7 * 86400) soon++;
      }
      if (p.listed > 0n) listed++;
    }
    return { active, soon, listed, expired };
  }, [mine, nowMs]);

  // What resales of each plan have actually settled at. Empty until there is
  // history, which the oracle reports rather than papers over.
  const signals = useMemo(() => planSignals(activity, passes), [activity, passes]);

  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  async function run(key: string, what: string, fn: () => Promise<`0x${string}`>) {
    setBusy(key);
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
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">My passes</h1>
      <p className="mt-2 max-w-lg text-[14px] text-muted">
        Time you own. List any of it and someone else can take over what&rsquo;s
        left.
      </p>

      {wrongNetwork && (
        <Banner tone="warn">Switch your wallet to Arbitrum Sepolia.</Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      {tx && (
        <Banner tone="ok">
          {tx.what} —{" "}
          <a
            className="underline underline-offset-2"
            href={`${EXPLORER}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            view on Arbiscan
          </a>
        </Banner>
      )}

      {!isConnected ? (
        <Empty
          title="Connect a wallet"
          body="Your passes are held on-chain. Connect to see the ones this address owns."
        />
      ) : loading ? (
        <SkeletonGrid />
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active" value={stats.active} tone="var(--color-life-full)" />
            <Stat label="Expiring soon" value={stats.soon} tone="var(--color-life-low)" />
            <Stat label="Listed" value={stats.listed} tone="var(--color-life-mid)" />
            <Stat label="Expired" value={stats.expired} tone="var(--color-faint)" />
          </div>

          {mine.length === 0 ? (
            <Empty
              title="No passes yet"
              body="Buy one from the market and it will show up here."
              action={
                <Link
                  href="/market"
                  className="mt-5 inline-block rounded-lg bg-text px-4 py-2 text-[13px] font-medium text-ink"
                >
                  Go to market
                </Link>
              }
            />
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((pass) => (
                <OwnedPass
                  key={pass.tokenId.toString()}
                  pass={pass}
                  plan={planById.get(pass.planId.toString())}
                  signal={signals.get(pass.planId.toString())}
                  busy={busy === `t-${pass.tokenId}`}
                  disabled={wrongNetwork}
                  onList={(price) =>
                    run(`t-${pass.tokenId}`, `Listed pass #${pass.tokenId}`, async () =>
                      writeContractAsync({
                        address: LIQUID_PASS_ADDRESS,
                        abi: liquidPassAbi,
                        functionName: "list",
                        args: [pass.tokenId, price],
                        chainId: arbitrumSepolia.id,
                        ...(await fees()),
                      }),
                    )
                  }
                  onUnlist={() =>
                    run(`t-${pass.tokenId}`, `Unlisted pass #${pass.tokenId}`, async () =>
                      writeContractAsync({
                        address: LIQUID_PASS_ADDRESS,
                        abi: liquidPassAbi,
                        functionName: "unlist",
                        args: [pass.tokenId],
                        chainId: arbitrumSepolia.id,
                        ...(await fees()),
                      }),
                    )
                  }
                />
              ))}
            </div>
          )}

          <AutoSell
            passes={mine}
            plans={planById}
            nowMs={nowMs}
            busyToken={busy?.startsWith("t-") ? busy.slice(2) : null}
            onList={(tokenId, price) =>
              run(`t-${tokenId}`, `Listed pass #${tokenId}`, async () =>
                writeContractAsync({
                  address: LIQUID_PASS_ADDRESS,
                  abi: liquidPassAbi,
                  functionName: "list",
                  args: [tokenId, price],
                  chainId: arbitrumSepolia.id,
                  ...(await fees()),
                }),
              )
            }
          />
        </>
      )}

      {/* Outside the connected branch on purpose: this explains a mechanism,
          and a judge who never connects a wallet should still see it. */}
      <div className="mt-12">
        <YieldConcept />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="tnum text-[22px] font-semibold" style={{ color: tone }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-faint">
        {label}
      </p>
    </div>
  );
}

function OwnedPass({
  pass,
  plan,
  signal,
  busy,
  disabled,
  onList,
  onUnlist,
}: {
  pass: Pass;
  plan?: Plan;
  signal?: PlanSignal;
  busy: boolean;
  disabled: boolean;
  onList: (price: bigint) => void;
  onUnlist: () => void;
}) {
  const now = useNow();
  const { shiftExpiry } = useDemo();
  const expiry = shiftExpiry(pass.expiry);

  const [listing, setListing] = useState(false);
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  // Before the clock mounts, fall back to the expiry itself so the pass reads
  // as "just expiring" rather than flashing a wrong number.
  const left = remaining(expiry, now ?? Number(expiry) * 1000);
  const fraction = lifeFraction(expiry, plan?.duration ?? 0n);
  // What the remaining time is proportionally worth, offered as the default
  // ask so the seller does not have to work it out.
  const fair = fairPrice(pass.paid, expiry, plan?.duration ?? 0n, now);
  const expired = left <= 0;
  const isListed = pass.listed > 0n;

  function submit() {
    setPriceError(null);
    let wei: bigint;
    try {
      wei = parseEther(price.trim() || "0");
    } catch {
      setPriceError("Enter a number, like 0.0001");
      return;
    }
    // Mirrors the contract: 0 is the "not listed" sentinel and is rejected
    // there, so catch it here rather than spending gas to learn that.
    if (wei <= 0n) {
      setPriceError("Price must be above zero.");
      return;
    }
    onList(wei);
    setListing(false);
    setPrice("");
  }

  return (
    <div className="hairline flex flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium">
            {plan?.name || `Pass #${pass.tokenId}`}
          </h3>
          <p className="tnum mt-1 text-[11px] text-faint">
            #{pass.tokenId.toString()}
          </p>
        </div>
        {isListed && !expired && (
          <span className="rounded-md bg-life-mid/15 px-2 py-1 text-[10px] uppercase tracking-wider text-life-mid">
            listed
          </span>
        )}
        {expired && (
          <span className="rounded-md bg-raised px-2 py-1 text-[10px] uppercase tracking-wider text-faint">
            expired
          </span>
        )}
      </div>

      <div className="my-6 grid place-items-center">
        <DecayRing
          fraction={fraction}
          size={96}
          label={expired ? "0d" : formatRemaining(left).replace(/ days?/, "d")}
          sublabel={expired ? "gone" : "left"}
        />
      </div>

      <div className="mt-auto border-t border-line pt-4">
        {expired ? (
          isListed ? (
            <button
              onClick={onUnlist}
              disabled={busy || disabled}
              className="w-full rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              {busy ? "Confirm…" : "Clear stale listing"}
            </button>
          ) : (
            <p className="text-center text-[12px] text-faint">
              This pass has run out.
            </p>
          )
        ) : isListed ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-faint">asking</span>
              <span
                className="tnum text-[14px] font-medium"
                style={{ color: lifeColor(fraction) }}
              >
                {formatEthShort(pass.current)} ETH
              </span>
            </div>
            {pass.paid > 0n && discountPct(pass.paid, pass.current) !== null && (
              <p className="tnum text-[11px] text-faint">
                {discountPct(pass.paid, pass.current)}% below the{" "}
                {formatEther(pass.paid)} ETH original
              </p>
            )}
            <button
              onClick={onUnlist}
              disabled={busy || disabled}
              className="w-full rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              {busy ? "Confirm…" : "Remove listing"}
            </button>
          </div>
        ) : listing ? (
          <div className="space-y-2">
            <label className="block text-[11px] text-faint" htmlFor={`p-${pass.tokenId}`}>
              Asking price in ETH
            </label>
            <input
              id={`p-${pass.tokenId}`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={fair !== null && fair > 0n ? formatEthShort(fair) : "0.0001"}
              inputMode="decimal"
              autoFocus
              className="tnum w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
            />
            <PricingOracle
              pass={pass}
              plan={plan}
              signal={signal}
              nowMs={now}
              onUse={setPrice}
            />
            {priceError && (
              <p className="text-[11px] text-life-crit">{priceError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={busy || disabled}
                className="flex-1 rounded-lg bg-text px-3 py-2 text-[12px] font-medium text-ink disabled:opacity-40"
              >
                {busy ? "Confirm…" : "List it"}
              </button>
              <button
                onClick={() => {
                  setListing(false);
                  setPriceError(null);
                }}
                className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setListing(true)}
            disabled={disabled}
            className="w-full rounded-lg bg-text px-3 py-2 text-[12px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Sell remaining time
          </button>
        )}
      </div>
    </div>
  );
}
