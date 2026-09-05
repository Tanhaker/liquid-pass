# Liquid Pass: Pitch & Script Context

*Context document to generate a hackathon presentation script. Liquid Pass is built for the Arbitrum Stylus (Rust) hackathon.*

## 🚀 The Elevator Pitch
**Stop paying for unused time.** 
Liquid Pass transforms standard digital subscriptions (like Netflix, Figma, or a Gym membership) into **liquid, resellable assets**. When you buy a 30-day subscription and stop using it on day 10, Liquid Pass allows you to sell the remaining 20 days on an open secondary market. The buyer inherits your exact expiry date—not a fresh 30 days.

## 🏗️ The Architecture (Why it wins the hackathon)
Unlike competitors who just use the blockchain as a slow database to store hashes, **Liquid Pass uses the blockchain to create a brand new financial primitive: liquid time.**

1. **Arbitrum Stylus (Rust) Core:** The core engine is written in Rust, running on Arbitrum Stylus. We pushed the 24KB WebAssembly limit to handle complex time-decay math, NFT fractionalization, and asset bundling entirely on-chain.
2. **Solidity Marketplace:** A companion Solidity contract handles marketplace routing and enforces the 90/10 split between seller and original issuer on every sale. A yield escrow that routes proceeds into **Aave V3** is written and wired into `buy()`, but is not currently deployed, so sale proceeds pay the seller directly today.
3. **The Graph:** A custom Subgraph is deployed to The Graph Studio and indexes core and marketplace events. The app deliberately keeps the chain as its source of truth and treats the indexer as an accelerator, so there is no centralized Web2 backend either way.

---

## ✨ Key Features & How They Work

### 1. The Dutch Auction Secondary Market (Time Decay Pricing)
- **How it works:** Subscriptions expire whether you use them or not, so their value decays by the second. If you list a pass for 1 ETH, the smart contract mathematically decays that price down to zero as the expiry date approaches. 
- **The Magic:** The buyer pays the "current" decayed price. The smart contract automatically splits the proceeds: **90% to the seller, 10% to the original creator**. 

### 2. Fractionalization (Splitting & Bundling Time)
- **How it works:** Time is flexible. If you have a 60-day pass, you can call the `split()` function to burn it and mint four 15-day passes that activate sequentially. Conversely, you can use the `bundle()` function to merge two 15-day passes into a single 30-day pass. 
- **The Magic:** This happens entirely on-chain in the Rust contract. We aren't creating new time out of thin air; we are mathematically slicing the remaining seconds.

### 3. Yield Escrow (Aave V3) — designed, not yet deployed
- **How it works:** `Marketplace.buy()` already routes sale proceeds through an escrow when one is configured: `EscrowYield.sol` takes the seller's proceeds and deposits them into the **Aave V3 WETH Gateway** on Arbitrum, so the money earns interest while it sits unclaimed.
- **Status, stated plainly:** the escrow contract is written and `buy()` calls it, but no escrow address is configured on Arbitrum Sepolia yet, so today proceeds pay the seller directly. The dashboard panel stays hidden rather than showing a figure that isn't real.
- **Note:** it escrows the seller's 90%, not the issuer's 10% royalty — the royalty is transferred to the issuer immediately.

### 4. Auto-Sell Rules and the Usage Signal Service
- **How it works:** Users write plain-English rules — *"if I don't use this for 5 days, sell it"* — which are parsed into a condition and evaluated against the pass. A companion service (`oracle/index.js`) can receive usage webhooks from a SaaS product, read the pass on chain, and report whether the holder looks to have stopped using it.
- **The honest part:** nothing signs on the user's behalf. The rule and the service both produce a *recommendation*, and the user presses the button. The service holds no key and broadcasts no transaction, and says so on every response.
- **Why not autonomous:** doing it automatically means account abstraction and session keys, which are explicitly out of scope for this project. A watch that hands you a button is what is actually built, so it is what is claimed.

### 5. The Issuer Command Center (B2B SaaS Dashboard)
- **How it works:** A dedicated `/issuer` dashboard where companies (like Figma) can view their total primary revenue, track secondary market trading volume, and see how many active subscribers they have. 
- **The Magic:** It bridges the gap between Web3 asset ownership and Web2 B2B enterprise analytics.

---

## 🎯 The "Web 2.5" Vision (Future Roadmap)
While we currently rely on Web3 wallets, the ultimate vision for Liquid Pass is integrating **Stripe Crypto Onramps and Coinbase Pay**. A gym or university could onboard normal customers who pay in fiat with a credit card, while Liquid Pass tokenizes and trades the underlying subscription on Arbitrum in the background. We bring the transparency and liquidity of Web3 to the seamless UX of Web2.
