import { NextResponse } from "next/server";
import { gate } from "@/lib/access";

/**
 * "Am I in?" -- read from the chain on every call, never cached, so a pass
 * sold a moment ago is already reflected here.
 */
export async function GET() {
  try {
    return NextResponse.json(await gate(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read the pass contract: ${(e as Error).message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
