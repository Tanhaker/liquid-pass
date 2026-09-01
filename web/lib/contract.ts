import { parseAbi } from "viem";

/**
 * Liquid Pass on Arbitrum Sepolia.
 *
 * This supersedes the earlier subscription contract at 0x03be934c...; that one
 * had no plan catalogue, so a new pass could not be bought at all. It also has
 * nothing to do with the PassKeyWallet contract, which is no longer on the
 * product path.
 */
export const LIQUID_PASS_ADDRESS =
  "0xe67078be99dec98b9788a0e6c2054d03b361f84a" as const;

/** Block the contract was deployed in, so getLogs never scans from genesis. */
export const DEPLOY_BLOCK = 304198700n;

export const EXPLORER = "https://sepolia.arbiscan.io";

/**
 * Signatures taken verbatim from `cargo stylus export-abi`.
 *
 * Note this is deliberately NOT ERC-721: no approvals, no operators, no
 * enumeration, and ownership moves emit `PassTransferred` rather than
 * `Transfer`. Emitting the ERC-721 signature would advertise an interface the
 * contract does not implement, and indexers would believe it.
 */
export const liquidPassAbi = parseAbi([
  // --- plans: the product catalogue ---
  "function createPlan(string name, string metadataUri, uint256 price, uint256 durationSeconds) returns (uint256)",
  "function setPlanOpen(uint256 planId, bool open)",
  "function planIssuerOf(uint256 planId) view returns (address)",
  "function planPriceOf(uint256 planId) view returns (uint256)",
  "function planDurationOf(uint256 planId) view returns (uint256)",
  "function planIsOpen(uint256 planId) view returns (bool)",
  "function planName(uint256 planId) view returns (string)",
  "function planUri(uint256 planId) view returns (string)",
  "function nextPlanId() view returns (uint256)",

  // --- passes: bought instances of a plan ---
  "function buyPass(uint256 planId) payable returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function expiryOf(uint256 tokenId) view returns (uint256)",
  "function issuerOf(uint256 tokenId) view returns (address)",
  "function planOf(uint256 tokenId) view returns (uint256)",
  "function paidOf(uint256 tokenId) view returns (uint256)",
  "function isActive(uint256 tokenId) view returns (bool)",
  "function remainingSeconds(uint256 tokenId) view returns (uint256)",
  "function nextTokenId() view returns (uint256)",

  // --- resale ---
  "function list(uint256 tokenId, uint256 price)",
  "function unlist(uint256 tokenId)",
  "function buy(uint256 tokenId) payable",
  "function priceOf(uint256 tokenId) view returns (uint256)",

  // --- admin ---
  "function admin() view returns (address)",
  "function isIssuer(address who) view returns (bool)",
  "function mint(address to, uint256 durationSeconds) returns (uint256)",

  // --- events, for the activity feed and the getLogs data layer ---
  "event PlanCreated(uint256 indexed planId, address indexed issuer, uint256 price, uint256 durationSeconds)",
  "event PlanOpenSet(uint256 indexed planId, bool open)",
  "event PassPurchased(uint256 indexed tokenId, uint256 indexed planId, address indexed buyer, uint256 price, uint256 expiry)",
  "event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Unlisted(uint256 indexed tokenId, address indexed seller)",
  "event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty)",
  "event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId)",
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
  /** What the FIRST buyer paid. 0 for passes issued by mint, never sold. */
  paid: bigint;
  /** Resale price in wei, or 0 when not for sale. */
  listed: bigint;
};

/** Seconds left, clamped at 0. Computed client-side so the ring can tick. */
export function remaining(expiry: bigint, now = Date.now()): number {
  const left = Number(expiry) - Math.floor(now / 1000);
  return left > 0 ? left : 0;
}

/**
 * How much of the pass's life is left, 0..1.
 *
 * Needs the plan duration rather than just the expiry: a pass with 10 days
 * left is nearly spent if it started at 14 days and barely touched if it
 * started at a year. Falls back to treating the remaining time as full when
 * the duration is unknown, so the ring never renders as a lie.
 */
export function lifeFraction(expiry: bigint, duration: bigint): number {
  const left = remaining(expiry);
  const total = Number(duration);
  if (!total) return left > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, left / total));
}

/**
 * Discount against what the pass originally sold for.
 *
 * Returns null rather than 0 when it cannot be computed -- an unpriced or
 * never-sold pass must not render as "0% off", which would be a fabricated
 * number. Only positive discounts count; a resale above the original price is
 * not a discount.
 */
export function discountPct(paid: bigint, askingPrice: bigint): number | null {
  if (paid <= 0n || askingPrice <= 0n || askingPrice >= paid) return null;
  return Number(((paid - askingPrice) * 100n) / paid);
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
