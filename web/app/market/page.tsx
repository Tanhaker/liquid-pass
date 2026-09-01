"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import { usePublicClient, useAccount, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { DecayRing, lifeColor } from "@/components/DecayRing";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS,
  discountPct,
  formatRemaining,
  lifeFraction,
  liquidPassAbi,
  remaining,
  shortAddress,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { activeListings, fetchPasses, fetchPlans } from "@/lib/data";
import { Banner, Empty, SkeletonGrid, humanise, useFees, useNow } from "@/components/ui";
import { useDemo } from "@/lib/demo";

type Tab = "plans" | "resale";

/**
 * Short stagger, per the spec's rule that entrance motion must not make the
 * user wait: the last card in a row of three lands 90ms after the first.
 */
const GRID = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.045 } },
};

const CARD = {
  hidden: { y: 10 },
  shown: { y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Market() {
  const client = usePublicClient();
  const { isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const nowMs = useNow(1000);

  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  const load = useCallback(async () => {
    // No setState before the first await: doing so runs synchronously inside
    // the effect and triggers a cascading render.
    try {
      const [p, t] = await Promise.all([fetchPlans(), fetchPasses()]);
      setPlans(p);
      setPasses(t);
      setError(null);
    } catch (e) {
      // Surfaced, never swallowed: an empty market and an unreachable RPC must
      // not look the same.
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const listings = useMemo(() => activeListings(passes, nowMs), [passes, nowMs]);
  const planById = useMemo(
    () => new Map(plans.map((p) => [p.id.toString(), p])),
    [plans],
  );


  async function buyPlan(plan: Plan) {
    setBusy(`plan-${plan.id}`);
    setTx(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "buyPass",
        args: [plan.id],
        value: plan.price,
        chainId: arbitrumSepolia.id,
        ...(await fees()),
      });
      setTx({ hash, what: `Bought ${plan.name}` });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  }

  async function buyResale(pass: Pass) {
    setBusy(`pass-${pass.tokenId}`);
    setTx(null);
    try {
      const hash = await writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "buy",
        args: [pass.tokenId],
        value: pass.listed,
        chainId: arbitrumSepolia.id,
        ...(await fees()),
      });
      setTx({ hash, what: `Bought pass #${pass.tokenId}` });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  }

  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Market</h1>
          <p className="mt-2 max-w-lg text-[14px] text-muted">
            Buy a fresh pass from an issuer, or take over the time somebody else
            didn&rsquo;t use.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(["plans", "resale"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] transition-colors ${
                tab === t ? "bg-raised text-text" : "text-muted hover:text-text"
              }`}
            >
              {t === "plans" ? "New" : "Resale"}
              <span className="tnum ml-2 text-[11px] text-faint">
                {t === "plans" ? plans.filter((p) => p.open).length : listings.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {wrongNetwork && (
        <Banner tone="warn">
          Your wallet is on the wrong network. Switch to Arbitrum Sepolia to
          transact.
        </Banner>
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

      {loading ? (
        <SkeletonGrid />
      ) : tab === "plans" ? (
        plans.length === 0 ? (
          <Empty
            title="No plans yet"
            body="An issuer needs to publish one before anything can be bought."
          />
        ) : (
          <motion.div
            initial="hidden"
            animate="shown"
            variants={GRID}
            className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {plans.map((plan) => (
              <PlanCard
                key={plan.id.toString()}
                plan={plan}
                busy={busy === `plan-${plan.id}`}
                canBuy={isConnected && !wrongNetwork}
                onBuy={() => buyPlan(plan)}
              />
            ))}
          </motion.div>
        )
      ) : listings.length === 0 ? (
        <Empty
          title="Nothing on resale"
          body="When a holder lists a pass, the remaining time shows up here."
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="shown"
          variants={GRID}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {listings.map((pass) => (
            <ResaleCard
              key={pass.tokenId.toString()}
              pass={pass}
              plan={planById.get(pass.planId.toString())}
              busy={busy === `pass-${pass.tokenId}`}
              canBuy={isConnected && !wrongNetwork}
              onBuy={() => buyResale(pass)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  busy,
  canBuy,
  onBuy,
}: {
  plan: Plan;
  busy: boolean;
  canBuy: boolean;
  onBuy: () => void;
}) {
  const days = Number(plan.duration) / 86400;
  return (
    <motion.div
      variants={CARD}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="hairline flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-bright hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,.9)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium">{plan.name || `Plan #${plan.id}`}</h3>
          <p className="tnum mt-1 text-[11px] text-faint">
            by {shortAddress(plan.issuer)}
          </p>
        </div>
        {!plan.open && (
          <span className="rounded-md bg-raised px-2 py-1 text-[10px] uppercase tracking-wider text-faint">
            closed
          </span>
        )}
      </div>

      <div className="my-6 grid place-items-center">
        <DecayRing
          fraction={1}
          size={96}
          label={`${days % 1 === 0 ? days : days.toFixed(1)}d`}
          sublabel="of access"
        />
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <span className="tnum text-[15px] font-medium">
          {formatEther(plan.price)} <span className="text-[11px] text-faint">ETH</span>
        </span>
        <button
          onClick={onBuy}
          disabled={!plan.open || busy || !canBuy}
          title={!canBuy ? "Connect a wallet on Arbitrum Sepolia" : undefined}
          className="rounded-lg bg-text px-3.5 py-1.5 text-[12px] font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Confirm…" : "Buy pass"}
        </button>
      </div>
    </motion.div>
  );
}

function ResaleCard({
  pass,
  plan,
  busy,
  canBuy,
  onBuy,
}: {
  pass: Pass;
  plan?: Plan;
  busy: boolean;
  canBuy: boolean;
  onBuy: () => void;
}) {
  // Ticks locally so the countdown is alive without hammering the RPC.
  const now = useNow();
  const { shiftExpiry } = useDemo();
  // In live mode shiftExpiry is the identity function, so this is a no-op.
  const expiry = shiftExpiry(pass.expiry);
  const left = remaining(expiry, now ?? Number(expiry) * 1000);
  const fraction = lifeFraction(expiry, plan?.duration ?? 0n);
  const off = discountPct(pass.paid, pass.listed);
  const urgent = left > 0 && left <= 7 * 86400;

  return (
    <motion.div
      variants={CARD}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="hairline flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-bright hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,.9)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium">
            {plan?.name || `Pass #${pass.tokenId}`}
          </h3>
          <p className="tnum mt-1 text-[11px] text-faint">
            #{pass.tokenId.toString()} · {shortAddress(pass.owner)}
          </p>
        </div>
        {off !== null &&
          (off >= 40 ? (
            <span className="tnum flex items-center gap-1 rounded-md bg-life-low/15 px-2 py-1 text-[10px] font-semibold text-life-low">
              <span aria-hidden>🔥</span> STEAL · {off}%
            </span>
          ) : (
            <span className="tnum rounded-md bg-life-full/10 px-2 py-1 text-[10px] font-medium text-life-full">
              {off}% below original
            </span>
          ))}
      </div>

      <div className="my-6 grid place-items-center">
        <DecayRing
          fraction={fraction}
          size={96}
          label={formatRemaining(left).replace(" days", "d").replace(" day", "d")}
          sublabel="left"
        />
      </div>

      {urgent && (
        <p className="mb-3 text-center text-[11px] text-life-low">
          expiring soon
        </p>
      )}

      <div className="mt-auto border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-[15px] font-medium" style={{ color: lifeColor(fraction) }}>
            {formatEther(pass.listed)} <span className="text-[11px] text-faint">ETH</span>
          </span>
          <button
            onClick={onBuy}
            disabled={busy || !canBuy}
            title={!canBuy ? "Connect a wallet on Arbitrum Sepolia" : undefined}
            className="rounded-lg bg-text px-3.5 py-1.5 text-[12px] font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Confirm…" : "Take over"}
          </button>
        </div>
        {pass.paid > 0n && (
          <p className="tnum mt-2 text-[11px] text-faint">
            originally {formatEther(pass.paid)} ETH
          </p>
        )}
      </div>
    </motion.div>
  );
}
