# Liquid Pass

**Buy time. Use it. Sell what's left.**

Subscriptions expire whether you use them or not. Liquid Pass turns the
remaining time into something you can hand to somebody else — and the buyer
inherits your expiry date, not a fresh term.

First built for the Arbitrum showcase (2 September 2026); extended for
HackSphere 2026, Phase 2.

| | |
|---|---|
| Marketplace | https://liquidpass.xyz |
| LiquidDesk, a sample app a pass unlocks | https://desk.liquidpass.xyz |
| Network | Arbitrum Sepolia (testnet; no real money moves) |

## The idea

An issuer publishes a **plan**: a name, a price, a duration. Buying from it
mints a **pass** that expires that duration from now.

```
BUY  →  OWN  →  USE  →  LIST  →  RESOLD  →  new owner gets the REMAINING time
```

If Alice buys a 30-day pass and sells it on day 10, Bob gets 20 days. Not 30.
That invariant is enforced in the contract, not the interface — a resale
transfers ownership and never touches the expiry timestamp.

On every resale: **90% to the seller, 10% to the original issuer**, forever,
for as long as the pass keeps trading.

## Using a pass

Holding a pass is the access. The **Use Pass** page (`/use`) gathers the
places that accept one; all of them read the same contract, so when a pass is
sold or gifted they close for the old holder and open for the new one.

- **LiquidDesk** (`liquiddesk/`, its own app and address). A sample SaaS
  product. You sign in by signing a one-time message with your wallet; its
  server reads `isActive`, `ownerOf` and `issuerOf` on every request and runs
  the Pro feature only while they pass. Sell the pass and it locks on screen
  within seconds. No user database, no passwords.
- **QR check-in** (`/checkin`, `/checkin/sign`). For physical venues. The
  scanner shows a one-time challenge that changes every 2 minutes; the
  holder's wallet signs it (EIP-191, free, no transaction); the scanner
  recovers the signer and confirms on chain that it holds an active pass.
  Each challenge is accepted once, so a screenshot cannot be reused. The
  admit-or-refuse decision is made in the scanner's browser; `/api/checkin`
  only relays the signed answer between the two screens.
- **Verify** (`/verify`). Who holds access to any pass right now, with the
  few lines of code another app needs to make the same check.

## Liquidity AI

Google Gemini behind server routes, so the key never reaches the browser.
Every answer is grounded in what the server hands the model, and checked.

- **Assistant** (the corner widget on both apps, `/api/ai`). Answers from the
  in-repo knowledge base and a live chain snapshot, including the connected
  wallet's own passes. It is told to say it does not know rather than guess.
- **Auto-sell rules** (`/api/rule`, My Passes). A sentence such as *if I don't
  use this pass for 7 days, sell it for 0.001* becomes a validated rule. A
  pass counts as used when it unlocks LiquidDesk, when a check-in is signed
  with it, or when it is verified. A rule that fires offers a one-click
  listing for the holder to sign; nothing is listed without a signature.
- **Fair-price advisor** (`/api/price`, the sell form). The price is computed
  first, from the time left and from past resales read off the chain. The
  model only explains it, and an explanation containing any number that was
  not in the supplied facts is discarded in favour of rule-based wording.

## The Web 2.5 Vision (Bridging Fiat & Crypto)

Liquid Pass is built to be a true B2B SaaS platform for Web3. Today it uses ordinary Web3 wallets; the product roadmap includes **Stripe Crypto Onramps and Coinbase Pay**. 

This means a university, gym, or SaaS company (like Figma) will be able to onboard users who pay in fiat with a credit card, while the underlying asset (the resellable subscription pass) is tokenized and traded on Arbitrum. We bring the transparency of Web3 to the UX of Web2.

## Smart Contract vs Database (Our Architectural Thesis)

Unlike traditional SaaS platforms that require bloated backend infrastructure (20+ PHP microservices, MySQL databases, background queues, and webhook processors), **Liquid Pass has zero backend services and no centralized database.** 

We don't need them. **Arbitrum Stylus and The Graph handle our state, execution, and indexing securely and transparently.** Our core logic—time decay math, fractionalization, ownership transfer, and market pricing—executes entirely on-chain in highly optimized Rust. We achieve the scale and feature set of an enterprise SaaS platform with nothing more than a smart contract and a frontend.

## Architecture

```
contracts/     PassKeyWallet — earlier work, not on the product path
subscription/  the Liquid Pass contract (Rust + Stylus) and its e2e suite
web/           Next.js 15 marketplace (liquidpass.xyz)
liquiddesk/    Next.js sample app unlocked by a pass (desk.liquidpass.xyz)
subgraph/      The Graph mappings — optional, nothing depends on it
extension/     read-only Chrome companion
bench/         P-256 gas benchmark from the earlier project
```

**There is no backend server and no database.** The marketplace reads the
chain directly with viem. A handful of serverless routes cover what cannot run
in a browser or on chain: IPFS pinning (`/api/ipfs`), the three Liquidity AI
routes, the activity feed (`/api/activity`, one cached read of the contract's
events shared by every visitor) and the check-in relay. None of them holds a
wallet key or can move a pass, and buying, selling and gifting work with none
of them configured.

The contract deliberately **does not implement ERC-721**: no approvals, no
operators, no enumeration, and ownership moves emit `PassTransferred` rather
than the ERC-721 `Transfer` signature. Emitting `Transfer` would advertise an
interface it does not implement, and wallets and indexers would believe it.
Resale goes through the contract's own `buy`.

That choice is also why there is a data layer: with no enumeration on chain,
every list view is assembled in `web/lib/data.ts` from counters plus batched
`multicall` reads. It keeps the contract under the 24 KB Stylus limit.

## Contract interface

```
createPlan(name, metadataUri, price, durationSeconds) -> planId   issuer only
setPlanOpen(planId, open)                                          plan issuer
buyPass(planId) payable -> tokenId          primary sale, 100% to the issuer
list(tokenId, price)                       owner only; sets the OPENING ask
unlist(tokenId)                          allowed after expiry, to clear stale
buy(tokenId) payable        resale at currentPrice, 90% seller / 10% issuer
transferPass(to, tokenId)               gift; owner only, clears any listing
split(tokenId, parts) -> firstId    burns one pass into `parts` consecutive
                                    slices, 2..24, owner only, must be unlisted
```

Views: `planName` `planUri` `planPriceOf` `planDurationOf` `planIsOpen`
`ownerOf` `expiryOf` `issuerOf` `planOf` `paidOf` `priceOf` `openingPrice`
`currentPrice` `isActive` `remainingSeconds` `nextPlanId` `nextTokenId`
`isIssuer` `admin`

**Prices decay.** `openingPrice` is what the seller asked; `currentPrice` is
what `buy()` charges now, falling in proportion to the access still left:

```
currentPrice = openingPrice x (expiry - now) / (expiry - listedAt)
```

`buy()` takes **at least** `currentPrice` and refunds the change. Exact payment
is impossible against a falling price -- the value decays between quoting and
mining -- so callers send a small buffer and get the surplus back.

**Splitting is sequential.** `split(id, 4)` on a 60-day pass produces four
passes of ~15 days that activate one after another, not four simultaneous
passes. Parallel slices would be four times the access, minted from nothing.

`paidOf` records what the **first** buyer paid and is never overwritten. It is
what every "% below original" figure is computed against — the discount is
read from chain, not invented by the frontend.

## Development

```bash
# contract
cd subscription
cargo build --release --target wasm32-unknown-unknown
cargo stylus check --endpoint https://sepolia-rollup.arbitrum.io/rpc

# end-to-end against the live chain
node e2e.mjs                    # LIQUID_PASS_ADDRESS=0x… to target a redeploy

# frontend
cd web
npm install
cp .env.example .env.local      # optional keys; the app runs without them
npm run dev
```

`cargo test` does not link for the host target — the crate has no unit tests
and `crate-type = ["lib", "cdylib"]` cannot resolve the WasmVM host symbols
off-chain. **`subscription/e2e.mjs` is the real test suite**, and it runs
against Arbitrum Sepolia.

### Deploying the contract

Reproducible Docker builds are unsupported on Windows outside WSL, so:

```bash
cargo stylus deploy --no-verify \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc \
  --private-key-path ../contracts/deployer.key \
  --max-fee-per-gas-gwei 1 \
  --constructor-args <ADMIN_ADDRESS>      # must come last: it is variadic
```

Needs a native `wasm-opt.exe` (Binaryen 131) on PATH. The npm `binaryen`
package ships only `.cmd` shims, which Rust's process spawn cannot resolve.

## Environment

See `web/.env.example`. Everything is optional:

| Variable | Without it |
|---|---|
| `PINATA_JWT` | `/api/ipfs` returns 501; plan names and prices are on chain anyway |
| `GEMINI_API_KEY` | Liquid AI answers from the in-repo knowledge base, labelled as documentation |
| `NEXT_PUBLIC_SUBGRAPH_URL` | Direct chain reads, which are the primary path regardless |

LiquidDesk needs one variable in production: `SESSION_SECRET`, any long random
string, which signs its session cookie.

Server-only keys have **no** `NEXT_PUBLIC_` prefix, which is what keeps Next
from inlining them into the browser bundle.

## Testing

```bash
cd subscription && node e2e.mjs      # on-chain: mint, list, buy, resale, splits
cd web && npx tsc --noEmit           # types
cd web && npx eslint .               # lint
cd web && npm run build              # production build
```

Do not run `npm run build` while `next dev` is live — it overwrites `.next` and
the running dev server starts 404ing on its own chunks.

## Testing

[`docs/TESTING.md`](docs/TESTING.md) lists every working feature with the exact
steps to verify it yourself, plus what is not implemented and why.

## Demo

See [`docs/DEMO.md`](docs/DEMO.md) for the five-minute script and the fallback
if the live path fails.
