import { NextResponse } from "next/server";
import { isHex, verifyMessage } from "viem";
import { signInMessage, startSession, takeChallenge } from "@/lib/session";

/**
 * Step 2 of sign-in: check the wallet really signed the message we issued.
 *
 * The message is rebuilt here from the nonce this server stored, never taken
 * from the request -- otherwise a visitor could have the wallet sign one thing
 * and present another.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { signature?: string } | null;
  const signature = body?.signature;
  if (!signature || !isHex(signature)) {
    return NextResponse.json({ error: "A signature is required" }, { status: 400 });
  }

  const challenge = await takeChallenge();
  if (!challenge) {
    return NextResponse.json({ error: "Sign-in expired. Please try again." }, { status: 401 });
  }

  const host = req.headers.get("host") ?? "localhost";
  const valid = await verifyMessage({
    address: challenge.address,
    message: signInMessage({ host, ...challenge }),
    signature,
  }).catch(() => false);
  if (!valid) {
    return NextResponse.json({ error: "That signature does not match the wallet." }, { status: 401 });
  }

  await startSession(challenge.address);
  return NextResponse.json({ address: challenge.address });
}
