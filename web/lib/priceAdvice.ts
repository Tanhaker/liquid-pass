import { formatEthShort, remaining, type Pass, type Plan } from "./contract";
import type { PlanSignal, Suggestion } from "./signals";

/**
 * The fair-price advisor's explanation: what the model is told, and how its
 * answer is checked before anyone sees it.
 *
 * The price itself is never the model's. lib/signals.ts computes it from the
 * time left and from resales that actually happened. The model's only job is
 * to put that reasoning into two plain sentences -- and because a confident
 * sentence with a made-up figure is worse than no sentence, every number it
 * writes has to be one it was given. Anything else is thrown away and the
 * rule-based wording is shown instead, labelled as such.
 *
 * Pure functions only, so the server route and the tests share one copy.
 */

export type PriceFacts = {
  planName: string;
  /** What the pass cost new, as the UI formats it. */
  originalEth: string;
  planDays: number;
  daysLeft: number;
  hoursLeft: number;
  /** Share of the plan's time still left, 0..100. */
  percentLeft: number;
  /** Resales of this plan seen on chain. */
  resales: number;
  /** Median discount those resales settled at, against the original price. */
  medianCutPct: number | null;
  /** True when the suggestion sits under the time value to match past resales. */
  belowTimeValue: boolean;
};

export function priceFacts(
  pass: Pass,
  plan: Plan | undefined,
  signal: PlanSignal | undefined,
  suggestion: Suggestion,
  nowMs: number,
): PriceFacts {
  const left = remaining(pass.expiry, nowMs);
  const duration = Number(plan?.duration ?? 0n);
  return {
    planName: plan?.name || `Plan #${pass.planId}`,
    originalEth: formatEthShort(pass.paid),
    planDays: Math.round(duration / 86400),
    daysLeft: Math.floor(left / 86400),
    hoursLeft: Math.floor(left / 3600),
    percentLeft: duration > 0 ? Math.min(100, Math.round((left * 100) / duration)) : 0,
    resales: signal?.sold ?? 0,
    medianCutPct: signal?.medianCut ?? null,
    belowTimeValue: suggestion.grounded && suggestion.headline.startsWith("Price under"),
  };
}

export const PRICE_SYSTEM = [
  "You are Liquidity AI, the fair-price advisor inside the Liquid Pass marketplace.",
  "A seller is about to list the unused time on a subscription pass. The asking price has ALREADY been calculated; you only explain the reasoning.",
  "Write at most two short sentences, in plain English, addressed to the seller as 'you'.",
  "Base the explanation on the time left, the plan's original price and the recent resales, using ONLY the facts provided.",
  "Do not write any number that is not in the facts. Do not state or guess the asking price.",
  "Do not promise a sale, and do not give investment advice. No markdown, no lists, no line breaks.",
  'Reply with JSON only: {"explanation": "..."}',
].join("\n");

export function pricePrompt(f: PriceFacts): string {
  return [
    "FACTS:",
    `- Plan: ${f.planName}, a ${f.planDays}-day plan that cost ${f.originalEth} ETH new.`,
    f.daysLeft >= 2
      ? `- Time left on this pass: ${f.daysLeft} days, which is ${f.percentLeft}% of the plan.`
      : `- Time left on this pass: ${f.hoursLeft} hours, which is ${f.percentLeft}% of the plan.`,
    f.resales > 0 && f.medianCutPct !== null
      ? `- Recent resales of this plan: ${f.resales}, settling at a median ${f.medianCutPct}% below the original price.`
      : "- Recent resales of this plan: none yet, so there is no market price to compare with.",
    f.belowTimeValue
      ? "- The asking price was set BELOW the value of the time left, to match what past resales actually sold for."
      : "- The asking price was set at the value of the time left, in proportion to the original price.",
    "- The price keeps falling every second after listing and reaches zero at expiry.",
  ].join("\n");
}

const MAX_LEN = 420;

/**
 * Whether a model's sentence is fit to show.
 *
 * The number check is the one that matters: each figure in the text must be
 * one of the figures in the facts. A model that writes "3 resales" when there
 * were 2, or invents a price, fails here rather than reaching the seller.
 */
export function explanationProblem(text: unknown, f: PriceFacts): string | null {
  if (typeof text !== "string") return "not a string";
  const t = text.trim();
  if (t.length < 30) return "too short";
  if (t.length > MAX_LEN) return "too long";
  if (/[\n\r*#`]/.test(t)) return "contains markdown or line breaks";
  if (/guarantee|invest|profit|will sell|sure to sell/i.test(t)) return "makes a promise or gives investment advice";

  const allowed = new Set(
    [f.planDays, f.daysLeft, f.hoursLeft, f.percentLeft, f.resales, f.medianCutPct, 100, 0]
      .filter((n): n is number => n !== null)
      .map(String),
  );
  allowed.add(f.originalEth);
  allowed.add(String(Number(f.originalEth)));
  // "2,954 days" is the same figure as 2954; drop thousands separators first.
  const plain = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  for (const n of plain.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!allowed.has(n) && !allowed.has(String(Number(n)))) return `uses a number that was not in the facts: ${n}`;
  }
  return null;
}

/** Pulls {"explanation": "..."} out of a model reply, tolerating a ```json fence. */
export function parseExplanation(raw: string): unknown {
  const body = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return (JSON.parse(body) as { explanation?: unknown }).explanation;
  } catch {
    return undefined;
  }
}
