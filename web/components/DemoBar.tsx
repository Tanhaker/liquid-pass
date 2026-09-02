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
          className="flex items-center gap-2 border border-dark-border bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-grey transition-colors hover:border-uranium hover:text-uranium"
        >
          <span className="size-1.5 rounded-full bg-uranium" />
          LIVE // ARBITRUM SEPOLIA — SWITCH TO DEMO MODE
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="border border-aviation/50 bg-aviation/10 px-4 py-3 shadow-glow-amber">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wider text-aviation">
            <span className="size-1.5 rounded-full bg-life-low" />
            DEMO MODE
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-aviation/90">
            Simulated — no blockchain transaction. Nothing here is real chain
            state.
          </span>
          <button
            onClick={() => setEnabled(false)}
            className="ml-auto border border-aviation/50 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-aviation hover:bg-aviation/10"
          >
            Back to live
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-aviation/25 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-aviation/80">
            Simulate pass age
          </span>
          {STOPS.map((s) => (
            <button
              key={s.label}
              onClick={() => setTimeTravel(timeTravel === s.days ? null : s.days)}
              className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                timeTravel === s.days
                  ? "bg-aviation font-bold text-black"
                  : "border border-aviation/50 text-aviation hover:bg-aviation/10"
              }`}
            >
              {s.label}
            </button>
          ))}
          {timeTravel !== null && (
            <button
              onClick={() => setTimeTravel(null)}
              className="font-mono text-[11px] uppercase text-aviation/80 underline underline-offset-2"
            >
              reset
            </button>
          )}
        </div>

        {timeTravel !== null && (
          <p className="mt-2 font-mono text-[11px] text-aviation/80">
            Showing every pass as it would look {timeTravel} day
            {timeTravel === 1 ? "" : "s"} further into its life. The real expiry
            timestamps on chain are unchanged.
          </p>
        )}
      </div>
    </div>
  );
}
