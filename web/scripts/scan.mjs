const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358".toLowerCase();
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return (await r.json()).result;
}

async function batch(nums) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(RPC, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(nums.map((n, i) => ({
          jsonrpc: "2.0", id: i, method: "eth_getBlockByNumber",
          params: ["0x" + n.toString(16), true],
        }))),
      });
      const j = await r.json();
      if (Array.isArray(j)) return j.map((x) => x.result).filter(Boolean);
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return [];
}

const latest = parseInt(await rpc("eth_blockNumber", []), 16);
const WINDOW = 30000, SIZE = 20, CONC = 15;
const start = latest - WINDOW;
console.log(`scanning blocks ${start}..${latest} (~2h)`);

const chunks = [];
for (let b = latest; b > start; b -= SIZE) {
  const nums = [];
  for (let k = 0; k < SIZE && b - k > start; k++) nums.push(b - k);
  chunks.push(nums);
}

const found = [];
let done = 0;
for (let i = 0; i < chunks.length; i += CONC) {
  const slice = chunks.slice(i, i + CONC);
  const results = await Promise.all(slice.map(batch));
  for (const blocks of results) {
    for (const blk of blocks) {
      for (const tx of blk.transactions ?? []) {
        if ((tx.to ?? "").toLowerCase() === ADDRESS) {
          found.push({ hash: tx.hash, from: tx.from, input: tx.input,
                       block: parseInt(blk.number, 16), value: tx.value });
        }
      }
    }
  }
  done += slice.length;
  if (done % 300 === 0) process.stdout.write(`.`);
}
console.log(`\n\ntransactions to contract: ${found.length}`);

found.sort((a, b) => a.block - b.block);
for (const t of found) {
  const rcpt = await rpc("eth_getTransactionReceipt", [t.hash]);
  const status = rcpt?.status === "0x1" ? "SUCCESS" : "FAILED ";
  const sel = t.input.slice(0, 10);
  console.log(`\nblock ${t.block}  ${status}  ${t.hash}`);
  console.log(`  from ${t.from}  selector ${sel}  gasUsed ${rcpt ? parseInt(rcpt.gasUsed, 16) : "?"}  value ${t.value}`);
  console.log(`  inputLen ${(t.input.length - 2) / 2} bytes`);
  if (sel === "0xd66d6c10" && t.input.length >= 138) {
    const x = BigInt("0x" + t.input.slice(10, 74));
    const y = BigInt("0x" + t.input.slice(74, 138));
    console.log(`  x = 0x${x.toString(16).padStart(64, "0")}  zero=${x === 0n}`);
    console.log(`  y = 0x${y.toString(16).padStart(64, "0")}  zero=${y === 0n}`);
  } else {
    console.log(`  input ${t.input.slice(0, 200)}`);
  }
}
