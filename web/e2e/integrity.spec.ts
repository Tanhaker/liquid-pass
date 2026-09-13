import { test, expect, useMockWallet, recordedTxs } from "./fixtures/wallet";
import type { Page } from "@playwright/test";
import { decodeFunctionData, parseAbi } from "viem";
import { planOrdinals } from "../lib/planOrdinals";

/**
 * Fixes from one round of user reports, each checked against the behaviour
 * that was reported rather than against the implementation.
 */

const REQUESTS = "0xc4f2ceef3668a3fd878df7dd4ec12f0cfb93b766";
/** A real wallet that holds a pass but is NOT an issuer on the live core. */
const NON_ISSUER = "0xedeAA9e50141bF17927E0e39Faadb22926fa49a5";

/** Answer every synthetic (0xfeed…) receipt as REVERTED. */
async function revertFakeReceipts(page: Page) {
  await page.route(
    (url) => url.href.startsWith("https://sepolia-rollup.arbitrum.io/rpc"),
    async (route) => {
      const raw = route.request().postData() ?? "";
      if (!(raw.includes("eth_getTransactionReceipt") && raw.includes("0xfeed"))) return route.fallback();
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
          to: null,
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
    },
  );
}

test.describe("with the test wallet", () => {
  test.beforeEach(async ({ page }) => {
    await useMockWallet(page);
  });

  /**
   * The reported bug: MetaMask showed a buy as failed while the site said it
   * went through. A reverted transaction still has a receipt, and the site
   * treated "a receipt arrived" as success.
   */
  test("a reverted transaction is reported as failed, never confirmed", async ({ page }) => {
    test.setTimeout(120_000);
    await revertFakeReceipts(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const card = page
      .locator("div.bg-dark-card[data-token-id]")
      .filter({ hasNot: page.locator("text=LISTED") })
      .first();
    await expect(card).toBeVisible({ timeout: 40_000 });
    await card.getByRole("button", { name: "Split", exact: true }).click();
    await card.locator('input[id^="s-"]').fill("2");
    await card.getByRole("button", { name: "Split into 2", exact: true }).click();

    await expect(page.getByText("TX_ERROR")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText(/failed on-chain/i).first()).toBeVisible();
    await expect(page.getByText("TX_CONFIRMED")).toHaveCount(0);
  });

  /**
   * Every listing on the market is owned by this wallet, which is why the
   * reported buy failed: the contract refuses to sell a pass to its owner.
   */
  test("your own listings offer no buy button", async ({ page }) => {
    await page.goto("/market", { waitUntil: "domcontentloaded" });
    const cards = page.locator("[data-token-id]");
    await expect(cards.first()).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText("Your listing", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /acquire pass/i })).toHaveCount(0);
    expect(await recordedTxs(page)).toHaveLength(0);
  });

  test("the admin sees the plan tools and the request inbox", async ({ page }) => {
    await page.goto("/issuer", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("AUTHORISED ISSUER")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText("Create New Subscription Plan")).toBeVisible();
    await expect(page.getByText("Live On-Chain Plans")).toBeVisible();
    await expect(page.getByText(/Access requests \(\d+\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Request access" })).toHaveCount(0);

    // The plan list scrolls inside its card instead of growing the page.
    const list = page.locator(".mini-scroll").last();
    await expect(list).toHaveCSS("overflow-y", "auto");
  });
});

test.describe("with a wallet that is not an issuer", () => {
  test.beforeEach(async ({ page }) => {
    await useMockWallet(page, NON_ISSUER);
  });

  test("sees no plan tools, and can request access on-chain", async ({ page }) => {
    await page.goto("/issuer", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("NOT AN ISSUER")).toBeVisible({ timeout: 40_000 });

    await expect(page.getByText("Create New Subscription Plan")).toHaveCount(0);
    await expect(page.getByText("Live On-Chain Plans")).toHaveCount(0);

    await page.locator("#req-company").fill("Acme AI");
    await page.locator("#req-note").fill("Monthly plans for our API");
    await page.getByRole("button", { name: "Request access" }).click();

    await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 30_000 }).toBe(1);
    const [tx] = await recordedTxs(page);
    expect(tx.to.toLowerCase()).toBe(REQUESTS);
    const d = decodeFunctionData({
      abi: parseAbi(["function request(string company, string note)"]),
      data: tx.data as `0x${string}`,
    });
    expect(d.functionName).toBe("request");
    expect(d.args).toEqual(["Acme AI", "Monthly plans for our API"]);
  });
});

test("the nav runs Market, My Passes, Explorer, Issuer, Analytics, Verify, with Passkey by the wallet", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the desktop nav is hidden on mobile");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const labels = await page.locator("header nav a").allInnerTexts();
  expect(labels.map((l) => l.trim())).toEqual(["MARKET", "MY PASSES", "EXPLORER", "ISSUER", "ANALYTICS", "VERIFY"]);

  const passkey = page.locator('header a[href="/passkey"]');
  const demo = page.getByRole("button", { name: /DEMO:/ });
  const wallet = page.getByRole("button", { name: /connect wallet/i });
  await expect(passkey).toBeVisible();
  const [p, d, w] = await Promise.all([passkey.boundingBox(), demo.boundingBox(), wallet.boundingBox()]);
  expect(p!.x).toBeGreaterThan(d!.x);
  expect(p!.x).toBeLessThan(w!.x);
});

test("same-plan listings are numbered within their plan", () => {
  const n = planOrdinals([
    { tokenId: 9n, planId: 4n },
    { tokenId: 2n, planId: 1n },
    { tokenId: 5n, planId: 4n },
    { tokenId: 7n, planId: 4n },
  ]);
  // Plan 4 has three listings, numbered oldest token first.
  expect(n.get("5")).toBe(1);
  expect(n.get("7")).toBe(2);
  expect(n.get("9")).toBe(3);
  // A plan with one listing is not numbered.
  expect(n.has("2")).toBe(false);
});
