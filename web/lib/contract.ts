import { parseAbi } from "viem";

export const LIQUID_PASS_ADDRESS = (process.env.NEXT_PUBLIC_LIQUID_PASS_ADDRESS ||
  "0xac20ef73723e7c620df1024eb04cc0b71fca1055") as `0x${string}`;

export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
  "0x63a9edec92baf3e74f19d301808c56104e786241") as `0x${string}`;

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  "0x") as `0x${string}`;

export const DEPLOY_BLOCK = 304290900n;

/**
 * The PassKey wallet: a Stylus contract that verifies a real WebAuthn
 * secp256r1 (P-256) assertion on chain.
 *
 * This is the whole reason the project is on Stylus. Every passkey
 * authenticator signs with P-256, for which the EVM has no precompile, so
 * verifying one in Solidity means hand-rolled 256-bit field arithmetic costing
 * hundreds of thousands of gas. In Rust it is an audited library call.
 */
export const PASSKEY_WALLET_ADDRESS =
  "0x490630168df621c98e6bba22549295a2202de358" as `0x${string}`;

/**
 * The origin baked into the deployed wallet at compile time.
 *
 * The contract's verify_assertion compares the "origin" field of clientDataJSON
 * against this constant, so an assertion produced on any other origin is
 * rejected on chain. The contract is deployed and must not be redeployed, so
 * this is a fixed property of the system, not a setting -- and it means
 * execute() can only ever succeed for a passkey created at this exact origin.
 */
export const PASSKEY_EXPECTED_ORIGIN = "http://localhost:3000";

export const passkeyWalletAbi = parseAbi([
  "function nonce() view returns (uint256)",
  "function pubkey() view returns (uint256 x, uint256 y)",
  "function getChallenge(address target, uint256 value, bytes data) view returns (bytes32)",
  "function register(uint256 x, uint256 y)",
  "function execute(address target, uint256 value, bytes data, bytes authData, bytes clientData, bytes32 r, bytes32 s) returns (bytes)",
]);
export const EXPLORER = "https://sepolia.arbiscan.io";

export const liquidPassAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isActive(uint256 tokenId) view returns (bool)",
  "function expiryOf(uint256 tokenId) view returns (uint256)",
  "function issuerOf(uint256 tokenId) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function planIssuerOf(uint256 planId) view returns (address)",
  "function planPriceOf(uint256 planId) view returns (uint256)",
  "function planDurationOf(uint256 planId) view returns (uint256)",
  "function planIsOpen(uint256 planId) view returns (bool)",
  "function planName(uint256 planId) view returns (string)",
  "function planUri(uint256 planId) view returns (string)",
  "function nextPlanId() view returns (uint256)",
  "function planOf(uint256 tokenId) view returns (uint256)",
  "function paidOf(uint256 tokenId) view returns (uint256)",
  "function createPlan(string name, string metadataUri, uint256 price, uint256 durationSeconds) returns (uint256)",
  "function setPlanOpen(uint256 planId, bool open)",
  "function buyPass(uint256 planId) payable returns (uint256)",
  "function admin() view returns (address)",
  "function isIssuer(address who) view returns (bool)",
  "function mint(address to, uint256 durationSeconds) returns (uint256)",
  "function transferPass(address to, uint256 tokenId)",
  "function split(uint256 tokenId, uint256 parts) returns (uint256)",
  "function bundle(uint256[] tokenIds) returns (uint256)",
  "event PlanCreated(uint256 indexed planId, address indexed issuer, uint256 price, uint256 durationSeconds)",
  "event PlanOpenSet(uint256 indexed planId, bool open)",
  "event PassPurchased(uint256 indexed tokenId, uint256 indexed planId, address indexed buyer, uint256 price, uint256 expiry)",
  "event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry)",
  "event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const marketplaceAbi = parseAbi([
  "function list(uint256 tokenId, uint256 price)",
  "function unlist(uint256 tokenId)",
  "function buy(uint256 tokenId) payable",
  "function currentPrice(uint256 tokenId) view returns (uint256)",
  // The public `listings` mapping generates this getter on chain; it was
  // simply missing from our copy of the ABI. `listedAt` is what makes the
  // decay computable in the browser between polls.
  "function listings(uint256 tokenId) view returns (uint256 openingPrice, uint256 listedAt)",
  "function openingPrice(uint256 tokenId) view returns (uint256)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Unlisted(uint256 indexed tokenId, address indexed seller)",
  "event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty)"
]);

export const escrowAbi = parseAbi([
  "function lockedBalances(address seller) view returns (uint256)",
  "function withdraw()",
  "event YieldDeposited(address indexed seller, uint256 amount)",
  "event YieldWithdrawn(address indexed seller, uint256 principal, uint256 totalPayout)"
]);

export type Plan = {
  id: bigint;
  name: string;
  uri: string;
  price: bigint;
  duration: bigint;
  issuer: `0x${string}`;
  open: boolean;
};

export type Pass = {
  tokenId: bigint;
  planId: bigint;
  owner: `0x${string}`;
  issuer: `0x${string}`;
  expiry: bigint;
  paid: bigint;
  listed: bigint;
  active: boolean;
  current: bigint;
  /** Unix seconds when the listing opened; 0 when not listed. */
  listedAt: bigint;
};

/**
 * The asking price right now, computed the way Marketplace.sol computes it.
 *
 * Mirrors `currentPrice()` exactly, including the truncating integer division:
 *
 *     openingPrice * (expiry - now) / (expiry - listedAt)
 *
 * The chain is still the source of truth -- `pass.current` is refreshed by
 * polling -- but a figure that only moves when a poll lands looks static, and
 * the whole point of this asset is that it is not. This fills in the seconds
 * between, and because it is the same formula it cannot drift away from what
 * the contract will actually charge.
 *
 * Returns null when there is nothing to show: not listed, expired, or a
 * listing whose window is degenerate.
 */
export function decayedPrice(pass: Pass, nowMs: number | null): bigint | null {
  if (pass.listed <= 0n) return null;
  if (pass.listedAt <= 0n) return null;

  const now = BigInt(Math.floor((nowMs ?? Date.now()) / 1000));
  if (now >= pass.expiry) return 0n;
  if (pass.expiry <= pass.listedAt) return 0n;

  return (pass.listed * (pass.expiry - now)) / (pass.expiry - pass.listedAt);
}

/**
 * How much value this listing sheds per hour, in wei.
 *
 * The slope is constant for the life of a listing, so this is the whole ask
 * divided by the listing window -- no need to sample two points in time.
 */
export function decayPerHour(pass: Pass): bigint | null {
  if (pass.listed <= 0n || pass.listedAt <= 0n) return null;
  const window = pass.expiry - pass.listedAt;
  if (window <= 0n) return null;
  return (pass.listed * 3600n) / window;
}

export function remaining(expiry: bigint, now = Date.now()): number {
  const left = Number(expiry) - Math.floor(now / 1000);
  return left > 0 ? left : 0;
}

export function lifeFraction(expiry: bigint, duration: bigint): number {
  const left = remaining(expiry);
  const total = Number(duration);
  if (!total) return left > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, left / total));
}

export function discountPct(paid: bigint, askingPrice: bigint): number | null {
  if (paid <= 0n || askingPrice <= 0n || askingPrice >= paid) return null;
  return Number(((paid - askingPrice) * 100n) / paid);
}

export function fairPrice(
  paid: bigint,
  expiry: bigint,
  duration: bigint,
  nowMs: number | null,
): bigint | null {
  if (paid <= 0n || duration <= 0n) return null;
  const left = BigInt(remaining(expiry, nowMs ?? Date.now()));
  if (left <= 0n) return 0n;
  const capped = left > duration ? duration : left;
  return (paid * capped) / duration;
}

export function priceVsFair(listed: bigint, fair: bigint | null): number | null {
  if (fair === null || fair <= 0n || listed <= 0n) return null;
  return Number(((listed - fair) * 100n) / fair);
}

export function withBuffer(price: bigint): bigint {
  return price + price / 1000n + 1n;
}

export function formatEthShort(wei: bigint): string {
  if (wei === 0n) return "0";
  const eth = Number(wei) / 1e18;
  if (eth >= 0.001) return String(Number(eth.toFixed(6)));
  return String(Number(eth.toPrecision(6)));
}

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "expired";
  const d = Math.floor(seconds / 86400);
  if (d >= 1) return `${d} day${d === 1 ? "" : "s"}`;
  const h = Math.floor(seconds / 3600);
  if (h >= 1) return `${h} hour${h === 1 ? "" : "s"}`;
  const m = Math.floor(seconds / 60);
  if (m >= 1) return `${m} min`;
  return `${seconds}s`;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
