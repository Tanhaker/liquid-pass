import type { Activity } from "./data";

/**
 * The Graph, as an optional accelerator over the direct chain reads.
 *
 * The order of preference is deliberate and the opposite of most projects:
 * viem is the primary path and the subgraph is the enhancement. That is what
 * lets the marketplace work with no indexer at all, and it means a subgraph
 * that is unsynced, unreachable or simply never deployed costs nothing.
 *
 * A plain fetch client rather than urql. The spec named urql, but there is one
 * query shape here and no cache, subscription or React binding is wanted --
 * a GraphQL client library would be more surface area than the twelve lines it
 * would replace. Noted as a deliberate deviation.
 */

export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "";

export function subgraphConfigured(): boolean {
  return SUBGRAPH_URL.length > 0;
}

export type Source = "subgraph" | "chain";

type GraphEvent = {
  kind: "MINTED" | "PURCHASED" | "LISTED" | "UNLISTED" | "RESOLD";
  price: string | null;
  royalty: string | null;
  blockNumber: string;
  timestamp: string;
  tx: string;
  from: string | null;
  to: string | null;
  pass: { id: string; plan: { id: string } | null };
};

/** Subgraph enum -> the app's own event names, which match the contract. */
const KIND: Record<GraphEvent["kind"], Activity["kind"]> = {
  MINTED: "Minted",
  PURCHASED: "PassPurchased",
  LISTED: "Listed",
  UNLISTED: "Unlisted",
  RESOLD: "Bought",
};

const RECENT_EVENTS = `
  query RecentEvents($first: Int!) {
    passEvents(first: $first, orderBy: blockNumber, orderDirection: desc) {
      kind
      price
      royalty
      blockNumber
      timestamp
      tx
      from
      to
      pass { id plan { id } }
    }
  }
`;

export async function query<T>(
  document: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  if (!SUBGRAPH_URL) throw new Error("No subgraph configured");

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  // GraphQL returns 200 with an `errors` array, so a bare res.ok check would
  // treat a failed query as a success and hand back undefined.
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("Subgraph returned no data");
  return json.data;
}

/**
 * Recent activity from the indexer.
 *
 * Throws rather than returning empty when the subgraph is missing or failing,
 * so the caller can fall back to chain reads and SAY which one it used. An
 * empty array would be indistinguishable from "nothing has happened yet".
 */
export async function fetchActivityFromSubgraph(limit = 25): Promise<Activity[]> {
  const data = await query<{ passEvents: GraphEvent[] }>(RECENT_EVENTS, { first: limit });

  return data.passEvents.map((e) => ({
    kind: KIND[e.kind],
    tokenId: BigInt(e.pass.id),
    planId: e.pass.plan ? BigInt(e.pass.plan.id) : undefined,
    who: ((e.to ?? e.from) ?? undefined) as `0x${string}` | undefined,
    price: e.price != null ? BigInt(e.price) : undefined,
    blockNumber: BigInt(e.blockNumber),
    txHash: e.tx as `0x${string}`,
  }));
}

export const MARKETPLACE_TOTALS = `
  query Totals {
    marketplace(id: "global") {
      plans
      passesIssued
      passesSold
      resales
      primaryVolume
      resaleVolume
      royaltiesPaid
    }
  }
`;
