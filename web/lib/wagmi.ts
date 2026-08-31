// `injected` comes from the wagmi root, NOT from "wagmi/connectors". That
// barrel also pulls in the Base Account connector, whose @coinbase/cdp-sdk
// dependency imports an optional @x402/* package that is not installed, and
// the unresolved import fails the whole build.
import { http, createConfig, injected } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

export const ARBITRUM_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

/**
 * The connected wallet acts as the relayer: it pays gas and sends the
 * transaction. Authorisation comes from the passkey signature inside the
 * calldata, not from msg.sender -- the contract never checks the caller.
 */
export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(ARBITRUM_SEPOLIA_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
