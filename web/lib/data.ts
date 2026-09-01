import type { PublicClient } from "viem";
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
export async function fetchPlans(client: PublicClient): Promise<Plan[]> {
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
export async function fetchPasses(client: PublicClient): Promise<Pass[]> {
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
export async function fetchActivity(
  client: PublicClient,
  limit = 25,
): Promise<Activity[]> {
  const logs = await client.getLogs({
    address: LIQUID_PASS_ADDRESS,
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });

  const decoded: Activity[] = [];
  for (const log of logs) {
    // Topic-matching is done by viem's parseEventLogs upstream; here we accept
    // whatever decodes and skip what does not, so an unknown event added later
    // degrades to "not shown" rather than throwing.
    const ev = log as unknown as {
      eventName?: string;
      args?: Record<string, unknown>;
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    };
    if (!ev.eventName) continue;
    const a = (ev.args ?? {}) as Record<string, bigint | `0x${string}`>;
    decoded.push({
      kind: ev.eventName as Activity["kind"],
      tokenId: a.tokenId as bigint | undefined,
      planId: a.planId as bigint | undefined,
      who: (a.buyer ?? a.seller ?? a.to ?? a.issuer) as `0x${string}` | undefined,
      price: a.price as bigint | undefined,
      blockNumber: ev.blockNumber,
      txHash: ev.transactionHash,
    });
  }

  return decoded.reverse().slice(0, limit);
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
