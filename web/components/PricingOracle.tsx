"use client";

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
    <div className="mt-3 rounded-none border border-line bg-ink p-3">
      <div className="flex items-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1.5 8.3 5.2 12 6.5 8.3 7.8 7 11.5 5.7 7.8 2 6.5l3.7-1.3z"
            stroke={s.grounded ? "var(--color-life-full)" : "var(--color-faint)"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="text-[11px] font-medium"
          style={{ color: s.grounded ? "var(--color-life-full)" : "var(--color-muted)" }}
        >
          {s.headline}
        </span>
        {!s.grounded && (
          <span className="ml-auto text-[9px] uppercase tracking-wider text-faint">
            no history yet
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-faint">{s.evidence}</p>

      <button
        type="button"
        onClick={() => onUse(formatEthShort(s.price))}
        className="tnum mt-2.5 rounded-none border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-bright hover:text-text"
      >
        use {formatEthShort(s.price)} ETH
      </button>
    </div>
  );
}
