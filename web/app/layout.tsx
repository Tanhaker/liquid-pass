import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { DemoBar } from "@/components/DemoBar";
import { FloatingAI } from "@/components/FloatingAI";
import { DemoProvider } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Liquid Pass",
  description:
    "Buy time. Use it. Sell what's left. Resellable subscription passes on Arbitrum Stylus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-text antialiased">
        <Providers>
          <DemoProvider>
            <Nav />
            <DemoBar />
            <main>{children}</main>
            <footer className="mt-24 border-t border-line px-6 py-8 text-xs text-faint">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <span>Liquid Pass — Arbitrum Sepolia. Testnet only.</span>
              <span className="tnum">Rust + Stylus · secp256r1-free by design</span>
            </div>
            </footer>
            <FloatingAI />
          </DemoProvider>
        </Providers>
      </body>
    </html>
  );
}
