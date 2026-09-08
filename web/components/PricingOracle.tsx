"use client";

import { Sparkles } from "lucide-react";
import { formatEthShort, type Pass, type Plan } from "@/lib/contract";
import { suggestPrice, type PlanSignal } from "@/lib/signals";

/**
 * Pricing suggestion for a pass the user is about to list.
 *
 * Every claim carries its evidence in the same panel. The version of this
 * feature that says "demand is HIGH today" with nothing behind it is worse
 * than useless at a showcase: the first judge who asks where the number came
 * from gets no answer, and the honest parts of the app lose credibility too.
 *
 * When there is no resale history the panel says exactly that and falls back
 * to the time value, marked as a starting point rather than a recommendation.
 *
 * STYLING: restyled from the earlier token set (line / ink / faint / muted,
 * plus inline CSS-variable colours) to the grunge tokens used by the page it
 * sits on. The grounded/ungrounded distinction is now carried by uranium
 * versus zincGrey rather than by inline styles.
 */
export function PricingOracle({
  pass,
  plan,
  signal,
  nowMs,
  onUse,
}: {
  pass: Pass;
  plan: Plan | undefined;
  signal: PlanSignal | undefined;
  nowMs: number | null;
  onUse: (price: string) => void;
}) {
  const s = suggestPrice(pass, plan, signal, nowMs);
  if (!s) return null;

  return (
    <div className="border border-dark-border bg-dark p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles
          className={`h-3.5 w-3.5 shrink-0 ${s.grounded ? "text-uranium" : "text-zincGrey"}`}
        />
        <span
          className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
            s.grounded ? "text-uranium" : "text-zincGrey"
          }`}
        >
          {s.headline}
        </span>
        {!s.grounded && (
          <span className="ml-auto shrink-0 border border-dark-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zincGrey">
            no history yet
          </span>
        )}
      </div>

      <p className="mt-2 font-body text-[11px] leading-relaxed text-zincGrey">{s.evidence}</p>

      <button
        type="button"
        onClick={() => onUse(formatEthShort(s.price))}
        className="tnum mt-2.5 border border-dark-border bg-dark-surface px-2.5 py-1.5 font-mono text-[11px] uppercase text-zincGrey transition-all hover:border-uranium hover:text-alabaster"
      >
        use {formatEthShort(s.price)} ETH
      </button>
    </div>
  );
}
