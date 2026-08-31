import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const CALLER = "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174";
const P256 = "0x0000000000000000000000000000000000000100";

const v = JSON.parse(readFileSync(new URL("../contracts/tracks/fixtures/vector1.json", import.meta.url)));
const pk = Buffer.from(v.publicKeyDer, "base64");
const ad = Buffer.from(v.authenticatorData, "base64");
const cdj = Buffer.from(v.clientDataJSON, "base64");
const der = Buffer.from(v.signatureDer, "base64");
const x = pk.subarray(pk.length-64, pk.length-32), y = pk.subarray(pk.length-32);
const digest = createHash("sha256").update(Buffer.concat([ad, createHash("sha256").update(cdj).digest()])).digest();
let i = 2; const rl = der[i+1]; let r = der.subarray(i+2, i+2+rl); i += 2+rl;
const sl = der[i+1]; let s = der.subarray(i+2, i+2+sl);
const fix = (b) => Buffer.from(b.toString("hex").padStart(64,"0").slice(-64), "hex");
r = fix(r); s = fix(s);

const good = "0x" + Buffer.concat([digest, r, s, x, y]).toString("hex");
const badDigest = Buffer.from(digest); badDigest[0] ^= 1;
const bad = "0x" + Buffer.concat([badDigest, r, s, x, y]).toString("hex");

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: {"content-type":"application/json"},
    body: JSON.stringify({ jsonrpc:"2.0", id:1, method, params }) });
  return await res.json();
}

console.log("correctness:");
console.log(`  valid signature  -> ${(await rpc("eth_call",[{to:P256,data:good},"latest"])).result}`);
console.log(`  tampered digest  -> ${JSON.stringify((await rpc("eth_call",[{to:P256,data:bad},"latest"])).result)}  (must NOT be ...0001)`);

const est = [];
for (let k = 0; k < 3; k++) {
  const e = await rpc("eth_estimateGas", [{ from: CALLER, to: P256, data: good }]);
  est.push(parseInt(e.result, 16));
}
// Baseline: same 160-byte calldata to an address that does nothing.
const base = [];
for (let k = 0; k < 3; k++) {
  const e = await rpc("eth_estimateGas", [{ from: CALLER, to: "0x000000000000000000000000000000000000dEaD", data: good }]);
  base.push(parseInt(e.result, 16));
}
const g = Math.min(...est), b = Math.min(...base);
console.log(`\ngas:`);
console.log(`  call to precompile 0x100      : ${g}`);
console.log(`  same calldata to a dead EOA   : ${b}`);
console.log(`  PURE PRECOMPILE VERIFICATION  : ${g - b}`);
