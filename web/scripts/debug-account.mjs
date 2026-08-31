const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const ACCOUNT = "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174";
const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";

const X = 0xb4e9cf3272e8d135b7177865aa46e2e5c6aabfef25bd3a75c63f1588e1f7767an;
const Y = 0x69598508dfc4b3ae0797ce61fd2832f43b461d8b379827e812f0b9bab31003b0n;

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return await r.json();
}

const bal = await rpc("eth_getBalance", [ACCOUNT, "latest"]);
const wei = BigInt(bal.result ?? "0x0");
const txcount = await rpc("eth_getTransactionCount", [ACCOUNT, "latest"]);
console.log(`account ${ACCOUNT}`);
console.log(`  balance  ${wei} wei  = ${Number(wei) / 1e18} ETH`);
console.log(`  tx count ${parseInt(txcount.result ?? "0x0", 16)}`);

// Is the stored pubkey actually a point on P-256?  y^2 == x^3 - 3x + b (mod p)
const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
const mod = (a, m) => ((a % m) + m) % m;
const lhs = mod(Y * Y, P);
const rhs = mod(X * X * X - 3n * X + B, P);
console.log(`\nstored pubkey on curve? ${lhs === rhs}`);
console.log(`  x = 0x${X.toString(16).padStart(64, "0")}`);
console.log(`  y = 0x${Y.toString(16).padStart(64, "0")}`);

// Does register succeed from THEIR address with THEIR values?
const h = (v) => v.toString(16).padStart(64, "0");
const data = "0xd66d6c10" + h(X) + h(Y);
const call = await rpc("eth_call", [{ from: ACCOUNT, to: ADDRESS, data }, "latest"]);
console.log(`\neth_call register(their x,y) from their account:`);
console.log(`  ${call.result !== undefined ? "OK " + call.result : "REVERT " + JSON.stringify(call.error)}`);

const est = await rpc("eth_estimateGas", [{ from: ACCOUNT, to: ADDRESS, data }]);
console.log(`eth_estimateGas: ${est.result !== undefined ? parseInt(est.result, 16) + " gas" : "FAILED " + JSON.stringify(est.error)}`);

if (est.result) {
  const gp = await rpc("eth_gasPrice", []);
  const cost = BigInt(est.result) * BigInt(gp.result);
  console.log(`\ngas price ${BigInt(gp.result)} wei`);
  console.log(`estimated tx cost ${cost} wei = ${Number(cost) / 1e18} ETH`);
  console.log(`affordable? ${wei >= cost}   (balance ${Number(wei)/1e18} ETH)`);
}
