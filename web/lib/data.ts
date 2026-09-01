import type { PublicClient } from "viem";
import { publicClient } from "./publicClient";
import {
  DEPLOY_BLOCK,
  LIQUID_PASS_ADDRESS,
  liquidPassAbi,
  type Pass,
  type Plan,
} from "./contract";

/**
 * Reading the marketplace without an indexer.
 *
 * The contract deliberately has no enumeration -- no `allPlans()`, no
 * `tokensOfOwner()`. That keeps it small (there are ~2KB of headroom under the
 * 24KB Stylus limit) but it means every list view has to be assembled here.
 *
 * Two sources are possible: The Graph, or reading the chain directly. This is
 * the direct path, and it is the PRIMARY one, not a fallback -- the subgraph
 * layers on top of it later. Nothing in the marketplace depends on an indexer
 * being up.
 *
 * The pattern throughout: use counters (`nextPlanId`, `nextTokenId`) to learn
 * how many entities exist, then batch view calls via multicall. Events are used
 * only for the activity feed, where the ordering IS the content.
 */

/** Every plan in the catalogue, newest first. */
export async function fetchPlans(client: PublicClient = publicClient): Promise<Plan[]> {
  const count = await client.readContract({
    address: LIQUID_PASS_ADDRESS,
    abi: liquidPassAbi,
    functionName: "nextPlanId",
  });

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  if (!ids.length) return [];

  // One multicall rather than 7 sequential reads per plan. Public RPCs rate
  // limit aggressively and a serial loop over a dozen plans is visibly slow.
  const results = await client.multicall({
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planName", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planUri", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planPriceOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planDurationOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planIssuerOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planIsOpen", args: [id] },
    ] as const),
  });

  const plans: Plan[] = ids.map((id, i) => {
    const o = i * 6;
    return {
      id,
      name: results[o] as string,
      uri: results[o + 1] as string,
      price: results[o + 2] as bigint,
      duration: results[o + 3] as bigint,
      issuer: results[o + 4] as `0x${string}`,
      open: results[o + 5] as boolean,
    };
  });

  // A plan whose issuer is the zero address does not exist. Cannot happen via
  // createPlan, but guards against a bad id reaching this far.
  return plans
    .filter((p) => p.issuer !== "0x0000000000000000000000000000000000000000")
    .reverse();
}

/** Every pass ever issued, newest first. */
export async function fetchPasses(client: PublicClient = publicClient): Promise<Pass[]> {
  const count = await client.readContract({
    address: LIQUID_PASS_ADDRESS,
    abi: liquidPassAbi,
    functionName: "nextTokenId",
  });

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  if (!ids.length) return [];

  const results = await client.multicall({
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "ownerOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "expiryOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "issuerOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "paidOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "priceOf", args: [id] },
    ] as const),
  });

  return ids
    .map((tokenId, i) => {
      const o = i * 6;
      return {
        tokenId,
        owner: results[o] as `0x${string}`,
        expiry: results[o + 1] as bigint,
        issuer: results[o + 2] as `0x${string}`,
        planId: results[o + 3] as bigint,
        paid: results[o + 4] as bigint,
        listed: results[o + 5] as bigint,
      };
    })
    .reverse();
}

/**
 * Passes currently for sale.
 *
 * Expired passes are excluded even when still listed. The contract refuses to
 * sell them, so showing one would be offering something unbuyable -- and there
 * is at least one such pass on chain already, left listed by a test run.
 */
export function activeListings(passes: Pass[], nowMs: number | null): Pass[] {
  // The caller supplies the clock. Reading Date.now() here made every useMemo
  // that called this impure, which is a hydration hazard on prerendered pages.
  const now = Math.floor((nowMs ?? 0) / 1000);
  return passes.filter((p) => p.listed > 0n && Number(p.expiry) > now);
}

export function passesOf(passes: Pass[], owner?: string): Pass[] {
  if (!owner) return [];
  const lower = owner.toLowerCase();
  return passes.filter((p) => p.owner.toLowerCase() === lower);
}

/**
 * The subset of contract events the activity feed renders, as viem needs them:
 * decoded ABI items, not signature strings. Pulled from the full ABI so the
 * two can never drift apart.
 */
const ACTIVITY_EVENT_NAMES = [
  "PassPurchased",
  "Listed",
  "Unlisted",
  "Bought",
  "PlanCreated",
  "Minted",
] as const;

const ACTIVITY_EVENTS = liquidPassAbi.filter(
  (item): item is Extract<typeof item, { type: "event" }> =>
    item.type === "event" &&
    (ACTIVITY_EVENT_NAMES as readonly string[]).includes(item.name),
);

export type Activity = {
  kind: "PassPurchased" | "Listed" | "Unlisted" | "Bought" | "PlanCreated" | "Minted";
  tokenId?: bigint;
  planId?: bigint;
  who?: `0x${string}`;
  price?: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

/**
 * Recent on-chain activity, newest first.
 *
 * Reads real logs -- never synthesised. If the RPC refuses the range this
 * throws and the caller shows a connection warning rather than inventing a
 * plausible-looking feed.
 */
/** Public RPCs cap getLogs ranges; 9k stays under the common 10k limit. */
const LOG_WINDOW = 9_000n;

export async function fetchActivity(
  limit = 25,
  client: PublicClient = publicClient,
): Promise<Activity[]> {
  // `getLogs` must be given the event definitions to decode against. Without
  // them it returns RAW logs -- no `eventName`, no `args` -- and any code that
  // reads `log.eventName` silently drops every entry. An earlier version did
  // exactly that and always returned [], which is indistinguishable from "no
  // activity yet" and so never surfaced.
  const latest = await client.getBlockNumber();

  // Walked in windows rather than one request. A single span from the deploy
  // block to head is already past the 10k-block limit most public endpoints
  // enforce, and the request neither resolves nor rejects promptly when it is
  // -- it just hangs, which strands the caller on a loading skeleton.
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_WINDOW) {
    const to = from + LOG_WINDOW - 1n;
    ranges.push({ from, to: to > latest ? latest : to });
  }

  const batches = await Promise.all(
    ranges.map((r) =>
      client
        .getLogs({
          address: LIQUID_PASS_ADDRESS,
          events: ACTIVITY_EVENTS,
          fromBlock: r.from,
          toBlock: r.to,
        })
        // One bad window must not lose the whole history.
        .catch(() => []),
    ),
  );

  const decoded: Activity[] = [];
  for (const log of batches.flat()) {
    const eventName = log.eventName as Activity["kind"] | undefined;
    if (!eventName) continue;
    const a = (log.args ?? {}) as Record<string, unknown>;
    decoded.push({
      kind: eventName,
      tokenId: a.tokenId as bigint | undefined,
      planId: a.planId as bigint | undefined,
      // Ordered most-specific first so a Bought log reports the buyer.
      who: (a.buyer ?? a.seller ?? a.to ?? a.issuer) as `0x${string}` | undefined,
      price: a.price as bigint | undefined,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? ("0x" as `0x${string}`),
    });
  }

  decoded.sort((x, y) => Number(y.blockNumber - x.blockNumber));
  return decoded.slice(0, limit);
}

export type MarketStats = {
  plans: number;
  issued: number;
  active: number;
  listed: number;
  /** Wei taken across primary sales. Resales are not included -- see below. */
  primaryVolume: bigint;
};

/**
 * Headline numbers for the landing page.
 *
 * `primaryVolume` sums `paidOf`, which is the original sale price of every
 * pass. It deliberately excludes resale volume: the contract stores the
 * original price per token, not a running total, so resale turnover cannot be
 * read back from a view call. Labelling this "total volume" would inflate it
 * with a number nothing on chain supports.
 */
export function marketStats(plans: Plan[], passes: Pass[], nowMs: number): MarketStats {
  const now = Math.floor(nowMs / 1000);
  let issued = 0;
  let active = 0;
  let listed = 0;
  let primaryVolume = 0n;
  for (const p of passes) {
    if (p.paid === 0n) continue; // minted directly, never sold
    issued++;
    if (Number(p.expiry) > now) {
      active++;
      if (p.listed > 0n) listed++;
    }
    primaryVolume += p.paid;
  }
  return { plans: plans.length, issued, active, listed, primaryVolume };
}
