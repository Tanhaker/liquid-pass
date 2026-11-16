import { parseEventLogs, type Log } from "viem";
import { isHiddenPlan, liquidPassAbi, marketplaceAbi } from "./contract";

/**
 * The activity feed's shared vocabulary: what an entry is, how a raw log
 * becomes one, and how one crosses the /api/activity boundary.
 *
 * Kept free of any RPC or browser dependency so the server reader
 * (lib/activityServer.ts) and the client fetcher (lib/data.ts) can both import
 * it without dragging each other in.
 */

export type Activity = {
  kind:
    | "PassPurchased"
    | "Listed"
    | "Unlisted"
    | "Bought"
    | "PlanCreated"
    | "Minted"
    | "PassTransferred";
  tokenId?: bigint;
  planId?: bigint;
  who?: `0x${string}`;
  price?: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

const ACTIVITY_EVENT_NAMES = [
  "PassPurchased",
  "Listed",
  "Unlisted",
  "Bought",
  "PlanCreated",
  "Minted",
  // Without this the feed silently omitted whole categories of event: gifts
  // emit only PassTransferred, and so does every slice produced by `split`.
  "PassTransferred",
] as const;

/**
 * Drawn from BOTH ABIs. Listed, Unlisted and Bought are emitted by the
 * marketplace contract, not the core, so a feed built from the core's ABI and
 * the core's address alone can never contain a resale -- which is what the
 * explorer did until this file existed, with its LISTED and BOUGHT filters
 * permanently empty.
 */
const ACTIVITY_EVENTS = [...liquidPassAbi, ...marketplaceAbi].filter(
  (item): item is Extract<typeof item, { type: "event" }> =>
    item.type === "event" && (ACTIVITY_EVENT_NAMES as readonly string[]).includes(item.name),
);

/** A log as stored and scanned: only the fields decoding needs. */
export type RawLog = {
  address: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  topics: string[];
  data: string;
};

/** Decoded entries, newest first. Logs that are not feed events are dropped. */
export function decodeActivity(logs: RawLog[]): Activity[] {
  const parsed = parseEventLogs({
    abi: ACTIVITY_EVENTS,
    strict: false,
    logs: logs.map(
      (l) =>
        ({
          address: l.address,
          blockNumber: BigInt(l.blockNumber),
          transactionHash: l.transactionHash,
          logIndex: l.logIndex,
          topics: l.topics,
          data: l.data,
          blockHash: null,
          transactionIndex: null,
          removed: false,
        }) as unknown as Log,
    ),
  });

  return parsed
    .map((log) => {
      const a = (log.args ?? {}) as Record<string, unknown>;
      return {
        entry: {
          kind: log.eventName as Activity["kind"],
          tokenId: a.tokenId as bigint | undefined,
          planId: a.planId as bigint | undefined,
          // Ordered most-specific first so a Bought log reports the buyer.
          who: (a.buyer ?? a.seller ?? a.to ?? a.issuer) as `0x${string}` | undefined,
          price: a.price as bigint | undefined,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? ("0x" as `0x${string}`),
        } satisfies Activity,
        logIndex: log.logIndex ?? 0,
      };
    })
    .sort((x, y) => Number(y.entry.blockNumber - x.entry.blockNumber) || y.logIndex - x.logIndex)
    .map((x) => x.entry);
}

/**
 * Drops everything that belongs to a hidden test plan: the plan's own
 * events, and every event of a pass that was bought from it.
 *
 * Listings, sales and transfers name only the pass, not its plan, so the
 * passes are found first from their PassPurchased events, which name both.
 */
export function visibleActivity(all: Activity[]): Activity[] {
  const hiddenPasses = new Set(
    all
      .filter((a) => a.kind === "PassPurchased" && isHiddenPlan(a.planId) && a.tokenId !== undefined)
      .map((a) => a.tokenId!.toString()),
  );
  return all.filter(
    (a) => !isHiddenPlan(a.planId) && !(a.tokenId !== undefined && hiddenPasses.has(a.tokenId.toString())),
  );
}

/** JSON cannot carry a bigint, so they travel as decimal strings. */
export type ActivityJson = {
  kind: Activity["kind"];
  tokenId?: string;
  planId?: string;
  who?: `0x${string}`;
  price?: string;
  blockNumber: string;
  txHash: `0x${string}`;
};

export function activityToJson(a: Activity): ActivityJson {
  return {
    kind: a.kind,
    tokenId: a.tokenId?.toString(),
    planId: a.planId?.toString(),
    who: a.who,
    price: a.price?.toString(),
    blockNumber: a.blockNumber.toString(),
    txHash: a.txHash,
  };
}

export function activityFromJson(j: ActivityJson): Activity {
  return {
    kind: j.kind,
    tokenId: j.tokenId === undefined ? undefined : BigInt(j.tokenId),
    planId: j.planId === undefined ? undefined : BigInt(j.planId),
    who: j.who,
    price: j.price === undefined ? undefined : BigInt(j.price),
    blockNumber: BigInt(j.blockNumber),
    txHash: j.txHash,
  };
}
