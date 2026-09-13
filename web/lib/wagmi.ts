import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "wagmi/chains";
import { fallback, http } from "wagmi";

/**
 * Wallet configuration, via RainbowKit.
 *
 * RainbowKit's `getDefaultConfig` builds the wagmi config and the connector
 * list together, so this replaces the bare `injected()` setup rather than
 * layering on top of it.
 *
 * On the WalletConnect project id: RainbowKit needs one to offer the
 * QR-code/mobile wallets. Without it, injected wallets (MetaMask, Rabby,
 * Brave) still connect normally and the WalletConnect entries simply fail if
 * chosen. A placeholder is used rather than crashing the app at import time,
 * because a missing id must not take the whole marketplace down -- but it does
 * mean mobile wallet connections need a real id from cloud.reown.com.
 */
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "liquid-pass-no-wc-id";

export const ARBITRUM_SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";

/**
 * Second read endpoint. The public Arbitrum RPC drops requests under load and
 * answers without CORS headers when it does, which the browser reports as
 * "Failed to fetch". PublicNode serves the same chain with CORS allowed.
 * Reads only: transactions are signed and sent by the user's wallet.
 */
export const ARBITRUM_SEPOLIA_BACKUP_RPC = "https://arbitrum-sepolia-rpc.publicnode.com";

export const config = getDefaultConfig({
  appName: "Liquid Pass",
  appDescription: "Buy time. Use it. Sell what's left.",
  projectId,
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: fallback([
      http(ARBITRUM_SEPOLIA_RPC, { retryCount: 2 }),
      http(ARBITRUM_SEPOLIA_BACKUP_RPC, { retryCount: 2 }),
    ]),
  },
  // Server-side rendering is on, so the config must not touch browser APIs
  // during the first render.
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
