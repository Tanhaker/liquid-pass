/**
 * Liquid AI's product knowledge.
 *
 * Deliberately a file in the repo rather than a vector database. The corpus is
 * a dozen short facts; embedding them into Pinecone would add a network
 * dependency, an API key, and a cold-start failure mode during a live demo, in
 * exchange for retrieval quality that keyword matching already achieves at this
 * size. If the corpus grew to hundreds of documents that trade would flip.
 *
 * Every fact here must match the deployed contract. If the contract changes,
 * this changes with it -- an assistant confidently describing behaviour the
 * contract does not have is worse than no assistant.
 */

export type Doc = { id: string; title: string; text: string; tags: string[] };

export const KNOWLEDGE: Doc[] = [
  {
    id: "what",
    title: "What Liquid Pass is",
    text: "Liquid Pass turns a software subscription into a time-bound asset you can resell. You buy a pass that grants access for a fixed period. If you stop needing it partway through, you can sell the remaining time to someone else instead of letting it expire unused.",
    tags: ["what", "liquid", "pass", "product", "overview", "about"],
  },
  {
    id: "expiry",
    title: "Why the buyer does not get a fresh term",
    text: "A pass stores an absolute expiry timestamp, set when it is first bought. Reselling transfers ownership but never touches that timestamp. If Alice buys a 30-day pass and sells it on day 10, Bob receives the original expiry -- 20 days -- not a new 30-day term. This is the central invariant of the product and it is enforced in the contract, not the frontend.",
    tags: ["expiry", "expire", "remaining", "time", "fresh", "reset", "30", "days", "invariant"],
  },
  {
    id: "split",
    title: "How the resale payment splits",
    text: "On resale, 90% of the price goes to the seller and 10% goes to the original issuer of the pass. The issuer keeps earning that 10% on every subsequent resale, for as long as the pass keeps trading. The contract computes the royalty as price / 10 using integer division and pays the seller the remainder, so the two payouts always sum to exactly the price with no dust left behind.",
    tags: ["split", "90", "10", "royalty", "fee", "issuer", "seller", "payment", "revenue"],
  },
  {
    id: "primary",
    title: "Buying a new pass",
    text: "An issuer publishes a plan with a name, price and duration. Buying from a plan mints a new pass to you that expires that duration from now, and pays 100% of the price to the issuer. There is no 90/10 split on a primary sale because there is no seller -- only on resale.",
    tags: ["buy", "primary", "new", "plan", "mint", "purchase", "issuer"],
  },
  {
    id: "listing",
    title: "Listing a pass for resale",
    text: "The owner of an active pass can list it at any price above zero. Zero is the contract's marker for 'not listed', so it is rejected as a price. Listing does not transfer the pass; it stays yours until somebody buys it. You can remove a listing at any time.",
    tags: ["list", "listing", "sell", "resale", "unlist", "price"],
  },
  {
    id: "expired",
    title: "What happens when a pass expires",
    text: "An expired pass cannot be listed and cannot be bought -- the contract rejects both, and re-checks expiry at the moment of purchase, not just at listing, because a pass can expire while it sits on the market. Removing a stale listing still works after expiry so sellers can always clean up.",
    tags: ["expired", "expire", "dead", "stale", "cannot", "sell"],
  },
  {
    id: "discount",
    title: "How the discount is calculated",
    text: "The contract records what the first buyer paid for each pass. A resale price is compared against that recorded original, which is why the marketplace can say '50% below original' without inventing the number. A pass that was issued directly rather than sold has no original price, and shows no discount rather than showing zero.",
    tags: ["discount", "steal", "below", "original", "cheap", "percent", "price"],
  },
  {
    id: "tech",
    title: "How it is built",
    text: "The contract is written in Rust and deployed to Arbitrum Sepolia using Arbitrum Stylus. The frontend is Next.js with wagmi and viem. There is no backend server and no database -- the chain is the only source of truth, and the marketplace reads it directly rather than depending on an indexer.",
    tags: ["tech", "rust", "stylus", "arbitrum", "built", "stack", "architecture", "contract"],
  },
  {
    id: "not-erc721",
    title: "Why it is not ERC-721",
    text: "The contract deliberately does not implement ERC-721. It has no approvals, no operators, no enumeration, and it emits PassTransferred rather than the ERC-721 Transfer signature. Emitting Transfer would advertise an interface the contract does not implement, and wallets and indexers would believe it. Resale goes through the contract's own buy function instead.",
    tags: ["erc721", "erc-721", "nft", "standard", "transfer", "wallet"],
  },
  {
    id: "issuer",
    title: "Becoming an issuer",
    text: "Only addresses on the contract's issuer allowlist can publish plans or mint passes. The admin who deployed the contract controls that allowlist. An address that is not on it will have its transaction reverted, so the issuer console checks first and says so up front.",
    tags: ["issuer", "allowlist", "admin", "publish", "permission", "create"],
  },
  {
    id: "safety",
    title: "Testnet only",
    text: "Liquid Pass runs on Arbitrum Sepolia, a test network. The ETH involved has no monetary value. Nothing here is an investment, and passes are access to a service rather than a financial instrument.",
    tags: ["testnet", "sepolia", "real", "money", "investment", "risk", "safe"],
  },
  {
    id: "use",
    title: "Where a pass can be used",
    text: "Holding a pass is the access. The Use Pass page lists the three places it works: LiquidDesk, a sample online product that unlocks for a wallet holding a valid pass; the QR check-in, for physical venues; and the Verify page, which shows who holds access to any pass. All three read the same contract, so when a pass is sold or gifted they stop working for the old holder and start working for the new one, with the same expiry.",
    tags: ["use", "using", "unlock", "access", "where", "works", "gateway", "open"],
  },
  {
    id: "liquiddesk",
    title: "LiquidDesk, the sample app a pass unlocks",
    text: "LiquidDesk is a separate sample SaaS product at desk.liquidpass.xyz. You sign in with your wallet by signing a one-time message, which is free and sends no transaction. Its server then reads the pass contract and unlocks the Pro workspace, a tool that condenses notes into key points, only while your wallet holds an active pass. It re-checks every few seconds, so if you sell or gift the pass it locks for you and unlocks for the new holder. It keeps no user database and no passwords.",
    tags: ["liquiddesk", "desk", "app", "saas", "unlock", "workspace", "pro", "sign", "sample"],
  },
  {
    id: "checkin",
    title: "Checking in at a venue with a QR code",
    text: "The check-in is for gyms, co-working spaces and events. The venue opens the scanner page, which shows a QR code holding a one-time challenge that changes every 2 minutes. The pass holder scans it, picks a pass and signs the challenge with their wallet; signing is free and sends no transaction. The scanner works out which wallet signed and reads the contract to confirm that wallet holds an active pass, then shows admit or do not admit. Each code is accepted once, so a screenshot cannot be reused.",
    tags: ["check", "checkin", "check-in", "qr", "venue", "door", "scanner", "scan", "gym", "event", "screenshot", "code"],
  },
  {
    id: "autosell",
    title: "Auto-sell rules",
    text: "In My Passes you can write a rule in plain English, such as: if I do not use my pass for 7 days, sell it for 0.001. A rule can watch the days left on a pass, a date, or how long the pass has gone unused. A pass counts as used when it unlocks LiquidDesk, when you sign a venue check-in with it, or when you verify it. Rules are kept in your own browser. When a rule fires it offers a one-click listing that you sign; nothing is ever listed without your signature.",
    tags: ["auto", "autosell", "auto-sell", "rule", "rules", "automatic", "unused", "idle", "watch", "remind"],
  },
  {
    id: "fairprice",
    title: "The suggested asking price",
    text: "When you open Sell remaining time on a pass, Liquid Pass suggests an asking price. It is calculated from the time left in proportion to the original price, and moved toward what past resales of the same plan actually sold for when there are any. Liquidity AI then explains the reasoning in two sentences; the server discards any explanation that contains a number not found in the chain data. You can accept the suggestion or type your own price, and you sign the listing yourself.",
    tags: ["price", "pricing", "fair", "suggest", "suggested", "asking", "advisor", "worth", "value", "how", "much"],
  },
  {
    id: "business",
    title: "How Liquid Pass makes money",
    text: "Liquid Pass earns only when unused time is resold. Planned revenue streams: a 2.5% marketplace fee on each resale, taken alongside the seller's share and the issuer's 10% royalty; Issuer Pro plans with revenue analytics, branding and promoted plans; a paid hosted Access Gateway API, with basic on-chain verification free; revenue share from card on-ramp partners; and an enterprise exchange for unused team seats. The fee is not charged yet: the deployed marketplace pays 90% to the seller and 10% to the issuer. At $100,000 of resales a month, a 2.5% fee earns Liquid Pass $2,500 while issuers earn $10,000 in royalties. The Business Model page shows the live figures.",
    tags: ["business", "model", "revenue", "money", "earn", "fee", "fees", "profit", "monetise", "monetize", "pricing", "sustainable"],
  },
];

/**
 * Keyword retrieval with a light scoring pass.
 *
 * Tag hits count more than body hits, and a document has to clear a floor to be
 * returned at all -- returning everything for an unmatched question would let
 * the model answer from loosely related context.
 */
export function retrieve(question: string, k = 4): Doc[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (!words.length) return [];

  const scored = KNOWLEDGE.map((doc) => {
    const hay = doc.text.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (doc.tags.includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.doc);
}
