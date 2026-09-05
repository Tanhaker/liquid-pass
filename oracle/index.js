require("dotenv").config();
const express = require("express");

/**
 * Liquid Pass — usage signal service.
 *
 * WHAT THIS IS
 * ------------
 * A small service that receives "the user was last active at T" webhooks from
 * a SaaS product, checks the pass on chain, and reports whether the holder
 * looks like they have stopped using it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It does not sell anything and it cannot. It holds no key, signs nothing and
 * broadcasts nothing. It emits a recommendation; a human presses the button on
 * the website, which is the same contract the Auto-Sell panel there honours.
 *
 * This file previously claimed otherwise. It advertised ZeroDev session keys
 * and ERC-4337 execution, and returned a hardcoded `txHash:
 * "0xMockTxHash...4337"` for a sale that never happened. It also did not run at
 * all: `ethers` and `dotenv` were each required twice, so Node refused to load
 * it with "Identifier 'ethers' has already been declared", and `express` was
 * never in package.json. Account abstraction is explicitly out of scope for
 * this project, so the claims are gone rather than implemented.
 *
 * The inactivity test is a threshold on elapsed time. That is genuinely all it
 * is, and it is described that way below rather than as a prediction.
 */

const app = express();
app.use(express.json());

const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const CORE = (process.env.LIQUID_PASS_ADDRESS ||
  "0xac20ef73723e7c620df1024eb04cc0b71fca1055").toLowerCase();

/** Days of silence after which a pass is worth flagging. */
const IDLE_DAYS = Number(process.env.IDLE_DAYS || 3);

/**
 * Function selectors: keccak256 of the signature, first 4 bytes.
 * Both verified against the deployed contract rather than assumed.
 */
const SEL = {
  ownerOf: "0x6352211e",
  expiryOf: "0xbaef73e9",
};

const encUint = (n) => BigInt(n).toString(16).padStart(64, "0");

async function ethCall(data, to = CORE) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const asBigInt = (hex) => (hex && hex !== "0x" ? BigInt(hex) : 0n);
const asAddress = (hex) => "0x" + hex.slice(-40);

/**
 * POST /webhook/usage
 *   { tokenId: "3", lastActiveAt: "2026-09-01T10:00:00Z" }
 *
 * Answers with a recommendation and the on-chain facts behind it, so the
 * caller can see why rather than taking the verdict on trust.
 */
app.post("/webhook/usage", async (req, res) => {
  const { tokenId, lastActiveAt } = req.body || {};

  if (tokenId === undefined || !lastActiveAt) {
    return res.status(400).json({ error: "tokenId and lastActiveAt are required" });
  }

  const last = Date.parse(lastActiveAt);
  if (Number.isNaN(last)) {
    return res.status(400).json({ error: "lastActiveAt must be an ISO 8601 timestamp" });
  }

  let owner, expiry;
  try {
    [owner, expiry] = await Promise.all([
      ethCall(SEL.ownerOf + encUint(tokenId)).then(asAddress),
      ethCall(SEL.expiryOf + encUint(tokenId)).then(asBigInt),
    ]);
  } catch (e) {
    // A chain read failing is not a reason to recommend selling something.
    return res.status(502).json({ error: "chain read failed: " + e.message });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const secondsLeft = Number(expiry) - nowSec;
  const idleDays = (Date.now() - last) / 86_400_000;

  if (owner === "0x" + "0".repeat(40)) {
    return res.json({ tokenId: String(tokenId), action: "UNKNOWN_TOKEN" });
  }

  const expired = secondsLeft <= 0;
  const idle = idleDays >= IDLE_DAYS;

  res.json({
    tokenId: String(tokenId),
    owner,
    secondsLeft: Math.max(0, secondsLeft),
    idleDays: Number(idleDays.toFixed(2)),
    threshold: IDLE_DAYS,
    action: expired ? "EXPIRED" : idle ? "RECOMMEND_LIST" : "MONITORING",
    // Stated on every response so no caller can mistake this for a trade.
    note: "Advisory only. This service holds no key and broadcasts no transaction.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, rpc: RPC_URL, core: CORE, idleDays: IDLE_DAYS });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Liquid Pass usage signal service on :${PORT}`);
    console.log(`Reading ${CORE} via ${RPC_URL}`);
    console.log("Advisory only - no keys, no signing, no broadcasting.");
  });
}

module.exports = app;
