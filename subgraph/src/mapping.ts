import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Bought,
  Listed,
  Minted,
  PassPurchased,
  PlanCreated,
  PlanOpenSet,
  Unlisted,
} from "../generated/LiquidPass/LiquidPass";
import { Marketplace, Pass, PassEvent, Plan } from "../generated/schema";

/**
 * Handlers mirror the contract's own semantics exactly.
 *
 * The two that matter, because getting either wrong would misrepresent the
 * product:
 *
 *   - `Bought` must NOT touch `expiry`. The whole premise is that a resale
 *     transfers ownership and leaves the expiry alone.
 *   - `originalPrice` is written once, at the primary sale, and never again.
 *     It is what every "% below original" figure is computed against.
 */

const GLOBAL = "global";

function marketplace(): Marketplace {
  let m = Marketplace.load(GLOBAL);
  if (m == null) {
    m = new Marketplace(GLOBAL);
    m.plans = 0;
    m.passesIssued = 0;
    m.passesSold = 0;
    m.resales = 0;
    m.primaryVolume = BigInt.zero();
    m.resaleVolume = BigInt.zero();
    m.royaltiesPaid = BigInt.zero();
  }
  return m as Marketplace;
}

function recordEvent(
  passId: string,
  kind: string,
  event: ethereum.Event,
  from: Bytes | null,
  to: Bytes | null,
  price: BigInt | null,
  royalty: BigInt | null,
): void {
  // logIndex keeps the id unique when one transaction emits several events for
  // the same pass -- buyPass emits both PassPurchased and PassTransferred.
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const e = new PassEvent(id);
  e.pass = passId;
  e.kind = kind;
  e.from = from;
  e.to = to;
  e.price = price;
  e.royalty = royalty;
  e.blockNumber = event.block.number;
  e.timestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handlePlanCreated(event: PlanCreated): void {
  const p = new Plan(event.params.planId.toString());
  p.issuer = event.params.issuer;
  p.price = event.params.price;
  p.durationSeconds = event.params.durationSeconds;
  p.open = true;
  p.createdAt = event.block.timestamp;
  p.createdTx = event.transaction.hash;
  p.save();

  const m = marketplace();
  m.plans = m.plans + 1;
  m.save();
}

export function handlePlanOpenSet(event: PlanOpenSet): void {
  const p = Plan.load(event.params.planId.toString());
  if (p == null) return;
  p.open = event.params.open;
  p.save();
}

export function handlePassPurchased(event: PassPurchased): void {
  const id = event.params.tokenId.toString();
  let pass = Pass.load(id);
  if (pass == null) pass = new Pass(id);

  pass.plan = event.params.planId.toString();
  pass.owner = event.params.buyer;
  pass.expiry = event.params.expiry;
  // Written once. Never overwritten on resale -- that is the point of it.
  pass.originalPrice = event.params.price;
  pass.listedPrice = null;
  pass.issuedAt = event.block.timestamp;
  pass.resaleCount = 0;

  const plan = Plan.load(event.params.planId.toString());
  pass.issuer = plan == null ? event.params.buyer : plan.issuer;
  pass.save();

  recordEvent(id, "PURCHASED", event, null, event.params.buyer, event.params.price, null);

  const m = marketplace();
  m.passesIssued = m.passesIssued + 1;
  m.passesSold = m.passesSold + 1;
  m.primaryVolume = m.primaryVolume.plus(event.params.price);
  m.save();
}

export function handleMinted(event: Minted): void {
  const id = event.params.tokenId.toString();
  let pass = Pass.load(id);
  if (pass == null) pass = new Pass(id);

  pass.owner = event.params.to;
  pass.issuer = event.params.issuer;
  pass.expiry = event.params.expiry;
  // Deliberately null, not zero: this pass was issued directly and never had a
  // sale price, so no discount can ever be computed against it.
  pass.originalPrice = null;
  pass.listedPrice = null;
  pass.issuedAt = event.block.timestamp;
  pass.resaleCount = 0;
  pass.save();

  recordEvent(id, "MINTED", event, null, event.params.to, null, null);

  const m = marketplace();
  m.passesIssued = m.passesIssued + 1;
  m.save();
}

export function handleListed(event: Listed): void {
  const id = event.params.tokenId.toString();
  const pass = Pass.load(id);
  if (pass == null) return;
  pass.listedPrice = event.params.price;
  pass.save();

  recordEvent(id, "LISTED", event, event.params.seller, null, event.params.price, null);
}

export function handleUnlisted(event: Unlisted): void {
  const id = event.params.tokenId.toString();
  const pass = Pass.load(id);
  if (pass == null) return;
  pass.listedPrice = null;
  pass.save();

  recordEvent(id, "UNLISTED", event, event.params.seller, null, null, null);
}

export function handleBought(event: Bought): void {
  const id = event.params.tokenId.toString();
  const pass = Pass.load(id);
  if (pass == null) return;

  pass.owner = event.params.buyer;
  // Listing clears on sale, mirroring the contract.
  pass.listedPrice = null;
  pass.resaleCount = pass.resaleCount + 1;
  // `expiry` and `originalPrice` are untouched on purpose. The buyer inherits
  // the remaining time, and the original price stays the benchmark.
  pass.save();

  recordEvent(
    id,
    "RESOLD",
    event,
    event.params.seller,
    event.params.buyer,
    event.params.price,
    event.params.royalty,
  );

  const m = marketplace();
  m.resales = m.resales + 1;
  m.resaleVolume = m.resaleVolume.plus(event.params.price);
  m.royaltiesPaid = m.royaltiesPaid.plus(event.params.royalty);
  m.save();
}
