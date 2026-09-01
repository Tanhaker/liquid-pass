"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { DecayRing, lifeColor } from "@/components/DecayRing";
import { Banner, useNow } from "@/components/ui";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS,
  formatRemaining,
  lifeFraction,
  remaining,
  shortAddress,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchPasses, fetchPlans } from "@/lib/data";
import { useDemo } from "@/lib/demo";
import { markUsed } from "@/lib/autosell";

/**
 * The access gate.
 *
 * This is the step the rest of the app was missing. Buying and reselling time
 * are only interesting if the time is FOR something, and until this page
 * existed nothing showed what holding a pass actually gets you.
 *
 * It answers the question a real service would ask -- "does this address hold
 * an active pass for my plan?" -- rather than the question the contract
 * exposes, which is "who owns token N?". The contract has no
 * hasActivePassForPlan(address, planId): adding one would mean an on-chain
 * index and the binary is already at 22366 of 24576 bytes. So the lookup is
 * assembled here from the same reads the dashboard uses.
 *
 * Nothing is written. Checking access is a read, and a service verifying a
 * customer should never need a transaction.
 */

type Result =
  | { state: "granted"; pass: Pass; plan: Plan | null; left: number }
  | { state: "denied"; reason: string }
  | { state: "invalid"; reason: string }
  | null;

export default function Verify() {
  const { address } = useAccount();
  const nowMs = useNow(1000);
  const { shiftExpiry } = useDemo();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [who, setWho] = useState("");
  const [planId, setPlanId] = useState<string>("any");
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([fetchPlans(), fetchPasses()]);
      setPlans(p);
      setPasses(t);
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

  // Prefills the connected wallet, but stays editable: a service checking a
  // customer is not checking itself.
  useEffect(() => {
    if (address && !who) setWho(address);
  }, [address, who]);

  const result: Result = useMemo(() => {
    if (!checked) return null;
    const target = who.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      // Distinct from a denial: nothing was checked, so labelling this "NO
      // ACTIVE PASS" would report a result that was never computed.
      return { state: "invalid", reason: "That isn't a valid address." };
    }

    const owned = passes.filter((p) => p.owner.toLowerCase() === target.toLowerCase());
    if (owned.length === 0) {
      return { state: "denied", reason: "This address doesn't hold any Liquid Pass." };
    }

    const wanted = planId === "any" ? null : BigInt(planId);
    const forPlan = wanted === null ? owned : owned.filter((p) => p.planId === wanted && p.paid > 0n);
    if (forPlan.length === 0) {
      return { state: "denied", reason: "This address holds passes, but none for that plan." };
    }

    // `p.active` is the contract's own answer, not expiry-vs-clock. A split
    // slice whose window has not opened has a future expiry but grants
    // nothing, and this page claims to be what a real service runs -- so it
    // must agree with the contract exactly.
    const live = forPlan.filter((p) => p.active);
    if (live.length === 0) {
      const pending = forPlan.some((p) => Number(p.expiry) > Math.floor((nowMs ?? 0) / 1000));
      return {
        state: "denied",
        reason: pending
          ? "They hold a pass for that plan, but its access window hasn't started yet."
          : "Their pass for that plan has expired.",
      };
    }

    const scored = live
      .map((p) => {
        const expiry = shiftExpiry(p.expiry);
        return { p, left: remaining(expiry, nowMs ?? Number(expiry) * 1000) };
      })
      .sort((a, b) => b.left - a.left);

    const best = scored[0];

    return {
      state: "granted",
      pass: best.p,
      plan: plans.find((x) => x.id === best.p.planId) ?? null,
      left: best.left,
    };
  }, [checked, who, planId, passes, plans, nowMs, shiftExpiry]);

  // A granted check is the only usage signal this product can honestly
  // observe, so it is what the auto-sell "idle" condition measures against.
  useEffect(() => {
    if (result?.state === "granted") markUsed(result.pass.tokenId.toString());
  }, [result]);

  const selectedPlan = planId === "any" ? null : plans.find((p) => p.id.toString() === planId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Verify access</h1>
      <p className="mt-2 max-w-xl text-[14px] text-muted">
        What a service runs before letting somebody in. Ask whether an address
        holds an active pass — no transaction, no signature, just a read of the
        contract.
      </p>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
              Address to check
            </span>
            <input
              value={who}
              onChange={(e) => {
                setWho(e.target.value);
                setChecked(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && setChecked(true)}
              placeholder="0x…"
              spellCheck={false}
              className="tnum mt-2 w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.12em] text-faint">Plan</span>
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setChecked(false);
              }}
              className="mt-2 w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright sm:w-48"
            >
              <option value="any">Any plan</option>
              {plans.map((p) => (
                <option key={p.id.toString()} value={p.id.toString()}>
                  {p.name || `Plan #${p.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          onClick={() => setChecked(true)}
          disabled={loading || !who.trim()}
          className="mt-4 rounded-xl bg-text px-4 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Reading chain…" : "Check access"}
        </button>
      </div>

      {result && (
        <div
          className="mt-6 rounded-2xl border p-6"
          style={{
            borderColor:
              result.state === "granted"
                ? "color-mix(in oklab, var(--color-life-full) 40%, transparent)"
                : "color-mix(in oklab, var(--color-life-crit) 40%, transparent)",
            background:
              result.state === "granted"
                ? "color-mix(in oklab, var(--color-life-full) 8%, transparent)"
                : "color-mix(in oklab, var(--color-life-crit) 8%, transparent)",
          }}
          role="status"
          aria-live="polite"
        >
          {result.state === "granted" ? (
            <div className="flex flex-wrap items-center gap-6">
              <DecayRing
                fraction={lifeFraction(
                  shiftExpiry(result.pass.expiry),
                  result.plan?.duration ?? 0n,
                )}
                size={104}
                label={formatRemaining(result.left).replace(/ days?/, "d")}
                sublabel="left"
              />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-life-full">
                  Access granted
                </p>
                <p className="mt-1 text-[22px] font-semibold">
                  {result.plan?.name || `Pass #${result.pass.tokenId}`}
                </p>
                <p
                  className="tnum mt-1 text-[14px]"
                  style={{
                    color: lifeColor(
                      lifeFraction(shiftExpiry(result.pass.expiry), result.plan?.duration ?? 0n),
                    ),
                  }}
                >
                  {formatRemaining(result.left)} remaining
                </p>
                <p className="tnum mt-2 text-[11px] text-faint">
                  pass #{result.pass.tokenId.toString()} · held by{" "}
                  {shortAddress(result.pass.owner)} ·{" "}
                  <Link
                    href={`/pass/${result.pass.tokenId}`}
                    className="underline underline-offset-2 hover:text-muted"
                  >
                    view
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-life-crit">
                No active pass
              </p>
              <p className="mt-2 text-[15px]">{result.reason}</p>
              {selectedPlan && (
                <Link
                  href="/market"
                  className="mt-4 inline-block rounded-lg bg-text px-4 py-2 text-[13px] font-medium text-ink"
                >
                  Buy {selectedPlan.name}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-surface/50 p-5">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
          What this actually checks
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Access is ownership. There is no redeem step and no code to claim —
          the moment a resale confirms, the buyer holds the pass and the seller
          does not. Verify the same address before and after a sale and the
          answer flips, while the expiry stays exactly where it was.
        </p>
        <pre className="tnum mt-4 overflow-x-auto rounded-lg border border-line bg-ink p-4 text-[11px] leading-relaxed text-muted">
{`ownerOf(tokenId)  == customer   // do they hold it
isActive(tokenId)  == true       // is there time left
                    ↓
             access granted`}
        </pre>
        <p className="mt-3 text-[12px] text-faint">
          Contract{" "}
          <a
            href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="tnum underline underline-offset-2 hover:text-muted"
          >
            {shortAddress(LIQUID_PASS_ADDRESS)}
          </a>{" "}
          — both are view calls, so verification costs nothing and needs no
          wallet.
        </p>
      </section>
    </div>
  );
}
