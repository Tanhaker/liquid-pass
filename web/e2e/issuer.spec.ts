import { test, expect, useMockWallet, recordedTxs, clearTxs, TEST_ACCOUNT } from "./fixtures/wallet";
import { decodeFunctionData, parseAbi } from "viem";

/**
 * Issuer authorisation.
 *
 * setIssuer() is how a SaaS company is allowed to create plans -- the B2B
 * onboarding step -- and it had no ABI entry and no UI at all, so the only way
 * to use it was hand-built calldata.
 *
 * The test account is the contract admin, which is what makes the management
 * form reachable here.
 */

const LIQUID_PASS = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";
const abi = parseAbi(["function setIssuer(address issuer, bool allowed)"]);

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

async function openIssuer(page: import("@playwright/test").Page) {
  await page.goto("/issuer", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Who is allowed to create plans/i)).toBeVisible({
    timeout: 30_000,
  });
}

test("shows this wallet's issuer status and the contract admin", async ({ page }) => {
  await openIssuer(page);

  // Both come from the chain, so neither should stay in its loading state.
  await expect(page.getByText(/AUTHORISED ISSUER|NOT AN ISSUER/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Contract admin/i)).toBeVisible();
  // The test account IS the admin, so the panel should say so.
  await expect(page.getByText("(you)")).toBeVisible({ timeout: 30_000 });
});

test("authorising sends setIssuer(address, true)", async ({ page }) => {
  await openIssuer(page);
  await clearTxs(page);

  await page.locator("#issuer-addr").fill("0x000000000000000000000000000000000000dEaD");
  await page.getByRole("button", { name: /^Authorise$/i }).click();

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 20_000 }).toBe(1);
  const [tx] = await recordedTxs(page);

  expect(tx.to.toLowerCase()).toBe(LIQUID_PASS);
  const decoded = decodeFunctionData({ abi, data: tx.data as `0x${string}` });
  expect(decoded.functionName).toBe("setIssuer");
  expect(String(decoded.args?.[0]).toLowerCase()).toBe(
    "0x000000000000000000000000000000000000dead",
  );
  expect(decoded.args?.[1]).toBe(true);
});

test("revoking sends setIssuer(address, false)", async ({ page }) => {
  await openIssuer(page);
  await clearTxs(page);

  await page.locator("#issuer-addr").fill(TEST_ACCOUNT);
  await page.getByRole("button", { name: /^Revoke$/i }).click();

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 20_000 }).toBe(1);
  const [tx] = await recordedTxs(page);
  const decoded = decodeFunctionData({ abi, data: tx.data as `0x${string}` });
  expect(decoded.functionName).toBe("setIssuer");
  expect(decoded.args?.[1]).toBe(false);
});

/**
 * The contract rejects the zero address. Catching it here saves a wallet
 * prompt and a failed transaction.
 */
test("refuses the zero address without asking the wallet", async ({ page }) => {
  await openIssuer(page);
  await clearTxs(page);

  await page.locator("#issuer-addr").fill("0x0000000000000000000000000000000000000000");
  await page.getByRole("button", { name: /^Authorise$/i }).click();

  await expect(page.getByText(/zero address can't be an issuer/i)).toBeVisible();
  expect(await recordedTxs(page)).toHaveLength(0);
});

test("refuses input that isn't an address", async ({ page }) => {
  await openIssuer(page);
  await clearTxs(page);

  await page.locator("#issuer-addr").fill("not-an-address");
  await page.getByRole("button", { name: /^Authorise$/i }).click();

  await expect(page.getByText(/doesn't look like an address/i)).toBeVisible();
  expect(await recordedTxs(page)).toHaveLength(0);
});
