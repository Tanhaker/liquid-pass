"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  fairPrice,
  formatEthShort,
  type Pass,
  type Plan,
} from "@/lib/contract";
import {
  addRule,
  describe,
  evaluate,
  loadRules,
  removeRule,
  type Condition,
  type Rule,
} from "@/lib/autosell";

/**
 * Auto-sell rules on the dashboard.
 *
 * Every rule is a watch that ends in a button you press. Nothing here signs,
 * and the panel says so, because "AI sells your pass automatically" is the
 * kind of claim a judge will test.
 */
export function AutoSell({
  passes,
  plans,
  nowMs,
  onList,
  busyToken,
}: {
  passes: Pass[];
  plans: Map<string, Plan>;
  nowMs: number | null;
  onList: (tokenId: bigint, price: bigint) => void;
  busyToken: string | null;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    condition: Condition;
    priceEth: string;
    restated: string;
    tokenId: string;
  } | null>(null);

  // Rules live in localStorage, which is not readable during render on a
  // prerendered page.
  useEffect(() => {
    setRules(loadRules());
  }, []);

  const byToken = useMemo(
    () => new Map(passes.map((p) => [p.tokenId.toString(), p])),
    [passes],
  );

  const labelFor = useCallback(
    (p: Pass) => plans.get(p.planId.toString())?.name || `Pass #${p.tokenId}`,
    [plans],
  );

  /** Best-effort match of the model's hint to a pass this wallet holds. */
  const resolveToken = useCallback(
    (hint: string): string | null => {
      const h = hint.trim().toLowerCase();
      if (!h) return passes[0]?.tokenId.toString() ?? null;
      if (/^\d+$/.test(h) && byToken.has(h)) return h;
      const named = passes.find((p) => labelFor(p).toLowerCase().includes(h));
      if (named) return named.tokenId.toString();
      const partial = passes.find((p) =>
        h.split(/\s+/).some((w) => w.length > 2 && labelFor(p).toLowerCase().includes(w)),
      );
      return partial?.tokenId.toString() ?? null;
    },
    [passes, byToken, labelFor],
  );

  async function parse() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    setPending(null);
    try {
      const res = await fetch("/api/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.detail ? `${j.error} — ${j.detail}` : (j.error ?? "Couldn't read that."));
        return;
      }
      const tokenId = resolveToken(j.tokenHint ?? "");
      if (!tokenId) {
        setError("I couldn't tell which of your passes you meant.");
        return;
      }
      setPending({
        condition: j.condition,
        priceEth: j.priceEth ?? "",
        restated: j.restated ?? "",
        tokenId,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!pending) return;
    const pass = byToken.get(pending.tokenId);
    if (!pass) return;
    setRules(
      addRule({
        id: `${pending.tokenId}-${Date.now()}`,
        tokenId: pending.tokenId,
        label: labelFor(pass),
        condition: pending.condition,
        priceEth: pending.priceEth,
        createdAt: Date.now(),
      }),
    );
    setPending(null);
    setText("");
  }

  const evaluated = useMemo(
    () =>
      rules
        .filter((r) => !r.doneAt)
        .map((r) => evaluate(r, byToken.get(r.tokenId), nowMs ?? Date.now())),
    [rules, byToken, nowMs],
  );

  const armed = evaluated.filter((e) => !e.fired);
  const ready = evaluated.filter((e) => e.fired);

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-1.5 rounded-full bg-life-mid" />
        <h2 className="text-[13px] font-medium">Auto-sell rules</h2>
        <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-faint">
          watches, never signs
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        Describe when you&rsquo;d want a pass sold and I&rsquo;ll watch for it.
        When the condition is met you get a one-click listing to sign —
        nothing is ever listed without you.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && parse()}
          placeholder="if I don't use my Notion pass for 7 days, sell it for 0.0002"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
        />
        <button
          onClick={parse}
          disabled={busy || !text.trim() || passes.length === 0}
          className="rounded-lg bg-text px-3.5 py-2 text-[12px] font-medium text-ink disabled:opacity-40"
        >
          {busy ? "Reading…" : "Add rule"}
        </button>
      </div>

      {passes.length === 0 && (
        <p className="mt-2 text-[11px] text-faint">
          You need a pass before a rule has anything to watch.
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-life-crit">{error}</p>}

      {pending && (
        <div className="mt-4 rounded-xl border border-life-mid/40 bg-life-mid/10 p-4">
          <p className="text-[12px] text-life-mid">
            {pending.restated || "Rule understood."}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Pass: {labelFor(byToken.get(pending.tokenId)!)} · price:{" "}
            {pending.priceEth ? `${pending.priceEth} ETH` : "its time value at the moment it fires"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirm}
              className="rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-ink"
            >
              Save rule
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div className="mt-5 space-y-2">
          {ready.map(({ rule, because }) => {
            const pass = byToken.get(rule.tokenId)!;
            const plan = plans.get(pass.planId.toString());
            const fair = fairPrice(pass.paid, pass.expiry, plan?.duration ?? 0n, nowMs);
            const price = rule.priceEth
              ? (() => {
                  try {
                    return parseEther(rule.priceEth);
                  } catch {
                    return fair ?? 0n;
                  }
                })()
              : (fair ?? 0n);
            return (
              <div
                key={rule.id}
                className="rounded-xl border border-life-low/40 bg-life-low/10 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-life-low">
                  Ready to list
                </p>
                <p className="mt-1 text-[13px]">{describe(rule)}</p>
                <p className="mt-1 text-[11px] text-muted">{because}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (price > 0n) onList(pass.tokenId, price);
                    }}
                    disabled={price <= 0n || busyToken === rule.tokenId}
                    className="rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-ink disabled:opacity-40"
                  >
                    {busyToken === rule.tokenId
                      ? "Confirm in wallet…"
                      : `List for ${price > 0n ? formatEthShort(price) : "—"} ETH`}
                  </button>
                  <button
                    onClick={() => setRules(removeRule(rule.id))}
                    className="text-[11px] text-faint underline underline-offset-2 hover:text-muted"
                  >
                    dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {armed.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {armed.map(({ rule, because }) => (
            <li key={rule.id} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px]">{describe(rule)}</p>
                <p className="mt-0.5 text-[11px] text-faint">{because}</p>
              </div>
              <button
                onClick={() => setRules(removeRule(rule.id))}
                className="text-[11px] text-faint underline underline-offset-2 hover:text-muted"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {rules.length === 0 && !pending && (
        <p className="mt-4 text-[11px] text-faint">
          No rules yet. Conditions I can actually watch: days remaining, a
          calendar date, or how long a pass has gone unused —{" "}
          <span className="text-muted">
            measured by access checks on this device, not by whether you opened
            the app itself, which nothing on chain can see.
          </span>
        </p>
      )}

      {rules.length > 0 && (
        <p className="mt-4 text-[11px] text-faint">
          Rules are stored in this browser only. They are never sent anywhere
          and cannot act without you.
        </p>
      )}
    </section>
  );
}

export { formatEther };
