import { NextResponse } from "next/server";

/**
 * Today's mainnet ETH price in US dollars, for showing prices at a familiar
 * scale. The app runs on a testnet whose ETH is worth nothing, so every place
 * that shows a dollar figure says it is "at the mainnet ETH price".
 *
 * Two public sources, no key. Cached for five minutes at the CDN and in memory,
 * so the whole site makes a handful of requests an hour however busy it is.
 */

const SOURCES: Array<{ url: string; read: (j: unknown) => number }> = [
  {
    url: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    read: (j) => Number((j as { data?: { amount?: string } }).data?.amount),
  },
  {
    url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    read: (j) => Number((j as { ethereum?: { usd?: number } }).ethereum?.usd),
  },
];

const FRESH_MS = 5 * 60_000;
let memo: { at: number; usd: number } | null = null;

export async function GET() {
  if (!memo || Date.now() - memo.at > FRESH_MS) {
    for (const source of SOURCES) {
      try {
        const res = await fetch(source.url, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
        if (!res.ok) continue;
        const usd = source.read(await res.json());
        if (Number.isFinite(usd) && usd > 0) {
          memo = { at: Date.now(), usd };
          break;
        }
      } catch {
        // Try the next source.
      }
    }
  }
  if (!memo) {
    return NextResponse.json({ error: "No ETH price available" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { usd: memo.usd, at: memo.at },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
