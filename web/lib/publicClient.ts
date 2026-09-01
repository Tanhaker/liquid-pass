import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * A plain viem client for reads.
 *
 * Deliberately NOT wagmi's `usePublicClient()`. Two reasons:
 *
 *   1. wagmi's client carries request batching and caching configured for
 *      React's lifecycle. Reads issued from an effect could sit unresolved
 *      behind that machinery, which strands a page on its loading skeleton
 *      with no error to explain it -- the failure mode this file exists to
 *      remove.
 *   2. The data layer is used outside React too: API routes and the browser
 *      extension have no wagmi provider, and requiring one to read public
 *      chain state would be backwards.
 *
 * Writes still go through wagmi, which is what it is good at -- that path
 * needs the connected wallet.
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL, {
    // A read that hangs is worse than a read that fails: a failure surfaces a
    // message, a hang looks identical to "still loading" forever.
    timeout: 15_000,
    retryCount: 2,
  }),
});
