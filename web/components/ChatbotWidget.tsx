"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Send, Bot, User, RotateCcw } from "lucide-react";
import { useAccount } from "wagmi";

/**
 * Stylus Copilot — the UI drop's terminal chatbot, on the real assistant.
 *
 * The drop ships this component with a `setTimeout` and a handful of canned
 * replies keyed off substring matches ("decay", "split", "passkey"). Those are
 * deleted here. The panel talks to /api/ai, which is the same endpoint the
 * previous floating assistant used: repo documentation plus a live chain
 * snapshot, answered by Gemini, and never invented.
 *
 * That distinction matters on stage. A judge asking "what's listed right now?"
 * gets the actual listings; the drop's version would have replied with its
 * fallback string. Everything visual is the drop's — the square video trigger,
 * the terminal chrome, the prompt rail, the `>` input.
 */

type Message = {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  /** Set by /api/ai when the answer came from the knowledge base, not the model. */
  mode?: "model" | "knowledge-base";
};

function clock() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const GREETING =
  "LIQUIDPASS PROTOCOL TERMINAL v1.4 // ONLINE\n\nI am your on-chain co-pilot. Ask about time decay, the 90/10 split, what is listed right now, or which of your passes expire soon.";

/** Real questions this assistant can actually answer from chain + docs. */
const SUGGESTED_PROMPTS = [
  "What is Liquid Pass?",
  "Why doesn't the buyer get 30 fresh days?",
  "What's listed right now?",
  "Which of my passes expire soon?",
];

export function ChatbotWidget() {
  const { address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const triggerVideoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The greeting is seeded on mount rather than in the initial state so the
  // server-rendered markup and the first client render agree -- `clock()` would
  // otherwise differ between the two and trip hydration.
  useEffect(() => {
    setMessages([{ id: "m-1", sender: "bot", text: GREETING, time: clock() }]);
  }, []);

  // Follows the theme so the avatar matches the page it sits on.
  useEffect(() => {
    const read = () =>
      setIsLightMode(document.documentElement.getAttribute("data-theme") === "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const videoSrc = isLightMode ? "/Lchatbot.mp4" : "/Dchatbot.mp4";

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isTyping, isOpen]);

  // Escape closes, so the panel never traps someone mid-page.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleMouseEnter = () => {
    triggerVideoRef.current?.play().catch(() => {
      /* autoplay policy — the frozen first frame is a fine resting state */
    });
  };

  const handleMouseLeave = () => {
    const v = triggerVideoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  const send = useCallback(
    async (textToSend?: string) => {
      const query = (textToSend ?? input).trim();
      if (!query || isTyping) return;

      setInput("");
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, sender: "user", text: query, time: clock() },
      ]);
      setIsTyping(true);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: query, address }),
        });
        const j = await res.json();
        if (j.answer) {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              sender: "bot",
              text: j.answer,
              time: clock(),
              mode: j.mode,
            },
          ]);
        } else {
          setError(j.error ?? "No answer returned.");
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, address],
  );

  const handleReset = () => {
    setError(null);
    setMessages([{ id: "m-1", sender: "bot", text: GREETING, time: clock() }]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex select-none flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Stylus Copilot"
            className="mb-4 flex h-[550px] max-h-[82vh] w-[calc(100vw-2.5rem)] flex-col overflow-hidden border-2 border-dark-border bg-dark-card shadow-grunge sm:w-[420px]"
          >
            {/* Terminal chrome */}
            <div className="flex items-center justify-between border-b border-dark-border bg-dark-surface p-3 font-mono text-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 shrink-0 overflow-hidden border border-dark-border bg-black">
                  <video
                    key={`header-${videoSrc}`}
                    src={videoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-wider text-alabaster sm:text-xs">
                    STYLUS // COPILOT
                  </span>
                  <span className="-mt-0.5 text-[9px] uppercase tracking-wider text-uranium">
                    ● ACTIVE STREAM
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReset}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  className="p-1 text-zinc-grey transition-colors hover:bg-dark hover:text-alabaster"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Minimize"
                  aria-label="Minimize"
                  className="p-1 text-zinc-grey transition-colors hover:bg-dark hover:text-alabaster"
                >
                  <Minus className="size-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close"
                  aria-label="Close"
                  className="p-1 text-zinc-grey transition-colors hover:bg-dark hover:text-life-crit"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Telemetry strip. Says what it actually knows: the connected
                address, or that there isn't one. The drop hard-coded a
                "LATENCY: 18ms" readout that measured nothing. */}
            <div className="flex items-center justify-between border-b border-dark-border/80 bg-dark px-3 py-1.5 font-mono text-[10px] text-zinc-grey">
              <span>NODE: ARBITRUM SEPOLIA</span>
              <span className="font-bold text-uranium">
                {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "NO WALLET"}
              </span>
            </div>

            {/* Message stream */}
            <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-4 font-mono text-xs">
              {messages.map((msg) => {
                const isBot = msg.sender === "bot";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-zinc-grey">
                      {isBot ? (
                        <>
                          <Bot className="size-3 text-uranium" />
                          <span className="font-bold text-uranium">STYLUS AI</span>
                        </>
                      ) : (
                        <>
                          <User className="size-3 text-aviation" />
                          <span className="font-bold text-aviation">YOU</span>
                        </>
                      )}
                      <span>• {msg.time}</span>
                    </div>

                    <div
                      className={`max-w-[88%] whitespace-pre-line p-3 leading-relaxed ${
                        isBot
                          ? "border border-dark-border bg-dark text-alabaster"
                          : "border border-uranium bg-uranium/15 font-medium text-alabaster"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.mode === "knowledge-base" && (
                      <span className="mt-1 border border-aviation/40 bg-aviation/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-aviation">
                        from documentation
                      </span>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] text-zinc-grey">
                    <Bot className="size-3 text-uranium" />
                    <span className="font-bold text-uranium">STYLUS AI</span>
                    <span>• thinking</span>
                  </div>
                  <div className="flex items-center gap-1.5 border border-dark-border bg-dark p-3 text-zinc-grey">
                    <span className="size-1.5 animate-ping rounded-full bg-uranium" />
                    <span className="text-[11px]">Reading chain state…</span>
                  </div>
                </div>
              )}

              {error && (
                <p className="border border-life-crit/40 bg-life-crit/10 p-2 text-[11px] text-life-crit">
                  {error}
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Prompt rail */}
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-dark-border bg-dark/60 p-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  disabled={isTyping}
                  className="shrink-0 border border-dark-border bg-dark px-2.5 py-1 font-mono text-[10px] text-zinc-grey transition-colors hover:border-uranium hover:text-alabaster disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="border-t border-dark-border bg-dark-surface p-3"
            >
              <div className="flex items-center gap-2">
                <span className="select-none font-mono text-sm font-bold text-uranium">
                  &gt;
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about passes, decay, gas…"
                  aria-label="Ask the Stylus Copilot"
                  className="min-w-0 flex-1 border border-dark-border bg-dark px-3 py-2 font-mono text-xs text-alabaster transition-colors placeholder:text-zinc-grey/60 focus:border-uranium focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  aria-label="Send query"
                  className="flex items-center justify-center bg-uranium px-3.5 py-2 font-mono text-xs font-extrabold text-black shadow-glow-uranium transition-all hover:bg-uranium/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Square video trigger */}
      <motion.button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close Stylus Copilot" : "Open Stylus Copilot"}
        className="group relative flex size-20 items-center justify-center overflow-hidden border-2 border-dark-border bg-dark-card p-1.5 shadow-grunge transition-all hover:border-uranium sm:size-24"
      >
        <div className="pointer-events-none absolute -inset-1 bg-uranium/20 opacity-0 blur transition-opacity group-hover:opacity-100" />

        <div className="relative flex size-full items-center justify-center overflow-hidden border border-dark-border/60 bg-black">
          <video
            key={videoSrc}
            ref={triggerVideoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="auto"
            className="size-full object-cover contrast-105"
          />
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 size-3 rounded-full bg-uranium shadow-[0_0_10px_#98FF1A]" />
          <div className="pointer-events-none absolute left-1.5 top-1.5 size-2 border-l-2 border-t-2 border-uranium/70" />
          <div className="pointer-events-none absolute right-1.5 top-1.5 size-2 border-r-2 border-t-2 border-uranium/70" />
        </div>
      </motion.button>
    </div>
  );
}
