import { NextResponse } from "next/server";
import { gate } from "@/lib/access";
import { recordUse } from "@/lib/usage";

/**
 * "Am I in?" -- read from the chain on every call, never cached, so a pass
 * sold a moment ago is already reflected here.
 *
 * An unlocked answer also counts as a use of the pass, which Liquid Pass's
 * "sell if unused" rules need to know about (lib/usage.ts).
 */
export async function GET(req: Request) {
  try {
    const who = await gate();
    if (who.signedIn && who.granted) {
      await recordUse(who.pass.tokenId, req.headers.get("host") ?? "localhost");
    }
    return NextResponse.json(who, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read the pass contract: ${(e as Error).message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
