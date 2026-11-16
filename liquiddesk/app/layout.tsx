import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiquidDesk — unlocked by Liquid Pass",
  description:
    "A sample SaaS workspace whose Pro feature unlocks only for a wallet that holds a valid Liquid Pass, checked on Arbitrum.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
