# Liquid Pass — project status

Every row below was checked against the code and against Arbitrum Sepolia
rather than from memory. "Implemented" here means *deployed and reachable from
the website*; anything short of that says so, because a feature nobody can
click is not shipped.

## Deployed contracts

| What | Address | State |
| :--- | :--- | :--- |
| Core (Rust / Stylus) | `0xac20ef73723e7c620df1024eb04cc0b71fca1055` | Live · 24,296 bytes of the 24 KB limit |
| Marketplace (Solidity) | `0x63a9edec92baf3e74f19d301808c56104e786241` | Live · the core trusts this address |
| PassKeyWallet (Rust / Stylus) | `0x490630168df621c98e6bba22549295a2202de358` | Live · P-256 key registered, nonce 1 |
| EscrowYield (Solidity) | — | **Written, never deployed** |

The core has roughly 280 bytes of headroom against the 24 KB compressed Stylus
limit. New on-chain functionality has to go in a separate contract.

## Backend & infrastructure

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Core pass contract (Rust) | Shipped | Stylus WASM holding mint, plans, transfer, split, bundle. |
| Split contract architecture | Shipped | Core + Marketplace, to stay under the 24 KB limit. |
| Time-decay pricing | Shipped | `currentPrice()` decays continuously to zero at expiry — every second, not in daily steps. |
| Pass bundling | Shipped | `bundle()` burns several passes into one. |
| Pass splitting | Shipped | `split()` divides a pass into consecutive slices. |
| Marketplace 90/10 split | Shipped | Enforced in `buy()`; royalty goes to the original issuer. |
| WebAuthn / P-256 verification | Shipped (contract) | `PassKeyWallet` verifies real secp256r1 assertions on chain. Not yet wired into the website. |
| Escrow & Aave yield | **Not deployed** | `EscrowYield.sol` is written and `Marketplace.setEscrow` exists, but no escrow address is configured, so `buy()` pays the seller directly. The UI panel stays hidden rather than showing a dead widget. |
| Account abstraction | **Out of scope** | ERC-4337, bundlers and paymasters are explicitly out per `CLAUDE.md`. `lib/zerodev.ts` is dead code that does not typecheck and is imported by nothing. |
| Pay-per-second rental | **Written, not deployed** | `StreamRental.sol` + 18 passing tests. Escrows a pass and charges by the second, 90/10 split, accrual capped by both deposit and expiry. Deploy with `scripts/deployStreamRental.js`. |
| Usage signal service | Shipped (advisory) | `oracle/index.js` reads the pass on chain and returns a recommendation. It holds no key and broadcasts nothing. |
| The Graph subgraph | Shipped (secondary) | Deployed and configured in production. The app reads from RPC; the subgraph is an accelerator, not the source of truth. |

## Frontend

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Theme + design system | Shipped | Light/dark via `data-theme`, Tailwind v4 tokens. |
| Marketplace carousel | Shipped | Drift, drag, wheel and keyboard, covered by Playwright. |
| Live decaying price | Shipped | Recomputes `currentPrice()` in the browser once a second at 9 dp. |
| Time-decay rings | Shipped | SVG rings tracking remaining life. |
| Gift & split UI | Shipped | On every pass card in the vault. |
| Pass bundler UI | Shipped | Appears when you hold more than one pass. |
| Auto-sell rules | Shipped (advisory) | Rules evaluate locally and produce a button. Nothing signs on your behalf, and the panel says so. |
| Pricing suggestions | Shipped | Median resale behaviour per plan, on the listing form. |
| Subgraph panel | Shipped | Probes the GraphQL layer and reports what came back. |
| Issuer console | Shipped | `/issuer` — plans, revenue, royalty terms. |
| Analytics | Shipped | `/analytics` — primary vs resale volume and royalties. |
| Yield dashboard | **Hidden** | Built, but not mounted while no escrow is deployed. |
| Passkey verifier | Shipped | `/passkey` creates a real ES256 credential, signs a challenge read live from the deployed wallet, and verifies the secp256r1 signature in the browser. Shows the challenge match, UP/UV flags and the low-s fold. |
| Passkey sign-in on chain | **Localhost only** | The deployed wallet was compiled with `EXPECTED_ORIGIN = "http://localhost:3000"` and must not be redeployed, so `execute()` only accepts assertions produced at that origin. `register()` is also one-shot and already used. The page states both plainly. |
| Pay-per-second rental UI | **Hidden** | Renders once `NEXT_PUBLIC_STREAM_RENTAL_ADDRESS` is set. |
| Chrome extension | Shipped (read-only) | Lists your passes and time remaining. Holds no keys; buying and selling happen on the site. |

## Testing

Playwright covers the routes, the carousel, the dashboard write paths and the
decay curve. Reads hit real Arbitrum Sepolia; writes are recorded and asserted
against the ABI but never broadcast, so the suite costs no testnet ETH.

```bash
cd web && npm run e2e
```

Contract tests run on the Hardhat EVM against a mock core, since the real core
is Stylus WASM and cannot run there.

```bash
cd contracts && npm test
```
