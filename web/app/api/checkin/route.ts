import { NextResponse } from "next/server";
import { isResponse, type CheckInResponse } from "@/lib/checkin";

/**
 * Carries a signed check-in from the holder's screen to the scanner's.
 *
 * A relay and nothing more. It never decides who gets in: the scanner
 * verifies the signature and reads the contract itself, so a wrong or forged
 * entry here is simply rejected over there. It stores no wallet keys, and
 * what it holds is already public the moment it is signed.
 *
 * Entries live in memory for two minutes. On serverless hosting a request can
 * land on a different instance and miss an entry, which is why the pages also
 * offer a code to copy across by hand -- the relay is a convenience, never
 * the only way through.
 */

const TTL_MS = 2 * 60_000;
const MAX_ENTRIES = 500;
const pending = new Map<string, { response: CheckInResponse; at: number }>();

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [nonce, entry] of pending) if (entry.at < cutoff) pending.delete(nonce);
  // Oldest first: a Map iterates in insertion order.
  while (pending.size > MAX_ENTRIES) pending.delete(pending.keys().next().value as string);
}

const noStore = { headers: { "Cache-Control": "no-store" } };

/** The holder's page posts the signed response here. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isResponse(body)) {
    return NextResponse.json({ error: "Not a check-in response" }, { status: 400, ...noStore });
  }
  prune();
  pending.set(body.nonce, {
    response: { nonce: body.nonce, tokenId: body.tokenId, signature: body.signature },
    at: Date.now(),
  });
  return NextResponse.json({ ok: true }, noStore);
}

/** The scanner asks for answers to the challenges it is showing. Each is handed over once. */
export async function GET(req: Request) {
  const nonces = (new URL(req.url).searchParams.get("nonces") ?? "").split(",").slice(0, 12);
  prune();
  for (const nonce of nonces) {
    const entry = pending.get(nonce);
    if (entry) {
      pending.delete(nonce);
      return NextResponse.json({ response: entry.response }, noStore);
    }
  }
  return NextResponse.json({ response: null }, noStore);
}
