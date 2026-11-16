import { NextResponse } from "next/server";
import { gate } from "@/lib/access";
import { summarise } from "@/lib/summarise";

/**
 * The paid feature. Everything above the `summarise` call is the gate, and it
 * is the same three lines any real endpoint would need.
 */

const MAX_CHARS = 20_000;

export async function POST(req: Request) {
  let who;
  try {
    who = await gate();
  } catch (e) {
    return NextResponse.json({ error: `Could not read the pass contract: ${(e as Error).message}` }, { status: 502 });
  }
  if (!who.signedIn) return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  if (!who.granted) {
    return NextResponse.json({ error: "This wallet does not hold an active pass." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").slice(0, MAX_CHARS).trim();
  if (!text) return NextResponse.json({ error: "`text` is required" }, { status: 400 });

  return NextResponse.json(summarise(text));
}
