import { NextResponse } from "next/server";

/**
 * Turns a sentence into an auto-sell rule.
 *
 * "if I don't use my Notion pass for 7 days, sell it for 0.0002"
 *   -> { tokenHint: "Notion", condition: { kind: "idle", days: 7 }, priceEth: "0.0002" }
 *
 * The model only ever proposes STRUCTURE. It never lists anything, never signs
 * anything, and the result is validated against a fixed shape here before the
 * client is allowed to see it -- a model that returns nonsense produces a 422,
 * not a malformed rule sitting in someone's dashboard.
 *
 * Deliberately narrow: three condition kinds, all of them observable. If the
 * sentence asks for something we cannot detect -- "when Netflix usage drops" --
 * the model is instructed to say so rather than invent a condition that would
 * silently never fire.
 */

export const maxDuration = 20;

type Condition =
  | { kind: "daysLeft"; days: number }
  | { kind: "byDate"; iso: string }
  | { kind: "idle"; days: number };

type Parsed = {
  tokenHint: string;
  condition: Condition;
  priceEth: string;
  restated: string;
};

const SYSTEM = `You convert a sentence into a JSON auto-sell rule for Liquid Pass, a marketplace for resellable subscription passes.

Return ONLY a JSON object, no prose, no markdown fence:
{
  "tokenHint": string,   // which pass they mean: a plan name like "Notion Plus", or a token id like "4". "" if unclear.
  "condition": { "kind": "daysLeft", "days": N }
             | { "kind": "byDate", "iso": "YYYY-MM-DD" }
             | { "kind": "idle", "days": N },
  "priceEth": string,    // asking price in ETH as a decimal string, or "" to use the pass's time value
  "restated": string     // one short sentence restating the rule plainly
}

Condition meanings:
- daysLeft: fires when the pass has N or fewer days of access remaining.
- byDate: fires on a calendar date.
- idle: fires when the holder has not verified access to that pass through Liquid Pass for N days.

Map "if I don't open / don't use / stop using X for N days" to idle, because that is the closest thing actually observable.

If the sentence asks for something none of these can express, return:
{"error":"<short reason>"}

Never invent a price. If none is given, priceEth is "".`;

export async function POST(req: Request) {
  let text = "";
  try {
    text = String(((await req.json()) as { text?: string }).text ?? "").slice(0, 300);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "`text` is required" }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "Rule parsing needs a language model",
        detail: "GEMINI_API_KEY is not set. You can still add a rule with the form.",
      },
      { status: 501 },
    );
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 300,
            // Asking for JSON directly avoids the model wrapping it in a
            // markdown fence, which would then need stripping.
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "The model rejected the request", detail: (await res.text()).slice(0, 200) },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!raw) {
      return NextResponse.json({ error: "Empty response from the model" }, { status: 502 });
    }

    let parsed: Parsed & { error?: string };
    try {
      parsed = JSON.parse(raw) as Parsed & { error?: string };
    } catch {
      return NextResponse.json(
        { error: "The model did not return usable JSON" },
        { status: 502 },
      );
    }

    if (parsed.error) {
      // The model correctly refused something unrepresentable. Pass the reason
      // through rather than dressing it up as a rule.
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    // Validate rather than trust. A rule that never fires because `days` came
    // back as a string would be invisible until the moment it mattered.
    const c = parsed.condition;
    const ok =
      c &&
      ((c.kind === "daysLeft" && Number.isFinite(c.days) && c.days >= 0) ||
        (c.kind === "idle" && Number.isFinite(c.days) && c.days >= 0) ||
        (c.kind === "byDate" && !Number.isNaN(Date.parse(c.iso))));

    if (!ok) {
      return NextResponse.json(
        { error: "That didn't parse into a condition I can watch for." },
        { status: 422 },
      );
    }

    if (parsed.priceEth && !/^\d*\.?\d+$/.test(parsed.priceEth)) {
      parsed.priceEth = "";
    }

    return NextResponse.json({
      tokenHint: String(parsed.tokenHint ?? ""),
      condition: c,
      priceEth: parsed.priceEth ?? "",
      restated: String(parsed.restated ?? ""),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach the model", detail: (e as Error).message },
      { status: 502 },
    );
  }
}
