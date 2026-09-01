import type { Pass, Plan } from "./contract";
import { remaining } from "./contract";

/**
 * Auto-sell rules.
 *
 * WHAT THIS HONESTLY IS, because the obvious reading of "if I don't open
 * Netflix for 7 days, sell my pass" cannot be built:
 *
 *   1. Nothing on chain knows whether you opened Netflix. There is no signal,
 *      no oracle, and no way to acquire one. Any code claiming otherwise would
 *      be inventing the input.
 *   2. Listing a pass is a state-changing transaction. Firing one without you
 *      present means holding your key or a session key the contract does not
 *      implement. Neither is something to build hours before a demo.
 *
 * So a rule here is a WATCH, not an agent. It evaluates conditions that are
 * genuinely observable, and when one fires it surfaces a one-click listing for
 * you to sign. The chain still gets a transaction you authorised; what the
 * rule removes is having to remember.
 *
 * The three observable conditions:
 *   daysLeft     -- from the pass's expiry. Fully on-chain.
 *   byDate       -- wall clock.
 *   idle         -- how long since this pass was last used to prove access
 *                   through /verify on this device. A real signal about YOUR
 *                   usage of Liquid Pass, not a claim about Netflix.
 *
 * Rules live in localStorage: per-browser, never sent anywhere. There is no
 * backend to hold them and adding one to store a handful of preferences would
 * be the wrong trade.
 */

export type Condition =
  | { kind: "daysLeft"; days: number }
  | { kind: "byDate"; iso: string }
  | { kind: "idle"; days: number };

export type Rule = {
  id: string;
  tokenId: string;
  /** Human label for the pass, so a rule reads sensibly after it fires. */
  label: string;
  condition: Condition;
  /** Asking price in ETH, as typed. Empty means "use the time value". */
  priceEth: string;
  createdAt: number;
  /** Set once the rule has been acted on, so it stops nagging. */
  doneAt?: number;
};

const RULES_KEY = "liquid-pass-autosell-rules";
const USE_KEY = "liquid-pass-last-verified";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private windows and blocked site data throw. Rules are a convenience;
    // losing them must never break the page.
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not being able to persist is not worth failing over */
  }
}

export function loadRules(): Rule[] {
  return read<Rule[]>(RULES_KEY, []);
}

export function saveRules(rules: Rule[]) {
  write(RULES_KEY, rules);
}

export function addRule(rule: Rule): Rule[] {
  const next = [...loadRules().filter((r) => r.id !== rule.id), rule];
  saveRules(next);
  return next;
}

export function removeRule(id: string): Rule[] {
  const next = loadRules().filter((r) => r.id !== id);
  saveRules(next);
  return next;
}

/** Called by /verify whenever a pass is confirmed as granting access. */
export function markUsed(tokenId: string) {
  const map = read<Record<string, number>>(USE_KEY, {});
  map[tokenId] = Date.now();
  write(USE_KEY, map);
}

export function lastUsed(tokenId: string): number | null {
  const map = read<Record<string, number>>(USE_KEY, {});
  return map[tokenId] ?? null;
}

export type Evaluated = {
  rule: Rule;
  fired: boolean;
  /** Why it did or did not fire, in words fit to show a user. */
  because: string;
};

export function evaluate(rule: Rule, pass: Pass | undefined, nowMs: number): Evaluated {
  if (!pass) {
    return { rule, fired: false, because: "That pass is no longer in this wallet." };
  }
  if (pass.listed > 0n) {
    return { rule, fired: false, because: "Already listed." };
  }

  const left = remaining(pass.expiry, nowMs);
  if (left <= 0) {
    return { rule, fired: false, because: "Expired — it can no longer be listed." };
  }
  const daysLeft = Math.floor(left / 86400);

  switch (rule.condition.kind) {
    case "daysLeft": {
      const fired = daysLeft <= rule.condition.days;
      return {
        rule,
        fired,
        because: fired
          ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left, at or below your ${rule.condition.days}-day trigger.`
          : `${daysLeft} days left — fires at ${rule.condition.days}.`,
      };
    }
    case "byDate": {
      const when = Date.parse(rule.condition.iso);
      // An unparseable date must not silently fire.
      if (Number.isNaN(when)) {
        return { rule, fired: false, because: "That date could not be read." };
      }
      const fired = nowMs >= when;
      return {
        rule,
        fired,
        because: fired
          ? `The date you set has passed.`
          : `Fires on ${new Date(when).toLocaleDateString()}.`,
      };
    }
    case "idle": {
      const seen = lastUsed(rule.tokenId);
      if (seen === null) {
        return {
          rule,
          fired: false,
          because:
            "No access check recorded yet for this pass. Verify it once and the idle clock starts.",
        };
      }
      const idleDays = Math.floor((nowMs - seen) / 86_400_000);
      const fired = idleDays >= rule.condition.days;
      return {
        rule,
        fired,
        because: fired
          ? `Unused for ${idleDays} day${idleDays === 1 ? "" : "s"}, past your ${rule.condition.days}-day trigger.`
          : `Last used ${idleDays} day${idleDays === 1 ? "" : "s"} ago — fires at ${rule.condition.days}.`,
      };
    }
  }
}

export function describe(rule: Rule, plans?: Map<string, Plan>): string {
  const c = rule.condition;
  const when =
    c.kind === "daysLeft"
      ? `when ${c.days} day${c.days === 1 ? "" : "s"} or fewer remain`
      : c.kind === "byDate"
        ? `on ${new Date(c.iso).toLocaleDateString()}`
        : `if unused for ${c.days} day${c.days === 1 ? "" : "s"}`;
  const price = rule.priceEth ? `${rule.priceEth} ETH` : "its time value";
  void plans;
  return `List ${rule.label} for ${price} ${when}`;
}
