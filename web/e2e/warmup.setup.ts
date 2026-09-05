import { test as setup, expect } from "@playwright/test";

/**
 * Compile every route before any spec runs.
 *
 * `next dev` compiles routes on demand. Playwright's webServer only waits for
 * `/` to answer, so the first spec to hit `/market` races that route's first
 * compile and can fetch a half-written chunk. The browser then reports
 * "Uncaught SyntaxError: Invalid or unexpected token", React never hydrates,
 * and the page sits in its loading state forever -- which looks exactly like
 * an application bug and is not one. Two hours of this session went into
 * proving that, so it is worth warming the routes properly.
 *
 * This runs as a setup project, not globalSetup, because setup projects are
 * guaranteed to run after webServer is up.
 */

const ROUTES = [
  "/",
  "/market",
  "/dashboard",
  "/issuer",
  "/analytics",
  "/explorer",
  "/verify",
  "/passkey",
  "/assistant",
];

setup("compile every route", async ({ page }) => {
  setup.setTimeout(300_000);

  for (const route of ROUTES) {
    const res = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120_000 });
    expect(res?.status(), `${route} failed to compile`).toBeLessThan(400);
    // A rendered h1 means the client bundle parsed and React mounted.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });
  }
});
