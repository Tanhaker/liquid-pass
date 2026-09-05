/**
 * Liquid Pass popup.
 *
 * Plain JS, no bundler, no dependencies. Everything here is read-only: the
 * extension holds no keys and can only make eth_call requests. Buying and
 * selling happen on the website with the user's own wallet.
 *
 * Calldata is encoded by hand rather than pulling in a library. There are five
 * functions and they all take a single uint256 or address, so an ABI coder
 * would be more code than the encoding it replaces.
 */

const RPC = "https://sepolia-rollup.arbitrum.io/rpc";

/**
 * Two contracts, not one.
 *
 * This previously pointed every call at a single address, 0x22703fdd..., which
 * is a real but SUPERSEDED deployment of the core -- so the extension was
 * reading a different chain state than the website and quietly disagreed with
 * it. And `currentPrice` was being called against the core, which does not
 * implement it; that lives on the Marketplace. Listing prices in this popup
 * could therefore never have worked.
 *
 * Keep these in step with web/lib/contract.ts. A bundler would let the two
 * share one constant, and this extension deliberately has none.
 */
const CORE = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";
const MARKETPLACE = "0x63a9edec92baf3e74f19d301808c56104e786241";

const SITE = "https://web-tanmaygaming206-5537s-projects.vercel.app";

/**
 * Function selectors: first 4 bytes of keccak256 of the signature.
 *
 * Precomputed because Chrome's SubtleCrypto has no keccak256 -- it only offers
 * the SHA-2 family -- so hashing these at runtime would mean shipping a keccak
 * implementation for six constants that never change.
 */
const SEL = {
  nextTokenId: "0x75794a3c",
  ownerOf: "0x6352211e",
  expiryOf: "0xbaef73e9",
  planOf: "0x5e2246ee",
  priceOf: "0xb9186d7d",
  planName: "0xc10250ff",
  // The ask decays; priceOf is the opening figure, currentPrice is what a
  // buyer pays now. Both computed with keccak256 and checked on chain.
  currentPrice: "0x7a3c4c17",
  openingPrice: "0xd069ee42",
};

const $ = (id) => document.getElementById(id);

function pad32(hexNo0x) {
  return hexNo0x.padStart(64, "0");
}

function encUint(n) {
  return pad32(BigInt(n).toString(16));
}

function encAddr(a) {
  return pad32(a.toLowerCase().replace(/^0x/, ""));
}

async function call(data, to = CORE) {
  const res = await fetch(RPC, {
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

/** Decodes a single dynamic `string` return value. */
function asString(hex) {
  if (!hex || hex === "0x") return "";
  const body = hex.slice(2);
  // [0] offset, [1] length, then the bytes.
  const len = parseInt(body.slice(64, 128), 16);
  if (!len) return "";
  const bytes = body.slice(128, 128 + len * 2);
  return decodeURIComponent(bytes.replace(/(..)/g, "%$1"));
}

function fmtEth(wei) {
  if (wei === 0n) return "0";
  const s = (Number(wei) / 1e18).toFixed(6);
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

function timeLeft(expiry) {
  const secs = Number(expiry) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return { text: "expired", tone: "dead", frac: 0 };
  const d = Math.floor(secs / 86400);
  if (d >= 1) return { text: `${d} day${d === 1 ? "" : "s"}`, tone: d <= 3 ? "crit" : d <= 7 ? "low" : "ok", frac: 1 };
  const h = Math.floor(secs / 3600);
  return { text: `${h} hour${h === 1 ? "" : "s"}`, tone: "crit", frac: 1 };
}

async function loadFor(address) {
  $("state").textContent = "Reading chain…";
  $("list").innerHTML = "";

  const total = Number(asBigInt(await call(SEL.nextTokenId)));
  if (!total) {
    $("state").textContent = "No passes have been issued yet.";
    return;
  }

  const mine = [];
  for (let i = 0; i < total; i++) {
    const owner = asAddress(await call(SEL.ownerOf + encUint(i)));
    if (owner.toLowerCase() !== address.toLowerCase()) continue;
    const expiry = asBigInt(await call(SEL.expiryOf + encUint(i)));
    const planId = asBigInt(await call(SEL.planOf + encUint(i)));
    // Marketplace, not core -- see the note on the addresses above.
    const listed = asBigInt(
      await call(SEL.currentPrice + encUint(i), MARKETPLACE),
    );
    let name = `Pass #${i}`;
    try {
      const n = asString(await call(SEL.planName + encUint(planId)));
      if (n) name = n;
    } catch {
      // A plan name is a nicety; the pass still renders without it.
    }
    mine.push({ id: i, expiry, listed, name });
  }

  if (!mine.length) {
    $("state").textContent = "This address doesn't own any passes.";
    return;
  }

  // Soonest to expire first -- that is the one the user needs to act on.
  mine.sort((a, b) => Number(a.expiry - b.expiry));
  $("state").textContent = `${mine.length} pass${mine.length === 1 ? "" : "es"}`;

  for (const p of mine) {
    const t = timeLeft(p.expiry);
    const li = document.createElement("li");
    li.className = "pass";
    li.innerHTML = `
      <div class="row">
        <span class="name"></span>
        <span class="time ${t.tone}"></span>
      </div>
      <div class="meta">
        <span class="id"></span>
        <span class="listed"></span>
      </div>`;
    li.querySelector(".name").textContent = p.name;
    li.querySelector(".time").textContent = t.text;
    li.querySelector(".id").textContent = `#${p.id}`;
    li.querySelector(".listed").textContent =
      p.listed > 0n ? `listed · ${fmtEth(p.listed)} ETH` : "";
    li.addEventListener("click", () => {
      chrome.tabs.create({ url: `${SITE}/pass/${p.id}` });
    });
    $("list").appendChild(li);
  }
}

async function main() {
  const { address } = await chrome.storage.local.get("address");
  if (address) {
    $("addr").value = address;
    try {
      await loadFor(address);
    } catch (e) {
      $("state").textContent = `Couldn't read the chain: ${e.message}`;
    }
  } else {
    $("state").textContent = "Paste an address to see its passes.";
  }

  $("go").addEventListener("click", async () => {
    const a = $("addr").value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
      $("state").textContent = "That doesn't look like an address.";
      return;
    }
    await chrome.storage.local.set({ address: a });
    try {
      await loadFor(a);
    } catch (e) {
      $("state").textContent = `Couldn't read the chain: ${e.message}`;
    }
  });

  $("market").addEventListener("click", () => chrome.tabs.create({ url: `${SITE}/market` }));
  $("dash").addEventListener("click", () => chrome.tabs.create({ url: `${SITE}/dashboard` }));
}

main();
