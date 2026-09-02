"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { Banner, Empty, SkeletonGrid } from "@/components/ui";
import { fetchPlans, fetchPasses, fetchActivity } from "@/lib/data";
import { EXPLORER, type Plan, type Pass } from "@/lib/contract";
import type { Activity } from "@/lib/data";

export default function IssuerDashboard() {
  const { address, isConnected } = useAccount();
  
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
        fetchActivity(1000),
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

  // Filter data for the connected issuer
  const myPlans = useMemo(() => {
    if (!address) return [];
    return plans.filter((p) => p.issuer.toLowerCase() === address.toLowerCase());
  }, [plans, address]);

  const myPlanIds = useMemo(() => new Set(myPlans.map((p) => p.id)), [myPlans]);

  const myPasses = useMemo(() => {
    return passes.filter((p) => myPlanIds.has(p.planId));
  }, [passes, myPlanIds]);

  const stats = useMemo(() => {
    let primaryRevenue = 0n;
    let secondaryVolume = 0n;
    let royaltiesEarned = 0n;
    let activeSubscribers = 0;

    const now = Math.floor(Date.now() / 1000);

    // Calculate Primary Revenue and Active Subs
    for (const pass of myPasses) {
      primaryRevenue += pass.paid;
      if (Number(pass.expiry) > now) {
        activeSubscribers++;
      }
    }

    // Calculate Secondary Volume and Royalties (10% of secondary sales)
    const resaleEvents = activity.filter((a) => a.kind === "Bought" && a.tokenId && myPlanIds.has(myPasses.find(p => p.tokenId === a.tokenId)?.planId || -1n));
    
    for (const event of resaleEvents) {
      if (event.price) {
        secondaryVolume += event.price;
        // In Liquid Pass, marketplace fee is 10%, we assume issuer gets a cut or we just show the network volume.
        royaltiesEarned += (event.price * 10n) / 100n; 
      }
    }

    return { primaryRevenue, secondaryVolume, royaltiesEarned, activeSubscribers };
  }, [myPasses, activity, myPlanIds]);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-14">
        <Empty
          title="Connect as Issuer"
          body="Connect your wallet to manage your subscription plans, view subscriber analytics, and track revenue."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-10">
        <div className="border-l-2 border-uranium pl-6">
          <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-uranium">
            06 // Issuer portal
          </h2>
          <h1 className="mt-2 font-header text-[32px] font-bold tracking-tight">Issuer command center.</h1>
        <p className="mt-2 text-[14px] text-muted max-w-2xl">
          Manage your subscription plans, monitor active users, and track real-time revenue across primary sales and secondary market royalties.
        </p>
      </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* Top Level Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <MetricCard 
              title="Total Revenue" 
              value={`${formatEther(stats.primaryRevenue + stats.royaltiesEarned).substring(0, 6)} ETH`} 
              subtitle="Primary + Royalties" 
              color="var(--theme-life-full)"
            />
            <MetricCard 
              title="Active Subscribers" 
              value={stats.activeSubscribers.toString()} 
              subtitle="Current token holders" 
              color="var(--theme-life-mid)"
            />
            <MetricCard 
              title="Secondary Volume" 
              value={`${formatEther(stats.secondaryVolume).substring(0, 6)} ETH`} 
              subtitle="Total traded on marketplace" 
              color="var(--theme-accent)"
            />
            <MetricCard 
              title="Active Plans" 
              value={myPlans.length.toString()} 
              subtitle="Subscription tiers" 
              color="var(--theme-text)"
            />
          </div>

          {/* Plan Management Table */}
          <div className="rounded-none border border-line bg-surface overflow-hidden">
            <div className="border-b border-line px-6 py-4 flex justify-between items-center bg-surface/50">
              <h2 className="font-semibold text-text">Your Subscription Plans</h2>
              <button className="rounded-none bg-text text-ink px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity">
                + Create New Plan
              </button>
            </div>
            
            {myPlans.length === 0 ? (
              <div className="p-12 text-center text-muted">
                You haven't created any plans yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-raised/30 text-faint text-[12px] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-medium">Plan Name</th>
                      <th className="px-6 py-4 font-medium">Price</th>
                      <th className="px-6 py-4 font-medium">Duration</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {myPlans.map((plan) => (
                      <tr key={plan.id.toString()} className="hover:bg-raised/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-text">{plan.name || `Plan #${plan.id}`}</td>
                        <td className="px-6 py-4 tnum">{formatEther(plan.price)} ETH</td>
                        <td className="px-6 py-4 tnum">{Number(plan.duration) / 86400} Days</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-none text-[11px] font-medium ${plan.open ? 'bg-[var(--theme-life-full)]/10 text-[var(--theme-life-full)]' : 'bg-raised text-faint'}`}>
                            {plan.open ? 'Active' : 'Closed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-muted hover:text-text transition-colors text-[13px]">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  return (
    <div className="rounded-none border border-line bg-surface/50 p-6 relative overflow-hidden group hover:border-line-bright transition-colors">
      <div 
        className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"
        style={{ background: color }}
      />
      <h3 className="text-[13px] font-medium text-muted">{title}</h3>
      <p className="mt-2 text-[32px] font-bold tracking-tight tnum" style={{ color }}>{value}</p>
      <p className="mt-1 text-[11px] text-faint">{subtitle}</p>
    </div>
  );
}
