import { NextResponse } from "next/server";

/**
 * Pins plan metadata to IPFS via Pinata.
 *
 * Server-side only. PINATA_JWT is read from the environment and never reaches
 * the browser -- a JWT in client code would let anyone pin to the account.
 * Note the variable is NOT prefixed NEXT_PUBLIC_, which is what keeps Next from
 * inlining it into the bundle.
 *
 * The endpoint returns a CID. Nothing in the marketplace depends on it: plan
 * names and prices live on chain precisely so the product keeps working when
 * IPFS does not.
 */

const PIN_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export type PlanMetadata = {
  name: string;
  description?: string;
  image?: string;
  category?: string;
  durationDays?: number;
  issuer?: string;
};

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    // 501 rather than 500: the code is fine, the deployment is unconfigured.
    // The message says exactly what to do rather than leaking a stack trace.
    return NextResponse.json(
      {
        error: "IPFS is not configured",
        detail: "Set PINATA_JWT in the server environment to enable pinning.",
      },
      { status: 501 },
    );
  }

  let body: PlanMetadata;
  try {
    body = (await req.json()) as PlanMetadata;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "`name` is required" }, { status: 400 });
  }

  // Whitelisted rather than spread: this is user input going to a third party
  // under our account, and an unbounded object is an unbounded upload.
  const metadata = {
    name: body.name.slice(0, 120),
    description: (body.description ?? "").slice(0, 800),
    image: (body.image ?? "").slice(0, 400),
    category: (body.category ?? "").slice(0, 60),
    durationDays: Number.isFinite(body.durationDays) ? body.durationDays : undefined,
    issuer: (body.issuer ?? "").slice(0, 60),
    schema: "liquid-pass/plan/1",
  };

  try {
    const res = await fetch(PIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name: `liquid-pass-plan-${metadata.name}` },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Pinata rejected the upload", detail: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const json = (await res.json()) as { IpfsHash?: string };
    if (!json.IpfsHash) {
      return NextResponse.json({ error: "Pinata returned no CID" }, { status: 502 });
    }

    return NextResponse.json({
      cid: json.IpfsHash,
      uri: `ipfs://${json.IpfsHash}`,
      gateway: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach Pinata", detail: (e as Error).message },
      { status: 502 },
    );
  }
}

export async function GET() {
  // Lets the issuer form show the right state before anyone tries to upload.
  return NextResponse.json({ configured: Boolean(process.env.PINATA_JWT) });
}
