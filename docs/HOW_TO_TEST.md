# Liquid Pass - Comprehensive Testing Guide

This guide explains step-by-step how to manually test every single feature built for the Liquid Pass project on the live website.

## Prerequisites
1. Ensure your wallet (MetaMask/Rabby) is connected to **Arbitrum Sepolia**.
2. Have some testnet Sepolia ETH (you can get this from [Arbitrum Faucet](https://faucet.quicknode.com/arbitrum/sepolia)).

---

## 1. Purchasing a Fresh Subscription (Primary Market)
*This tests the Rust Stylus core contract's ability to mint a new pass.*

1. Navigate to the **Market** page (`/market`).
2. Ensure the **"New"** tab is selected.
3. You will see active Plans (e.g., "Figma Pro", "Netflix").
4. Click **"Buy pass"** on any plan.
5. Confirm the transaction in your wallet.
6. A success banner will appear at the top. You just bought a brand new pass!

---

## 2. Viewing Your Passes & The 3D UI
*This tests the fetching logic, the SVG Decay Rings, and the hardware-accelerated 3D glassmorphism UI.*

1. Navigate to **My Passes** (`/dashboard`).
2. You will see a summary grid: Active, Expiring soon, Listed, Expired.
3. Look at your newly purchased pass.
4. **Test the UI:** Move your mouse over the Pass Card. You will see:
   - The card tilting dramatically in 3D space.
   - Dynamic glaring reflections moving across the glass.
   - Elements (text, SVG rings) floating at different Z-depths off the card.
5. Notice the **Decay Ring** (the circular SVG). It is full (green) for a brand new pass.

---

## 3. Listing a Pass on the Secondary Market
*This tests the integration between the Rust Core contract and the Solidity Marketplace contract.*

1. On the **My Passes** (`/dashboard`) page, find a pass you own.
2. In the "Auto-Sell Rules" panel below your passes, select a pass you want to list.
3. Enter a price (e.g., `0.005` ETH).
4. Click **"List on Market"**.
5. Confirm the transaction. 
6. *Note: You are setting the "Opening Ask" price. The actual price will decay over time.*

---

## 4. Buying on the Secondary Market (Dutch Auction Decay)
*This tests the time-decay pricing algorithm and fractional ownership transfer.*

1. Go back to the **Market** page (`/market`).
2. Switch the tab from "New" to **"Resale"**.
3. You will see passes listed by other users (or your own if you switch wallets).
4. Notice the pricing details on the card:
   - **"opened at X ETH"** (the original asking price)
   - **"now Y ETH"** (the current price, which is lower because time has passed)
   - Look for the **"🔥 STEAL"** badge, which appears if the pass is selling for >40% below its original value.
5. Click **"Take over"** and confirm the transaction. You just bought remaining time!

---

## 5. Bundling Passes (Combining Time)
*This tests the `bundle()` function inside the Rust Stylus contract.*

1. Buy at least **two passes of the exact same plan** (e.g., two Figma Pro passes).
2. Go to **My Passes** (`/dashboard`).
3. Scroll down to the **"Bundle Passes"** panel.
4. Click the passes you want to merge (they will highlight).
5. The UI will show you the combined remaining time.
6. Click **"Bundle Passes"** and confirm the transaction.
7. The two old passes are burned, and a new pass with the combined expiry date is minted.

---

## 6. Real Yield / Escrow (Aave V3 Integration)
*This tests the Solidity EscrowYield contract routing.*

1. When a pass is sold on the secondary market, the funds are routed to the `EscrowYield.sol` contract.
2. Navigate to **My Passes** (`/dashboard`).
3. Scroll down to the **Yield Dashboard**.
4. You will see your active balance held in Escrow (it is secretly earning interest in Aave V3's WETH Gateway).
5. Click **"Claim Funds"** to withdraw your earnings directly to your wallet.

---

## 7. Account Abstraction (ZeroDev Session Keys)
*This tests the Web3 UX and Autonomous UI components.*

1. Go to **My Passes** (`/dashboard`).
2. Look at the **"Set Auto-Sell Rule"** panel.
3. Type a natural language rule, like: `"If I don't use this for 5 days, sell it for 0.01 ETH"`.
4. Click **"Parse Rule"**. The UI will extract the days (5) and the price (0.01 ETH).
5. Click **"Issue Session Key"**.
6. This simulates generating an ECDSA keypair scoped *only* to the `list()` function of the Marketplace contract, avoiding the need for you to sign transactions manually in the future.

---

## 8. Issuer Dashboard (B2B SaaS View)
*This tests the analytics and data aggregation.*

1. Navigate to the **Issuer Dashboard** via the Navigation bar (or go to `/issuer`).
2. If you are connected with the wallet that created the plans, you will see:
   - Total Revenue (Primary + Secondary Royalties)
   - Active Subscribers
   - Secondary Market Volume
   - A table of your active subscription plans.
3. *Note: If you didn't create any plans, the dashboard will tell you it is empty. To test this, you would need to call `createPlan` directly on the smart contract.*

---

## 9. The Graph / Subgraph Data Layer
*This tests the decentralized indexer.*

1. All data on the **Market** and **Dashboard** pages is loaded via **The Graph**.
2. If you look at `web/lib/graphql.ts`, you will see the exact queries being fired.
3. The UI feels incredibly fast because it is querying the deployed Liquid Pass subgraph on The Graph Studio instead of hammering the Arbitrum RPC node.

---

## 10. Light / Dark Mode
*This tests the global design system.*

1. Look at the top right of the navigation bar.
2. Click the **Sun/Moon icon**.
3. Watch the entire application smoothly transition between the deep "Ink" dark mode and the clean, enterprise-ready Light Mode.
