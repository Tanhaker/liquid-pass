import { readFileSync } from "node:fs";

// Reimplement the frontend's extraction exactly as lib/passkey.ts has it.
function bytesToBigInt(b) { let o = 0n; for (const x of b) o = (o << 8n) | BigInt(x); return o; }
function parseSpkiPublicKey(spki) {
  if (spki.length < 65) throw new Error(`SPKI too short: ${spki.length}`);
  const point = spki.slice(spki.length - 65);
  if (point[0] !== 0x04) throw new Error(`not uncompressed: 0x${point[0].toString(16)}`);
  return { x: bytesToBigInt(point.slice(1, 33)), y: bytesToBigInt(point.slice(33, 65)) };
}
const hex = (v) => "0x" + v.toString(16).padStart(64, "0");

const v1 = JSON.parse(readFileSync("../contracts/tracks/fixtures/vector1.json", "utf8"));
const spki = Buffer.from(v1.publicKeyDer, "base64");

console.log(`SPKI length: ${spki.length}`);
console.log(`SPKI hex   : ${spki.toString("hex")}`);
const { x, y } = parseSpkiPublicKey(spki);
console.log(`\nextracted x = ${hex(x)}`);
console.log(`extracted y = ${hex(y)}`);

// Known-good values decoded earlier straight from the fixture.
const EXP_X = "0xccc84f03b91e4e0f66ccf27d4d66165bfab63dccb3d546e8c72a98a23687b02d";
const EXP_Y = "0x63d55dd74686667eb86f0a82fd27b2e94dccd71f205355abe4f75d42187077cf";
console.log(`\nx matches: ${hex(x) === EXP_X}`);
console.log(`y matches: ${hex(y) === EXP_Y}`);
console.log(`x is zero: ${x === 0n}   y is zero: ${y === 0n}`);

// Round-trip through the exact storage path the page uses.
const stored = { x: x.toString(), y: y.toString() };
console.log(`\nlocalStorage round-trip: BigInt(x)==x -> ${BigInt(stored.x) === x}`);
console.log(`decimal string length: ${stored.x.length}`);
