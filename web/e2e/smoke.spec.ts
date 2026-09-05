import { test, expect } from "./fixtures/wallet";

/**
 * Every route loads, renders its heading, and throws nothing.
 *
 * Deliberately run with NO wallet injected: that is how most visitors arrive,
 * and a page that only works once a wallet is present is broken for almost
 * everyone who sees it.
 */

const ROUTES = [
  { path: "/", heading: /buy time|liquid ?pass|resell/i },
  { path: "/market", heading: /resale marketplace/i },
  { path: "/dashboard", heading: /.+/ },
  { path: "/issuer", heading: /issuer console/i },
  { path: "/analytics", heading: /.+/ },
  { path: "/explorer", heading: /.+/ },
  { path: "/verify", heading: /verify pass/i },
  { path: "/passkey", heading: /passkey verifier/i },
  { path: "/assistant", heading: /.+/ },
];

/**
 * Noise that is not the app's fault and would otherwise fail every page:
 * absent WalletConnect/RPC keys in local dev, and Next's dev-only warnings.
 */
const IGNORABLE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /status of 4\d\d/i,
  /WalletConnect/i,
  /Download the React DevTools/i,
  /react-devtools/i,
  /pino-pretty/i,
  /async-storage/i,
  /\[Fast Refresh\]/i,
];

const meaningful = (msgs: string[]) =>
  msgs.filter((m) => !IGNORABLE.some((re) => re.test(m)));

for (const route of ROUTES) {
  test(`${route.path} renders without errors`, async ({ page, errors }) => {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route.path} HTTP status`).toBeLessThan(400);

    // The app is client-rendered, so wait for the heading rather than load.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("h1").first()).toHaveText(route.heading);

    expect(meaningful(errors.page), `${route.path} page errors`).toEqual([]);
    expect(meaningful(errors.console), `${route.path} console errors`).toEqual([]);
  });
}

test("no route leaves a dangling loading state", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });
  // Either listings or the empty state must resolve; "Reading active
  // listings..." forever means the data layer failed silently.
  await expect(
    page.getByText(/Reading active listings/i),
  ).toBeHidden({ timeout: 45_000 });
});
