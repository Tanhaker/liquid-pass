import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { LiquidPassProvider } from "@/lib/store";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TransactionToasts } from "@/components/TransactionToasts";
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { Space_Mono } from "next/font/google";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "LiquidPass — Resellable SaaS Passes on Arbitrum Stylus",
  description:
    "Turn unused SaaS subscription time into liquid value. Time-decaying, resellable access NFTs with on-chain P-256 passkey verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceMono.variable}`}>
      <body className="grain-overlay min-h-screen flex flex-col justify-between">
        <Providers>
          <LiquidPassProvider>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
            <TransactionToasts />
            <ChatbotWidget />
          </LiquidPassProvider>
        </Providers>
      </body>
    </html>
  );
}
