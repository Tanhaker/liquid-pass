import { NextResponse } from "next/server";
import { sessionAddress } from "@/lib/session";
import { LIQUID_PASS_URL } from "@/lib/site";

/**
 * Liquidity AI inside LiquidDesk.
 *
 * One assistant, not two. Liquid Pass already runs it -- the product
 * knowledge, the live chain snapshot and the model key all live there -- so
 * this route only forwards the question. Going through this server rather
 * than calling Liquid Pass from the page keeps the browser on one origin, and
 * lets the signed-in wallet be attached from the verified session instead of
 * from whatever address a page claims.
 */

export const maxDuration = 30;

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(req: Request): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
  recent.push(Date.now());
  hits.set(ip, recent);
  if (hits.size > 2_000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return NextResponse.json({ error: "`question` is required" }, { status: 400 });
  if (limited(req)) {
    return NextResponse.json({ error: "Too many questions. Try again in a few minutes." }, { status: 429 });
  }

  const address = (await sessionAddress()) ?? undefined;
  try {
    const res = await fetch(`${LIQUID_PASS_URL}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, address }),
      signal: AbortSignal.timeout(28_000),
      cache: "no-store",
    });
    const j = (await res.json()) as { answer?: string; mode?: string; error?: string };
    if (!j.answer) {
      return NextResponse.json({ error: j.error ?? "The assistant returned no answer." }, { status: 502 });
    }
    return NextResponse.json({ answer: j.answer, mode: j.mode === "model" ? "model" : "knowledge-base" });
  } catch {
    return NextResponse.json({ error: "Could not reach Liquidity AI." }, { status: 502 });
  }
}
