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

const TERRAIN = "[data-hero-terrain] canvas";

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
  const backdrop = page.locator("[data-hero-terrain]");
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
  const surface = page.locator("[data-hero-terrain]");
  await expect(page.locator(TERRAIN)).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  const a = await surface.screenshot();
  await page.waitForTimeout(1200);
  const b = await surface.screenshot();

  expect(Buffer.compare(a, b)).not.toBe(0);
});

/**
 * Visible, not merely present.
 *
 * Every other test in this file passed while the terrain was INVISIBLE: the
 * canvas existed, it was moving, and it was fast -- and a screenshot of the
 * hero looked blank. Opacity 0.3 stacked under a mask that started at 0.5 left
 * the brightest dot at +16/255 over the background, with 0.04% of the hero's
 * pixels lit. A user reported it before any test did.
 *
 * So this measures what a person sees: the hero is screenshotted with the
 * canvas shown and then hidden, and the difference is the terrain's actual
 * contribution to the image.
 *
 *   invisible version: brightest +15.9, lit 0.04%   -> must fail
 *   fixed version:     brightest +90.4, lit 0.79%   -> passes
 */
test("the terrain is actually visible", async ({ page }) => {
  const { PNG } = await import("pngjs");
  const lums = (buf: Buffer) => {
    const png = PNG.sync.read(buf);
    const out: number[] = [];
    for (let i = 0; i < png.data.length; i += 4) {
      out.push(0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2]);
    }
    return out;
  };

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(TERRAIN)).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  const box = (await page.locator("[data-hero-terrain]").boundingBox())!;
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };

  const shown = lums(await page.screenshot({ clip }));
  await page.addStyleTag({ content: "[data-hero-terrain] canvas{visibility:hidden!important}" });
  await page.waitForTimeout(250);
  const hidden = lums(await page.screenshot({ clip }));

  let brightest = 0;
  let lit = 0;
  for (let i = 0; i < shown.length; i++) {
    const d = shown[i] - hidden[i];
    if (d > brightest) brightest = d;
    if (d > 6) lit++;
  }
  const litPct = (lit / shown.length) * 100;
  console.log(`\n  terrain: brightest dot +${brightest.toFixed(1)}/255, lit ${litPct.toFixed(2)}%\n`);

  // Comfortably between the invisible version and the fixed one.
  expect(brightest).toBeGreaterThan(40);
  expect(litPct).toBeGreaterThan(0.25);
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
