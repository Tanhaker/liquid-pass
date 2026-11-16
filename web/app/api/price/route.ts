import { NextResponse } from "next/server";
import { loadActivity } from "@/lib/activityServer";
import { fetchPasses, fetchPlans } from "@/lib/data";
import { planSignals, suggestPrice } from "@/lib/signals";
import {
  PRICE_SYSTEM,
  explanationProblem,
  parseExplanation,
  priceFacts,
  pricePrompt,
} from "@/lib/priceAdvice";

/**
 * Liquidity AI's fair-price advisor.
 *
 * Order matters and is the whole design: the price is computed first, from
 * the time left and from resales read off the chain, and only then is the
 * model asked to explain it. Its sentence is validated against the same facts
 * (lib/priceAdvice.ts) and discarded if it strays. The seller still types or
 * accepts the price and signs the listing themselves -- nothing here can list
 * a pass.
 *
 * Server-side so GEMINI_API_KEY never reaches the browser. Without a key, or
 * when the model's answer fails validation, the rule-based wording is
 * returned and labelled "rules", never dressed up as the model's.
 */

export const maxDuration = 30;

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: unknown }>();

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
  const body = (await req.json().catch(() => null)) as { tokenId?: unknown } | null;
  const tokenId = String(body?.tokenId ?? "");
  if (!/^\d{1,12}$/.test(tokenId)) {
    return NextResponse.json({ error: "`tokenId` is required" }, { status: 400 });
  }

  const hit = cache.get(tokenId);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);
  if (limited(req)) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  let pass, plan, signal;
  try {
    const [plans, passes, { activity }] = await Promise.all([fetchPlans(), fetchPasses(), loadActivity(500)]);
    pass = passes.find((p) => p.tokenId.toString() === tokenId);
    plan = pass && plans.find((p) => p.id === pass!.planId);
    signal = pass && planSignals(activity, passes).get(pass.planId.toString());
  } catch (e) {
    return NextResponse.json({ error: `Could not read the chain: ${(e as Error).message}` }, { status: 502 });
  }
  if (!pass) return NextResponse.json({ error: `Pass #${tokenId} does not exist` }, { status: 404 });

  const now = Date.now();
  const suggestion = suggestPrice(pass, plan, signal, now);
  if (!suggestion) {
    return NextResponse.json({ error: "This pass has no time value to price." }, { status: 422 });
  }
  const facts = priceFacts(pass, plan, signal, suggestion, now);

  const rules = (note: string) => ({ explanation: suggestion.evidence, source: "rules" as const, note, facts });
  const respond = (payload: unknown) => {
    cache.set(tokenId, { at: Date.now(), body: payload });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(payload);
  };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return respond(rules("Liquidity AI has no language model configured, so this is the rule-based explanation."));

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  /*
   * Two attempts, differing in one setting. Gemini 2.5 spends "thinking"
   * tokens out of the same output budget, and on a task this small it can
   * spend all of them and return no text at all -- which is what happened on
   * the first pass tested. Thinking is switched off first; the second attempt
   * leaves it alone, for a GEMINI_MODEL that does not accept the setting.
   */
  let note = "The language model did not answer in time, so this is the rule-based explanation.";
  for (const thinkingOff of [true, false]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        // Header rather than ?key=, so the key cannot leak through logs or a Referer.
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PRICE_SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: pricePrompt(facts) }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: thinkingOff ? 400 : 2000,
            responseMimeType: "application/json",
            ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        note = `The language model was unreachable (HTTP ${res.status}), so this is the rule-based explanation.`;
        continue;
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const explanation = parseExplanation(raw);
      const problem = explanationProblem(explanation, facts);
      if (!problem) return respond({ explanation: (explanation as string).trim(), source: "gemini" as const, facts });
      note = `The model's answer was discarded (${problem}), so this is the rule-based explanation.`;
    } catch {
      // Timed out or the network failed; `note` already says so.
    }
  }
  return respond(rules(note));
}
