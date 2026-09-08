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

/*
 * Retried, unlike the rest of the suite.
 *
 * Both tests here drive the verify page, which fires three reads at the PUBLIC
 * Arbitrum Sepolia RPC. Everything else in this suite either reads through the
 * mock or reads once; these are the only tests whose result depends on a
 * third-party endpoint answering promptly, and under full-suite load it has
 * taken over 90 seconds. That is flakiness in someone else's infrastructure,
 * not in this app, and a retry is the right tool for it -- the assertions
 * themselves are unchanged and still have to pass.
 */
test.describe.configure({ retries: 2 });

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
  test.setTimeout(180_000);
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

  // Anchored on the verdict badge, which reads "VERIFIED: ACCESS GRANTED".
  // A page-wide /ACCESS GRANTED/i also matches the SDK snippet this page
  // displays ("true = unexpired, access granted"), so the loose version passed
  // even when the chain read had failed and nothing was granted at all -- which
  // is exactly how this test went green and then failed on the next assertion.
  //
  // The timeout is generous because three reads go to the public Arbitrum RPC
  // and have taken 15s+ when the machine is busy running the rest of the suite.
  await expect(page.getByText(/VERIFIED: ACCESS GRANTED/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/idle clock for this pass starts now/i)).toBeVisible({
    timeout: 15_000,
  });

  const usage = await readUsage(page);
  expect(Object.keys(usage)).toContain("1");
  // Recorded as a timestamp, and a recent one.
  expect(usage["1"]).toBeGreaterThan(Date.now() - 120_000);
});

test("a token that does not exist records nothing", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/verify", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("e.g. 0, 1, 2...").fill("99999");
  await page.getByRole("button", { name: "VERIFY", exact: true }).click();

  // Waits for the verdict panel to resolve at all, rather than for one exact
  // sentence.
  //
  // ownerOf() returns the zero address for an unknown id without reverting, so
  // this path is not inherently slow -- but all three reads go to the public
  // Arbitrum RPC, and inside the full suite that has taken over 90s. Whichever
  // way it resolves (the token does not exist, or the read itself failed) the
  // verdict is DENIED and the invariant is identical: nothing was granted, so
  // nothing may be logged.
  await expect(page.getByText(/VERIFIED: ACCESS (DENIED|GRANTED)/i)).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText(/VERIFIED: ACCESS DENIED/i)).toBeVisible();
  // Deliberately NOT asserting that "ACCESS GRANTED" is absent from the page:
  // the integration snippet this page displays carries the comment
  // "true = unexpired, access granted", so such a check fails on
  // documentation rather than on behaviour. The verdict above and the empty
  // log below are the actual invariant.
  expect(await readUsage(page)).toEqual({});
});
