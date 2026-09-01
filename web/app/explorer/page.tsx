"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { Banner, Empty, useNow } from "@/components/ui";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS,
  liquidPassAbi,
  shortAddress,
} from "@/lib/contract";
import { fetchActivity, type Activity } from "@/lib/data";
import { fetchActivityFromSubgraph, subgraphConfigured, type Source } from "@/lib/graph";

/**
 * On-chain event explorer.
 *
 * Two data paths, both real:
 *   - a getLogs backfill on mount, for history
 *   - useWatchContractEvent for anything that lands while the page is open
 *
 * There is no subgraph behind this. The spec allows The Graph with a viem
 * fallback; this IS the viem path, and it is labelled as such rather than
 * claiming indexed data it does not have.
 */

const PRESETS = [
  { id: "all", label: "All events", match: () => true },
  { id: "purchases", label: "Purchases", match: (a: Activity) => a.kind === "PassPurchased" },
  { id: "resales", label: "Resales", match: (a: Activity) => a.kind === "Bought" },
  { id: "listings", label: "Listings", match: (a: Activity) => a.kind === "Listed" || a.kind === "Unlisted" },
  { id: "plans", label: "Plans created", match: (a: Activity) => a.kind === "PlanCreated" },
] as const;

const LABEL: Record<Activity["kind"], string> = {
  PassPurchased: "bought a new pass",
  Bought: "bought a resale",
  Listed: "listed for resale",
  Unlisted: "removed a listing",
  PlanCreated: "published a plan",
  Minted: "was issued a pass",
};

const TONE: Record<Activity["kind"], string> = {
  PassPurchased: "var(--color-life-full)",
  Bought: "var(--color-life-mid)",
  Listed: "var(--color-life-low)",
  Unlisted: "var(--color-faint)",
  PlanCreated: "var(--color-text)",
  Minted: "var(--color-faint)",
};

export default function ExplorerPage() {
  const client = usePublicClient();
  const [events, setEvents] = useState<Activity[]>([]);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [source, setSource] = useState<Source>("chain");

  const load = useCallback(async () => {
    try {
      // Subgraph first when one is configured, chain reads otherwise -- and
      // chain reads again if the indexer errors or is still syncing. Whichever
      // answered is recorded so the badge can say so honestly rather than
      // claiming indexed data it did not use.
      let a: Activity[];
      if (subgraphConfigured()) {
        try {
          a = await fetchActivityFromSubgraph(100);
          setSource("subgraph");
        } catch {
          a = await fetchActivity(100);
          setSource("chain");
        }
      } else {
        a = await fetchActivity(100);
        setSource("chain");
      }
      setEvents(a);
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

  // Anything mined while the page is open. Real logs only -- on failure the
  // banner says the live channel is down rather than inventing entries.
  useWatchContractEvent({
    address: LIQUID_PASS_ADDRESS,
    abi: liquidPassAbi,
    onLogs: () => {
      setLiveCount((n) => n + 1);
      void load();
    },
  });

  const shown = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset)!;
    return events.filter(p.match);
  }, [events, preset]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Explorer</h1>
          <p className="mt-2 max-w-lg text-[14px] text-muted">
            Every Liquid Pass event, read straight from Arbitrum Sepolia.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[11px] text-muted">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-life-full opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-life-full" />
          </span>
          {source === "subgraph" ? "Indexed by The Graph" : "Direct chain data via viem"}
          {liveCount > 0 && (
            <span className="tnum text-faint">· {liveCount} live</span>
          )}
        </span>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="mt-8 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
              preset === p.id ? "bg-raised text-text" : "text-muted hover:text-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty
          title="No events yet"
          body="On-chain activity will appear here as soon as something happens."
        />
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {shown.map((a) => (
            <EventRow key={`${a.txHash}-${a.kind}-${a.tokenId ?? a.planId ?? ""}`} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ a }: { a: Activity }) {
  const now = useNow(15_000);
  const subject =
    a.tokenId !== undefined
      ? `pass #${a.tokenId}`
      : a.planId !== undefined
        ? `plan #${a.planId}`
        : "";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: TONE[a.kind] }}
        aria-hidden
      />
      <span className="tnum text-muted">
        {a.who ? shortAddress(a.who) : "—"}
      </span>
      <span className="text-text">{LABEL[a.kind]}</span>
      {subject && <span className="tnum text-muted">{subject}</span>}
      {a.price !== undefined && a.price > 0n && (
        <span className="tnum" style={{ color: TONE[a.kind] }}>
          {formatEther(a.price)} ETH
        </span>
      )}
      <span className="tnum ml-auto text-[11px] text-faint">
        block {a.blockNumber.toString()}
        {now !== null && ""}
      </span>
      <a
        href={`${EXPLORER}/tx/${a.txHash}`}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-faint underline underline-offset-2 hover:text-muted"
      >
        tx
      </a>
    </li>
  );
}
