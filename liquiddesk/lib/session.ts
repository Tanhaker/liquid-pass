import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAddress, isAddress } from "viem";

/**
 * Wallet sign-in, kept deliberately small.
 *
 * Connecting a wallet only tells a page which address the browser CLAIMS. To
 * know the visitor controls it, the server hands out a one-time nonce, the
 * wallet signs a message containing it, and the server checks the signature.
 * After that the address lives in a signed, httpOnly cookie.
 *
 * Signing is free and off chain. This server holds no wallet keys and can
 * move nothing -- the secret below only authenticates its own cookies.
 */

const SESSION_COOKIE = "unlock_session";
const NONCE_COOKIE = "unlock_nonce";
const SESSION_SECONDS = 12 * 60 * 60;
const NONCE_SECONDS = 5 * 60;

/**
 * A missing secret must not quietly become a guessable one. Dev gets a random
 * secret per process (sessions end when the server restarts); production
 * refuses to sign anything until SESSION_SECRET is set.
 */
let devSecret: string | null = null;
function secret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function seal(payload: string): string {
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function unseal(token: string | undefined): string | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const payload = Buffer.from(body, "base64url").toString();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return payload;
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/** The exact text the wallet shows and signs. Built only on the server. */
export function signInMessage(p: { host: string; address: string; nonce: string; issuedAt: string }) {
  return [
    `${p.host} wants you to sign in with your wallet:`,
    p.address,
    "",
    "This proves you control the wallet so LiquidDesk can check it for a Liquid Pass.",
    "It is free and does not send a transaction.",
    "",
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
  ].join("\n");
}

export type Challenge = { address: `0x${string}`; nonce: string; issuedAt: string };

/** Starts a sign-in: remembers a fresh nonce for this browser. */
export async function issueChallenge(address: `0x${string}`): Promise<Challenge> {
  const challenge: Challenge = {
    address,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: new Date().toISOString(),
  };
  (await cookies()).set(NONCE_COOKIE, seal(JSON.stringify(challenge)), cookieOptions(NONCE_SECONDS));
  return challenge;
}

/** The pending challenge, once. Reading it spends it, so a signature cannot be replayed. */
export async function takeChallenge(): Promise<Challenge | null> {
  const jar = await cookies();
  const payload = unseal(jar.get(NONCE_COOKIE)?.value);
  jar.delete(NONCE_COOKIE);
  if (!payload) return null;
  const c = JSON.parse(payload) as Challenge;
  if (Date.now() - Date.parse(c.issuedAt) > NONCE_SECONDS * 1000) return null;
  return c;
}

export async function startSession(address: `0x${string}`) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  (await cookies()).set(SESSION_COOKIE, seal(`${address}|${expires}`), cookieOptions(SESSION_SECONDS));
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in wallet, or null. */
export async function sessionAddress(): Promise<`0x${string}` | null> {
  const payload = unseal((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const [address, expires] = payload.split("|");
  if (!isAddress(address) || Number(expires) < Date.now() / 1000) return null;
  return getAddress(address);
}
