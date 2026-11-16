import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "wagmi/chains";
import { fallback, http } from "wagmi";
import { READ_RPCS } from "./publicClient";

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

export const config = getDefaultConfig({
  appName: "Liquid Pass",
  appDescription: "Buy time. Use it. Sell what's left.",
  projectId,
  chains: [arbitrumSepolia],
  transports: {
    // Same endpoints, same order as the plain read client -- see READ_RPCS.
    // Reads only: transactions are signed and sent by the user's wallet.
    [arbitrumSepolia.id]: fallback(READ_RPCS.map((url) => http(url, { retryCount: 1 }))),
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
