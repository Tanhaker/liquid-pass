import { test, expect } from "./fixtures/wallet";
import type { Locator, Page } from "@playwright/test";

/**
 * The market carousel.
 *
 * These assertions exist because the previous round of work fixed this rail but
 * could not prove it: requestAnimationFrame does not tick while the Claude
 * browser pane is hidden (measured: 0 frames/sec), so the drift could not be
 * timed and had to ship on structural reasoning alone. Playwright drives real
 * Chromium, so it can finally be measured.
 */

const RAIL = '[aria-label="Listed passes"]';

// Hover, drag and wheel are pointer concepts. On touch the rail deliberately
// hands scrolling back to the browser, so none of this applies.
test.skip(({ isMobile }) => !!isMobile, "pointer-driven rail behaviour is desktop-only");

async function railOrSkip(page: Page): Promise<Locator> {
  await page.goto("/market", { waitUntil: "domcontentloaded" });
  const rail = page.locator(RAIL);
  // The market reads live chain state; with nothing listed there is no rail.
  await expect
    .poll(async () => (await rail.count()) > 0, { timeout: 30_000 })
    .toBe(true);
  const overflows = await rail.evaluate((el) => el.scrollWidth - el.clientWidth > 4);
  test.skip(!overflows, "rail does not overflow at this viewport; nothing to scroll");
  return rail;
}

/** Parks the pointer well away from the rail so hover cannot pause the drift. */
async function unhover(page: Page) {
  await page.mouse.move(5, 5);
}

test("drifts on its own when idle", async ({ page }) => {
  const rail = await railOrSkip(page);
  await unhover(page);

  // Settle first: the drift yields for a beat after load and at each end.
  await page.waitForTimeout(1200);
  const start = await rail.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(2000);
  const end = await rail.evaluate((el) => el.scrollLeft);

  // 40px/sec nominal. Assert real movement without pinning the exact rate.
  expect(Math.abs(end - start)).toBeGreaterThan(20);
});

test("hovering holds it still", async ({ page }) => {
  const rail = await railOrSkip(page);
  await rail.hover();
  await page.waitForTimeout(300);

  const a = await rail.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(1500);
  const b = await rail.evaluate((el) => el.scrollLeft);

  expect(Math.abs(b - a)).toBeLessThan(2);
});

test("reverses at the end instead of snapping back to zero", async ({ page }) => {
  const rail = await railOrSkip(page);
  await unhover(page);

  // Park at the far end, then let the drift take over.
  const max = await rail.evaluate((el) => {
    const m = el.scrollWidth - el.clientWidth;
    el.scrollLeft = m;
    return m;
  });
  // Long enough to clear the 900ms turn-around pause and travel back.
  await page.waitForTimeout(2600);
  const after = await rail.evaluate((el) => el.scrollLeft);

  expect(after).toBeLessThan(max); // moved back...
  expect(after).toBeGreaterThan(max * 0.3); // ...rather than jumping to 0
});

test("drag tracks the cursor 1:1", async ({ page }) => {
  const rail = await railOrSkip(page);
  const box = (await rail.boundingBox())!;
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 60;

  await rail.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 60, y, { steps: 6 });
  await page.mouse.move(startX - 150, y, { steps: 6 });
  const during = await rail.evaluate((el) => el.scrollLeft);
  await page.mouse.up();

  // Dragged 150px left, so the rail should have advanced ~150px.
  expect(during).toBeGreaterThan(120);
  expect(during).toBeLessThan(180);
});

test("a drag that ends on ACQUIRE PASS does not fire it", async ({ page }) => {
  const rail = await railOrSkip(page);

  // handleBuy alerts when no wallet is connected; capture that instead of
  // letting a dialog block the run.
  const alerts: string[] = [];
  page.on("dialog", async (d) => {
    alerts.push(d.message());
    await d.dismiss();
  });

  const buy = rail.getByRole("button", { name: /acquire pass/i }).first();
  await expect(buy).toBeVisible();

  // 1. A plain click must still work.
  //
  // Uses Locator.click rather than raw mouse coordinates: hovering pauses the
  // drift AND tilts the card in 3D, so a position measured before the pointer
  // arrives is stale by the time it gets there. Playwright re-measures and
  // waits for the element to stop moving.
  await buy.click();
  await page.waitForTimeout(400);
  expect(alerts.length, "plain click should reach the buy handler").toBe(1);

  // 2. A click at the end of a drag must be swallowed. The pointer is already
  // over the rail now, so the drift is paused and coordinates are stable.
  const box = (await buy.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 45, cy, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(alerts.length, "drag then release should NOT buy").toBe(1);
});

test("arrows disable at the ends and step by the viewport", async ({ page }) => {
  const rail = await railOrSkip(page);
  await unhover(page);

  const left = page.getByRole("button", { name: "Scroll left" });
  const right = page.getByRole("button", { name: "Scroll right" });

  await rail.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await expect(left).toBeDisabled();
  await expect(right).toBeEnabled();

  await right.click();
  await page.waitForTimeout(900);
  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);

  await rail.evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  });
  await expect(right).toBeDisabled();
});

test("wheel scrolls the rail mid-way and releases at the ends", async ({ page }) => {
  const rail = await railOrSkip(page);
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await rail.evaluate((el) => {
    el.scrollLeft = 120;
  });
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(250);
  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(200);

  // At the start, scrolling up must leave the gesture to the page.
  await rail.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const pageYBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(250);
  expect(await rail.evaluate((el) => el.scrollLeft)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(pageYBefore);
});
