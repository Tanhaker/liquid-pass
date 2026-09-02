"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Bot, Send, AlertTriangle } from "lucide-react";

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
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-dark-border pb-8">
        <div className="mb-2 inline-flex items-center space-x-2 border border-dark-border bg-dark-card px-2.5 py-0.5 font-mono text-xs uppercase text-uranium">
          <Bot className="h-3.5 w-3.5" />
          <span>RETRIEVAL-GROUNDED PROTOCOL ASSISTANT</span>
        </div>
        <h1 className="font-header text-3xl font-extrabold tracking-tight text-alabaster sm:text-5xl">
          Liquid AI
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-zincGrey">
          Ask about your passes, what&rsquo;s on the market, or how any of this
          works. Answers come from the product documentation and live chain
          state &mdash; never invented.
        </p>
      </div>

      {configured === false && (
        <div className="mt-6 flex items-start space-x-2 border border-aviation/50 bg-aviation/10 p-4 font-mono text-xs text-aviation">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            No language model is configured, so answers are returned straight
            from the product documentation rather than generated. Set{" "}
            <code className="font-bold">GEMINI_API_KEY</code> to enable it.
          </p>
        </div>
      )}
      {error && (
        <div className="mt-6 flex items-start space-x-2 border border-red-500/50 bg-red-500/10 p-4 font-mono text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-8 flex-1 space-y-5">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="border border-dark-border bg-dark-card px-3 py-2 font-mono text-xs text-zincGrey transition-colors hover:border-uranium hover:text-uranium"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] border border-dark-border bg-dark-surface px-4 py-2.5 font-body text-sm text-alabaster">
                {t.text}
              </p>
            </div>
          ) : (
            <div key={i} className="max-w-[90%]">
              <div className="mb-1.5 flex items-center space-x-2 font-mono text-[10px] uppercase tracking-widest text-uranium">
                <Bot className="h-3.5 w-3.5" />
                <span>LIQUID AI</span>
              </div>
              <p className="whitespace-pre-wrap border border-dark-border bg-dark-card px-4 py-3 font-body text-sm leading-relaxed text-alabaster">
                {t.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {t.mode === "knowledge-base" && (
                  <span className="border border-aviation/40 bg-aviation/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-aviation">
                    from documentation
                  </span>
                )}
                {t.sources?.map((s) => (
                  <span key={s} className="font-mono text-[11px] text-zincGrey">
                    {s}
                  </span>
                ))}
              </div>
              {t.note && (
                <p className="mt-1 font-mono text-[11px] text-zincGrey">{t.note}</p>
              )}
            </div>
          ),
        )}

        {busy && (
          <p className="font-mono text-xs text-zincGrey">
            <span className="inline-block animate-pulse">
              LIQUID AI IS THINKING&hellip;
            </span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-6 mt-8 flex gap-2 border border-dark-border bg-dark-card/95 p-2 backdrop-blur-xl"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ? "Ask about your passes…" : "Ask how Liquid Pass works…"}
          className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-alabaster outline-none placeholder:text-zincGrey"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex items-center space-x-1.5 bg-uranium px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Ask</span>
        </button>
      </form>

      {!address && (
        <p className="mt-3 font-mono text-[11px] text-zincGrey">
          Connect a wallet and Liquid AI can answer questions about the passes
          you own.
        </p>
      )}
    </div>
  );
}
