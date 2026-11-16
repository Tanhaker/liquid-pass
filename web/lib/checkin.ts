import { isHex, recoverMessageAddress, zeroAddress, type PublicClient } from "viem";
import { publicClient } from "./publicClient";
import {
  LIQUID_PASS_ADDRESS,
  STREAM_RENTAL_ADDRESS,
  liquidPassAbi,
  streamRentalAbi,
} from "./contract";

/**
 * Secure QR check-in: a one-time challenge, signed by the pass holder's
 * wallet, checked by the scanner.
 *
 * A QR that just says "I own pass #4" can be screenshotted and shown by
 * anyone. Here the scanner makes up a random challenge, the holder's wallet
 * signs it (EIP-191 personal_sign, free, no transaction), and the scanner
 * recovers the signer and asks the contract whether that signer holds an
 * active pass. A screenshot is useless twice over: the challenge expires
 * after two minutes, and each one is accepted once.
 *
 * Everything that decides admit-or-reject runs in the SCANNER's browser. The
 * relay in /api/checkin only carries the signed blob from one screen to the
 * other; it cannot forge a signature and is trusted with nothing.
 */

/**
 * How long a challenge can be answered, and how often the scanner shows a
 * fresh one. One clock for both, so the code on screen is always the valid
 * one and the countdown beside it means exactly what it says.
 *
 * Two minutes rather than seconds because the holder's side is slow in real
 * life: unlock the phone, open the wallet, wait for it to load, approve. A
 * short window expired on people before they finished. What stops reuse is
 * not the window but that each challenge is accepted once.
 */
export const CHALLENGE_TTL_S: number = 120;
export const ROTATE_S = CHALLENGE_TTL_S;

/** 95 -> "1:35". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 120 -> "2 minutes", 45 -> "45 seconds". */
export const CHALLENGE_TTL_LABEL =
  CHALLENGE_TTL_S % 60 === 0
    ? `${CHALLENGE_TTL_S / 60} minute${CHALLENGE_TTL_S === 60 ? "" : "s"}`
    : `${CHALLENGE_TTL_S} seconds`;

export const CHECKIN_CHANNEL = "liquidpass-checkin";

export type Challenge = {
  /** 16 random bytes, hex. */
  nonce: string;
  /** Unix seconds. */
  expires: number;
  venue: string;
};

export type CheckInResponse = {
  nonce: string;
  tokenId: string;
  signature: `0x${string}`;
};

const NONCE = /^[0-9a-f]{32}$/;
const TOKEN = /^\d{1,12}$/;

export function newChallenge(venue: string, nowMs = Date.now()): Challenge {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return {
    nonce: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
    expires: Math.floor(nowMs / 1000) + CHALLENGE_TTL_S,
    venue: venue.trim().slice(0, 40) || "Main entrance",
  };
}

/**
 * The exact text the wallet shows and signs.
 *
 * The pass number is inside the signed text, so a signature for one pass
 * cannot be presented for another, and the venue is there so the holder can
 * see what they are checking in to.
 */
export function checkInMessage(c: Challenge, tokenId: string): string {
  return [
    "Liquid Pass check-in",
    "",
    `Venue: ${c.venue}`,
    `Pass: #${tokenId}`,
    `Challenge: ${c.nonce}`,
    `Valid until: ${new Date(c.expires * 1000).toISOString()}`,
    "",
    "Signing is free and does not send a transaction.",
  ].join("\n");
}

/** The link inside the scanner's QR. */
export function signUrl(origin: string, c: Challenge): string {
  const q = new URLSearchParams({ n: c.nonce, e: String(c.expires), v: c.venue });
  return `${origin}/checkin/sign?${q.toString()}`;
}

export function parseChallenge(search: string): Challenge | null {
  const q = new URLSearchParams(search);
  const nonce = q.get("n") ?? "";
  const expires = Number(q.get("e"));
  if (!NONCE.test(nonce) || !Number.isInteger(expires) || expires <= 0) return null;
  return { nonce, expires, venue: (q.get("v") ?? "").slice(0, 40) || "Main entrance" };
}

export function isResponse(r: unknown): r is CheckInResponse {
  const x = r as Partial<CheckInResponse> | null;
  return (
    !!x &&
    typeof x.nonce === "string" &&
    NONCE.test(x.nonce) &&
    typeof x.tokenId === "string" &&
    TOKEN.test(x.tokenId) &&
    typeof x.signature === "string" &&
    isHex(x.signature) &&
    x.signature.length === 132
  );
}

/** The copy-and-paste form, for when the two screens cannot reach each other. */
export function encodeResponse(r: CheckInResponse): string {
  return `LP1.${r.tokenId}.${r.nonce}.${r.signature}`;
}

export function decodeResponse(code: string): CheckInResponse | null {
  const [tag, tokenId, nonce, signature] = code.trim().split(".");
  const r = { tokenId, nonce, signature };
  return tag === "LP1" && isResponse(r) ? r : null;
}

export type Verdict =
  | {
      admit: true;
      tokenId: string;
      holder: `0x${string}`;
      planName: string;
      /** Unix seconds. */
      expiry: number;
      rented: boolean;
    }
  | { admit: false; reason: string; tokenId?: string; signer?: `0x${string}` };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The scanner's decision.
 *
 * `challenge` is the scanner's OWN record for the nonce in the response, or
 * undefined if it never issued one. The signed text is rebuilt from that
 * record rather than taken from the response, so an answer to someone else's
 * challenge, or to an edited one, recovers to the wrong address and fails.
 */
export async function verifyCheckIn(
  challenge: Challenge | undefined,
  alreadyUsed: boolean,
  r: CheckInResponse,
  nowMs = Date.now(),
  client: PublicClient = publicClient,
): Promise<Verdict> {
  const tokenId = r.tokenId;
  if (!challenge) return { admit: false, reason: "This code was not issued by this scanner.", tokenId };
  if (alreadyUsed) return { admit: false, reason: "This code was already used. Each code works once.", tokenId };
  if (nowMs / 1000 > challenge.expires) {
    return { admit: false, reason: `This code has expired. Codes last ${CHALLENGE_TTL_LABEL}.`, tokenId };
  }

  let signer: `0x${string}`;
  try {
    signer = await recoverMessageAddress({
      message: checkInMessage(challenge, tokenId),
      signature: r.signature,
    });
  } catch {
    return { admit: false, reason: "The signature is not valid.", tokenId };
  }

  const id = BigInt(tokenId);
  const [owner, active, expiry, plan] = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "ownerOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "isActive", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "expiryOf", args: [id] },
      { address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "planOf", args: [id] },
    ],
  });
  if (owner.status !== "success" || same(owner.result as string, zeroAddress)) {
    return { admit: false, reason: `Pass #${tokenId} does not exist.`, tokenId, signer };
  }
  if (active.status !== "success" || !active.result) {
    return { admit: false, reason: `Pass #${tokenId} has run out of time.`, tokenId, signer };
  }

  // A rented pass sits in the rental contract; access belongs to the renter.
  let holder = owner.result as `0x${string}`;
  const rented = same(holder, STREAM_RENTAL_ADDRESS);
  if (rented) {
    holder = (await client.readContract({
      address: STREAM_RENTAL_ADDRESS,
      abi: streamRentalAbi,
      functionName: "activeRenter",
      args: [id],
    })) as `0x${string}`;
    if (same(holder, zeroAddress)) {
      return { admit: false, reason: `Pass #${tokenId} is in rental escrow and nobody is renting it.`, tokenId, signer };
    }
  }

  if (!same(holder, signer)) {
    return {
      admit: false,
      reason: `The wallet that signed does not hold pass #${tokenId}.`,
      tokenId,
      signer,
    };
  }

  const planName =
    plan.status === "success"
      ? await client
          .readContract({
            address: LIQUID_PASS_ADDRESS,
            abi: liquidPassAbi,
            functionName: "planName",
            args: [plan.result as bigint],
          })
          .catch(() => "")
      : "";

  return {
    admit: true,
    tokenId,
    holder,
    planName: planName || `Plan #${plan.status === "success" ? plan.result : "?"}`,
    expiry: expiry.status === "success" ? Number(expiry.result) : 0,
    rented,
  };
}
