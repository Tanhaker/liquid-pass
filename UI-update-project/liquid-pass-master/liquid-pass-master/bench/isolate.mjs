import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const C = "0x337cc429dcd46e31b5d98ed26d364a6b5cfffaf2"; // x1 + x2 + noop, precomputed-tables
const CALLER = "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174";
const client = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });

const v = JSON.parse(readFileSync(new URL("../contracts/tracks/fixtures/vector1.json", import.meta.url)));
const pk = Buffer.from(v.publicKeyDer, "base64");
const ad = Buffer.from(v.authenticatorData, "base64");
const cdj = Buffer.from(v.clientDataJSON, "base64");
const der = Buffer.from(v.signatureDer, "base64");
const x = "0x" + pk.subarray(pk.length - 64, pk.length - 32).toString("hex");
const y = "0x" + pk.subarray(pk.length - 32).toString("hex");
const digest = "0x" + createHash("sha256").update(Buffer.concat([ad, createHash("sha256").update(cdj).digest()])).digest("hex");
let i = 2; const rl = der[i+1]; const rb = der.subarray(i+2, i+2+rl); i += 2+rl;
const sl = der[i+1]; const sb = der.subarray(i+2, i+2+sl);
const pad = (b) => "0x" + Buffer.from(b).toString("hex").padStart(64,"0").slice(-64);
const r = pad(rb), s = pad(sb);

const five = [{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"}];
const abi = ["verifyP256","verifyP256X2","noop"].map((name) => ({
  type: "function", name, stateMutability: "view", inputs: five, outputs: [{ type: "bool" }],
}));
const args = [x, y, digest, r, s];

for (const fn of ["verifyP256", "verifyP256X2"]) {
  const ok = await client.readContract({ address: C, abi, functionName: fn, args });
  console.log(`${fn} returns ${ok}`);
  if (!ok) { console.log("  NOT VERIFYING - number would be meaningless"); process.exit(1); }
}

const g = async (fn) => {
  const runs = [];
  for (let k = 0; k < 3; k++) runs.push(await client.estimateContractGas({ address: C, abi, functionName: fn, args, account: CALLER }));
  return runs.reduce((m, v) => (v < m ? v : m));
};

const noop = await g("noop"), one = await g("verifyP256"), two = await g("verifyP256X2");
console.log(`\n  noop        ${noop}`);
console.log(`  verify x1   ${one}`);
console.log(`  verify x2   ${two}`);
console.log(`\n  x1 - noop        = ${one - noop}   (subtracts fixed costs via a no-op)`);
console.log(`  x2 - x1          = ${two - one}   (subtracts EVERYTHING incl. module init)`);
console.log(`  x2 - 2*(x1-noop) = ${two - 2n * (one - noop)}  (implied fixed overhead)`);
