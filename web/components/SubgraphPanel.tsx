"use client";

import { useState } from "react";
import { Database, Play, TriangleAlert } from "lucide-react";
import {
  fetchActivityGql,
  fetchPassesGql,
  fetchPlansGql,
  isSubgraphConfigured,
} from "@/lib/graphql";
import { SUBGRAPH_URL } from "@/lib/graph";

/**
 * UI for the subgraph GraphQL layer.
 *
 * `lib/graphql.ts` implements the whole plan / pass / activity read path
 * against The Graph and had no caller anywhere in the app -- a working
 * feature with no way to reach it. This panel is that way in.
 *
 * It deliberately does NOT put the subgraph in the read path. Two reasons,
 * both in the module itself: `fetchPlansGql` returns an empty `name` because
 * the subgraph does not index it, so promoting it to primary would blank every
 * plan title; and the whole design of this app is that the chain is the source
 * of truth and the indexer is an accelerator. So this probes it, reports
 * exactly what came back, and changes nothing about what the market renders.
 */

type Probe = {
  plans: number;
  passes: number;
  events: number;
  ms: number;
};

export function SubgraphPanel() {
  const configured = isSubgraphConfigured();
  const [state, setState] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [result, setResult] = useState<Probe | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function probe() {
    setState("running");
    setError(null);
    setResult(null);
    const started = performance.now();
    try {
      // Settled, not all: a subgraph can serve two of the three entities.
      // Reporting "failed" because one query 404s would hide that.
      const [plans, passes, events] = await Promise.all([
        fetchPlansGql(),
        fetchPassesGql(),
        fetchActivityGql(25),
      ]);
      setResult({
        plans: plans.length,
        passes: passes.length,
        events: events.length,
        ms: Math.round(performance.now() - started),
      });
      setState("ok");
    } catch (e) {
      setError((e as Error).message);
      setState("failed");
    }
  }

  return (
    <div className="border border-dark-border bg-surface p-5">
      <div className="flex items-center gap-2 border-b border-dark-border pb-3">
        <Database className="size-3.5 text-uranium" />
        <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-uranium">
          Subgraph layer
        </span>
        <span
          className={`ml-auto border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            configured
              ? "border-uranium bg-uranium/10 text-uranium"
              : "border-dark-border bg-raised text-zinc-grey"
          }`}
        >
          {configured ? "CONFIGURED" : "NOT CONFIGURED"}
        </span>
      </div>

      <p className="mt-4 font-body text-[13px] leading-relaxed text-zinc-grey">
        The Graph is an accelerator here, never a dependency. Every page on this
        site reads the chain directly through viem, so an unsynced, unreachable
        or undeployed subgraph costs nothing. This panel probes the GraphQL
        layer without putting it in that path.
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-px border border-dark-border bg-dark-border font-mono text-[11px]">
        <div className="flex items-center justify-between gap-3 bg-ink px-3 py-2">
          <dt className="uppercase text-zinc-grey">Endpoint</dt>
          <dd className="truncate text-right text-text">
            {SUBGRAPH_URL || "— unset (NEXT_PUBLIC_SUBGRAPH_URL)"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 bg-ink px-3 py-2">
          <dt className="uppercase text-zinc-grey">Primary read path</dt>
          <dd className="text-text">viem multicall · RPC</dd>
        </div>
        <div className="flex items-center justify-between gap-3 bg-ink px-3 py-2">
          <dt className="uppercase text-zinc-grey">GraphQL client</dt>
          <dd className="text-text">plain fetch — no Apollo, no urql</dd>
        </div>
      </dl>

      <button
        onClick={probe}
        disabled={state === "running"}
        className="mt-4 flex w-full items-center justify-center gap-2 border border-dark-border bg-raised px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text transition-colors hover:border-uranium hover:text-uranium disabled:opacity-50"
      >
        <Play className="size-3" />
        {state === "running" ? "Querying…" : "Run probe"}
      </button>

      {state === "ok" && result && (
        <div className="mt-3 border border-uranium/40 bg-uranium/10 p-3 font-mono text-[11px] text-uranium">
          <p className="font-bold uppercase tracking-wider">Subgraph responded · {result.ms}ms</p>
          <p className="mt-1 text-uranium/90">
            {result.plans} plans · {result.passes} passes · {result.events} events
          </p>
        </div>
      )}

      {state === "failed" && (
        <div className="mt-3 flex gap-2 border border-aviation/40 bg-aviation/10 p-3 font-mono text-[11px] text-aviation">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wider">Probe failed</p>
            <p className="mt-1 break-words text-aviation/90">{error}</p>
            <p className="mt-1 text-aviation/70">
              Nothing on the site is affected — the chain path is already
              serving this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
