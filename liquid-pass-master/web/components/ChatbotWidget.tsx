"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Minus,
  Send,
  Bot,
  User,
  RotateCcw,
} from "lucide-react";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}

const DEFAULT_MESSAGES: Message[] = [
  {
    id: "m-1",
    sender: "bot",
    text: "LIQUIDPASS PROTOCOL TERMINAL v1.4 // ONLINE\n\nI am your on-chain escrow co-pilot. Ask me about dynamic time decay, listing secondary passes, or smart contract verification on Arbitrum Stylus.",
    time: "10:42",
  },
];

const SUGGESTED_PROMPTS = [
  "How does the time decay formula work?",
  "What is the 90/10 escrow split?",
  "How do I log in with a Passkey?",
];

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const triggerVideoRef = useRef<HTMLVideoElement>(null);

  // Detect theme dynamically (dark mode vs light mode)
  useEffect(() => {
    const checkTheme = () => {
      const themeAttr = document.documentElement.getAttribute("data-theme");
      setIsLightMode(themeAttr === "light");
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  const videoSrc = isLightMode ? "/Lchatbot.mp4" : "/Dchatbot.mp4";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  // Hover video play & freeze on 1st frame handlers
  const handleMouseEnter = () => {
    if (triggerVideoRef.current) {
      triggerVideoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  };

  const handleMouseLeave = () => {
    if (triggerVideoRef.current) {
      triggerVideoRef.current.pause();
      triggerVideoRef.current.currentTime = 0; // Freeze back to 1st frame
    }
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Mock interactive response until backend endpoint is hooked up
    setTimeout(() => {
      let reply = "Query processed by Stylus telemetry node. Standby for backend endpoint sync.";
      const lower = query.toLowerCase();

      if (lower.includes("decay") || lower.includes("formula")) {
        reply = "Dynamic Resale Pricing Formula:\nPrice = (Remaining Seconds / Total Seconds) × Original Face Value.\nAs on-chain block timestamps advance, the fair resale floor decreases linearly.";
      } else if (lower.includes("split") || lower.includes("royalty") || lower.includes("90")) {
        reply = "LiquidPass Secondary Escrow Split:\n• 90% of proceeds go directly to the Seller.\n• 10% royalty is sent automatically to the original SaaS Issuer on-chain.";
      } else if (lower.includes("passkey") || lower.includes("webauthn") || lower.includes("p-256")) {
        reply = "Passkey WebAuthn Authentication:\nLiquidPass verifies secp256r1 (P-256) signatures directly inside our Arbitrum Stylus Rust contract without seed phrases or gas overhead.";
      } else {
        reply = `Received: "${query}". Backend API listener is configured and ready for live LLM streaming.`;
      }

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: "bot",
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 900);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages(DEFAULT_MESSAGES);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end select-none">
      
      {/* ============================================================ */}
      {/* CHAT WINDOW (EXPANDED STATE) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 w-[calc(100vw-2.5rem)] sm:w-[420px] h-[550px] max-h-[82vh] bg-dark-card border-2 border-dark-border shadow-grunge flex flex-col overflow-hidden"
          >
            {/* Terminal Window Header */}
            <div className="p-3 bg-dark-surface border-b border-dark-border flex items-center justify-between font-mono text-xs">
              <div className="flex items-center space-x-2.5">
                {/* Live Chatbot Video Avatar in Header (Theme-Aware) */}
                <div className="w-8 h-8 border border-dark-border overflow-hidden bg-black flex-shrink-0">
                  <video
                    key={`header-${videoSrc}`}
                    src={videoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-alabaster tracking-wider text-[11px] sm:text-xs">
                    STYLUS // COPILOT
                  </span>
                  <span className="text-[9px] text-uranium uppercase tracking-wider -mt-0.5">
                    ● ACTIVE STREAM
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleReset}
                  title="Reset conversation"
                  className="p-1 text-zincGrey hover:text-alabaster hover:bg-dark transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Minimize"
                  className="p-1 text-zincGrey hover:text-alabaster hover:bg-dark transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close"
                  className="p-1 text-zincGrey hover:text-red-400 hover:bg-dark transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sub-header telemetry badge */}
            <div className="px-3 py-1.5 bg-dark border-b border-dark-border/80 flex items-center justify-between text-[10px] font-mono text-zincGrey">
              <span>NODE: ARBITRUM SEPOLIA</span>
              <span className="text-uranium font-bold">LATENCY: 18ms</span>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs no-scrollbar">
              {messages.map((msg) => {
                const isBot = msg.sender === "bot";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-zincGrey">
                      {isBot ? (
                        <>
                          <Bot className="w-3 h-3 text-uranium" />
                          <span className="text-uranium font-bold">STYLUS AI</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-aviation" />
                          <span className="text-aviation font-bold">YOU</span>
                        </>
                      )}
                      <span>• {msg.time}</span>
                    </div>

                    <div
                      className={`max-w-[88%] p-3 whitespace-pre-line leading-relaxed ${
                        isBot
                          ? "bg-dark border border-dark-border text-alabaster shadow-sm"
                          : "bg-uranium/15 border border-uranium text-alabaster font-medium shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-zincGrey">
                    <Bot className="w-3 h-3 text-uranium" />
                    <span className="text-uranium font-bold">STYLUS AI</span>
                    <span>• thinking</span>
                  </div>
                  <div className="p-3 bg-dark border border-dark-border text-zincGrey flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-uranium animate-ping" />
                    <span className="text-[11px]">Computing contract response...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-2 bg-dark/60 border-t border-dark-border flex items-center space-x-2 overflow-x-auto no-scrollbar">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="flex-shrink-0 px-2.5 py-1 bg-dark border border-dark-border hover:border-uranium text-[10px] font-mono text-zincGrey hover:text-alabaster transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Terminal Input Bar */}
            <div className="p-3 bg-dark-surface border-t border-dark-border">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-uranium font-bold text-sm select-none">
                  &gt;
                </span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about passes, decay, gas..."
                  className="flex-1 bg-dark border border-dark-border px-3 py-2 text-xs font-mono text-alabaster focus:outline-none focus:border-uranium transition-colors placeholder:text-zincGrey/60"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  aria-label="Send query"
                  className="px-3.5 py-2 bg-uranium hover:bg-uranium/90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono text-xs font-extrabold flex items-center justify-center transition-all shadow-glow-uranium"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* FLOATING ACTION TRIGGER BUTTON (SQUARE, TEXT-FREE, THEMED) */}
      {/* ============================================================ */}
      <motion.button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle Stylus AI Copilot"
        className="group relative w-20 h-20 sm:w-24 sm:h-24 bg-dark-card border-2 border-dark-border hover:border-uranium shadow-grunge flex items-center justify-center overflow-hidden transition-all rounded-none p-1.5"
      >
        {/* Active Ambient Glow */}
        <div className="absolute -inset-1 bg-uranium/20 blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Video Container (Fits entire square button) */}
        <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center border border-dark-border/60">
          <video
            key={videoSrc}
            ref={triggerVideoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="auto"
            className="w-full h-full object-cover filter contrast-105"
          />
          
          {/* Subtle Cybernetic Corner Tick & Live Pulse Dot */}
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 rounded-full bg-uranium shadow-[0_0_10px_#98FF1A] pointer-events-none" />
          <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-uranium/70 pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-uranium/70 pointer-events-none" />
        </div>
      </motion.button>

    </div>
  );
}
