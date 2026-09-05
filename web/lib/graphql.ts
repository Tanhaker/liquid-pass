import type { Pass, Plan } from "./contract";
import type { Activity } from "./data";

/**
 * GraphQL data layer for The Graph subgraph.
 *
 * This module provides the same fetchPlans / fetchPasses / fetchActivity
 * interface as data.ts, but powered by a GraphQL query against The Graph
 * instead of direct RPC multicalls. It is faster and does not hammer the
 * public RPC endpoint.
 *
 * Falls back to the RPC path (data.ts) if the subgraph URL is not configured
 * or the query fails.
 */

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!SUBGRAPH_URL) throw new Error("No subgraph URL configured");

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Subgraph query failed: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  return json.data as T;
}

// ─── Plans ──────────────────────────────────────────────────────────────────

type GqlPlan = {
  id: string;
  issuer: string;
  price: string;
  durationSeconds: string;
  open: boolean;
};

export async function fetchPlansGql(): Promise<Plan[]> {
  const data = await gql<{ plans: GqlPlan[] }>(`
    query {
      plans(first: 100, orderBy: id, orderDirection: desc) {
        id
        issuer
        price
        durationSeconds
        open
      }
    }
  `);

  return data.plans
    .filter((p) => p.issuer !== "0x0000000000000000000000000000000000000000")
    .map((p) => ({
      id: BigInt(p.id),
      name: "", // Not stored in subgraph; fall back to RPC for name/uri
      uri: "",
      price: BigInt(p.price),
      duration: BigInt(p.durationSeconds),
      issuer: p.issuer as `0x${string}`,
      open: p.open,
    }));
}

// ─── Passes ─────────────────────────────────────────────────────────────────

type GqlPass = {
  id: string;
  plan: { id: string } | null;
  owner: string;
  issuer: string;
  expiry: string;
  originalPrice: string | null;
  listedPrice: string | null;
};

export async function fetchPassesGql(): Promise<Pass[]> {
  const data = await gql<{ passes: GqlPass[] }>(`
    query {
      passes(first: 1000, orderBy: id, orderDirection: desc) {
        id
        plan { id }
        owner
        issuer
        expiry
        originalPrice
        listedPrice
      }
    }
  `);

  const now = Math.floor(Date.now() / 1000);

  return data.passes.map((p) => ({
    tokenId: BigInt(p.id),
    planId: p.plan ? BigInt(p.plan.id) : 0n,
    owner: p.owner as `0x${string}`,
    issuer: p.issuer as `0x${string}`,
    expiry: BigInt(p.expiry),
    paid: p.originalPrice ? BigInt(p.originalPrice) : 0n,
    listed: p.listedPrice ? BigInt(p.listedPrice) : 0n,
    active: Number(p.expiry) > now,
    current: p.listedPrice ? BigInt(p.listedPrice) : 0n, // Approximate; real decay needs RPC
    // The subgraph does not index listedAt, so the decay curve cannot be
    // reconstructed from here. Zero makes decayedPrice() decline to guess and
    // the UI fall back to the polled on-chain figure, rather than inventing a
    // slope from a listing time we do not have.
    listedAt: 0n,
  }));
}

// ─── Activity ───────────────────────────────────────────────────────────────

type GqlEvent = {
  id: string;
  kind: string;
  pass: { id: string };
  from: string | null;
  to: string | null;
  price: string | null;
  royalty: string | null;
  blockNumber: string;
  timestamp: string;
  tx: string;
};

export async function fetchActivityGql(limit = 25): Promise<Activity[]> {
  const data = await gql<{ passEvents: GqlEvent[] }>(`
    query($limit: Int!) {
      passEvents(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id
        kind
        pass { id }
        from
        to
        price
        royalty
        blockNumber
        timestamp
        tx
      }
    }
  `, { limit });

  return data.passEvents.map((e) => ({
    kind: mapKind(e.kind),
    tokenId: BigInt(e.pass.id),
    who: (e.to ?? e.from ?? undefined) as `0x${string}` | undefined,
    price: e.price ? BigInt(e.price) : undefined,
    blockNumber: BigInt(e.blockNumber),
    txHash: e.tx as `0x${string}`,
  }));
}

function mapKind(kind: string): Activity["kind"] {
  switch (kind) {
    case "PURCHASED": return "PassPurchased";
    case "LISTED": return "Listed";
    case "UNLISTED": return "Unlisted";
    case "RESOLD": return "Bought";
    case "MINTED": return "Minted";
    default: return "PassTransferred";
  }
}

// ─── Availability check ─────────────────────────────────────────────────────

export function isSubgraphConfigured(): boolean {
  return !!SUBGRAPH_URL;
}
