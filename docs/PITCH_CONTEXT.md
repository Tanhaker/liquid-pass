# Liquid Pass: Pitch & Script Context

*Context document to generate a hackathon presentation script. Liquid Pass is built for the Arbitrum Stylus (Rust) hackathon.*

## 🚀 The Elevator Pitch
**Stop paying for unused time.** 
Liquid Pass transforms standard digital subscriptions (like Netflix, Figma, or a Gym membership) into **liquid, resellable assets**. When you buy a 30-day subscription and stop using it on day 10, Liquid Pass allows you to sell the remaining 20 days on an open secondary market. The buyer inherits your exact expiry date—not a fresh 30 days.

## 🏗️ The Architecture (Why it wins the hackathon)
Unlike competitors who just use the blockchain as a slow database to store hashes, **Liquid Pass uses the blockchain to create a brand new financial primitive: liquid time.**

1. **Arbitrum Stylus (Rust) Core:** The core engine is written in Rust, running on Arbitrum Stylus. We pushed the 24KB WebAssembly limit to handle complex time-decay math, NFT fractionalization, and asset bundling entirely on-chain.
2. **Solidity Marketplace & DeFi Escrow:** A companion Solidity contract handles the marketplace routing and automatically deposits all creator royalties into **Aave V3** to earn real yield while locked.
3. **Account Abstraction (ZeroDev):** We integrated ERC-4337 Session Keys so users can delegate highly restricted permissions to an AI oracle.
4. **The Graph:** All frontend data is indexed instantly via a custom Subgraph deployed to The Graph Studio, eliminating the need for a centralized Web2 backend.

---

## ✨ Key Features & How They Work

### 1. The Dutch Auction Secondary Market (Time Decay Pricing)
- **How it works:** Subscriptions expire whether you use them or not, so their value decays by the second. If you list a pass for 1 ETH, the smart contract mathematically decays that price down to zero as the expiry date approaches. 
- **The Magic:** The buyer pays the "current" decayed price. The smart contract automatically splits the proceeds: **90% to the seller, 10% to the original creator**. 

### 2. Fractionalization (Splitting & Bundling Time)
- **How it works:** Time is flexible. If you have a 60-day pass, you can call the `split()` function to burn it and mint four 15-day passes that activate sequentially. Conversely, you can use the `bundle()` function to merge two 15-day passes into a single 30-day pass. 
- **The Magic:** This happens entirely on-chain in the Rust contract. We aren't creating new time out of thin air; we are mathematically slicing the remaining seconds.

### 3. Real Yield Escrow (Aave V3 Integration)
- **How it works:** When a pass is resold, the 10% creator royalty doesn't just sit idle. The Solidity Escrow contract immediately deposits those funds into the **Aave V3 WETH Gateway** on Arbitrum. 
- **The Magic:** Creators earn interest on their secondary market royalties before they even claim them.

### 4. Autonomous AI Oracle (ZeroDev Session Keys)
- **How it works:** Users can set plain-English rules: *"If I don't use this software for 5 days, auto-sell my pass."* The frontend uses **ZeroDev** to generate a "Session Key" that is mathematically restricted to *only* be allowed to call the `list()` function on the marketplace.
- **The Magic:** An external AI Oracle monitors the user's SaaS usage. If it detects abandonment, it uses the Session Key to list the pass on the user's behalf. The Oracle cannot steal funds or transfer the pass; it can only list it.

### 5. The Issuer Command Center (B2B SaaS Dashboard)
- **How it works:** A dedicated `/issuer` dashboard where companies (like Figma) can view their total primary revenue, track secondary market trading volume, and see how many active subscribers they have. 
- **The Magic:** It bridges the gap between Web3 asset ownership and Web2 B2B enterprise analytics.

---

## 🎯 The "Web 2.5" Vision (Future Roadmap)
While we currently rely on Web3 wallets, the ultimate vision for Liquid Pass is integrating **Stripe Crypto Onramps and Coinbase Pay**. A gym or university could onboard normal customers who pay in fiat with a credit card, while Liquid Pass tokenizes and trades the underlying subscription on Arbitrum in the background. We bring the transparency and liquidity of Web3 to the seamless UX of Web2.
