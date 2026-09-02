# 🏆 LiquidPass — Judge Presentation & Live Demo Script

> **Protocol Summary:** The world's first liquid SaaS subscription protocol powered by **Arbitrum Stylus (Rust WASM)**, **The Graph**, and **Pinata IPFS**. LiquidPass turns rigid software access into liquid, resellable NFT credentials with algorithmic fair-value decay and an immutable 10% creator royalty.

---

## ⏱️ Timing Overview (3 to 5 Minutes Total)

| Time | Phase | Focus / Action |
|---|---|---|
| **0:00 - 0:45** | **1. The Hook & Problem** | The \$30B+ SaaS waste problem & LiquidPass solution |
| **0:45 - 1:45** | **2. Live Vault & Decay** | `/dashboard` & `/pass/1` — sovereign pass vault & resale listing |
| **1:45 - 2:30** | **3. Secondary Marketplace** | `/market` — 90/10 split settlement & fair-value decay |
| **2:30 - 3:15** | **4. Issuer & Pinata IPFS** | `/issuer` — auto-pinning metadata & 10% recurring royalties |
| **3:15 - 4:00** | **5. The Graph & Verifier** | `/analytics` & `/verify` — sub-second GraphQL telemetry & auth gate |
| **4:00 - 5:00** | **6. Closing & Judge Q&A** | Why Arbitrum Stylus (Rust WASM) wins + Tech Stack |

---

## 🎤 Detailed Walkthrough & Speaking Script

### 1. The Hook (0:00 - 0:45)
**Tab:** Homepage (`/`)

> *"Judges, every year over **\$30 Billion** is wasted globally on unused SaaS subscriptions. When you buy a 30-day subscription to Figma, Cursor, or Claude and only use it for 10 days, the remaining 20 days vanish into thin air. Users lose money, and SaaS companies lose churned customers forever.*
>
> *Meet **LiquidPass** — a decentralized protocol built on **Arbitrum Stylus in Rust WASM**. LiquidPass converts time-bound software access into dynamic on-chain credentials that decay in real-time and can be resold peer-to-peer on a secondary market, while guaranteeing the original SaaS issuer an **immutable 10% royalty** on every resale."*

---

### 2. Sovereign Pass Vault (`/dashboard`) (0:45 - 1:45)
**Tab:** Click on **`MY PASSES`** (`/dashboard`) → Open **`Claude Pro (Token #1)`** (`/pass/1`)

**👉 What to show:**
- The **Cyberpunk Vault HUD** showing held passes and remaining days.
- The **Live Lifecycle Decay bar** (showing real-time retained value).
- Click **`Sell Remaining Time`** → Input `0.001` ETH → Click **`List It`**.

**🗣️ What to say:**
> *"Here in the user's sovereign vault, software passes aren't trapped in proprietary databases. Every pass is an on-chain asset on Arbitrum Sepolia.*
>
> *Notice the dynamic lifecycle decay timer: as time elapses, the pass's intrinsic value adjusts automatically. When a user finishes their project early, they simply click **'Sell Remaining Time'** to list their remaining days for secondary resale."*

---

### 3. Secondary Marketplace & 90/10 Split (`/market`) (1:45 - 2:30)
**Tab:** Click on **`MARKET`** (`/market`)

**👉 What to show:**
- Live resale listings with Dutch auction price decay.
- The **90/10 Split diagram**: 90% goes to seller, 10% goes to the original SaaS company.

**🗣️ What to say:**
> *"On the marketplace, buyers can purchase discounted remaining software time from other users.*
>
> *Whenever a pass is bought, the smart contract automatically settles the transaction in a single atomic block: **90% is sent directly to the seller**, and **10% is routed to the SaaS issuer's wallet** as a creator royalty. This aligns incentives across the entire ecosystem."*

---

### 4. SaaS Issuer Portal & Pinata IPFS (`/issuer`) (2:30 - 3:15)
**Tab:** Click on **`ISSUER`** (`/issuer`)

**👉 What to show:**
- The on-chain plan catalogue (`Figma Pro`, `GitHub Pro`, `Claude Pro`).
- The **'View on IPFS ↗'** link pointing to the Pinata gateway.
- The **Create New Subscription Plan** form.

**🗣️ What to say:**
> *"For SaaS enterprises, LiquidPass turns user churn into a new high-margin revenue stream through secondary volume.*
>
> *In our Issuer Console, companies can define plan tiers, prices, and durations. When a plan is created, its metadata is **automatically pinned to decentralized storage via Pinata IPFS**. You can click 'View on IPFS' to inspect the immutable cryptographic CID on the IPFS gateway directly from our UI."*

---

### 5. Access Verifier & The Graph Integration (3:15 - 4:00)
**Tabs:** Click on **`VERIFY`** (`/verify`) then **`ANALYTICS`** (`/analytics`)

**👉 What to show:**
1. **`/verify`:** Enter Token ID `1` → Click **`VERIFY`** → Show instantaneous **`ACCESS GRANTED`** badge and the 5-line integration code.
2. **`/analytics`:** Show the Apollo Client GraphQL Explorer → Click preset **`Active Plans`** → Click **`EXECUTE QUERY`** → Show live indexed JSON telemetry.

**🗣️ What to say:**
> *"How do software apps verify user access?*
>
> *Third-party platforms embed our 5-line Viem SDK. It queries `isActive(tokenId)` directly on our Arbitrum Stylus Rust contract in under **150 milliseconds**.*
>
> *For frontend telemetry and search, we integrated **The Graph Protocol** directly into our UI. In our GraphQL Playground, you can execute live queries against our subgraph indexer to stream real-time volume, active plans, and resale transactions without straining the RPC."*

---

### 6. Closing (4:00 - 4:30)

> *"By combining **Arbitrum Stylus (Rust WASM)** for ultra-low gas execution, **The Graph** for sub-second indexed queries, and **Pinata IPFS** for tamper-proof metadata, LiquidPass makes software ownership truly sovereign, composable, and liquid.*
>
> *Thank you, judges! We're ready for your questions."*

---

## 🎯 Judge Q&A Cheat Sheet

| Question | Winning Answer |
|---|---|
| **Why use Arbitrum Stylus (Rust) instead of Solidity?** | *"Stylus compiles Rust to native WebAssembly (WASM). This provides **10x-100x lower gas consumption** and near-instant memory execution, making high-frequency time-decay math and pass batching economically viable."* |
| **Why would SaaS companies allow reselling?** | *"Right now, SaaS companies get \$0 when a user churns or leaves. With LiquidPass, issuers earn an **enforced 10% royalty** on every secondary trade and acquire new paying users who buy discounted passes."* |
| **How is fraud prevented on resale?** | *"Pass ownership is cryptographically bound to the ERC token. When a pass is sold via `buy()`, ownership is atomically transferred on-chain, immediately revoking access from the seller and granting it to the buyer."* |
| **How is metadata stored?** | *"Plan metadata and tier specifications are pinned to **Pinata IPFS**, producing content-addressed hashes that are stored permanently on-chain in the Stylus contract."* |

---

## 📍 Quick Contract Reference for Judges

- **Arbitrum Stylus Rust Contract:** [`0xac20ef73723e7c620df1024eb04cc0b71fca1055`](https://sepolia.arbiscan.io/address/0xac20ef73723e7c620df1024eb04cc0b71fca1055)
- **Marketplace Contract:** [`0x63a9edec92baf3e74f19d301808c56104e786241`](https://sepolia.arbiscan.io/address/0x63a9edec92baf3e74f19d301808c56104e786241)
- **Network:** Arbitrum Sepolia (Chain ID: `421614`)
- **GitHub:** [`github.com/Tanhaker/liquid-pass`](https://github.com/Tanhaker/liquid-pass)
