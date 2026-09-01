"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { Banner, Empty, useNow } from "@/components/ui";
import { shortAddress, type Pass, type Plan } from "@/lib/contract";
import { fetchActivity, fetchPasses, fetchPlans, type Activity } from "@/lib/data";

/**
 * Marketplace analytics.
 *
 * Every number is derived from chain state or decoded logs. Where a metric
 * cannot be derived it is omitted rather than estimated -- the spec forbids
 * fabricated statistics, and an analytics page is the easiest place for an
 * invented figure to look authoritative.
 *
 * Charts are inline SVG rather than Recharts: the dataset is a handful of
 * points, and a charting dependency would add more bundle than it earns.
 */

export default function AnalyticsPage() {
  const client = usePublicClient();
  const nowMs = useNow(30_000);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, t, a] = await Promise.all([
        fetchPlans(),
        fetchPasses(),
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

  const m = useMemo(() => {
    const now = Math.floor((nowMs ?? 0) / 1000);
    const sold = passes.filter((p) => p.paid > 0n);
    // From the contract, not expiry-vs-clock. A split slice awaiting its turn
    // has a future expiry but is not active, and counting it inflated both the
    // active figure and the listing count.
    const active = sold.filter((p) => p.active);
    const expired = sold.filter((p) => !p.active && Number(p.expiry) <= now);
    const pending = sold.filter((p) => !p.active && Number(p.expiry) > now);
    const listed = sold.filter((p) => p.listed > 0n && p.active);
    void pending;

    // Resale volume comes from Bought logs, which carry the actual price.
    // This is the one place resale turnover IS knowable -- the contract itself
    // stores only each pass's original price, not a running total.
    const resales = activity.filter((a) => a.kind === "Bought");
    const resaleVolume = resales.reduce((s, a) => s + (a.price ?? 0n), 0n);
    const primaryVolume = sold.reduce((s, p) => s + p.paid, 0n);
    // The 10% cut is taken as a remainder in the contract, so recompute it the
    // same way rather than multiplying by 0.1.
    const royalties = resales.reduce((s, a) => s + (a.price ?? 0n) / 10n, 0n);

    const byIssuer = new Map<string, { plans: number; issued: number; volume: bigint }>();
    for (const plan of plans) {
      const k = plan.issuer.toLowerCase();
      const e = byIssuer.get(k) ?? { plans: 0, issued: 0, volume: 0n };
      e.plans++;
      byIssuer.set(k, e);
    }
    for (const p of sold) {
      const k = p.issuer.toLowerCase();
      const e = byIssuer.get(k) ?? { plans: 0, issued: 0, volume: 0n };
      e.issued++;
      e.volume += p.paid;
      byIssuer.set(k, e);
    }

    const byPlan = new Map<string, number>();
    for (const p of sold) {
      byPlan.set(p.planId.toString(), (byPlan.get(p.planId.toString()) ?? 0) + 1);
    }

    return {
      plans: plans.length,
      sold: sold.length,
      active: active.length,
      expired: expired.length,
      listed: listed.length,
      resales: resales.length,
      primaryVolume,
      resaleVolume,
      royalties,
      issuers: [...byIssuer.entries()].sort((a, b) => Number(b[1].volume - a[1].volume)),
      byPlan,
    };
  }, [plans, passes, activity, nowMs]);

  const planCounts = useMemo(
    () =>
      plans
        .map((p) => ({ name: p.name || `#${p.id}`, n: m.byPlan.get(p.id.toString()) ?? 0 }))
        .sort((a, b) => b.n - a.n),
    [plans, m.byPlan],
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Analytics</h1>
      <p className="mt-2 max-w-lg text-[14px] text-muted">
        Derived from contract state and decoded events. Nothing here is
        estimated.
      </p>

      {error && <Banner tone="error">{error}</Banner>}

      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : m.sold === 0 && m.plans === 0 ? (
        <Empty title="Nothing to chart yet" body="Publish a plan and sell a pass to populate this." />
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Plans" value={String(m.plans)} />
            <Metric label="Passes sold" value={String(m.sold)} tone="var(--color-life-full)" />
            <Metric label="Active" value={String(m.active)} tone="var(--color-life-mid)" />
            <Metric label="Expired" value={String(m.expired)} tone="var(--color-faint)" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Listed now" value={String(m.listed)} tone="var(--color-life-low)" />
            <Metric label="Resales" value={String(m.resales)} tone="var(--color-life-mid)" />
            <Metric label="Primary volume" value={`${trim(formatEther(m.primaryVolume))} ETH`} />
            <Metric label="Resale volume" value={`${trim(formatEther(m.resaleVolume))} ETH`} />
          </div>

          <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Issuer royalties earned
            </h2>
            <p className="tnum mt-3 text-[28px] font-semibold text-life-full">
              {trim(formatEther(m.royalties))}
              <span className="ml-1 text-[13px] font-normal text-muted">ETH</span>
            </p>
            <p className="mt-2 text-[12px] text-faint">
              Summed from the 10% share of every <code>Bought</code> event, using
              the same integer division the contract uses. Not a projection.
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Passes sold per plan
            </h2>
            {planCounts.every((p) => p.n === 0) ? (
              <p className="mt-4 text-[13px] text-muted">No passes sold yet.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {planCounts.map((p) => {
                  const max = Math.max(...planCounts.map((x) => x.n), 1);
                  return (
                    <li key={p.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-[13px]">{p.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-life-full transition-[width] duration-700"
                          style={{ width: `${(p.n / max) * 100}%` }}
                        />
                      </div>
                      <span className="tnum w-6 text-right text-[12px] text-muted">{p.n}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">Top issuers</h2>
            <ul className="mt-4 divide-y divide-line">
              {m.issuers.map(([addr, e]) => (
                <li key={addr} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span className="tnum text-muted">{shortAddress(addr)}</span>
                  <span className="tnum text-faint">
                    {e.plans} plan{e.plans === 1 ? "" : "s"} · {e.issued} sold ·{" "}
                    <span className="text-text">{trim(formatEther(e.volume))} ETH</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="tnum text-[22px] font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
    </div>
  );
}

function trim(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
