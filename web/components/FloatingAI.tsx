"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

/**
 * Liquid AI as a floating panel rather than a destination.
 *
 * It used to be a nav item, which meant asking a question cost you your place
 * on the page you were asking about. Here it opens over whatever you are
 * looking at, so "which of my passes expire soon?" can be asked while standing
 * on the dashboard.
 *
 * The /assistant route still exists for a full-page conversation and deep
 * links; this is the same endpoint, same rules -- answers come from repo
 * documentation plus a live chain snapshot, never invented.
 */

type Turn = {
  role: "user" | "assistant";
  text: string;
  mode?: "model" | "knowledge-base";
};

const QUICK = [
  "What is Liquid Pass?",
  "Why doesn't the buyer get 30 fresh days?",
  "What's listed right now?",
  "Which of my passes expire soon?",
];

export function FloatingAI() {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  // Escape closes, so the panel never traps someone mid-page.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
        setTurns((t) => [...t, { role: "assistant", text: j.answer, mode: j.mode }]);
      } else {
        setError(j.error ?? "No answer returned.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close Liquid AI" : "Ask Liquid AI"}
        className="fixed bottom-5 right-5 z-50 grid size-12 place-items-center rounded-full border border-line bg-surface/90 shadow-[0_10px_40px_-12px_rgba(0,0,0,.9)] backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M7 1.5 8.3 5.2 12 6.5 8.3 7.8 7 11.5 5.7 7.8 2 6.5l3.7-1.3z"
              stroke="var(--color-life-full)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 flex max-h-[min(70vh,560px)] w-[min(calc(100vw-2.5rem),380px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-[0_24px_70px_-20px_rgba(0,0,0,.95)] backdrop-blur-2xl"
          role="dialog"
          aria-label="Liquid AI"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="size-1.5 rounded-full bg-life-full" />
            <span className="text-[13px] font-medium">Liquid AI</span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-faint">
              live chain data
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-[12px] text-muted">
                  Ask about your passes, the market, or how any of this works.
                </p>
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="block w-full rounded-lg border border-line bg-ink px-3 py-2 text-left text-[12px] text-muted transition-colors hover:border-line-bright hover:text-text"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {turns.map((t, i) =>
              t.role === "user" ? (
                <p
                  key={i}
                  className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-raised px-3 py-2 text-[13px]"
                >
                  {t.text}
                </p>
              ) : (
                <div key={i} className="max-w-[92%]">
                  <p className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-ink px-3 py-2 text-[13px] leading-relaxed">
                    {t.text}
                  </p>
                  {t.mode === "knowledge-base" && (
                    <span className="mt-1 inline-block rounded bg-life-low/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-life-low">
                      from documentation
                    </span>
                  )}
                </div>
              ),
            )}

            {busy && (
              <p className="text-[12px] text-faint">
                <span className="animate-pulse">Liquid AI is thinking…</span>
              </p>
            )}
            {error && <p className="text-[12px] text-life-crit">{error}</p>}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex gap-2 border-t border-line p-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-ink disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
