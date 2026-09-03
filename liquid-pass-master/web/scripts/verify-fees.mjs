import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
const client = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });

const block = await client.getBlock();
const base = block.baseFeePerGas ?? 0n;
const tip = 1_000_000n;
const maxFee = base * 4n + tip;

console.log(`current baseFeePerGas : ${base} wei`);
console.log(`old (MetaMask) cap    : 45626000 wei  <- rejected, base was 46254000`);
console.log(`new cap (base*4 + tip): ${maxFee} wei`);
console.log(`headroom over base    : ${maxFee - base} wei  (${(Number(maxFee) / Number(base)).toFixed(1)}x)`);
console.log(`\nwould the old cap still fail right now? ${45626000n < base}`);
console.log(`does the new cap clear base?             ${maxFee > base}`);

// How far could the base fee spike before the new cap fails?
console.log(`\nbase fee could rise ${((Number(maxFee) / Number(base) - 1) * 100).toFixed(0)}% before this cap is too low.`);
const cost = 134850n * base;
console.log(`\nactual charge at 134850 gas: ${cost} wei = ${Number(cost) / 1e18} ETH`);
console.log("(the cap is a ceiling, not a price -- the difference is never charged)");
