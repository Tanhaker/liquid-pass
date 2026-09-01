import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Minted,
  PassPurchased,
  PlanCreated,
  PlanOpenSet,
  PassTransferred,
} from "../generated/LiquidPass/LiquidPass";
import { Marketplace, Pass, PassEvent, Plan } from "../generated/schema";

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

export function handlePassTransferred(event: PassTransferred): void {
  const id = event.params.tokenId.toString();
  const pass = Pass.load(id);
  if (pass == null) return;
  pass.owner = event.params.to;
  pass.save();
}
