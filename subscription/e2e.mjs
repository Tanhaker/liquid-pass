import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi, decodeEventLog } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONTRACT = "0x818069346812b169aebaf71f6e3f92be25f0153e";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

// Base fee drifts on Arbitrum Sepolia; a fixed 0.1 gwei ceiling clears it.
const FEES = { maxFeePerGas: 100_000_000n, maxPriorityFeePerGas: 1_000_000n };

const abi = parseAbi([
  "function mint(address to, uint256 durationSeconds) payable returns (uint256)",
  "function isActive(uint256 tokenId) view returns (bool)",
  "function remainingSeconds(uint256 tokenId) view returns (uint256)",
  "function list(uint256 tokenId, uint256 price)",
  "function unlist(uint256 tokenId)",
  "function buy(uint256 tokenId) payable",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function expiryOf(uint256 tokenId) view returns (uint256)",
  "function priceOf(uint256 tokenId) view returns (uint256)",
  "function issuerOf(uint256 tokenId) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) });
const issuerKey = "0x" + readFileSync("../contracts/deployer.key", "utf8").trim().replace(/^0x/, "");
const issuer = privateKeyToAccount(issuerKey);

// Throwaway seller so seller != issuer and the split is visible.
if (!existsSync("seller.key")) writeFileSync("seller.key", generatePrivateKey().slice(2));
const seller = privateKeyToAccount("0x" + readFileSync("seller.key", "utf8").trim());

const issuerW = createWalletClient({ account: issuer, chain: arbitrumSepolia, transport: http(RPC) });
const sellerW = createWalletClient({ account: seller, chain: arbitrumSepolia, transport: http(RPC) });

console.log(`issuer/buyer : ${issuer.address}`);
console.log(`seller       : ${seller.address}`);

const wait = (hash) => pub.waitForTransactionReceipt({ hash });
const logsOf = (r) => r.logs.map((l) => { try { return decodeEventLog({ abi, ...l }); } catch { return null; } }).filter(Boolean);

// Fund the seller for its one transaction.
if ((await pub.getBalance({ address: seller.address })) < parseEther("0.0005")) {
  console.log("\nfunding seller...");
  await wait(await issuerW.sendTransaction({ to: seller.address, value: parseEther("0.001"), ...FEES }));
}

// ---------- MINT ----------
const tokenId = await pub.readContract({ address: CONTRACT, abi, functionName: "nextTokenId" });
console.log(`\n=== MINT (issuer -> seller, 30 days), tokenId ${tokenId} ===`);
let r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "mint", args: [seller.address, 2592000n], ...FEES }));
console.log(`  tx ${r.transactionHash}  status=${r.status}  gas=${r.gasUsed}`);
console.log(`  events: ${logsOf(r).map((e) => e.eventName).join(", ")}`);
console.log(`  ownerOf   = ${await pub.readContract({ address: CONTRACT, abi, functionName: "ownerOf", args: [tokenId] })}`);
console.log(`  issuerOf  = ${await pub.readContract({ address: CONTRACT, abi, functionName: "issuerOf", args: [tokenId] })}`);
console.log(`  isActive  = ${await pub.readContract({ address: CONTRACT, abi, functionName: "isActive", args: [tokenId] })}`);
console.log(`  remaining = ${await pub.readContract({ address: CONTRACT, abi, functionName: "remainingSeconds", args: [tokenId] })}s`);

// ---------- LIST ----------
const PRICE = parseEther("0.001");
console.log(`\n=== LIST (seller lists at ${formatEther(PRICE)} ETH) ===`);
r = await wait(await sellerW.writeContract({ address: CONTRACT, abi, functionName: "list", args: [tokenId, PRICE], ...FEES }));
console.log(`  tx ${r.transactionHash}  status=${r.status}  gas=${r.gasUsed}`);
console.log(`  events: ${logsOf(r).map((e) => e.eventName).join(", ")}`);
console.log(`  priceOf = ${formatEther(await pub.readContract({ address: CONTRACT, abi, functionName: "priceOf", args: [tokenId] }))} ETH`);

// ---------- BUY ----------
console.log(`\n=== BUY (issuer buys from seller) ===`);
r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "buy", args: [tokenId], value: PRICE, ...FEES }));
console.log(`  tx ${r.transactionHash}  status=${r.status}  gas=${r.gasUsed}`);
const evs = logsOf(r);
console.log(`  events: ${evs.map((e) => e.eventName).join(", ")}`);
const bought = evs.find((e) => e.eventName === "Bought");
if (bought) console.log(`  Bought: price=${formatEther(bought.args.price)} royalty=${formatEther(bought.args.royalty)}`);

const before = r.blockNumber - 1n, after = r.blockNumber;
const sBefore = await pub.getBalance({ address: seller.address, blockNumber: before });
const sAfter  = await pub.getBalance({ address: seller.address, blockNumber: after });
console.log(`\n  seller balance delta across the buy block: +${formatEther(sAfter - sBefore)} ETH`);
console.log(`  expected 90% of ${formatEther(PRICE)}      : ${formatEther(PRICE - PRICE / 10n)} ETH`);
console.log(`  MATCH: ${sAfter - sBefore === PRICE - PRICE / 10n}`);
console.log(`\n  ownerOf after = ${await pub.readContract({ address: CONTRACT, abi, functionName: "ownerOf", args: [tokenId] })}`);
console.log(`  priceOf after = ${await pub.readContract({ address: CONTRACT, abi, functionName: "priceOf", args: [tokenId] })} (0 = delisted)`);
console.log(`  isActive      = ${await pub.readContract({ address: CONTRACT, abi, functionName: "isActive", args: [tokenId] })}`);
console.log(`  contract balance (must be 0, nothing retained) = ${formatEther(await pub.getBalance({ address: CONTRACT }))} ETH`);
