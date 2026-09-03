import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";
const TX = "0xed1787e13d2e0af9729757eb9c10bee1c2b1bac41b7bb59f32995f4591efd77e";
const client = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });

const r = await client.getTransactionReceipt({ hash: TX });
console.log(`receipt status : ${r.status}`);
console.log(`block          : ${r.blockNumber}`);
console.log(`gasUsed        : ${r.gasUsed}`);
console.log(`effectiveGasPrice: ${r.effectiveGasPrice} wei`);
console.log(`actual fee paid: ${Number(r.gasUsed * r.effectiveGasPrice) / 1e18} ETH`);
console.log(`logs emitted   : ${r.logs.length}`);

const abi = [
  { type: "function", name: "pubkey", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "nonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];
const [x, y] = await client.readContract({ address: ADDRESS, abi, functionName: "pubkey" });
const n = await client.readContract({ address: ADDRESS, abi, functionName: "nonce" });
const h = (v) => "0x" + v.toString(16).padStart(64, "0");
console.log(`\non-chain pubkey x = ${h(x)}`);
console.log(`on-chain pubkey y = ${h(y)}`);
console.log(`on-chain nonce    = ${n}`);

const EXP_X = 0xb4e9cf3272e8d135b7177865aa46e2e5c6aabfef25bd3a75c63f1588e1f7767an;
const EXP_Y = 0x69598508dfc4b3ae0797ce61fd2832f43b461d8b379827e812f0b9bab31003b0n;
console.log(`\nmatches the browser's passkey? ${x === EXP_X && y === EXP_Y}`);

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
const mod = (a, m) => ((a % m) + m) % m;
console.log(`registered key is on the P-256 curve? ${mod(y*y, P) === mod(x*x*x - 3n*x + B, P)}`);
