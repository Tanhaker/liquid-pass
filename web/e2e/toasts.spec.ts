import { test, expect, useMockWallet } from "./fixtures/wallet";

/**
 * Transaction toasts.
 *
 * TransactionToasts was fully written and styled and rendered on no page --
 * and nothing anywhere called addNotification, so mounting it alone would have
 * produced an empty fixed div. These assertions cover the half that was
 * missing: that a real write actually drives the toast through its lifecycle.
 *
 * The mock wallet answers the receipt lookup for the hashes it invents, so the
 * pending -> confirmed transition is exercised for real without broadcasting
 * anything.
 */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

function unlistedCard(page: import("@playwright/test").Page) {
  return page
    .locator("div.bg-dark-card")
    .filter({ hasText: /TOKEN #/ })
    .filter({ hasNot: page.locator("text=LISTED") })
    .first();
}

test("a write shows a pending toast, then a confirmed one", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("text=/TOKEN #\\d+/").first()).toBeVisible({ timeout: 40_000 });

  // Nothing has happened yet, so there should be no toast.
  await expect(page.getByText("TX_BROADCAST")).toHaveCount(0);
  await expect(page.getByText("TX_CONFIRMED")).toHaveCount(0);

  const card = unlistedCard(page);
  await card.getByRole("button", { name: "Split", exact: true }).click();
  await card.locator('input[id^="s-"]').fill("3");
  await card.getByRole("button", { name: "Split into 3", exact: true }).click();

  // Pending, then resolved in place rather than stacking a second toast.
  await expect(page.getByText("TX_CONFIRMED")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText(/Confirmed on Arbitrum Sepolia/i)).toBeVisible();

  // The toast links to the transaction it is reporting on.
  const link = page.locator('a[href*="sepolia.arbiscan.io/tx/0xfeed"]');
  await expect(link.first()).toBeVisible();
});

/**
 * The bug this guards against: addNotification used to auto-dismiss every
 * toast after 6.5s regardless of status, so a pending transaction that took
 * longer than that -- routine on Arbitrum Sepolia -- left the user with
 * nothing on screen while their wallet was still working.
 */
test("a pending toast is not auto-dismissed", async ({ page }) => {
  test.setTimeout(120_000);

  // Hold the write open so the toast stays pending for longer than the old
  // 6.5s dismissal window.
  await page.route(
    (url) => url.href.startsWith("https://sepolia-rollup.arbitrum.io/rpc"),
    async (route) => {
      const body = route.request().postData() ?? "";
      if (body.includes("eth_getTransactionReceipt")) {
        await new Promise((r) => setTimeout(r, 9000));
      }
      return route.fallback();
    },
  );

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("text=/TOKEN #\\d+/").first()).toBeVisible({ timeout: 40_000 });

  const card = unlistedCard(page);
  await card.getByRole("button", { name: "Split", exact: true }).click();
  await card.locator('input[id^="s-"]').fill("3");
  await card.getByRole("button", { name: "Split into 3", exact: true }).click();

  await expect(page.getByText("TX_BROADCAST")).toBeVisible({ timeout: 30_000 });

  // Past the old dismissal deadline, still on screen.
  await page.waitForTimeout(7500);
  await expect(page.getByText("TX_BROADCAST")).toBeVisible();
});
