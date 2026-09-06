import { test, expect, useMockWallet } from "./fixtures/wallet";

/**
 * Usage logging — the input the idle auto-sell rule depends on.
 *
 * lib/autosell's evaluate() reads lastUsed(tokenId) for "sell if unused for N
 * days" rules, and nothing anywhere called markUsed(). So lastUsed always
 * returned null and that rule could never fire, while the panel told people to
 * "verify it once and the idle clock starts". markUsed's own doc comment said
 * "Called by /verify", which was aspirational.
 */

const USE_KEY = "liquid-pass-last-verified";

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

const readUsage = (page: import("@playwright/test").Page) =>
  page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  }, USE_KEY);

test("verifying an active pass starts its idle clock", async ({ page }) => {
  await page.goto("/verify", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /verify pass/i })).toBeVisible();

  expect(await readUsage(page)).toEqual({});

  // Token 1 exists and is active on Arbitrum Sepolia.
  //
  // Anchored on the placeholder and on the button's exact label rather than a
  // page-wide search: the nav collapses on narrow viewports and a loose
  // /verify/i match picks up the nav entry instead of the form.
  await page.getByPlaceholder("e.g. 0, 1, 2...").fill("1");
  await page.getByRole("button", { name: "VERIFY", exact: true }).click();

  await expect(page.getByText(/ACCESS GRANTED/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/idle clock for this pass starts now/i)).toBeVisible();

  const usage = await readUsage(page);
  expect(Object.keys(usage)).toContain("1");
  // Recorded as a timestamp, and a recent one.
  expect(usage["1"]).toBeGreaterThan(Date.now() - 120_000);
});

test("a token that does not exist records nothing", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/verify", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("e.g. 0, 1, 2...").fill("99999");
  await page.getByRole("button", { name: "VERIFY", exact: true }).click();

  // Asserts on the verdict rather than the exact sentence, and waits
  // generously. Three reads go to the public Arbitrum RPC on a cold browser
  // context and have taken well over 30s; a slow read also renders "Failed to
  // verify" rather than "does not exist", which is a different message but
  // the same verdict and the same invariant -- nothing was granted, so nothing
  // may be recorded.
  await expect(page.getByText(/ACCESS DENIED/i)).toBeVisible({ timeout: 90_000 });
  // Deliberately NOT asserting that "ACCESS GRANTED" is absent from the page:
  // the integration snippet this page displays carries the comment
  // "true = unexpired, access granted", so such a check fails on
  // documentation rather than on behaviour. The verdict above and the empty
  // log below are the actual invariant.
  expect(await readUsage(page)).toEqual({});
});
