import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";
const abi = [
  { type: "function", name: "getChallenge", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    outputs: [{ type: "bytes32" }] },
  { type: "function", name: "nonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pubkey", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
];

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
});

async function call(name, args = []) {
  try {
    const out = await client.readContract({ address: ADDRESS, abi, functionName: name, args });
    console.log(`  ${name}() -> ${Array.isArray(out) ? out.join(", ") : out}`);
    return out;
  } catch (e) {
    console.log(`  ${name}() FAILED: ${e.shortMessage ?? e.message}`);
    return null;
  }
}

console.log("== reads that do NOT touch the precompile ==");
await call("nonce");
await call("pubkey");

console.log("\n== getChallenge: this calls SHA-256 precompile 0x02 twice ==");
const d1 = await call("getChallenge", ["0x0000000000000000000000000000000000000000", 0n, "0x"]);
const d2 = await call("getChallenge", ["0x0000000000000000000000000000000000000001", 0n, "0x"]);

console.log("");
if (d1 && d2) {
  console.log("PRECOMPILE WORKS - contract hashed and returned a digest.");
  console.log("distinct digests for distinct targets:", d1 !== d2);
} else {
  console.log("PRECOMPILE PATH BROKEN - execute() cannot succeed.");
}
