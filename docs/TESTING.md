# Liquid Pass — what works, and how to check it yourself

Every feature below, with the exact steps to verify it. Nothing here is
described as working unless it has been run against the deployed contract.

**Contract:** [`0x22703fdd3dd77f854ca111e581bbd84cf82c1d36`](https://sepolia.arbiscan.io/address/0x22703fdd3dd77f854ca111e581bbd84cf82c1d36)
· Arbitrum Sepolia · 24544 / 24576 bytes

---

## Before you start

You need **two** wallets, both on Arbitrum Sepolia, both funded.

1. MetaMask → add Arbitrum Sepolia (chain id **421614**, RPC
   `https://sepolia-rollup.arbitrum.io/rpc`)
2. Free test ETH: https://faucet.quicknode.com/arbitrum/sepolia
3. Create a second account in MetaMask and fund it too

**Why two:** the contract rejects buying your own listing (`already owner`).
The resale round trip is impossible with one wallet.

Current chain state, for reference:

| | |
|---|---|
| Plans | Figma Pro 0.0002/30d · GitHub Pro 0.00015/30d · Notion Plus 0.0001/14d · Cursor Pro 0.00025/60d |
| Passes | 6 issued, one listed, four of them split slices |
| Issuer / admin | `0xf5AbE5a5092Af1a7fA31109C98635440fdD83174` |

Only the admin address can publish plans. Everything else works from any wallet.

---

# Working features

## 1. Buy a pass (primary sale)

**What it proves:** an issuer's plan can be bought, minting a time-bound pass,
with 100% of the price going to the issuer.

1. Open `/market`, **New** tab
2. Connect wallet → **Buy pass** on Notion Plus (cheapest, 0.0001 ETH)
3. Confirm in MetaMask
4. Wait for the green banner → click **view on Arbiscan**

**Passes if:** the banner shows a real tx hash, and Arbiscan shows the value
going to `0xf5AbE5a5…`. Then open `/dashboard` — the pass is there with ~14
days.

**Common failure:** "Not enough ETH for the price plus gas" — top up the faucet.

---

## 2. Time decay — the price falls as the pass drains

**What it proves:** the headline mechanic. Resale prices decrease with the
remaining time, and the contract charges the decayed figure.

1. `/market` → **Resale** tab
2. Look at the GitHub Pro card: **"opened at 0.000075"** struck through,
   **"now 0.0000749…"** in teal
3. Wait 30 seconds, refresh
4. The "now" figure is **lower**

**Passes if:** the current price drops on every refresh while the opening ask
stays fixed.

**Verify on chain, no browser:**
```bash
cd subscription
node -e "
const {createPublicClient,http,parseAbi,formatEther}=require('viem');
const {arbitrumSepolia}=require('viem/chains');
const C='0x22703fdd3dd77f854ca111e581bbd84cf82c1d36';
const abi=parseAbi(['function currentPrice(uint256) view returns (uint256)','function openingPrice(uint256) view returns (uint256)']);
(async()=>{const c=createPublicClient({chain:arbitrumSepolia,transport:http('https://sepolia-rollup.arbitrum.io/rpc')});
const r=f=>c.readContract({address:C,abi,functionName:f,args:[0n]});
console.log('opening', formatEther(await r('openingPrice')));
console.log('current', formatEther(await r('currentPrice')));
await new Promise(x=>setTimeout(x,30000));
console.log('after 30s', formatEther(await r('currentPrice')));})()"
```

---

## 3. Resale — the buyer inherits the remaining time

**What it proves:** the core invariant. Reselling transfers ownership without
resetting the expiry.

1. `/dashboard` with **wallet A** → on your pass, **Sell remaining time**
2. Accept the suggested price → **List it** → confirm
3. Note the token id and days remaining
4. Switch to **wallet B** in MetaMask
5. `/market` → **Resale** → **Take over** → confirm
6. Open `/pass/<id>`

**Passes if:** Owner is now wallet B, and **the expiry date is unchanged**.
The lifecycle strip at the bottom shows the real purchase and resale events
with Arbiscan links.

**This is the demo's most important moment.** The buyer got the leftover days,
not a fresh term.

---

## 4. The 90 / 10 split

**What it proves:** the seller takes 90%, the original issuer keeps 10% on
every resale, enforced by the contract.

1. After step 3, open the resale tx on Arbiscan
2. Look at the internal transactions

**Passes if:** you see two outgoing transfers — ~90% to the seller, ~10% to
`0xf5AbE5a5…` — plus a small refund back to the buyer (see below), and the
contract's balance ends at zero.

**The refund:** the UI sends 0.1% over the quoted price on purpose. A price
that falls between quoting and mining makes exact payment impossible, so the
contract takes at least the current price and returns the change.

---

## 5. Verify access — what a service would run

**What it proves:** holding a pass *is* the access. There's no redeem step.

1. `/verify`
2. Paste an address, pick a plan (or "Any plan") → **Check access**

**Passes if:**
- An address holding an active pass → **ACCESS GRANTED**, with the plan, days
  remaining, and token id
- `0x1111111111111111111111111111111111111111` → **NO ACTIVE PASS**

**The strong demo move:** verify the same address *before and after* a resale.
The seller flips from granted to denied and the buyer from denied to granted,
while the expiry never moves.

---

## 6. Gift a pass

**What it proves:** a pass can be handed to someone with no payment.

1. `/dashboard` → on a pass you own → **Gift**
2. Paste wallet B's address → **Send** → confirm
3. Refresh — it's gone from your dashboard

**Passes if:** `/verify` on wallet B's address now grants access, and any
listing on that pass was cleared (the new owner didn't set that price).

---

## 7. Split a pass into consecutive slices

**What it proves:** a long pass divides into several shorter ones for different
people.

1. `/dashboard` → a pass with plenty of time (Cursor Pro, 60d) → **Split**
2. Enter `4` → read the note → **Split into 4** → confirm
3. Refresh

**Passes if:** the original is gone and four passes appear — roughly 15, 30, 45
and 60 days — and **only the first is active**. The others activate when their
turn arrives.

**Say this clearly to your mentor:** the slices are **sequential**, not
parallel. A 12-month pass becomes month 1 … month 12, not twelve simultaneous
passes. Parallel slices would be twelve times the access created from nothing.

Split refuses while a pass is listed, because it burns the original.

---

## 8. Publish a plan (issuer only)

**Requires the admin wallet** `0xf5AbE5a5…`.

1. `/issuer` → name, price, days
2. **Pin to IPFS** → the field fills with `ipfs://…`
3. **Publish plan** → confirm

**Passes if:** the plan appears on `/market` immediately, and its card shows
your description with a **VIA IPFS** badge.

From any other wallet the form says up front that the address isn't on the
issuer allowlist, rather than letting the transaction revert.

---

## 9. IPFS metadata

1. Follow step 8 → copy the CID from the URI
2. Open `https://yellow-legal-emu-572.mypinata.cloud/ipfs/<CID>`
3. Check Pinata → **Files**

**Passes if:** the JSON is there with your name and description, and the same
text renders on the market card.

**Note:** the four seeded plans point at placeholder CIDs and will never
resolve — `planUri` is fixed at creation and there's no `setPlanUri`. Only
plans you publish yourself carry real metadata.

**Only your dedicated gateway works.** `ipfs.io` and `cloudflare-ipfs` don't
respond; Pinata's public gateway serves a Cloudflare challenge to non-browsers.

---

## 10. Live activity and explorer

1. `/explorer`
2. Filter with the preset buttons
3. Leave it open and buy something in another tab

**Passes if:** every event has a real block number and a working Arbiscan link,
and new events appear without a refresh. The badge reads **"Direct chain data
via viem"** — honest, because no subgraph is deployed.

---

## 11. Analytics

1. `/analytics`

**Passes if:** the counts match `/market` and `/dashboard`. Royalties are
summed from `Bought` events using the same integer division the contract uses.

Resale volume comes from events — the only place it's knowable, since the
contract stores each pass's original price rather than a running total.

---

## 12. Liquid AI

1. Click the sparkle, bottom right, on any page
2. Ask **"What plans are available right now?"** → it lists the real four with
   real prices
3. Ask **"Why doesn't the buyer get another 30 days?"** → explains the expiry
   rule
4. Connect a wallet, ask **"Which of my passes expire soon?"**
5. Ask **"What was the gas price of block 12345?"**

**Passes if:** 2–4 are correct against chain, and **5 is refused**. It answers
only from the product docs plus a live chain snapshot, and says so when it
doesn't know.

---

## 13. Auto-sell rules

1. `/dashboard` → **Auto-sell rules**
2. Type: `if I don't use my Notion pass for 7 days, sell it for 0.0002`
3. **Add rule** → review → **Save rule**
4. Try: `sell my pass when bitcoin goes above 100k`

**Passes if:** the first becomes a watch, the second is **refused** with
"Cannot set a rule based on external market prices".

**Be honest about this one.** It's a watch, not an agent. Nothing can see
whether you opened Netflix — there's no on-chain signal — and listing needs a
signature. When a rule fires you get a one-click listing to sign. The panel
says *"watches, never signs"*.

---

## 14. Pricing oracle

1. `/dashboard` → **Sell remaining time**

**Passes if:** the suggestion shows its evidence — how many resales of that
plan happened and the median discount they settled at. With no history it says
so and offers the time value as a starting point.

Deliberately not "demand is HIGH today" — nothing measures demand.

---

## 15. Demo mode

1. Top of any page → **switch to demo mode**
2. Use the day buttons

**Passes if:** the banner is amber and says SIMULATED, rings and colours change
with the scrubber, and **no transaction hash ever appears** — there's nothing
to link to.

Use this if the wallet or RPC fails on stage. Never present it as real.

---

## 16. QR resale

1. `/pass/<id>` on a listed pass → **Generate QR**
2. Scan with a phone

**Passes if:** the phone opens that exact pass. The QR encodes the current
origin, so it works on localhost and on the deployed URL.

---

## 17. Chrome extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
2. Click the icon, paste an address → **Load**

**Passes if:** it lists that address's passes with time remaining, soonest
first, and clicking one opens the site.

Read-only by design — no keys, no signing.

---

## 18. Escrow yield (concept)

1. `/dashboard`, scroll to the bottom
2. Move the sliders

**Passes if:** it's labelled **CONCEPT**, the maths is shown, and it states
plainly that no escrow is deployed.

**There is no live yield counter and that's deliberate.** A number ticking
upward would be a claim that money is being earned. Nothing is. The panel
explains the mechanism instead, which survives a judge asking "is that real?"

---

# Not implemented

| Feature | Why |
|---|---|
| **Pass bundling** (combine passes into one) | No contract space. 32 bytes of headroom; this needs a mapping to a dynamic array plus its own mint/burn path — hundreds of bytes |
| **Real yield / Aave** | Would need an escrow contract and a lending integration. Liquid Pass settles resales atomically, so there's no escrow window to earn in |
| **Subgraph deployed** | Files are written and ready (`subgraph/`); needs a Subgraph Studio deploy key. The app doesn't depend on it |
| **WalletConnect mobile** | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` unset, so QR/mobile wallet options fail. Injected wallets are unaffected |
| **Multi-device passkeys, ERC-4337, mainnet** | Out of scope from the start |
| **Automatic listing without a signature** | Impossible without holding your key or a session-key mechanism the contract doesn't implement |
| **Usage detection ("did they open Netflix")** | No on-chain signal exists. The idle condition measures Liquid Pass access checks instead, and says so |

## Known limitations

- **The contract is frozen.** 24544 / 24576 bytes. Any further change exceeds
  the Stylus limit.
- **`startOf` was removed** to make room for split, so the frontend infers
  slice start times from ordering rather than reading them.
- **Seeded plans have placeholder IPFS CIDs** that will never resolve.
- **`cargo test` doesn't link** for the host target — the crate has no unit
  tests and `crate-type = ["lib","cdylib"]` can't resolve WasmVM symbols
  off-chain. `subscription/e2e.mjs` is the real suite and runs against the
  live chain.
- **Two pricing concepts coexist:** `fairPrice` (time-proportional, a
  suggestion for the opening ask) and the contract's decay ramp (what a buyer
  actually pays). They're different numbers.

## Run the on-chain test suite

```bash
cd subscription
LIQUID_PASS_ADDRESS=0x22703fdd3dd77f854ca111e581bbd84cf82c1d36 node e2e.mjs
```

Spends real testnet ETH. Exercises mint, list, buy, the primary sale, the
90/10 split, expiry enforcement and every revert path. Watch for
`EXPIRY PRESERVED = true` and `contract balance = 0`.
