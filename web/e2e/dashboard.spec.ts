import { test, expect, useMockWallet, recordedTxs, clearTxs } from "./fixtures/wallet";
import { decodeFunctionData, parseAbi } from "viem";

/**
 * The dashboard panels that had been written but rendered on no page.
 *
 * The point of these assertions is not that a button exists -- it is that
 * pressing it produces the RIGHT transaction: the right contract, the right
 * function, the right arguments. A button wired to the wrong ABI looks
 * completely fine on screen and can only ever revert.
 */

const LIQUID_PASS = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";

const abi = parseAbi([
  "function transferPass(address to, uint256 tokenId)",
  "function split(uint256 tokenId, uint256 parts)",
  "function bundle(uint256[] tokenIds)",
]);

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

/**
 * The card for a pass that is NOT listed.
 *
 * Splitting burns the original, so GiftSplit disables it while a pass is on
 * the market -- correctly. Most of this account's passes are listed, so a test
 * that grabs "the first Split button" grabs a disabled one and silently does
 * nothing.
 */
function unlistedCard(page: import("@playwright/test").Page) {
  return page
    .locator("div.bg-dark-card")
    .filter({ hasText: /TOKEN #/ })
    .filter({ hasNot: page.locator("text=LISTED") })
    .first();
}

async function openDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  // Wallet connection is asynchronous; the vault header reflects it.
  await expect(page.getByText(/HELD PASSES:/i)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => page.locator("text=/TOKEN #\\d+/").count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
}

test("the mock wallet connects and the vault lists real passes", async ({ page }) => {
  await openDashboard(page);
  const cards = await page.locator("text=/TOKEN #\\d+/").count();
  expect(cards).toBeGreaterThan(0);
});

test("gift and split controls are reachable on a pass", async ({ page }) => {
  await openDashboard(page);
  const card = unlistedCard(page);
  await expect(card.getByRole("button", { name: "Gift", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Split", exact: true })).toBeEnabled();
});

test("split sends split(tokenId, parts) to the Stylus contract", async ({ page }) => {
  await openDashboard(page);
  await clearTxs(page);

  const card = unlistedCard(page);
  await card.getByRole("button", { name: "Split", exact: true }).click();

  const parts = card.locator('input[id^="s-"]');
  await expect(parts).toBeVisible();
  await parts.fill("3");

  // The confirm button reads "Split into 3" once a count is entered.
  const confirm = card.getByRole("button", { name: "Split into 3", exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 20_000 }).toBe(1);
  const [tx] = await recordedTxs(page);

  expect(tx.to.toLowerCase()).toBe(LIQUID_PASS);
  const decoded = decodeFunctionData({ abi, data: tx.data as `0x${string}` });
  expect(decoded.functionName).toBe("split");
  expect(decoded.args?.[1]).toBe(3n);
});

test("gift sends transferPass(to, tokenId) to the Stylus contract", async ({ page }) => {
  await openDashboard(page);
  await clearTxs(page);

  const card = unlistedCard(page);
  await card.getByRole("button", { name: "Gift", exact: true }).click();

  const to = card.locator("input").first();
  await expect(to).toBeVisible();
  await to.fill("0x000000000000000000000000000000000000dEaD");
  await card.getByRole("button", { name: /^Send$/i }).click();

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 20_000 }).toBe(1);
  const [tx] = await recordedTxs(page);

  expect(tx.to.toLowerCase()).toBe(LIQUID_PASS);
  const decoded = decodeFunctionData({ abi, data: tx.data as `0x${string}` });
  expect(decoded.functionName).toBe("transferPass");
  expect(String(decoded.args?.[0]).toLowerCase()).toBe(
    "0x000000000000000000000000000000000000dead",
  );
});

test("the auto-sell panel renders and claims nothing it cannot do", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByText(/auto-?sell/i).first()).toBeVisible();

  // Regression guard. This panel used to carry a "Powered by ZeroDev" badge
  // and an "Issue Session Key" button that was an alert() and nothing else.
  // Account abstraction is out of scope, so neither should ever come back.
  await expect(page.getByRole("button", { name: /session key/i })).toHaveCount(0);
  await expect(page.getByText(/powered by zerodev/i)).toHaveCount(0);
});

test("the yield panel stays hidden while no escrow is deployed", async ({ page }) => {
  await openDashboard(page);
  // ESCROW_ADDRESS is still the literal "0x". Showing a dead Aave panel would
  // be worse than showing nothing.
  await expect(page.getByText(/Aave|lockedBalances|Claim Yield/i)).toHaveCount(0);
});
