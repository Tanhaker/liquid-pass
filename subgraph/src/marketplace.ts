import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Bought,
  Listed,
  Unlisted,
} from "../generated/Marketplace/Marketplace";
import { Marketplace, Pass, PassEvent } from "../generated/schema";

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
  pass.listedPrice = null;
  pass.resaleCount = pass.resaleCount + 1;
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
