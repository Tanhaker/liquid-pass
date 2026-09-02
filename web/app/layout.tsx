import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DemoBar } from "@/components/DemoBar";
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { DemoProvider } from "@/lib/demo";

export const metadata: Metadata = {
  title: "LiquidPass — Resellable SaaS Passes on Arbitrum Stylus",
  description:
    "Buy time. Use it. Sell what's left. Time-decaying, resellable subscription passes on Arbitrum Stylus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="grain-overlay flex min-h-screen flex-col justify-between bg-ink text-text antialiased">
        <Providers>
          <DemoProvider>
            <Nav />
            <DemoBar />
            <main className="grow">{children}</main>
            <Footer />
            <ChatbotWidget />
          </DemoProvider>
        </Providers>
      </body>
    </html>
  );
}
