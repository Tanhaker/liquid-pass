"use client";

import { useEffect, useRef, useState } from "react";
import { LIQUID_PASS_URL } from "@/lib/site";

/**
 * Liquidity AI, the same assistant as on Liquid Pass, in the same corner.
 *
 * Questions go to this app's /api/ai, which forwards them to Liquid Pass with
 * the signed-in wallet attached, so "how long is left on my pass" is answered
 * from live chain data for THIS wallet. Every reply is the assistant's own
 * text: when the language model was not used, the reply says so.
 */

type Message = { id: string; from: "ai" | "you"; text: string; time: string };

const GREETING: Message = {
  id: "greeting",
  from: "ai",
  text: "Hi, I am Liquidity AI. Ask me about your pass, how LiquidDesk checks it, or how to resell the days you will not use. I answer from the product documentation and live chain data.",
  time: "",
};

const PROMPTS = ["How long is left on my pass?", "How does LiquidDesk check my pass?", "How do I resell unused days?"];

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function LiquidityAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking, open]);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(text?: string) {
    const question = (text ?? input).trim();
    if (!question || thinking) return;
    setMessages((m) => [...m, { id: `y-${Date.now()}`, from: "you", text: question, time: clock() }]);
    setInput("");
    setThinking(true);
    let reply: string;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const j = (await res.json()) as { answer?: string; mode?: string; error?: string };
      reply = j.answer
        ? j.mode === "model"
          ? j.answer
          : `${j.answer}\n\n(From the product documentation. The language model was not used for this answer.)`
        : `Sorry, I could not answer that: ${j.error ?? "no answer was returned"}.`;
    } catch {
      reply = "Sorry, I could not reach the assistant. Check your connection and try again.";
    }
    setMessages((m) => [...m, { id: `a-${Date.now()}`, from: "ai", text: reply, time: clock() }]);
    setThinking(false);
  }

  return (
    <div className="lq">
      {open && (
        <section className="lq-panel" role="dialog" aria-label="Liquidity AI">
          <header className="lq-head">
            <div className="lq-id">
              <span className="lq-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" />
              </span>
              <span>
                <b>LIQUIDITYAI</b>
                <i>Answers from docs + live chain data</i>
              </span>
            </div>
            <div className="lq-tools">
              <button onClick={() => setMessages([GREETING])} title="Reset conversation" aria-label="Reset conversation">
                <ResetIcon />
              </button>
              <button onClick={() => setOpen(false)} title="Close" aria-label="Close Liquidity AI">
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="lq-stream" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`lq-msg ${m.from}`}>
                <span className="lq-who">
                  <b>{m.from === "ai" ? "LiquidityAI" : "YOU"}</b>
                  {m.time && ` • ${m.time}`}
                </span>
                <p>{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="lq-msg ai">
                <span className="lq-who">
                  <b>LiquidityAI</b> • thinking
                </span>
                <p className="lq-thinking">
                  <span className="lq-ping" />
                  Reading the chain and thinking...
                </p>
              </div>
            )}
            <div ref={end} />
          </div>

          <div className="lq-prompts">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => void ask(p)} disabled={thinking}>
                {p}
              </button>
            ))}
          </div>

          <form
            className="lq-input"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <span aria-hidden="true">&gt;</span>
            <input
              ref={field}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your pass, resale, check-in..."
              aria-label="Your question"
              maxLength={500}
            />
            <button type="submit" disabled={!input.trim() || thinking} aria-label="Send question">
              <SendIcon />
            </button>
          </form>
        </section>
      )}

      <button
        className="lq-fab"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => void video.current?.play().catch(() => undefined)}
        onMouseLeave={() => {
          if (!video.current) return;
          video.current.pause();
          video.current.currentTime = 0;
        }}
        aria-label={open ? "Close Liquidity AI" : "Open Liquidity AI"}
        aria-expanded={open}
      >
        {/* The animated mark is Liquid Pass's own; the still logo stands in if it cannot load. */}
        <video ref={video} src={`${LIQUID_PASS_URL}/Dchatbot.mp4`} poster="/logo.png" muted loop playsInline preload="metadata" />
        <span className="lq-tick tl" />
        <span className="lq-tick tr" />
        <span className="lq-live" />
      </button>
    </div>
  );
}

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function ResetIcon() {
  return (
    <svg {...icon}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...icon}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg {...icon}>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}
