import { cookies } from "next/headers";

/**
 * Tells Liquid Pass that a pass was just used here.
 *
 * Liquid Pass lets a holder write a rule like "if I don't use this pass for 7
 * days, sell it". Opening LiquidDesk with the pass is exactly the kind of use
 * that rule means, but the rule runs in the holder's browser on
 * liquidpass.xyz, a different address from this app.
 *
 * The two share a parent domain, so a cookie set on it is the whole bridge:
 * `lp_used`, holding `<tokenId>.<unix seconds>` pairs joined by `_`. Liquid
 * Pass reads it next to its own record (web/lib/autosell.ts). It is readable
 * by page script on purpose, carries nothing secret, and is never used to
 * decide access -- it only resets a reminder.
 */

const COOKIE = "lp_used";
/** A visit is polled every few seconds; one note per pass per 10 minutes is plenty. */
const REFRESH_SECONDS = 10 * 60;
const MAX_PASSES = 20;
const YEAR = 365 * 24 * 60 * 60;

/**
 * The parent domain both apps live under: desk.liquidpass.xyz -> .liquidpass.xyz.
 *
 * Returns undefined where there is no such domain to share: localhost (where
 * cookies already ignore the port, so dev works without it) and hosting
 * domains such as *.vercel.app, which browsers refuse cookies for anyway.
 */
function parentDomain(host: string): string | undefined {
  const name = host.split(":")[0].toLowerCase();
  if (name === "localhost" || /^[\d.]+$/.test(name) || name.endsWith(".vercel.app")) return undefined;
  const labels = name.split(".");
  return labels.length >= 2 ? `.${labels.slice(-2).join(".")}` : undefined;
}

export async function recordUse(tokenId: number, host: string) {
  const jar = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const uses = new Map<string, number>();
  for (const pair of (jar.get(COOKIE)?.value ?? "").split("_")) {
    const [id, seconds] = pair.split(".");
    if (/^\d+$/.test(id ?? "") && /^\d+$/.test(seconds ?? "")) uses.set(id, Number(seconds));
  }

  const key = String(tokenId);
  if (now - (uses.get(key) ?? 0) < REFRESH_SECONDS) return;
  uses.set(key, now);

  // Newest first, capped, so the cookie cannot grow without bound.
  const value = [...uses.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PASSES)
    .map(([id, seconds]) => `${id}.${seconds}`)
    .join("_");

  jar.set(COOKIE, value, {
    domain: parentDomain(host),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: YEAR,
  });
}
