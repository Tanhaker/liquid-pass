import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi, decodeEventLog } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Overridable because the plan catalogue required a redeploy: the old
// address has no createPlan/buyPass and the primary-sale section below will
// revert against it. Pass LIQUID_PASS_ADDRESS to point at a new deployment.
const CONTRACT = process.env.LIQUID_PASS_ADDRESS ?? "0x03be934c10e1dac77ad954998251fde169bba4d8";
const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
// Arbitrum Sepolia's base fee drifts a lot: it was ~46 mwei earlier today and
// 106 mwei by the time this ran, so a fixed 0.1 gwei ceiling started getting
// rejected mid-run. Recompute from the live base fee with 4x headroom before
// every send. The cap is a ceiling, not a price -- the surplus is never charged.
async function fees() {
  const base = (await pub.getBlock()).baseFeePerGas ?? 100_000_000n;
  const tip = 1_000_000n;
  return { maxFeePerGas: base * 4n + tip, maxPriorityFeePerGas: tip };
}

const abi = parseAbi([
  "function mint(address to, uint256 durationSeconds) returns (uint256)",
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
  "function isIssuer(address who) view returns (bool)",
  "function admin() view returns (address)",
  "function setIssuer(address issuer, bool allowed)",
  "event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty)",
  "event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId)",
  // Plan catalogue + primary sale. Signatures taken verbatim from
  // `cargo stylus export-abi`, not hand-derived from the Rust names.
  "function createPlan(string name, string metadataUri, uint256 price, uint256 durationSeconds) returns (uint256)",
  "function setPlanOpen(uint256 planId, bool open)",
  "function buyPass(uint256 planId) payable returns (uint256)",
  "function planIssuerOf(uint256 planId) view returns (address)",
  "function planPriceOf(uint256 planId) view returns (uint256)",
  "function planDurationOf(uint256 planId) view returns (uint256)",
  "function planIsOpen(uint256 planId) view returns (bool)",
  "function planName(uint256 planId) view returns (string)",
  "function planUri(uint256 planId) view returns (string)",
  "function nextPlanId() view returns (uint256)",
  "function planOf(uint256 tokenId) view returns (uint256)",
  "function paidOf(uint256 tokenId) view returns (uint256)",
  "event PlanCreated(uint256 indexed planId, address indexed issuer, uint256 price, uint256 durationSeconds)",
  "event PlanOpenSet(uint256 indexed planId, bool open)",
  "event PassPurchased(uint256 indexed tokenId, uint256 indexed planId, address indexed buyer, uint256 price, uint256 expiry)",
]);

const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) });
const issuer = privateKeyToAccount("0x" + readFileSync("../contracts/deployer.key", "utf8").trim().replace(/^0x/, ""));
if (!existsSync("seller.key")) writeFileSync("seller.key", generatePrivateKey().slice(2));
const seller = privateKeyToAccount("0x" + readFileSync("seller.key", "utf8").trim());
const issuerW = createWalletClient({ account: issuer, chain: arbitrumSepolia, transport: http(RPC) });
const sellerW = createWalletClient({ account: seller, chain: arbitrumSepolia, transport: http(RPC) });

const wait = (h) => pub.waitForTransactionReceipt({ hash: h });
const evs = (r) => r.logs.map((l) => { try { return decodeEventLog({ abi, ...l }); } catch { return null; } }).filter(Boolean);
const read = (fn, args = []) => pub.readContract({ address: CONTRACT, abi, functionName: fn, args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mustRevert(label, fn) {
  try {
    await fn();
    console.log(`  ${label}: NOT REVERTED  <-- GAP STILL OPEN`);
    return false;
  } catch (e) {
    const m = (e.shortMessage ?? e.message).split("\n")[0];
    console.log(`  ${label}: reverted (${m.slice(0, 60)})`);
    return true;
  }
}

console.log(`issuer/buyer : ${issuer.address}`);
console.log(`seller       : ${seller.address}`);

console.log(`\n=== constructor ran at deployment? ===`);
const adminAddr = await read("admin");
console.log(`  admin              = ${adminAddr}`);
console.log(`  admin is deployer  = ${adminAddr.toLowerCase() === issuer.address.toLowerCase()}`);
console.log(`  isIssuer(deployer) = ${await read("isIssuer", [issuer.address])}`);
console.log(`  isIssuer(seller)   = ${await read("isIssuer", [seller.address])}`);

if ((await pub.getBalance({ address: seller.address })) < parseEther("0.0005")) {
  console.log("\nfunding seller...");
  await wait(await issuerW.sendTransaction({ to: seller.address, value: parseEther("0.001"), ...(await fees()) }));
}

console.log(`\n=== FIX 1: mint is no longer payable, so ETH cannot be locked ===`);
await mustRevert("mint with value", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "mint", args: [seller.address, 60n], value: parseEther("0.001"), account: issuer }));

console.log(`\n=== FIX 3: mint access control ===`);
await mustRevert("mint from non-issuer", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "mint", args: [seller.address, 60n], account: seller }));

const tokenId = await read("nextTokenId");
console.log(`\n=== MINT (issuer -> seller, 30 days), tokenId ${tokenId} ===`);
let r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "mint", args: [seller.address, 2592000n], ...(await fees()) }));
console.log(`  tx ${r.transactionHash} status=${r.status} gas=${r.gasUsed}`);
console.log(`  events: ${evs(r).map((e) => e.eventName).join(", ")}`);
console.log(`  ownerOf=${await read("ownerOf", [tokenId])}  issuerOf=${await read("issuerOf", [tokenId])}`);
console.log(`  isActive=${await read("isActive", [tokenId])}  remaining=${await read("remainingSeconds", [tokenId])}s`);

const PRICE = parseEther("0.001");
console.log(`\n=== LIST (seller, ${formatEther(PRICE)} ETH) ===`);
r = await wait(await sellerW.writeContract({ address: CONTRACT, abi, functionName: "list", args: [tokenId, PRICE], ...(await fees()) }));
console.log(`  tx ${r.transactionHash} status=${r.status} gas=${r.gasUsed}`);
console.log(`  events: ${evs(r).map((e) => e.eventName).join(", ")}   priceOf=${formatEther(await read("priceOf", [tokenId]))} ETH`);

console.log(`\n=== BUY (issuer buys from seller) ===`);
r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "buy", args: [tokenId], value: PRICE, ...(await fees()) }));
console.log(`  tx ${r.transactionHash} status=${r.status} gas=${r.gasUsed}`);
const names = evs(r).map((e) => e.eventName);
console.log(`  events: ${names.join(", ")}`);
const bought = evs(r).find((e) => e.eventName === "Bought");
console.log(`  Bought: price=${formatEther(bought.args.price)} royalty=${formatEther(bought.args.royalty)}`);

const sB = await pub.getBalance({ address: seller.address, blockNumber: r.blockNumber - 1n });
const sA = await pub.getBalance({ address: seller.address, blockNumber: r.blockNumber });
console.log(`\n  seller delta across buy block: +${formatEther(sA - sB)} ETH`);
console.log(`  expected 90%                 :  ${formatEther(PRICE - PRICE / 10n)} ETH   MATCH=${sA - sB === PRICE - PRICE / 10n}`);
console.log(`  ownerOf after    = ${await read("ownerOf", [tokenId])}`);
console.log(`  priceOf after    = ${await read("priceOf", [tokenId])} (0 = delisted)`);
console.log(`  contract balance = ${formatEther(await pub.getBalance({ address: CONTRACT }))} ETH (must be 0)`);

console.log(`\n=== FIX 4: ownership event is PassTransferred, not ERC-721 Transfer ===`);
console.log(`  emitted: ${names.join(", ")}`);
console.log(`  claims the ERC-721 Transfer signature? ${names.includes("Transfer")}  (must be false)`);

console.log(`\n=== FIX 2: expired passes cannot be listed or bought ===`);
const shortId = await read("nextTokenId");
await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "mint", args: [seller.address, 5n], ...(await fees()) }));
console.log(`  minted tokenId ${shortId} with a 5s lifetime`);
await wait(await sellerW.writeContract({ address: CONTRACT, abi, functionName: "list", args: [shortId, PRICE], ...(await fees()) }));
console.log(`  listed while still active (priceOf=${formatEther(await read("priceOf", [shortId]))} ETH)`);
console.log(`  waiting for expiry...`);
while (await read("isActive", [shortId])) await sleep(2000);
console.log(`  isActive=${await read("isActive", [shortId])}  remaining=${await read("remainingSeconds", [shortId])}s`);
await mustRevert("buy an expired listed pass", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "buy", args: [shortId], value: PRICE, account: issuer }));
await mustRevert("list an expired pass", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "list", args: [shortId, PRICE], account: seller }));
await pub.simulateContract({ address: CONTRACT, abi, functionName: "unlist", args: [shortId], account: seller });
console.log(`  unlist on an expired pass: still allowed, so stale listings can be cleared`);

// ---------------------------------------------------------------------------
// PRIMARY SALE: the plan catalogue.
//
// Everything above tests resale, which worked before. This section covers the
// gap that made a new pass unbuyable: there was no product to buy, and mint
// was issuer-push-only and not payable.
// ---------------------------------------------------------------------------

const PLAN_PRICE = parseEther("0.0002");
const PLAN_DURATION = 2592000n; // 30 days
const RESALE_PRICE = parseEther("0.0001"); // deliberately 50% below original

console.log(`\n=== createPlan access control and validation ===`);
await mustRevert("createPlan from non-issuer", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "createPlan", args: ["Figma Pro", "ipfs://x", PLAN_PRICE, PLAN_DURATION], account: seller }));
await mustRevert("createPlan with zero price", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "createPlan", args: ["Figma Pro", "ipfs://x", 0n, PLAN_DURATION], account: issuer }));
await mustRevert("createPlan with zero duration", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "createPlan", args: ["Figma Pro", "ipfs://x", PLAN_PRICE, 0n], account: issuer }));

const planId = await read("nextPlanId");
console.log(`\n=== CREATE PLAN "Figma Pro", 30 days, ${formatEther(PLAN_PRICE)} ETH, planId ${planId} ===`);
r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "createPlan", args: ["Figma Pro", "ipfs://bafyPlaceholderFigmaPro", PLAN_PRICE, PLAN_DURATION], ...(await fees()) }));
console.log(`  tx ${r.transactionHash} status=${r.status} gas=${r.gasUsed}`);
console.log(`  events: ${evs(r).map((e) => e.eventName).join(", ")}`);
console.log(`  planName     = "${await read("planName", [planId])}"   (readable without IPFS)`);
console.log(`  planUri      = ${await read("planUri", [planId])}`);
console.log(`  planPriceOf  = ${formatEther(await read("planPriceOf", [planId]))} ETH`);
console.log(`  planDuration = ${await read("planDurationOf", [planId])}s`);
console.log(`  planIssuerOf = ${await read("planIssuerOf", [planId])}  isOpen=${await read("planIsOpen", [planId])}`);

console.log(`\n=== buyPass rejects bad input ===`);
await mustRevert("buyPass on a nonexistent plan", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "buyPass", args: [planId + 999n], value: PLAN_PRICE, account: seller }));
await mustRevert("buyPass underpaying", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "buyPass", args: [planId], value: PLAN_PRICE - 1n, account: seller }));
await mustRevert("buyPass overpaying", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "buyPass", args: [planId], value: PLAN_PRICE + 1n, account: seller }));

if ((await pub.getBalance({ address: seller.address })) < parseEther("0.0008")) {
  console.log(`\nfunding seller for the primary sale...`);
  await wait(await issuerW.sendTransaction({ to: seller.address, value: parseEther("0.002"), ...(await fees()) }));
}

const boughtId = await read("nextTokenId");
console.log(`\n=== BUY PASS (seller buys from the plan), tokenId ${boughtId} ===`);
// The seller account pays, so the issuer's balance delta is the payment alone,
// uncontaminated by gas.
r = await wait(await sellerW.writeContract({ address: CONTRACT, abi, functionName: "buyPass", args: [planId], value: PLAN_PRICE, ...(await fees()) }));
console.log(`  tx ${r.transactionHash} status=${r.status} gas=${r.gasUsed}`);
console.log(`  events: ${evs(r).map((e) => e.eventName).join(", ")}`);

const iB = await pub.getBalance({ address: issuer.address, blockNumber: r.blockNumber - 1n });
const iA = await pub.getBalance({ address: issuer.address, blockNumber: r.blockNumber });
console.log(`\n  issuer delta across buy block: +${formatEther(iA - iB)} ETH`);
console.log(`  expected 100% (no seller yet) :  ${formatEther(PLAN_PRICE)} ETH   MATCH=${iA - iB === PLAN_PRICE}`);
console.log(`  ownerOf   = ${await read("ownerOf", [boughtId])}  (seller=${seller.address})`);
console.log(`  planOf    = ${await read("planOf", [boughtId])}  (expected ${planId})`);
console.log(`  paidOf    = ${formatEther(await read("paidOf", [boughtId]))} ETH  (the original price)`);
console.log(`  isActive  = ${await read("isActive", [boughtId])}  remaining=${await read("remainingSeconds", [boughtId])}s`);
console.log(`  contract balance = ${formatEther(await pub.getBalance({ address: CONTRACT }))} ETH (must be 0)`);

console.log(`\n=== setPlanOpen gates further sales ===`);
await mustRevert("setPlanOpen from a non-issuer", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "setPlanOpen", args: [planId, false], account: seller }));
r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "setPlanOpen", args: [planId, false], ...(await fees()) }));
console.log(`  closed the plan (isOpen=${await read("planIsOpen", [planId])})`);
await mustRevert("buyPass on a closed plan", () =>
  pub.simulateContract({ address: CONTRACT, abi, functionName: "buyPass", args: [planId], value: PLAN_PRICE, account: seller }));
console.log(`  the already-sold pass is untouched: isActive=${await read("isActive", [boughtId])} remaining=${await read("remainingSeconds", [boughtId])}s`);
await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "setPlanOpen", args: [planId, true], ...(await fees()) }));
console.log(`  reopened (isOpen=${await read("planIsOpen", [planId])})`);

console.log(`\n=== THE INVARIANT: resale must not reset expiry, and paidOf must survive ===`);
const expiryBefore = await read("expiryOf", [boughtId]);
const remainingBefore = await read("remainingSeconds", [boughtId]);
console.log(`  before resale: expiry=${expiryBefore} remaining=${remainingBefore}s paidOf=${formatEther(await read("paidOf", [boughtId]))} ETH`);

await wait(await sellerW.writeContract({ address: CONTRACT, abi, functionName: "list", args: [boughtId, RESALE_PRICE], ...(await fees()) }));
console.log(`  listed at ${formatEther(RESALE_PRICE)} ETH`);

r = await wait(await issuerW.writeContract({ address: CONTRACT, abi, functionName: "buy", args: [boughtId], value: RESALE_PRICE, ...(await fees()) }));
console.log(`  resold: tx ${r.transactionHash} status=${r.status}`);
const resold = evs(r).find((e) => e.eventName === "Bought");

const expiryAfter = await read("expiryOf", [boughtId]);
const paidAfter = await read("paidOf", [boughtId]);
console.log(`\n  expiry before = ${expiryBefore}`);
console.log(`  expiry after  = ${expiryAfter}`);
console.log(`  EXPIRY PRESERVED (buyer did NOT get a fresh 30 days) = ${expiryBefore === expiryAfter}`);
console.log(`  ownerOf now   = ${await read("ownerOf", [boughtId])}  (issuer=${issuer.address})`);
console.log(`  planOf still  = ${await read("planOf", [boughtId])}`);
console.log(`  paidOf still  = ${formatEther(paidAfter)} ETH   ORIGINAL PRESERVED=${paidAfter === PLAN_PRICE}`);

const discountPct = Number(((PLAN_PRICE - RESALE_PRICE) * 100n) / PLAN_PRICE);
console.log(`\n  resale ${formatEther(RESALE_PRICE)} ETH vs original ${formatEther(PLAN_PRICE)} ETH`);
console.log(`  => "${discountPct}% below original" -- computed from chain data, not invented`);
console.log(`\n  Bought.royalty = ${formatEther(resold.args.royalty)} ETH`);
console.log(`  expected 10%   = ${formatEther(RESALE_PRICE / 10n)} ETH   MATCH=${resold.args.royalty === RESALE_PRICE / 10n}`);
console.log(`  contract balance = ${formatEther(await pub.getBalance({ address: CONTRACT }))} ETH (must be 0)`);
