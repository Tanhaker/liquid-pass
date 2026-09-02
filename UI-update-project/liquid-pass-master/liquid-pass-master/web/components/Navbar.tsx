"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiquidPass } from "@/lib/store";
import { Zap } from "lucide-react";
import { HorizontalThemeWipeToggle } from "@/components/ui/theme-wipe-toggle";

export function Navbar() {
  const pathname = usePathname();
  const { isDemoMode, toggleDemoMode, userAddress } = useLiquidPass();

  const navLinks = [
    { href: "/market", label: "MARKET" },
    { href: "/dashboard", label: "MY PASSES" },
    { href: "/explorer", label: "EXPLORER" },
    { href: "/analytics", label: "ANALYTICS" },
    { href: "/verify", label: "VERIFY" },
    { href: "/issuer", label: "ISSUER" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border-default bg-bg-page/90 backdrop-blur-md">
      <div className="w-full px-4 sm:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo / Brand (Far Left Corner with Custom Logo) */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center space-x-3">
              <div className="h-9 w-auto max-w-[160px] flex items-center justify-center relative overflow-hidden flex-shrink-0">
                <img
                  src="/Logo.png"
                  alt="LiquidPass"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-header font-extrabold text-lg tracking-tight text-alabaster group-hover:text-uranium transition-colors">
                  LIQUID<span className="text-uranium">PASS</span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-zincGrey -mt-1">
                  STYLUS // RESELLABLE SAAS PASSES
                </span>
              </div>
            </Link>
          </div>

          {/* Nav Links (Clean Labels) */}
          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all relative ${
                    active
                      ? "text-uranium bg-dark-surface border-b-2 border-uranium font-semibold"
                      : "text-zincGrey hover:text-alabaster hover:bg-dark-surface/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls (Far Right Corner) */}
          <div className="flex items-center space-x-3">
            {/* Theme Wipe Transition Toggle */}
            <div className="border border-dark-border bg-dark-card hover:border-uranium transition-colors">
              <HorizontalThemeWipeToggle direction="left" />
            </div>

            {/* Demo Mode Toggle */}
            <button
              onClick={toggleDemoMode}
              className={`flex items-center space-x-2 px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-all ${
                isDemoMode
                  ? "border-aviation bg-aviation/10 text-aviation shadow-glow-amber"
                  : "border-dark-border bg-dark-surface text-zincGrey hover:border-uranium"
              }`}
              title="Toggle Simulated State vs Live Contract RPC"
            >
              <Zap className={`w-3.5 h-3.5 ${isDemoMode ? "text-aviation fill-aviation animate-bounce" : "text-zincGrey"}`} />
              <span className="hidden sm:inline">DEMO:</span>
              <span className="font-bold">{isDemoMode ? "ACTIVE" : "ON-CHAIN"}</span>
            </button>

            {/* Wallet HUD Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 border border-dark-border bg-chip-bg text-white text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-accent-glow animate-ping"></div>
              <span className="hidden sm:inline text-zinc-400">PASSKEY //</span>
              <span className="text-chip-text font-semibold">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </span>
            </div>
          </div>

        </div>
      </div>
      
      {/* Mobile nav subbar */}
      <div className="flex md:hidden overflow-x-auto border-t border-dark-border bg-dark-card px-3 py-2 space-x-2 scrollbar-none">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-mono uppercase ${
              pathname === link.href
                ? "bg-uranium text-black font-bold"
                : "text-zincGrey bg-dark-surface"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
