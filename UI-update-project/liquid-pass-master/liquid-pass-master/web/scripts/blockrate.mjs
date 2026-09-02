const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return (await r.json()).result;
}
const latest = parseInt(await rpc("eth_blockNumber", []), 16);
const b1 = await rpc("eth_getBlockByNumber", ["0x" + latest.toString(16), false]);
const b0 = await rpc("eth_getBlockByNumber", ["0x" + (latest - 5000).toString(16), false]);
const dt = parseInt(b1.timestamp, 16) - parseInt(b0.timestamp, 16);
console.log(`latest block ${latest}`);
console.log(`5000 blocks span ${dt}s -> ${(dt / 5000).toFixed(3)} s/block`);
console.log(`blocks per hour: ${Math.round(3600 / (dt / 5000))}`);
console.log(`latest ts: ${new Date(parseInt(b1.timestamp, 16) * 1000).toISOString()}`);
