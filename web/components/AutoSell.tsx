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
  markUsed,
  lastUsed,
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
  /*
   * Bumped when an access is logged. lastUsed() reads localStorage, which
   * React cannot observe, so without this the rule row would keep showing the
   * old reason until something else happened to re-render.
   */
  const [usageTick, setUsageTick] = useState(0);
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
      // Nothing is evaluated until the clock has mounted. Falling back to
      // Date.now() here would read the wall clock during render, which is
      // impure and disagrees with the prerendered HTML -- and a rule has
      // nothing meaningful to say before it knows what time it is.
      nowMs === null
        ? []
        : rules
            .filter((r) => !r.doneAt)
            .map((r) => evaluate(r, byToken.get(r.tokenId), nowMs)),
    // usageTick is a deliberate dependency: logging an access changes what
    // evaluate() reads out of localStorage without changing any other input.
    [rules, byToken, nowMs, usageTick],
  );

  const armed = evaluated.filter((e) => !e.fired);
  const ready = evaluated.filter((e) => e.fired);

  return (
    <section className="space-y-4 border border-dark-border bg-dark-card p-8 shadow-grunge">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-uranium">
            <span className="size-1.5 rounded-full bg-uranium" />
            <span>Auto-sell rules</span>
          </div>
          <h2 className="mt-1 font-header text-2xl font-bold text-alabaster">
            Watches that hand you a button
          </h2>
        </div>
        <span className="border border-uranium bg-uranium/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-uranium">
          Advisory
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-zincGrey">
        Describe when you&apos;d want a pass sold and this will watch for it.
        When a rule matches you get a button with the price already filled in
        &mdash; the sale is still your signature. Nothing here can list or
        transfer a pass on your behalf.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && parse()}
          placeholder="if I don't use my Notion pass for 7 days, sell it for 0.0002"
          className="min-w-0 flex-1 border border-dark-border bg-dark px-3 py-2.5 font-mono text-xs text-alabaster outline-none focus:border-uranium"
        />
        <div className="flex gap-2">
          <button
            onClick={parse}
            disabled={busy || !text.trim() || passes.length === 0}
            className="bg-uranium px-4 py-2.5 font-mono text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
          >
            {busy ? "Reading..." : "Add rule"}
          </button>
          
          {/*
            An "Issue Session Key" button used to sit here. It was an alert()
            claiming to connect to ZeroDev, and it did nothing at all -- no
            key, no account, no delegation. Account abstraction is explicitly
            out of scope for this project (CLAUDE.md), so it is gone rather
            than reimplemented: a control that lies about what it did is worse
            than no control.
          */}
        </div>
      </div>

      {passes.length === 0 && (
        <p className="mt-2 text-[11px] text-zincGrey/70">
          You need a pass before a rule has anything to watch.
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

      {pending && (
        <div className="mt-4 rounded-none border border-uranium/40 bg-uranium/10 p-4">
          <p className="text-[12px] text-uranium">
            {pending.restated || "Rule understood."}
          </p>
          <p className="mt-1 text-[11px] text-zincGrey">
            Pass: {labelFor(byToken.get(pending.tokenId)!)} · price:{" "}
            {pending.priceEth ? `${pending.priceEth} ETH` : "its time value at the moment it fires"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirm}
              className="rounded-none bg-uranium px-3 py-1.5 text-[12px] font-medium text-black"
            >
              Save rule
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded-none border border-dark-border px-3 py-1.5 text-[12px] text-zincGrey"
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
                className="rounded-none border border-aviation/40 bg-aviation/10 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-aviation">
                  Ready to list
                </p>
                <p className="mt-1 text-[13px]">{describe(rule)}</p>
                <p className="mt-1 text-[11px] text-zincGrey">{because}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (price > 0n) onList(pass.tokenId, price);
                    }}
                    disabled={price <= 0n || busyToken === rule.tokenId}
                    className="rounded-none bg-uranium px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
                  >
                    {busyToken === rule.tokenId
                      ? "Confirm in wallet…"
                      : `List for ${price > 0n ? formatEthShort(price) : "—"} ETH`}
                  </button>
                  <button
                    onClick={() => setRules(removeRule(rule.id))}
                    className="text-[11px] text-zincGrey/70 underline underline-offset-2 hover:text-zincGrey"
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
        <ul className="mt-5 divide-y divide-dark-border border-t border-dark-border">
          {armed.map(({ rule, because }) => (
            <li key={rule.id} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px]">{describe(rule)}</p>
                <p className="mt-0.5 text-[11px] text-zincGrey/70">{because}</p>

                {/*
                  An idle rule measures time since the last access check, and
                  until something records one it can never fire. The check
                  itself lives on /verify, which is a long way to go from here,
                  so the same signal can be recorded in place.
                */}
                {rule.condition.kind === "idle" && (
                  <button
                    onClick={() => {
                      markUsed(rule.tokenId);
                      setUsageTick((n) => n + 1);
                    }}
                    className="mt-1.5 text-[11px] text-uranium underline underline-offset-2 hover:text-alabaster"
                  >
                    {lastUsed(rule.tokenId) === null
                      ? "Log an access to start the clock"
                      : "Log an access now"}
                  </button>
                )}
              </div>
              <button
                onClick={() => setRules(removeRule(rule.id))}
                className="text-[11px] text-zincGrey/70 underline underline-offset-2 hover:text-zincGrey"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {rules.length === 0 && !pending && (
        <p className="mt-4 text-[11px] text-zincGrey/70">
          No rules yet. Conditions I can actually watch: days remaining, a
          calendar date, or how long a pass has gone unused —{" "}
          <span className="text-zincGrey">
            measured by access checks on this device, not by whether you opened
            the app itself, which nothing on chain can see.
          </span>
        </p>
      )}

      {rules.length > 0 && (
        <p className="mt-4 text-[11px] text-zincGrey/70">
          Rules are stored in this browser only. They are never sent anywhere
          and cannot act without you.
        </p>
      )}
    </section>
  );
}

export { formatEther };
