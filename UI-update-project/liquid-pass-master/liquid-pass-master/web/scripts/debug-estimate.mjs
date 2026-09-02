const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

const X = 0xccc84f03b91e4e0f66ccf27d4d66165bfab63dccb3d546e8c72a98a23687b02dn;
const Y = 0x63d55dd74686667eb86f0a82fd27b2e94dccd71f205355abe4f75d42187077cfn;
const h = (v) => v.toString(16).padStart(64, "0");
const DATA = "0xd66d6c10" + h(X) + h(Y);

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return await r.json();
}

// A funded-looking EOA and a zero address, to see whether `from` matters.
const senders = [
  "0x1111111111111111111111111111111111111111",
  "0x0000000000000000000000000000000000000000",
];

for (const from of senders) {
  console.log(`\n=== from ${from} ===`);
  const call = await rpc("eth_call", [{ from, to: ADDRESS, data: DATA }, "latest"]);
  console.log(`  eth_call     : ${call.result !== undefined ? "OK " + call.result : "REVERT " + JSON.stringify(call.error)}`);

  const est = await rpc("eth_estimateGas", [{ from, to: ADDRESS, data: DATA }]);
  if (est.result !== undefined) {
    console.log(`  estimateGas  : OK ${parseInt(est.result, 16)} gas`);
  } else {
    console.log(`  estimateGas  : FAILED ${JSON.stringify(est.error)}`);
  }
}

// Also estimate the two working views for comparison.
console.log("\n=== control: estimateGas on nonce() ===");
const n = await rpc("eth_estimateGas", [{ from: senders[0], to: ADDRESS, data: "0xaffed0e0" }]);
console.log(n.result !== undefined ? `  OK ${parseInt(n.result, 16)} gas` : `  FAILED ${JSON.stringify(n.error)}`);
