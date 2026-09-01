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
  "0x22703fdd3dd77f854ca111e581bbd84cf82c1d36" as const;

/** Block the contract was deployed in, so getLogs never scans from genesis. */
export const DEPLOY_BLOCK = 304290900n;

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
  // The ask decays with the time left. `priceOf`/`openingPrice` is what the
  // seller first asked; `currentPrice` is what buy() actually charges now.
  "function currentPrice(uint256 tokenId) view returns (uint256)",
  "function openingPrice(uint256 tokenId) view returns (uint256)",

  // --- admin ---
  "function admin() view returns (address)",
  "function isIssuer(address who) view returns (bool)",
  "function mint(address to, uint256 durationSeconds) returns (uint256)",

  // --- gift and split ---
  "function transferPass(address to, uint256 tokenId)",
  // Slices are SEQUENTIAL: a 12-month pass becomes month 1..12, not twelve
  // simultaneous passes. Returns the first new token id.
  "function split(uint256 tokenId, uint256 parts) returns (uint256)",

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
  /** The seller's opening ask in wei, or 0 when not for sale. */
  listed: bigint;
  /**
   * Whether the contract considers this pass usable RIGHT NOW.
   *
   * Read from the chain, never inferred. A split slice has a start time as
   * well as an expiry, and `startOf` had to be dropped to fit `split` under
   * the 24KB limit -- so expiry alone cannot distinguish a live pass from one
   * whose window has not opened. Deriving activity from expiry showed pending
   * slices as usable, which is both a lie to the user and a transaction that
   * reverts, since `list` requires is_active.
   */
  active: boolean;
  /**
   * What `buy()` charges right now: the opening ask decayed in proportion to
   * the access still left. This is the number to display and to send as
   * msg.value. The contract requires AT LEAST this and refunds the change --
   * exact payment is impossible against a continuously falling price, because
   * the value decays between reading it and the transaction being mined.
   */
  current: bigint;
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

/**
 * What the remaining time is proportionally worth.
 *
 * A pass is time. Ten days left on a thirty-day pass that originally sold for
 * 0.003 ETH is worth 0.001 ETH of access -- that is the whole product stated
 * as arithmetic.
 *
 * This is a SUGGESTION, not a rule. The contract does not enforce it and must
 * not: a marketplace where the seller cannot set their own price is not a
 * marketplace. Sellers routinely price below fair value to move a pass quickly,
 * or above it for something scarce. Showing the fair price simply lets a buyer
 * see which of those is happening.
 *
 * Returns null when it cannot be computed -- a pass with no recorded original
 * price, or no known duration, has no fair value, and inventing one would put
 * a fabricated number next to a real one.
 */
export function fairPrice(
  paid: bigint,
  expiry: bigint,
  duration: bigint,
  nowMs: number | null,
): bigint | null {
  if (paid <= 0n || duration <= 0n) return null;
  const left = BigInt(remaining(expiry, nowMs ?? Date.now()));
  if (left <= 0n) return 0n;
  // Integer maths throughout: bigint wei must never touch floating point.
  const capped = left > duration ? duration : left;
  return (paid * capped) / duration;
}

/**
 * How a listing compares to its time-proportional value, as a percentage.
 * Negative means priced below fair value, positive means above.
 */
export function priceVsFair(listed: bigint, fair: bigint | null): number | null {
  if (fair === null || fair <= 0n || listed <= 0n) return null;
  return Number(((listed - fair) * 100n) / fair);
}

/**
 * Wei as a short ETH string.
 *
 * formatEther is exact, which is right for a price someone is about to pay but
 * wrong for a derived figure: the fair value of 13 of 14 days works out to
 * 0.000095312632275132 ETH, and eighteen decimals of a suggestion is noise.
 * Six significant digits keeps testnet-sized amounts legible without rounding
 * a real price into something the contract would reject.
 */
/**
 * What to actually send as msg.value when buying.
 *
 * A 0.1% buffer over the quoted price, for a reason that is not obvious and
 * cost a reverted transaction to find:
 *
 * `buy()` refunds any overpayment, and that refund is a conditional transfer.
 * When msg.value equals the price exactly, the refund is zero, the branch is
 * skipped, and the gas estimate excludes it. But the price keeps falling
 * between estimating and mining, so by execution the refund IS non-zero, the
 * extra transfer runs, and the transaction dies out of gas -- an estimate made
 * on one code path, executed on another.
 *
 * Sending slightly more makes the refund non-zero at estimate time as well, so
 * both paths match. The surplus comes straight back, so it costs the buyer
 * nothing.
 */
export function withBuffer(price: bigint): bigint {
  return price + price / 1000n + 1n;
}

export function formatEthShort(wei: bigint): string {
  if (wei === 0n) return "0";
  const eth = Number(wei) / 1e18;
  if (eth >= 0.001) return String(Number(eth.toFixed(6)));
  // Six significant figures, not three. At testnet sizes a decaying price sits
  // around 0.000074982, and three figures rounds that to 0.000075 -- exactly
  // the opening ask it is supposed to differ from. The decay was real and the
  // display was hiding it.
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
