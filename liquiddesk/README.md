# LiquidDesk

A sample SaaS app that is unlocked by a Liquid Pass. It is the "Unlock with
Liquid-Pass" app from the HackSphere proposal: a separate product whose Pro
feature works only for a wallet holding a valid pass, and locks again as soon
as the pass is sold.

## What it does

1. **Wallet sign-in.** The wallet signs a one-time message (free, no
   transaction). The server verifies the signature and keeps the address in a
   signed, httpOnly cookie. No email, no password, no user database.
2. **Pass check.** On every request the server reads the Liquid Pass core on
   Arbitrum Sepolia: `isActive`, `ownerOf` and `issuerOf` (plus `activeRenter`
   for a pass that is being rented out). See `lib/chain.ts`.
3. **Gated feature.** `/api/tools/summarise` runs only while the check passes,
   so there is nothing in the browser to unlock by editing the page.
4. **Live lock.** The page re-checks every 4 seconds. Sell or gift the pass
   and it locks on screen; the new holder can sign in and use the days left.

## Run it

```bash
npm install
npm run dev        # http://localhost:3300
```

`SESSION_SECRET` must be set in production (any long random string). The other
variables in `.env.example` are optional and default to the deployed contracts.

The design system is Liquid Pass's own, restated in plain CSS in
`app/globals.css`.
