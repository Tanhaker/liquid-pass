import { test, expect, useMockWallet, recordedTxs, clearTxs } from "./fixtures/wallet";
import { decodeFunctionData, parseAbi } from "viem";

/**
 * Gifting a listed pass must clear the listing first.
 *
 * transferPass() never touched the Marketplace, so a listing survived the pass
 * changing hands, and Marketplace.buy() sells whoever holds the pass now. Gift
 * a listed pass and anyone could buy it from the recipient at the price the
 * original owner set. Reproduced against the real contracts in
 * contracts/test/CrossContract.test.js.
 *
 * Tokens 2-5 are genuinely listed on Arbitrum Sepolia and token 1 is not, so
 * both branches run against real chain state.
 */

const MARKETPLACE = "0x63a9edec92baf3e74f19d301808c56104e786241";
const LIQUID_PASS = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";

const abi = parseAbi([
  "function unlist(uint256 tokenId)",
  "function transferPass(address to, uint256 tokenId)",
]);

const decode = (data?: string) => decodeFunctionData({ abi, data: data as `0x${string}` });

async function openDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-token-id]").first()).toBeVisible({ timeout: 40_000 });
}

function card(page: import("@playwright/test").Page, listed: boolean) {
  const base = page.locator("div.bg-dark-card[data-token-id]");
  return (listed
    ? base.filter({ has: page.locator("text=LISTED") })
    : base.filter({ hasNot: page.locator("text=LISTED") })
  ).first();
}

async function gift(page: import("@playwright/test").Page, listed: boolean) {
  const c = card(page, listed);
  await c.getByRole("button", { name: "Gift", exact: true }).click();
  await c.locator("input").first().fill(RECIPIENT);
  await c.getByRole("button", { name: /^Send$/i }).click();
  return c;
}

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

test("gifting a listed pass unlists it first, then transfers", async ({ page }) => {
  test.setTimeout(120_000);
  await openDashboard(page);
  await clearTxs(page);

  await gift(page, true);

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 40_000 }).toBe(2);
  const [first, second] = await recordedTxs(page);

  // Order is the whole point: the listing has to be gone BEFORE the pass moves.
  expect(first.to.toLowerCase()).toBe(MARKETPLACE);
  expect(decode(first.data).functionName).toBe("unlist");

  expect(second.to.toLowerCase()).toBe(LIQUID_PASS);
  const t = decode(second.data);
  expect(t.functionName).toBe("transferPass");
  expect(String(t.args?.[0]).toLowerCase()).toBe(RECIPIENT.toLowerCase());

  // Same token in both.
  expect(decode(first.data).args?.[0]).toBe(t.args?.[1]);
});

test("the listed pass warns about the second confirmation up front", async ({ page }) => {
  await openDashboard(page);
  const c = card(page, true);
  await c.getByRole("button", { name: "Gift", exact: true }).click();
  await expect(c.getByText(/two confirmations in your wallet/i)).toBeVisible();
});

test("an unlisted pass is transferred directly, with no needless unlist", async ({ page }) => {
  test.setTimeout(120_000);
  await openDashboard(page);
  await clearTxs(page);

  await gift(page, false);

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 40_000 }).toBe(1);
  const [only] = await recordedTxs(page);
  expect(only.to.toLowerCase()).toBe(LIQUID_PASS);
  expect(decode(only.data).functionName).toBe("transferPass");
});

/**
 * The guard that makes the fix a fix. If the unlist fails and the transfer is
 * sent anyway, that is the original bug with an extra prompt.
 */
test("if the unlist fails, the pass is never transferred", async ({ page }) => {
  test.setTimeout(120_000);

  // Answer the unlist receipt as REVERTED.
  await page.route(
    (url) => url.href.startsWith("https://sepolia-rollup.arbitrum.io/rpc"),
    async (route) => {
      const raw = route.request().postData() ?? "";
      if (raw.includes("eth_getTransactionReceipt") && raw.includes("0xfeed")) {
        const body = JSON.parse(raw);
        const one = (c: { id: number; params: string[] }) => ({
          jsonrpc: "2.0",
          id: c.id,
          result: {
            transactionHash: c.params[0],
            transactionIndex: "0x0",
            blockHash: "0x" + "ab".repeat(32),
            blockNumber: "0x1",
            from: "0x0000000000000000000000000000000000000000",
            to: MARKETPLACE,
            cumulativeGasUsed: "0x5208",
            gasUsed: "0x5208",
            contractAddress: null,
            logs: [],
            logsBloom: "0x" + "00".repeat(256),
            status: "0x0",
            effectiveGasPrice: "0x1",
            type: "0x2",
          },
        });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)),
        });
      }
      return route.fallback();
    },
  );

  await openDashboard(page);
  await clearTxs(page);

  const c = await gift(page, true);

  await expect(c.getByText(/Couldn.t remove the listing/i).or(
    page.getByText(/Couldn.t remove the listing/i),
  ).first()).toBeVisible({ timeout: 40_000 });

  const txs = await recordedTxs(page);
  // The unlist was attempted...
  expect(txs.length).toBe(1);
  expect(decode(txs[0].data).functionName).toBe("unlist");
  // ...and nothing followed it.
  expect(txs.some((t) => decode(t.data).functionName === "transferPass")).toBe(false);
});
