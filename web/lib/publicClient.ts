import { createPublicClient, fallback, http } from "viem";
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
/** Arbitrum's own public endpoint. Free, but see READ_RPCS for its catch. */
export const ARBITRUM_PUBLIC_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
export const PUBLICNODE_RPC = "https://arbitrum-sepolia-rpc.publicnode.com";

/**
 * Read endpoints, in the order they are tried.
 *
 * PublicNode goes first. Arbitrum's public endpoint rate-limits per visitor,
 * and its 429 answer carries no CORS header, so the browser reports a blocked
 * request rather than a status -- a visitor who trips the limit loses every
 * read on every page for a minute. PublicNode sends CORS headers and has not
 * done that to us; Arbitrum's endpoint stays as the backup.
 *
 * NEXT_PUBLIC_RPC_URL, when set, is tried before both. That is where a keyed
 * endpoint goes, and it is how local dev and the e2e suite (which intercepts
 * the Arbitrum URL) keep the old order.
 */
export const READ_RPCS = [
  ...new Set(
    [process.env.NEXT_PUBLIC_RPC_URL, PUBLICNODE_RPC, ARBITRUM_PUBLIC_RPC].filter(
      (url): url is string => Boolean(url),
    ),
  ),
];

export const RPC_URL = READ_RPCS[0];

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  // A read that hangs is worse than a read that fails: a failure surfaces a
  // message, a hang looks identical to "still loading" forever. One retry per
  // endpoint, then the next one answers instead.
  transport: fallback(READ_RPCS.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
});
