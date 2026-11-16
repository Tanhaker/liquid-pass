/**
 * Writes lib/activity-snapshot.json: every log the Liquid Pass core and the
 * marketplace have emitted, from the deploy block to a recent block.
 *
 * Why a snapshot exists at all: the activity feed needs the whole event
 * history, and free RPCs cap eth_getLogs at 10k-50k blocks per request. The
 * chain is already 25M+ blocks past the deploy block and grows by ~345k a day,
 * so reading history live means hundreds to thousands of requests. With this
 * file checked in, lib/activityServer.ts only has to read the blocks AFTER the
 * snapshot, which stays a handful of requests however old the contract gets.
 *
 * The logs are raw chain data, written exactly as the RPC returned them. Run
 * again whenever you like; it only moves the starting point forward.
 *
 *   node scripts/snapshot-activity.mjs            write the snapshot
 *   node scripts/snapshot-activity.mjs --verify   also re-read the range from a
 *                                                 second RPC and compare
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";
const MARKETPLACE = "0x63a9edec92baf3e74f19d301808c56104e786241";
const DEPLOY_BLOCK = 304290900;
/** Stay behind the head so a lagging node cannot hide the newest logs. */
const SAFETY = 1_000;

const TENDERLY = "https://arbitrum-sepolia.gateway.tenderly.co";
const PUBLICNODE = "https://arbitrum-sepolia-rpc.publicnode.com";
const PUBLICNODE_WINDOW = 45_000;

const hex = (n) => "0x" + n.toString(16);

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}

const slim = (l) => ({
  address: l.address.toLowerCase(),
  blockNumber: parseInt(l.blockNumber, 16),
  transactionHash: l.transactionHash,
  logIndex: parseInt(l.logIndex, 16),
  topics: l.topics,
  data: l.data,
});
const key = (l) => `${l.transactionHash}:${l.logIndex}`;
const order = (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex;

async function windowed(url, from, to, size) {
  const out = [];
  const ranges = [];
  for (let f = from; f <= to; f += size) ranges.push([f, Math.min(f + size - 1, to)]);
  for (let i = 0; i < ranges.length; i += 5) {
    const batch = await Promise.all(
      ranges.slice(i, i + 5).map(([f, t]) =>
        rpc(url, "eth_getLogs", [{ address: [CORE, MARKETPLACE], fromBlock: hex(f), toBlock: hex(t) }]),
      ),
    );
    out.push(...batch.flat());
    process.stdout.write(`\r  ${Math.min(i + 5, ranges.length)}/${ranges.length} windows`);
  }
  process.stdout.write("\n");
  return out;
}

const latest = parseInt(await rpc(TENDERLY, "eth_blockNumber", []), 16);
const toBlock = latest - SAFETY;
const raw = await rpc(TENDERLY, "eth_getLogs", [
  { address: [CORE, MARKETPLACE], fromBlock: hex(DEPLOY_BLOCK), toBlock: hex(toBlock) },
]);
const logs = raw.map(slim).sort(order);
console.log(`tenderly: ${logs.length} logs in blocks ${DEPLOY_BLOCK}..${toBlock}`);
console.log(`  core ${logs.filter((l) => l.address === CORE).length}, marketplace ${logs.filter((l) => l.address === MARKETPLACE).length}`);

if (process.argv.includes("--verify")) {
  console.log("publicnode: re-reading the same range in windows");
  const second = (await windowed(PUBLICNODE, DEPLOY_BLOCK, toBlock, PUBLICNODE_WINDOW)).map(slim).sort(order);
  const a = new Set(logs.map(key));
  const b = new Set(second.map(key));
  const onlyA = [...a].filter((k) => !b.has(k));
  const onlyB = [...b].filter((k) => !a.has(k));
  console.log(`publicnode: ${second.length} logs; only in tenderly ${onlyA.length}, only in publicnode ${onlyB.length}`);
  if (onlyA.length || onlyB.length) {
    console.error("The two RPCs disagree. Snapshot NOT written.");
    process.exit(1);
  }
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "activity-snapshot.json");
fs.writeFileSync(
  file,
  JSON.stringify({ core: CORE, marketplace: MARKETPLACE, fromBlock: DEPLOY_BLOCK, toBlock, logs }, null, 1) + "\n",
);
console.log("wrote", path.relative(process.cwd(), file));
