"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Banner } from "@/components/ui";

/**
 * Liquid AI.
 *
 * The connected address is sent with each question so the assistant can answer
 * "which of my passes expire soon" against real ownership. Nothing else about
 * the user is sent.
 */

type Turn = {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  mode?: "model" | "knowledge-base";
  note?: string;
};

const SUGGESTIONS = [
  "What is Liquid Pass?",
  "Why doesn't the buyer get another 30 days?",
  "How is the resale payment split?",
  "Which of my passes expire soon?",
  "What's listed right now?",
  "Can an expired pass be resold?",
];

export default function Assistant() {
  const { address } = useAccount();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, address }),
      });
      const j = await res.json();
      if (j.answer) {
        setTurns((t) => [
          ...t,
          { role: "assistant", text: j.answer, sources: j.sources, mode: j.mode, note: j.note },
        ]);
      } else {
        setError(j.detail ? `${j.error}: ${j.detail}` : (j.error ?? "No answer returned."));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col px-6 py-14">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Liquid AI</h1>
        <p className="mt-2 text-[14px] text-muted">
          Ask about your passes, what&rsquo;s on the market, or how any of this
          works. Answers come from the product documentation and live chain
          state — never invented.
        </p>
      </div>

      {configured === false && (
        <Banner tone="warn">
          No language model is configured, so answers are returned straight from
          the product documentation rather than generated. Set{" "}
          <code className="tnum">GEMINI_API_KEY</code> to enable it.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="mt-8 flex-1 space-y-5">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-muted transition-colors hover:border-line-bright hover:text-text"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-raised px-4 py-2.5 text-[14px]">
                {t.text}
              </p>
            </div>
          ) : (
            <div key={i} className="max-w-[90%]">
              <p className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[14px] leading-relaxed">
                {t.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                {t.mode === "knowledge-base" && (
                  <span className="rounded-md bg-life-low/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-life-low">
                    from documentation
                  </span>
                )}
                {t.sources?.map((s) => (
                  <span key={s} className="text-[11px] text-faint">
                    {s}
                  </span>
                ))}
              </div>
              {t.note && <p className="mt-1 pl-1 text-[11px] text-faint">{t.note}</p>}
            </div>
          ),
        )}

        {busy && (
          <p className="pl-1 text-[13px] text-faint">
            <span className="inline-block animate-pulse">Liquid AI is thinking…</span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-6 mt-8 flex gap-2 rounded-2xl border border-line bg-surface/90 p-2 backdrop-blur-xl"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ? "Ask about your passes…" : "Ask how Liquid Pass works…"}
          className="flex-1 bg-transparent px-3 py-2 text-[14px] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-text px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      {!address && (
        <p className="mt-3 text-[11px] text-faint">
          Connect a wallet and Liquid AI can answer questions about the passes
          you own.
        </p>
      )}
    </div>
  );
}
