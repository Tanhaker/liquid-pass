import { test, expect } from "./fixtures/wallet";
import type { Page } from "@playwright/test";

/**
 * The hero: the dotted terrain, restored.
 *
 * This replaced the CSS-3D "luxury" scene at the user's request, which puts a
 * WebGL runtime (three.js) back on the homepage. That scene was reported laggy
 * once already this project, so frame rate is measured here rather than
 * assumed -- relative to an idle page, which separates a slow scene from a slow
 * machine.
 */

test.use({
  launchOptions: {
    // Default headless Chromium falls back to software rendering, which would
    // make any WebGL measurement meaningless.
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=default"],
  },
});

/** Frames painted in a fixed window, so a slow page returns low, not a hang. */
async function fps(page: Page, ms = 2500) {
  return page.evaluate(async (duration) => {
    let frames = 0;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (performance.now() - start >= duration) return resolve();
        frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const elapsed = performance.now() - start;
    return { fps: (frames / elapsed) * 1000, frames, elapsed };
  }, ms);
}

const TERRAIN = ".hero-surface-fade canvas";

test("the dotted terrain renders a WebGL canvas behind the hero", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const canvas = page.locator(TERRAIN);
  await expect(canvas).toHaveCount(1, { timeout: 30_000 });

  const info = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    return { w: c.width, h: c.height };
  });
  expect(info.w).toBeGreaterThan(0);
  expect(info.h).toBeGreaterThan(0);
});

test("the terrain sits behind the headline, not over it", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(TERRAIN)).toHaveCount(1, { timeout: 30_000 });

  // The backdrop must not intercept clicks meant for the hero's buttons.
  const backdrop = page.locator(".hero-surface-fade").locator("xpath=..");
  await expect(backdrop).toHaveCSS("pointer-events", "none");

  // And the headline must be readable on top of it.
  await expect(page.locator("h1").first()).toBeVisible();
});

/**
 * Animation, checked by looking at it.
 *
 * A WebGL canvas cannot be read back with toDataURL unless the renderer was
 * created with preserveDrawingBuffer, which this one deliberately is not (it
 * costs memory and a copy per frame). Element screenshots capture the
 * composited frame instead, so two of them a moment apart should differ.
 */
test("the terrain is actually moving", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const surface = page.locator(".hero-surface-fade");
  await expect(page.locator(TERRAIN)).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  const a = await surface.screenshot();
  await page.waitForTimeout(1200);
  const b = await surface.screenshot();

  expect(Buffer.compare(a, b)).not.toBe(0);
});

test("the hero holds a smooth frame rate", async ({ page }) => {
  /*
   * Relative to a control page, not a fixed fps number. An absolute threshold
   * measures the machine: under full-suite load the previous scene read 44-48
   * fps and "failed" with nothing changed. The ceiling is measured on a route
   * with no animation loop, and the hero must stay near it.
   */
  await page.goto("/verify", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const ceiling = Math.max((await fps(page)).fps, (await fps(page)).fps);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(TERRAIN)).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  const samples = [] as Array<{ fps: number; frames: number; elapsed: number }>;
  for (let i = 0; i < 3; i++) {
    samples.push(await fps(page));
  }
  const best = samples.reduce((x, y) => (y.fps > x.fps ? y : x));
  const ratio = best.fps / ceiling;

  console.log(
    `\n  hero fps: ${samples.map((s) => s.fps.toFixed(1)).join(" / ")} ` +
      `(best ${best.fps.toFixed(1)}) vs ceiling ${ceiling.toFixed(1)} ` +
      `= ${(ratio * 100).toFixed(0)}% of an idle page\n`,
  );

  expect(ratio).toBeGreaterThan(0.8);
});
