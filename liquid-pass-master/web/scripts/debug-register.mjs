import { createPublicClient, http, encodeFunctionData, toFunctionSelector, hexToString } from "viem";
import { arbitrumSepolia } from "viem/chains";

const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const client = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) });

// Real, valid P-256 point taken from contracts/tracks/fixtures/vector1.json
const X = 0xccc84f03b91e4e0f66ccf27d4d66165bfab63dccb3d546e8c72a98a23687b02dn;
const Y = 0x63d55dd74686667eb86f0a82fd27b2e94dccd71f205355abe4f75d42187077cfn;

const CALLER = "0x1111111111111111111111111111111111111111";

console.log("selectors:");
for (const sig of [
  "register(uint256,uint256)",
  "nonce()",
  "pubkey()",
  "getChallenge(address,uint256,bytes)",
]) {
  console.log(`  ${toFunctionSelector(sig)}  ${sig}`);
}

async function rawCall(label, data) {
  const body = {
    jsonrpc: "2.0", id: 1, method: "eth_call",
    params: [{ from: CALLER, to: ADDRESS, data }, "latest"],
  };
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.result !== undefined) {
    console.log(`  ${label}: OK -> ${j.result}`);
    return { ok: true, result: j.result };
  }
  const err = j.error ?? {};
  let decoded = "";
  const d = err.data;
  if (typeof d === "string" && d.length > 2) {
    // Stylus reverts with raw bytes for Err(Vec<u8>), so try plain ASCII too.
    try { decoded = ` | ascii="${hexToString(d).replace(/[^\x20-\x7e]/g, ".")}"`; } catch {}
  }
  console.log(`  ${label}: REVERT msg="${err.message}" data=${d ?? "(none)"}${decoded}`);
  return { ok: false, err };
}

console.log("\n== control: functions known to work ==");
await rawCall("nonce()", toFunctionSelector("nonce()"));
await rawCall("pubkey()", toFunctionSelector("pubkey()"));

console.log("\n== register with the real fixture point ==");
await rawCall("register(fixture x,y)",
  encodeFunctionData({
    abi: [{ type: "function", name: "register", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] }],
    functionName: "register", args: [X, Y],
  }));

console.log("\n== register with trivial non-zero values ==");
await rawCall("register(1,1)",
  encodeFunctionData({
    abi: [{ type: "function", name: "register", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] }],
    functionName: "register", args: [1n, 1n],
  }));

console.log("\n== register with both zero (should hit the 'zero pubkey' guard) ==");
await rawCall("register(0,0)",
  encodeFunctionData({
    abi: [{ type: "function", name: "register", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] }],
    functionName: "register", args: [0n, 0n],
  }));
