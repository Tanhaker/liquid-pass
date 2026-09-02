import { createPublicClient, http, encodeFunctionData } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { passKeyWalletAbi, PASSKEY_WALLET_ADDRESS } from "../lib/abi.ts";

const client = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
const X = 0xccc84f03b91e4e0f66ccf27d4d66165bfab63dccb3d546e8c72a98a23687b02dn;
const Y = 0x63d55dd74686667eb86f0a82fd27b2e94dccd71f205355abe4f75d42187077cfn;

console.log("address from lib/abi.ts:", PASSKEY_WALLET_ADDRESS);

const encoded = encodeFunctionData({ abi: passKeyWalletAbi, functionName: "register", args: [X, Y] });
console.log("\nencoded by the frontend ABI:");
console.log(" ", encoded);
const known = "0xd66d6c10" + X.toString(16).padStart(64,"0") + Y.toString(16).padStart(64,"0");
console.log("known-good:");
console.log(" ", known);
console.log("match:", encoded.toLowerCase() === known.toLowerCase());

console.log("\n--- simulateContract (what wagmi does before sending) ---");
try {
  const sim = await client.simulateContract({
    address: PASSKEY_WALLET_ADDRESS,
    abi: passKeyWalletAbi,
    functionName: "register",
    args: [X, Y],
    account: "0x1111111111111111111111111111111111111111",
  });
  console.log("  simulate OK, request.chainId =", sim.request.chainId);
} catch (e) {
  console.log("  simulate FAILED:", e.shortMessage ?? e.message);
  if (e.metaMessages) console.log("  ", e.metaMessages.join("\n   "));
}
