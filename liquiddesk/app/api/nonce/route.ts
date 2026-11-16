import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { issueChallenge, signInMessage } from "@/lib/session";

/** Step 1 of sign-in: a one-time message for this wallet to sign. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) {
    return NextResponse.json({ error: "A wallet address is required" }, { status: 400 });
  }
  const challenge = await issueChallenge(getAddress(address));
  const host = req.headers.get("host") ?? "localhost";
  return NextResponse.json(
    { message: signInMessage({ host, ...challenge }) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
