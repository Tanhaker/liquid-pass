import type { Pass } from "./contract";
import { evaluate, loadRules } from "./autosell";

/**
 * Pass alerts: the moments a holder would want to hear about without watching
 * the page.
 *
 *   sold      a pass this wallet had listed now belongs to someone else
 *   expiring  an active pass has under a day left (once per pass)
 *   rule      an auto-sell rule's condition is met (once per rule)
 *
 * Everything is worked out in the browser from data the site already reads,
 * and remembered in localStorage per wallet so an alert fires once. There is
 * no server and no push service: alerts arrive while a Liquid Pass tab is open,
 * as an in-page notice and, if the user allowed it, a system notification.
 *
 * Pure apart from storage, so the rules can be tested without a browser.
 */

export const ALERTS_ON_KEY = "liquid-pass-alerts-on";
const SEEN_KEY = "liquid-pass-alerts-seen";
const SNAPSHOT_KEY = "liquid-pass-alerts-snapshot";
const DAY_S = 86_400;

export type Alert = { key: string; title: string; message: string; href: string };

type Snapshot = Record<string, { listed: boolean }>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* alerts are a convenience */
  }
}

export function alertsOn(): boolean {
  return read<boolean>(ALERTS_ON_KEY, false);
}

export function setAlertsOn(on: boolean) {
  write(ALERTS_ON_KEY, on);
}

const left = (p: Pass, nowS: number) => Number(p.expiry) - nowS;

function hoursLabel(seconds: number): string {
  const h = Math.max(1, Math.round(seconds / 3600));
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * Compares the chain now with what this browser saw last time, for one wallet,
 * and returns the alerts that have not fired yet. Records them as fired.
 *
 * The first check for a wallet only records a baseline: a pass sold before the
 * alerts were watching is not news.
 */
export function collectAlerts(
  wallet: string,
  all: Pass[],
  planName: (p: Pass) => string,
  nowMs: number,
): Alert[] {
  const w = wallet.toLowerCase();
  const nowS = Math.floor(nowMs / 1000);
  const seenAll = read<Record<string, string[]>>(SEEN_KEY, {});
  const seen = new Set(seenAll[w] ?? []);
  const snapshots = read<Record<string, Snapshot>>(SNAPSHOT_KEY, {});
  const before = snapshots[w];

  const mine = all.filter((p) => p.owner.toLowerCase() === w);
  const byId = new Map(all.map((p) => [p.tokenId.toString(), p]));
  const out: Alert[] = [];

  if (before) {
    for (const [id, was] of Object.entries(before)) {
      const now = byId.get(id);
      if (was.listed && now && now.owner.toLowerCase() !== w) {
        out.push({
          key: `sold:${id}:${now.owner.toLowerCase()}`,
          title: `${planName(now)} sold`,
          message: `Your listed pass #${id} was bought. 90% of the price is in your wallet and the buyer has the days that were left.`,
          href: `/pass/${id}`,
        });
      }
    }
  }

  for (const p of mine) {
    const s = left(p, nowS);
    if (p.active && s > 0 && s <= DAY_S) {
      out.push({
        key: `expiring:${p.tokenId}`,
        title: `${planName(p)} expires soon`,
        message: `Pass #${p.tokenId} has ${hoursLabel(s)} left.${p.listed > 0n ? "" : " Sell the remaining time before it runs out."}`,
        href: `/pass/${p.tokenId}`,
      });
    }
  }

  const passById = new Map(mine.map((p) => [p.tokenId.toString(), p]));
  for (const rule of loadRules()) {
    if (rule.doneAt) continue;
    const pass = passById.get(rule.tokenId);
    if (!pass) continue;
    const e = evaluate(rule, pass, nowMs);
    if (e.fired) {
      out.push({
        key: `rule:${rule.id}`,
        title: `Auto-sell rule ready: ${rule.label}`,
        message: `${e.because} Open My Passes to list it with one click.`,
        href: "/dashboard",
      });
    }
  }

  snapshots[w] = Object.fromEntries(mine.map((p) => [p.tokenId.toString(), { listed: p.listed > 0n }]));
  write(SNAPSHOT_KEY, snapshots);

  const fresh = out.filter((a) => !seen.has(a.key));
  if (!before) {
    // Baseline only: remember what is already true, announce nothing.
    seenAll[w] = [...seen, ...out.map((a) => a.key)].slice(-200);
    write(SEEN_KEY, seenAll);
    return [];
  }
  seenAll[w] = [...seen, ...fresh.map((a) => a.key)].slice(-200);
  write(SEEN_KEY, seenAll);
  return fresh;
}
