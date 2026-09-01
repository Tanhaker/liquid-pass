# Liquid Pass

**Buy time. Use it. Sell what's left.**

Subscriptions expire whether you use them or not. Liquid Pass turns the
remaining time into something you can hand to somebody else — and the buyer
inherits your expiry date, not a fresh term.

Built for the Arbitrum showcase, 2 September 2026.

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

## Deployed

| | |
|---|---|
| Contract | [`0xe67078be99dec98b9788a0e6c2054d03b361f84a`](https://sepolia.arbiscan.io/address/0xe67078be99dec98b9788a0e6c2054d03b361f84a) |
| Chain | Arbitrum Sepolia (421614) |
| Deploy tx | `0x1265a1db61a50a41fb08cf7399c332ab6ee3f0716d480e56af1679e54267746b` |
| Size | 22366 / 24576 bytes (`wasm-opt 131 -Oz`) |

Testnet only. The ETH has no monetary value.

## Architecture

```
contracts/     PassKeyWallet — earlier work, not on the product path
subscription/  the Liquid Pass contract (Rust + Stylus) and its e2e suite
web/           Next.js 15 marketplace
subgraph/      The Graph mappings — optional, nothing depends on it
extension/     read-only Chrome companion
bench/         P-256 gas benchmark from the earlier project
```

**There is no backend server and no database.** The marketplace reads the
chain directly with viem. Two API routes exist — IPFS pinning and the AI
assistant — and the product works fully with neither configured.

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
list(tokenId, price)                                              owner only
unlist(tokenId)                          allowed after expiry, to clear stale
buy(tokenId) payable                          resale, 90% seller / 10% issuer
```

Views: `planName` `planUri` `planPriceOf` `planDurationOf` `planIsOpen`
`ownerOf` `expiryOf` `issuerOf` `planOf` `paidOf` `priceOf` `isActive`
`remainingSeconds` `nextPlanId` `nextTokenId` `isIssuer` `admin`

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

## Demo

See [`docs/DEMO.md`](docs/DEMO.md) for the five-minute script and the fallback
if the live path fails.
