import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

const v = JSON.parse(readFileSync(new URL("../contracts/tracks/fixtures/vector1.json", import.meta.url)));
const pk = Buffer.from(v.publicKeyDer, "base64");
const ad = Buffer.from(v.authenticatorData, "base64");
const cdj = Buffer.from(v.clientDataJSON, "base64");
const der = Buffer.from(v.signatureDer, "base64");
const x = pk.subarray(pk.length - 64, pk.length - 32);
const y = pk.subarray(pk.length - 32);
const digest = createHash("sha256").update(Buffer.concat([ad, createHash("sha256").update(cdj).digest()])).digest();
let i = 2; const rl = der[i+1]; let r = der.subarray(i+2, i+2+rl); i += 2+rl;
const sl = der[i+1]; let s = der.subarray(i+2, i+2+sl);
const fix = (b) => Buffer.from(b.toString("hex").padStart(64,"0").slice(-64), "hex");
r = fix(r); s = fix(s);

// RIP-7212: input = hash || r || s || x || y  (160 bytes), returns 32-byte 1 on success
const input = "0x" + Buffer.concat([digest, r, s, x, y]).toString("hex");

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: {"content-type":"application/json"},
    body: JSON.stringify({ jsonrpc:"2.0", id:1, method, params }) });
  return await res.json();
}

for (const addr of ["0x0000000000000000000000000000000000000100", "0x0000000000000000000000000000000000000007"]) {
  const code = await rpc("eth_getCode", [addr, "latest"]);
  const call = await rpc("eth_call", [{ to: addr, data: input }, "latest"]);
  console.log(`\naddress ${addr}`);
  console.log(`  getCode : ${code.result}`);
  console.log(`  eth_call: ${call.result !== undefined ? JSON.stringify(call.result) : "ERROR " + JSON.stringify(call.error)}`);
  if (call.result && /^0x0*1$/.test(call.result)) console.log("  --> RIP-7212 P-256 PRECOMPILE IS PRESENT AND VALIDATED THE SIGNATURE");
  else if (call.result === "0x") console.log("  --> empty return: precompile absent (call to empty account succeeds trivially)");
}
