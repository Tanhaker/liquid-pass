"use client";

import { useDemo } from "@/lib/demo";

/**
 * The mode switch, plus the time-travel scrubber.
 *
 * Deliberately loud when demo mode is on. The failure this guards against is a
 * judge mistaking a simulation for a real transaction, so the banner is amber,
 * always visible, and says what it is in plain words.
 */

const STOPS = [
  { label: "Day 1", days: 1 },
  { label: "Day 10", days: 10 },
  { label: "Day 20", days: 20 },
  { label: "Day 29", days: 29 },
  { label: "Expired", days: 400 },
];

export function DemoBar() {
  const { enabled, setEnabled, timeTravel, setTimeTravel } = useDemo();

  if (!enabled) {
    return (
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <button
          onClick={() => setEnabled(true)}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[11px] text-faint transition-colors hover:text-muted"
        >
          <span className="size-1.5 rounded-full bg-life-crit" />
          LIVE — Arbitrum Sepolia · switch to demo mode
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="rounded-xl border border-life-low/40 bg-life-low/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-life-low">
            <span className="size-1.5 rounded-full bg-life-low" />
            DEMO MODE
          </span>
          <span className="text-[12px] text-life-low/90">
            Simulated — no blockchain transaction. Nothing here is real chain
            state.
          </span>
          <button
            onClick={() => setEnabled(false)}
            className="ml-auto rounded-lg border border-life-low/40 px-2.5 py-1 text-[11px] text-life-low hover:bg-life-low/10"
          >
            Back to live
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-life-low/20 pt-3">
          <span className="text-[10px] uppercase tracking-[0.16em] text-life-low/80">
            Simulate pass age
          </span>
          {STOPS.map((s) => (
            <button
              key={s.label}
              onClick={() => setTimeTravel(timeTravel === s.days ? null : s.days)}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
                timeTravel === s.days
                  ? "bg-life-low text-ink"
                  : "border border-life-low/40 text-life-low hover:bg-life-low/10"
              }`}
            >
              {s.label}
            </button>
          ))}
          {timeTravel !== null && (
            <button
              onClick={() => setTimeTravel(null)}
              className="text-[11px] text-life-low/80 underline underline-offset-2"
            >
              reset
            </button>
          )}
        </div>

        {timeTravel !== null && (
          <p className="mt-2 text-[11px] text-life-low/80">
            Showing every pass as it would look {timeTravel} day
            {timeTravel === 1 ? "" : "s"} further into its life. The real expiry
            timestamps on chain are unchanged.
          </p>
        )}
      </div>
    </div>
  );
}
