"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { ThemeProvider } from "next-themes";
import { LiquidPassProvider } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            // Squared corners and uranium accent so the wallet modal reads as
            // part of the same tactical surface as the rest of the app.
            theme={darkTheme({
              accentColor: "#98FF1A",
              accentColorForeground: "#08090C",
              borderRadius: "none",
              overlayBlur: "small",
            })}
            modalSize="compact"
          >
            <LiquidPassProvider>
              {children}
            </LiquidPassProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
