const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358".toLowerCase();
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await r.json()).result;
}
async function rpcBatch(reqs) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(reqs.map((q, i) => ({ jsonrpc: "2.0", id: i, ...q }))),
  });
  return await r.json();
}

const latest = parseInt(await rpc("eth_blockNumber", []), 16);
console.log(`latest block: ${latest}`);

const WINDOW = 20000;
const BATCH = 250;
const found = [];

for (let end = latest; end > latest - WINDOW && found.length < 20; end -= BATCH) {
  const nums = [];
  for (let b = end; b > Math.max(end - BATCH, latest - WINDOW); b--) nums.push(b);
  const res = await rpcBatch(nums.map((n) => ({
    method: "eth_getBlockByNumber", params: ["0x" + n.toString(16), true],
  })));
  for (const item of res) {
    const blk = item.result;
    if (!blk?.transactions) continue;
    for (const tx of blk.transactions) {
      if ((tx.to ?? "").toLowerCase() === ADDRESS) {
        found.push({ hash: tx.hash, from: tx.from, input: tx.input, block: parseInt(blk.number, 16) });
      }
    }
  }
}

console.log(`\ntransactions to the contract found: ${found.length}`);
for (const t of found.reverse()) {
  const receipt = await rpc("eth_getTransactionReceipt", [t.hash]);
  const status = receipt?.status === "0x1" ? "SUCCESS" : "FAILED";
  const selector = t.input.slice(0, 10);
  console.log(`\nblock ${t.block}  ${status}  ${t.hash}`);
  console.log(`  from     ${t.from}`);
  console.log(`  selector ${selector}`);
  console.log(`  gasUsed  ${receipt ? parseInt(receipt.gasUsed, 16) : "?"}`);
  console.log(`  input    ${t.input.length > 220 ? t.input.slice(0, 220) + "..." : t.input}`);
  if (t.input.length >= 138 && selector === "0xd66d6c10") {
    const x = BigInt("0x" + t.input.slice(10, 74));
    const y = BigInt("0x" + t.input.slice(74, 138));
    console.log(`  decoded x = 0x${x.toString(16).padStart(64, "0")}`);
    console.log(`  decoded y = 0x${y.toString(16).padStart(64, "0")}`);
    console.log(`  x zero? ${x === 0n}   y zero? ${y === 0n}`);
  }
}
