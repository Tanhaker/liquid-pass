import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const VARIANTS = {
  "no precomputed-tables": "0x52ca5d07bf69e0b2fb4f25ff10a32f709beb0fae",
  "precomputed-tables":    "0x80f7a7de171ab41ee80b0f32c8460d97a3ee9da1",
};
const CALLER = "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174";
const client = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });

// Real assertion from the Windows Hello fixture. Nothing synthetic.
const v = JSON.parse(readFileSync(new URL("../contracts/tracks/fixtures/vector1.json", import.meta.url)));
const pk = Buffer.from(v.publicKeyDer, "base64");
const ad = Buffer.from(v.authenticatorData, "base64");
const cdj = Buffer.from(v.clientDataJSON, "base64");
const der = Buffer.from(v.signatureDer, "base64");

const x = "0x" + pk.subarray(pk.length - 64, pk.length - 32).toString("hex");
const y = "0x" + pk.subarray(pk.length - 32).toString("hex");

// Rule 1 digest, computed off chain so the contract only does curve maths.
const cdjHash = createHash("sha256").update(cdj).digest();
const digest = "0x" + createHash("sha256").update(Buffer.concat([ad, cdjHash])).digest("hex");

function derRS(d) {
  let i = 2;
  const rl = d[i + 1]; const r = d.subarray(i + 2, i + 2 + rl); i += 2 + rl;
  const sl = d[i + 1]; const s = d.subarray(i + 2, i + 2 + sl);
  const pad = (b) => "0x" + Buffer.from(b).toString("hex").padStart(64, "0").slice(-64);
  return { r: pad(r), s: pad(s) };
}
const { r, s } = derRS(der);

const abi = [
  { type: "function", name: "verifyP256", stateMutability: "view",
    inputs: [{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"}],
    outputs: [{ type: "bool" }] },
  { type: "function", name: "noop", stateMutability: "view",
    inputs: [{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"},{type:"bytes32"}],
    outputs: [{ type: "bool" }] },
];
const args = [x, y, digest, r, s];

console.log("inputs (real Windows Hello assertion, vector1):");
console.log(`  x      ${x}`);
console.log(`  digest ${digest}`);
console.log(`  r      ${r}`);
console.log(`  s      ${s}`);

// Correctness first: a gas number from a signature that does not verify is meaningless.
const ok = await client.readContract({ address: Object.values(VARIANTS)[0], abi, functionName: "verifyP256", args });
console.log(`\nverifyP256 returns: ${ok}`);
if (!ok) { console.log("SIGNATURE DID NOT VERIFY - gas number would be meaningless"); process.exit(1); }

// Also confirm it rejects a corrupted signature (so it is really verifying).
const badR = "0x" + (BigInt(r) ^ 1n).toString(16).padStart(64, "0");
const bad = await client.readContract({ address: Object.values(VARIANTS)[0], abi, functionName: "verifyP256", args: [x, y, digest, badR, s] });
console.log(`verifyP256 with corrupted r returns: ${bad}  (must be false)`);

async function measure(address, fn, a) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    runs.push(await client.estimateContractGas({ address, abi, functionName: fn, args: a, account: CALLER }));
  }
  return runs.reduce((m, v) => (v < m ? v : m));
}

const results = {
  measuredAt: new Date().toISOString(),
  chain: "arbitrum-sepolia",
  source: "contracts/tracks/fixtures/vector1.json (Windows Hello, Chrome)",
  method: "eth_estimateGas, min of 3; pure = verifyP256 - noop (identical signature), removing intrinsic gas, calldata and router dispatch",
  stylus: {},
};

console.log(`
=== eth_estimateGas (min of 3 runs) ===`);
for (const [label, address] of Object.entries(VARIANTS)) {
  const correct = await client.readContract({ address, abi, functionName: "verifyP256", args });
  const verify = await measure(address, "verifyP256", args);
  const noop = await measure(address, "noop", args);
  const pure = verify - noop;
  console.log(`
${label}  (${address})`);
  console.log(`  verifies correctly : ${correct}`);
  console.log(`  full call          : ${verify}`);
  console.log(`  noop baseline      : ${noop}`);
  console.log(`  PURE VERIFICATION  : ${pure}`);
  results.stylus[label] = {
    address, verifiesCorrectly: correct,
    fullCallGas: Number(verify), baselineNoopGas: Number(noop), pureVerificationGas: Number(pure),
  };
}

writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(results, null, 2));
console.log(`
wrote bench/results.json`);
