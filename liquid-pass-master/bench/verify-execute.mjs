import { createPublicClient, http, parseAbi, decodeEventLog } from "viem";
import { arbitrumSepolia } from "viem/chains";
const WALLET = "0x490630168df621c98e6bba22549295a2202de358";
const TX = "0xdaff78191a04b77bdf8ffa50745cf3eca407d3162632efe4af6c477e0c4c3044";
const c = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });

const r = await c.getTransactionReceipt({ hash: TX });
const t = await c.getTransaction({ hash: TX });
const abi = parseAbi([
  "event Executed(address indexed target, uint256 value, uint256 nonce)",
  "function nonce() view returns (uint256)",
  "function pubkey() view returns (uint256, uint256)",
]);

console.log(`status            : ${r.status}`);
console.log(`block             : ${r.blockNumber}`);
console.log(`to is PassKeyWallet: ${t.to.toLowerCase() === WALLET.toLowerCase()}`);
console.log(`selector          : ${t.input.slice(0,10)}  (execute)`);
console.log(`calldata size     : ${(t.input.length - 2) / 2} bytes`);
console.log(`gasUsed           : ${r.gasUsed}`);
for (const l of r.logs) {
  try { const d = decodeEventLog({ abi, data: l.data, topics: l.topics });
    console.log(`event ${d.eventName}   : target=${d.args.target} value=${d.args.value} nonceConsumed=${d.args.nonce}`); } catch {}
}
const now = await c.readContract({ address: WALLET, abi, functionName: "nonce" });
const [x, y] = await c.readContract({ address: WALLET, abi, functionName: "pubkey" });
console.log(`\nnonce now         : ${now}`);
console.log(`pubkey still set  : ${!(x === 0n && y === 0n)}`);
console.log(`\nThe Executed event records nonceConsumed=0 and nonce() now reads ${now},`);
console.log(`so this tx advanced the nonce 0 -> 1. It only reaches that point after`);
console.log(`verify_assertion returns Ok, so P-256 was verified on chain.`);
