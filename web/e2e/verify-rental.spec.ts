import { test, expect } from "./fixtures/wallet";
import type { Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult, getAddress, parseAbi } from "viem";

/**
 * /verify on a rented pass.
 *
 * While a pass is rented it is owned by the StreamRental contract, so ownerOf()
 * returns the contract rather than a person. Reading ownerOf alone, /verify
 * named the contract as the owner and granted access whenever the pass was
 * unexpired -- including when it sat in escrow with nobody renting it.
 *
 * No pass is escrowed on Arbitrum Sepolia yet, so the rental states cannot be
 * read from real chain data. These tests answer the specific eth_calls for one
 * synthetic token id with properly ABI-encoded results, and leave every other
 * read going to the live chain. A normal pass is checked against real state.
 */

const CORE = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";
const RENTAL = "0x3640ee44a5055ffd5fd17989ffd95ef478929616";
/*
 * Built with getAddress, not typed. "0x...A11CE" and "0x...B0B0" look fine and
 * are not valid EIP-55 checksums; viem refuses to encode them. That used to
 * throw inside the stub, get swallowed, and let the read fall through to the
 * real chain -- where token 4242 has no renter -- so the idle-escrow test
 * passed without the stub ever working.
 */
const OWNER = getAddress("0x00000000000000000000000000000000000a11ce");
const RENTER = getAddress("0x000000000000000000000000000000000000b0b0");
const ISSUER = getAddress("0x0000000000000000000000000000000000001555");
const ZERO = "0x0000000000000000000000000000000000000000";
const TOKEN = 4242n;

const coreAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function isActive(uint256) view returns (bool)",
  "function expiryOf(uint256) view returns (uint256)",
  "function issuerOf(uint256) view returns (address)",
]);
const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";
const multicallAbi = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calls) payable returns (Result[] returnData)",
]);

const rentalAbi = parseAbi([
  "function activeRenter(uint256) view returns (address)",
  "function streams(uint256) view returns (address owner, uint256 ratePerSecond, address renter, uint256 startedAt, uint256 deposit)",
]);

/** Answer this token's reads as an escrowed pass, with or without a renter. */
async function stubEscrowedPass(page: Page, renter: string) {
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 20 * 86400);

  /**
   * Decoding is the only thing allowed to fail quietly: a call that does not
   * decode against these ABIs, or is for a different token, is simply not
   * ours and goes to the real chain. Encoding an answer for OUR token must
   * never fail quietly -- a swallowed encode error is exactly what let a test
   * here pass while the stub did nothing.
   */
  const decodeOurs = <T extends typeof coreAbi | typeof rentalAbi>(abi: T, data: `0x${string}`) => {
    try {
      const d = decodeFunctionData({ abi, data });
      const args = d.args as readonly unknown[] | undefined;
      return args?.[0] === TOKEN ? d : null;
    } catch {
      return null;
    }
  };

  const answer = (to: string, data: `0x${string}`): `0x${string}` | null => {
    if (to === CORE) {
      const d = decodeOurs(coreAbi, data);
      if (!d) return null;
      const out = { ownerOf: RENTAL, isActive: true, expiryOf: expiry, issuerOf: ISSUER }[d.functionName];
      return encodeFunctionResult({ abi: coreAbi, functionName: d.functionName, result: out as never });
    }
    if (to === RENTAL) {
      const d = decodeOurs(rentalAbi, data);
      if (!d) return null;
      if (d.functionName === "activeRenter") {
        return encodeFunctionResult({ abi: rentalAbi, functionName: "activeRenter", result: renter as `0x${string}` });
      }
      return encodeFunctionResult({
        abi: rentalAbi,
        functionName: "streams",
        result: [OWNER, 1_000_000_000n, renter as `0x${string}`, 0n, 0n],
      });
    }
    return null;
  };

  /*
   * The app's client batches reads through Multicall3: all four of /verify's
   * readContract calls arrive as ONE eth_call to 0xca11... using aggregate3.
   * A stub that only matched calls addressed to the core never fired, and the
   * page quietly read the real chain instead -- where token 4242 does not
   * exist. So aggregate3 is decoded, each sub-call answered, and the result
   * re-encoded; a batch containing anything that is not ours is left alone.
   */
  const answerCall = (to: string, data: `0x${string}`): `0x${string}` | null => {
    if (to === MULTICALL3) {
      let subs: readonly { target: string; callData: `0x${string}` }[];
      try {
        subs = decodeFunctionData({ abi: multicallAbi, data }).args![0] as typeof subs;
      } catch {
        return null; // not an aggregate3 call
      }
      // Deliberately outside the try: an encode error here is a test bug.
      const each = subs.map((c) => answer(c.target.toLowerCase(), c.callData));
      if (each.some((r) => r === null)) return null;
      return encodeFunctionResult({
        abi: multicallAbi,
        functionName: "aggregate3",
        result: each.map((r) => ({ success: true, returnData: r! })),
      });
    }
    return answer(to, data);
  };

  await page.route(
    (url) => url.href.startsWith("https://sepolia-rollup.arbitrum.io/rpc"),
    async (route) => {
      const raw = route.request().postData();
      if (!raw) return route.fallback();
      const body = JSON.parse(raw);
      const calls = Array.isArray(body) ? body : [body];

      const results = calls.map((c: { id: number; method: string; params: [{ to: string; data: `0x${string}` }] }) =>
        c.method === "eth_call" ? answerCall(c.params[0].to.toLowerCase(), c.params[0].data) : null,
      );
      if (results.every((r) => r === null)) return route.fallback();

      // Mixed batches are not expected here; fall back if one appears.
      if (results.some((r) => r === null)) return route.fallback();

      const out = calls.map((c: { id: number }, i: number) => ({ jsonrpc: "2.0", id: c.id, result: results[i] }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(Array.isArray(body) ? out : out[0]),
      });
    },
  );
}

async function verify(page: Page, token: string) {
  await page.goto("/verify", { waitUntil: "domcontentloaded" });
  /*
   * Under full-suite load the form can be interacted with before React
   * hydrates it. Two ways that went wrong:
   *   - the click lands first: nothing is requested and the test waits out
   *     its whole timeout;
   *   - the fill lands first: the typed id never reaches React state, which
   *     starts at "0", so the click verifies token #0 -- a real verdict, for
   *     the wrong token.
   * So retry until the verdict is for THIS token, identified by the result
   * message ("Token #4242 is ...", "... has ...", "... exists ...").
   */
  await page.waitForFunction(() => {
    // React tags hydrated DOM nodes with __reactProps$...; before that, typing
    // into the input never reaches component state.
    const el = document.querySelector('input[placeholder="e.g. 0, 1, 2..."]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  }, undefined, { timeout: 60_000 });
  const ours = page.getByText(new RegExp(`^Token #${token} (is|has|exists|does)`));
  await expect(async () => {
    await page.getByPlaceholder("e.g. 0, 1, 2...").fill(token);
    await page.getByRole("button", { name: "VERIFY", exact: true }).click({ timeout: 2_000 });
    await expect(ours).toBeVisible({ timeout: 25_000 });
  }).toPass({ timeout: 110_000 });

  await expect(page.getByText(/VERIFIED: ACCESS (GRANTED|DENIED)/i)).toBeVisible();
}

const row = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]");

test.describe.configure({ retries: 1 });
// Page load, the hydration retry above and a verdict over the public RPC do
// not fit in the default 60s when the rest of the suite is running.
test.setTimeout(150_000);

test("a rented pass grants access to the renter, not the owner", async ({ page }) => {
  await stubEscrowedPass(page, RENTER);
  await verify(page, TOKEN.toString());

  await expect(page.getByText(/VERIFIED: ACCESS GRANTED/i)).toBeVisible();
  await expect(page.getByText(/being RENTED/i)).toBeVisible();

  // Access is the renter's.
  await expect(row(page, "Access holder:")).toHaveText(/b0b0$/i);
  await expect(row(page, "Custody:")).toHaveText("RENTAL ESCROW");
  // And the owner shown is the real owner, not the rental contract.
  // shortAddress renders first 6 + last 4, so match what is actually shown.
  await expect(row(page, "Owner:")).toHaveText(/11ce$/i);
  await expect(row(page, "Owner:")).not.toHaveText(/3640/);
});

/**
 * The correctness bug, not just a display one. The pass is unexpired, so the
 * old page said ACCESS GRANTED -- to a contract, with no human behind it.
 */
test("an escrowed pass nobody is renting grants access to no one", async ({ page }) => {
  await stubEscrowedPass(page, ZERO);
  await verify(page, TOKEN.toString());

  await expect(page.getByText(/VERIFIED: ACCESS DENIED/i)).toBeVisible();
  await expect(page.getByText(/nobody is renting it right now/i)).toBeVisible();
  await expect(row(page, "Access holder:")).toHaveText("NO ONE");
  await expect(row(page, "Rented by:")).toHaveText("nobody");

  // Proof the stub drove this result. The real chain has no stream for token
  // 4242 and would report the zero address as owner; only the stub returns
  // this one. An earlier version passed by reading the real chain instead.
  await expect(row(page, "Owner:")).toHaveText(/11ce$/i);

  // A denial must not start the idle-sell clock.
  await expect(page.getByText(/idle clock for this pass starts now/i)).toHaveCount(0);
});

test("an ordinary pass still grants access to its owner", async ({ page }) => {
  // Token 1 on the real chain: unlisted, unescrowed, owned by the test account.
  await verify(page, "1");

  await expect(page.getByText(/VERIFIED: ACCESS GRANTED/i)).toBeVisible();
  await expect(row(page, "Access holder:")).toHaveText(/0xf5ab/i);
  await expect(page.getByText("RENTAL ESCROW")).toHaveCount(0);
});

test("the integration snippet resolves the renter, not just isActive", async ({ page }) => {
  await page.goto("/verify", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/activeRenter/).first()).toBeVisible({ timeout: 30_000 });
});
