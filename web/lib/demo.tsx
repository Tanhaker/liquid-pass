"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Demo mode.
 *
 * This exists because a live demo can fail for reasons that have nothing to do
 * with the product: no testnet ETH, a wallet that will not connect, an RPC
 * having a bad minute. Demo mode keeps the story tellable when that happens.
 *
 * The hard rule, from the build spec and worth restating here because it is the
 * one thing that must never slip: simulated state is NEVER presented as
 * blockchain state. Every surface that can show simulated data must show the
 * DEMO badge at the same time, and no simulated action ever produces a
 * transaction hash or an Arbiscan link -- there is nothing to link to.
 *
 * The `timeTravel` value is separate from `enabled` on purpose: a judge can
 * scrub a pass through its life without pretending any purchase happened.
 */

export type DemoState = {
  enabled: boolean;
  /** Days elapsed to simulate, or null for real time. */
  timeTravel: number | null;
  setEnabled: (v: boolean) => void;
  setTimeTravel: (v: number | null) => void;
  /**
   * Shifts a real expiry backwards by the simulated elapsed days, so a card
   * renders as it WILL look rather than as it does. Returns the expiry
   * untouched when not time-travelling, so live mode is unaffected.
   */
  shiftExpiry: (expiry: bigint) => bigint;
  /**
   * Whether a pass reads as usable under the current mode.
   *
   * In live mode this is simply the contract's own `isActive`. While time
   * travelling it has to be derived from the shifted expiry instead, because
   * the chain's answer describes real time and the scrubber does not move
   * real time. Without this the scrubber recoloured the rings while the
   * counters kept reporting the live figures -- visibly inconsistent, which is
   * worse than not having the control.
   */
  effectiveActive: (chainActive: boolean, expiry: bigint, nowMs: number | null) => boolean;
};

const Ctx = createContext<DemoState | null>(null);

const STORAGE_KEY = "liquid-pass-demo";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [timeTravel, setTimeTravel] = useState<number | null>(null);

  // Restored after mount, never during render: reading storage while rendering
  // would disagree with the prerendered HTML.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setEnabledState(true);
    } catch {
      // Private windows and blocked site data throw here. Demo mode simply
      // starts off, which is the safe default.
    }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (!v) setTimeTravel(null);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, []);

  const shiftExpiry = useCallback(
    (expiry: bigint) => {
      if (!enabled || timeTravel === null) return expiry;
      return expiry - BigInt(Math.round(timeTravel * 86400));
    },
    [enabled, timeTravel],
  );

  const effectiveActive = useCallback(
    (chainActive: boolean, expiry: bigint, nowMs: number | null) => {
      if (!enabled || timeTravel === null) return chainActive;
      const shifted = Number(shiftExpiry(expiry));
      return shifted * 1000 > (nowMs ?? Date.now());
    },
    [enabled, timeTravel, shiftExpiry],
  );

  const value = useMemo(
    () => ({ enabled, timeTravel, setEnabled, setTimeTravel, shiftExpiry, effectiveActive }),
    [enabled, timeTravel, setEnabled, shiftExpiry, effectiveActive],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoState {
  const c = useContext(Ctx);
  if (!c) {
    // A no-op fallback rather than a throw: a component rendered outside the
    // provider should degrade to live mode, not crash the page.
    return {
      enabled: false,
      timeTravel: null,
      setEnabled: () => {},
      setTimeTravel: () => {},
      shiftExpiry: (e) => e,
      effectiveActive: (a) => a,
    };
  }
  return c;
}
