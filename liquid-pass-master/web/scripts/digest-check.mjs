import { createHash } from "node:crypto";

// Recompute challenge_preimage() independently and compare with the value the
// deployed contract returned. If these agree, the frontend and the contract
// agree on rule 6's preimage.
const contract = "490630168df621c98e6bba22549295a2202de358";

function preimage(target, nonce, valueHex = "00".repeat(32), data = "") {
  const parts = [
    Buffer.from("PassKeyWallet.v1", "ascii"),
    Buffer.from(contract, "hex"),
    Buffer.from(nonce.toString(16).padStart(16, "0"), "hex"), // u64 big-endian
    Buffer.from(target, "hex"),
    Buffer.from(valueHex, "hex"),
    Buffer.from(data, "hex"),
  ];
  return "0x" + createHash("sha256").update(Buffer.concat(parts)).digest("hex");
}

const cases = [
  ["0000000000000000000000000000000000000000", "0x35f5c6556961a2981a3c199af4a77836fe7bfdebbc928f07ca9e621e36ebdfdc"],
  ["0000000000000000000000000000000000000001", "0xa95ffd9d5757c548d489728e00b4d0115820202d0882148b0b49aa527fcbacc5"],
];

let allMatch = true;
for (const [target, onchain] of cases) {
  const local = preimage(target, 0n);
  const match = local === onchain;
  allMatch &&= match;
  console.log(`target 0x${target.slice(0, 8)}...`);
  console.log(`  on-chain: ${onchain}`);
  console.log(`  local   : ${local}`);
  console.log(`  ${match ? "MATCH" : "MISMATCH"}\n`);
}
console.log(allMatch
  ? "Rule 6 preimage confirmed: contract and client agree byte-for-byte."
  : "PREIMAGE DISAGREES - the frontend would sign the wrong digest.");
