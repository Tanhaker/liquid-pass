"use client";

import { useState } from "react";

/**
 * Escrow yield — presented as a concept, not as a running balance.
 *
 * The brief for this asked for a live green counter reading
 * "Yield Earned: +0.25 USDC" to impress judges. I have not built that, and the
 * reason is worth stating in the code rather than only in a commit message:
 * there is no escrow, no Aave position and no yield. A number ticking upward
 * on screen is a claim that money is being earned. The first judge who asks
 * "is that real?" gets told no, and everything else on the page becomes
 * suspect -- including the parts that ARE real, which is most of it.
 *
 * The build spec also forbids it twice, in the rules about not fabricating
 * blockchain data or marketplace statistics.
 *
 * So this panel explains the mechanism and shows a worked example that is
 * labelled as arithmetic, with inputs the reader controls. It communicates the
 * same idea -- idle escrow money should not be idle -- and survives scrutiny.
 */

const APY = 0.045; // Aave USDC supply rates have sat around here; stated, not implied.

export function YieldConcept() {
  const [amount, setAmount] = useState(250);
  const [days, setDays] = useState(7);

  // Simple interest. Compounding over a days-long escrow is noise at these
  // sizes and would only make the number harder to check by hand.
  const yieldUsd = (amount * APY * days) / 365;
  const half = yieldUsd / 2;

  return (
    <section className="rounded-none border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-none bg-life-mid/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-life-mid">
          Concept
        </span>
        <h2 className="text-[15px] font-medium">Escrow that doesn&rsquo;t sit idle</h2>
      </div>

      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
        When a buyer bids on a second-hand pass, the money waits in escrow until
        the deal settles. That capital does nothing. If escrow instead supplied
        the funds to a lending pool for those few days, the interest could be
        split between buyer and seller rather than kept by whoever holds the
        float — which is what a bank does today.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            How it would work
          </p>
          <ol className="mt-4 space-y-0">
            {[
              ["Bid placed", "Buyer's USDC moves into the escrow contract."],
              ["Supplied", "Escrow supplies it to a lending pool. It starts earning immediately."],
              ["Deal settles", "Principal is withdrawn and paid to the seller in full."],
              ["Interest split", "The interest earned in between is shared between buyer and seller."],
            ].map(([t, d], i, a) => (
              <li key={t} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 rounded-full bg-life-mid" />
                  {i < a.length - 1 && <span className="w-px flex-1 bg-line" />}
                </div>
                <div className="pb-5">
                  <p className="text-[13px] font-medium">{t}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-none border border-line bg-ink p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Worked example
          </p>

          <label className="mt-4 block">
            <span className="text-[11px] text-muted">Escrowed amount</span>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                type="range"
                min={25}
                max={2000}
                step={25}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="flex-1 accent-[var(--color-life-mid)]"
              />
              <span className="tnum w-20 text-right text-[13px]">${amount}</span>
            </div>
          </label>

          <label className="mt-4 block">
            <span className="text-[11px] text-muted">Days in escrow</span>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="flex-1 accent-[var(--color-life-mid)]"
              />
              <span className="tnum w-20 text-right text-[13px]">{days}d</span>
            </div>
          </label>

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted">Interest earned</span>
              <span className="tnum text-[20px] font-semibold text-life-mid">
                ${yieldUsd.toFixed(4)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between text-[12px]">
              <span className="text-faint">to buyer / to seller</span>
              <span className="tnum text-muted">
                ${half.toFixed(4)} · ${half.toFixed(4)}
              </span>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Arithmetic, not a balance:{" "}
            <span className="tnum">
              ${amount} × {(APY * 100).toFixed(1)}% × {days}/365
            </span>
            . No escrow contract is deployed and no funds are supplied anywhere —
            this panel shows what the mechanism would pay, not what anything has
            earned.
          </p>
        </div>
      </div>

      <p className="mt-5 rounded-none border border-line bg-ink/60 px-4 py-3 text-[12px] leading-relaxed text-muted">
        <span className="font-medium text-text">Not implemented.</span> Liquid
        Pass settles resales atomically — the buyer pays and receives the pass in
        the same transaction, so today there is no escrow window for money to
        sit in. Yield-bearing escrow only becomes meaningful alongside bidding,
        where funds are committed before a deal closes.
      </p>
    </section>
  );
}
