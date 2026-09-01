import type { PlanMetadata } from "@/app/api/ipfs/route";

/**
 * Reading plan metadata from IPFS.
 *
 * Gateways are tried in order and the first success wins. Public gateways are
 * individually unreliable, and a plan card must never be held up waiting on
 * one -- hence the short per-gateway timeout and the null return rather than a
 * throw. Callers render the on-chain name and price, which is why those are
 * stored on chain in the first place.
 */

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const TIMEOUT_MS = 6_000;

/** In-memory, per-session. Metadata is immutable once pinned. */
const cache = new Map<string, PlanMetadata | null>();

export function cidFromUri(uri: string): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith("ipfs://")) return trimmed.slice("ipfs://".length);
  // Already a gateway URL: take the segment after /ipfs/.
  const m = trimmed.match(/\/ipfs\/([^/?#]+)/);
  return m ? m[1] : null;
}

export async function fetchPlanMetadata(uri: string): Promise<PlanMetadata | null> {
  const cid = cidFromUri(uri);
  if (!cid) return null;
  if (cache.has(cid)) return cache.get(cid) ?? null;

  for (const base of GATEWAYS) {
    try {
      const res = await fetch(base + cid, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as PlanMetadata;
      cache.set(cid, json);
      return json;
    } catch {
      // Try the next gateway. A dead gateway is expected, not exceptional.
    }
  }

  // Remembered as a miss so a broken CID is not retried on every render.
  cache.set(cid, null);
  return null;
}
