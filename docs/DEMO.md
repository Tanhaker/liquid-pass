# Liquid Pass — demo script

Deployed contract: `0x22703fdd3dd77f854ca111e581bbd84cf82c1d36` (Arbitrum Sepolia)

## Before you present

- [ ] Two wallets funded with Sepolia ETH, both on Arbitrum Sepolia
- [ ] Walk `docs/TESTING.md` once — it verifies every feature end to end
- [ ] Vercel Deployment Protection **off**, or the audience sees a login wall
- [ ] One pass listed below its original price, so the STEAL badge has data
- [ ] `/explorer` loaded once to confirm the RPC is responding
- [ ] Demo mode tested — this is the fallback if the live path fails

## Five minutes

**0:00 — The problem.** "You pay for a year of something, cancel in month
three, and the other nine months just evaporate. Nobody gets them."

**0:30 — The idea.** Open `/`. The headline: buy time, use it, sell what's
left. Point at the four cards — the same pass at 30, 18, 7 and 2 days. The
ring drains and the colour warms. That is the product in one image.

**1:00 — It's real.** The live strip under the hero is read from the contract
on page load — plans, passes issued, active now, primary volume.

**1:30 — Buy.** `/market` → buy a pass from a plan. Wallet confirms. 100% goes
to the issuer; there's no seller yet.

**2:15 — Own.** `/dashboard`. The pass is there with its remaining time.

**2:45 — The price falls by itself.** List it. On `/market` → Resale the card
shows **"opened at X"** struck through and **"now Y"** below it, and Y drops on
every refresh. The seller set an opening ask; the contract charges less as the
pass drains. Say the line: *"nobody is adjusting this — the contract prices the
time that's left."*

**3:00 — The invariant.** Switch to the second wallet, buy it. The card also
says **"50% below original"** — from `paidOf` on chain, not the frontend.

**3:20 — The point.** Open `/pass/<id>`. Ownership changed; **the expiry did
not**. The buyer got the remaining time, not a fresh term. Show the lifecycle
strip — built from that pass's own events.

**3:40 — Prove it means something.** `/verify` — paste the seller's address:
**NO ACTIVE PASS**. Paste the buyer's: **ACCESS GRANTED**, same expiry. This is
what a real service runs, and it is two view calls: no transaction, no wallet.

**4:00 — The split.** 90% went to the seller, 10% to the original issuer, and
the issuer keeps earning it on every future resale. Enforced in the contract.

**4:00 — Gift and split.** `/dashboard` → **Split** a 60-day pass into four.
Four consecutive slices appear and **only the first is active** — month one,
then month two. Then **Gift** one to a colleague's address. No payment, no
marketplace.

**4:30 — On chain.** `/explorer` — every event with an Arbiscan link.
`/analytics` — volumes and royalties, all derived. Sparkle icon, bottom right —
ask Liquid AI *"why doesn't the buyer get another 30 days?"*, then ask it
something it cannot know and watch it refuse.

**5:00 — Close.** "Rust on Arbitrum Stylus. No server, no database. The chain
is the only source of truth."

## If something breaks

Turn on **demo mode** (top of any page). It is amber, says SIMULATED, and
never produces a transaction hash — nothing simulated is ever presented as
chain state. Use the time-travel scrubber to walk a pass from day 1 to
expired. Then show `/explorer` to prove the real contract is live regardless.

## Questions you should expect

**"Is it ERC-721?"** No, deliberately. No approvals, no operators, no
enumeration, and it emits `PassTransferred` rather than `Transfer` — emitting
`Transfer` would advertise an interface it doesn't implement and indexers
would believe it.

**"Where's the backend?"** There isn't one. The marketplace reads the chain
directly with viem. The two API routes are for IPFS pinning and the AI
assistant, and the product works with neither.

**"What if The Graph is down?"** Nothing changes. Direct chain reads are the
primary path, not the fallback.

**"Does the AI sell my pass automatically?"** No. It watches a condition you
describe and hands you a one-click listing to sign. Nothing can see whether you
opened Netflix -- there is no on-chain signal -- and listing needs a signature.
The panel says "watches, never signs".

**"Is that yield counter real?"** There is no counter. The escrow-yield panel
is labelled a concept and shows the arithmetic, because no escrow is deployed
and nothing is earning. Resales settle atomically, so there is no escrow window
to earn in.

**"Does splitting give me twelve passes at once?"** No -- twelve consecutive
ones. Month one is usable now, month two when month one ends. Parallel slices
would be twelve times the access created from nothing.
