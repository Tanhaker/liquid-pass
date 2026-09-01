import type { Activity } from "./data";
import type { Pass, Plan } from "./contract";
import { fairPrice, remaining } from "./contract";

/**
 * Pricing signals, derived from what has actually happened on chain.
 *
 * The obvious version of this feature says "Market demand for Copilot Pro is
 * HIGH today" -- which would be invented, because nothing measures demand.
 * Everything here comes from decoded events instead:
 *
 *   sold        how many passes of this plan have resold
 *   medianCut   the discount resales actually settled at, against the
 *               original price
 *   speed       median time between a Listed event and the Bought that
 *               followed it
 *
 * Where there is not enough history to say anything, this returns null and the
 * widget says so. A recommendation with no evidence behind it is worse than no
 * recommendation, because it looks identical to one that has evidence.
 */

export type PlanSignal = {
  planId: string;
  /** Resales observed for passes of this plan. */
  sold: number;
  /** Median discount off the original price that resales settled at, 0..100. */
  medianCut: number | null;
  /** Median seconds from listing to sale. */
  medianSpeed: number | null;
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function planSignals(
  activity: Activity[],
  passes: Pass[],
): Map<string, PlanSignal> {
  const planOf = new Map(passes.map((p) => [p.tokenId.toString(), p.planId.toString()]));
  const paidOf = new Map(passes.map((p) => [p.tokenId.toString(), p.paid]));

  // Oldest first, so a Listed is seen before the Bought that closes it.
  const ordered = [...activity].sort((a, b) => Number(a.blockNumber - b.blockNumber));

  const listedAt = new Map<string, bigint>();
  const cuts = new Map<string, number[]>();
  const speeds = new Map<string, number[]>();
  const sold = new Map<string, number>();

  for (const e of ordered) {
    const token = e.tokenId?.toString();
    if (!token) continue;
    const plan = planOf.get(token);
    if (!plan) continue;

    if (e.kind === "Listed") {
      listedAt.set(token, e.blockNumber);
    } else if (e.kind === "Bought") {
      sold.set(plan, (sold.get(plan) ?? 0) + 1);

      const original = paidOf.get(token) ?? 0n;
      if (original > 0n && e.price !== undefined && e.price > 0n && e.price < original) {
        const cut = Number(((original - e.price) * 100n) / original);
        cuts.set(plan, [...(cuts.get(plan) ?? []), cut]);
      }

      const from = listedAt.get(token);
      if (from !== undefined) {
        // Arbitrum blocks are roughly a quarter second; this is an order-of-
        // magnitude figure and is presented as such, never as a precise time.
        const blocks = Number(e.blockNumber - from);
        speeds.set(plan, [...(speeds.get(plan) ?? []), Math.round(blocks * 0.25)]);
        listedAt.delete(token);
      }
    } else if (e.kind === "Unlisted") {
      listedAt.delete(token);
    }
  }

  const out = new Map<string, PlanSignal>();
  const plans = new Set([...sold.keys(), ...cuts.keys(), ...speeds.keys()]);
  for (const planId of plans) {
    out.set(planId, {
      planId,
      sold: sold.get(planId) ?? 0,
      medianCut: median(cuts.get(planId) ?? []),
      medianSpeed: median(speeds.get(planId) ?? []),
    });
  }
  return out;
}

export type Suggestion = {
  /** Suggested opening ask, in wei. */
  price: bigint;
  /** The sentence shown to the user, and the evidence behind it. */
  headline: string;
  evidence: string;
  /** False when there is no history, so the UI can say it is a starting point. */
  grounded: boolean;
};

/**
 * What to open the listing at.
 *
 * Starts from the time-proportional value, then leans on observed behaviour if
 * there is any: if resales of this plan have been settling 40% under the
 * original, opening at fair value will sit unsold, so the suggestion moves.
 */
export function suggestPrice(
  pass: Pass,
  plan: Plan | undefined,
  signal: PlanSignal | undefined,
  nowMs: number | null,
): Suggestion | null {
  const fair = fairPrice(pass.paid, pass.expiry, plan?.duration ?? 0n, nowMs);
  if (fair === null || fair <= 0n) return null;

  const left = remaining(pass.expiry, nowMs ?? Date.now());
  const days = Math.floor(left / 86400);

  if (!signal || signal.sold === 0 || signal.medianCut === null) {
    return {
      price: fair,
      headline: `Open at its time value`,
      evidence:
        "No resales of this plan yet, so there is nothing to price against. This is the remaining time valued proportionally, which is a fair starting point.",
      grounded: false,
    };
  }

  // Meet the market where it has actually cleared, not where we would like it
  // to. `medianCut` is measured against the original price, so apply it there
  // and take whichever is lower.
  const marketPrice = (pass.paid * BigInt(100 - signal.medianCut)) / 100n;
  const price = marketPrice < fair ? marketPrice : fair;

  return {
    price,
    headline:
      marketPrice < fair
        ? `Price under time value to actually sell`
        : `Time value is in line with the market`,
    evidence:
      `${signal.sold} resale${signal.sold === 1 ? "" : "s"} of this plan settled at a median ` +
      `${signal.medianCut}% below the original price` +
      (signal.medianSpeed !== null
        ? `, typically about ${signal.medianSpeed < 120 ? `${signal.medianSpeed}s` : `${Math.round(signal.medianSpeed / 60)} min`} after listing.`
        : ".") +
      ` With ${days} day${days === 1 ? "" : "s"} left, that puts this pass near the figure above.`,
    grounded: true,
  };
}
