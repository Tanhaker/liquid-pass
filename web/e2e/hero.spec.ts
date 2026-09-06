import { test, expect } from "./fixtures/wallet";
import type { Page } from "@playwright/test";

/**
 * The hero scene: the centre cube, the neon sweeps, and what they cost.
 *
 * This page was reported laggy earlier, so frame rate is measured rather than
 * asserted. That is only possible in real Chromium -- requestAnimationFrame
 * does not tick in a hidden browser pane, which is why an earlier round of
 * perf work had to rest on structural counts instead of a measurement.
 *
 * Context for the numbers: a Spline (WebGL) version of this cube was built and
 * measured first. It rendered correctly but ran the page at 9.7-15.3 fps with
 * hardware acceleration on, against 59.8 fps without it, and the cost was the
 * runtime's own render loop rather than anything tunable from our side. Hence
 * the CSS-3D cube these assertions cover.
 */

test.use({
  launchOptions: {
    // Default headless Chromium falls back to software rendering, which
    // makes any GPU comparison meaningless.
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=default"],
  },
});

/**
 * Frames actually painted in a fixed window.
 *
 * Counting frames over a known period, rather than waiting for a fixed number
 * of frames, means a slow page returns a low number instead of hanging.
 */
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
    return { frames, elapsed, fps: (frames / elapsed) * 1000 };
  }, ms);
}

test("the centre cube renders with all six faces", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const cube = page.locator(".cube-centre");
  await expect(cube).toHaveCount(1);
  await expect(cube.locator(".cube-face")).toHaveCount(6);

  // It must actually occupy the middle of the scene, not collapse to nothing.
  // The wrapper scales down on narrow viewports, so the floor accommodates
  // the 0.55 mobile scale rather than assuming the full 220px.
  const box = await cube.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);

  expect(errors.filter((e) => !/pino-pretty|async-storage/.test(e))).toEqual([]);
});

test("the cube turns", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const cube = page.locator(".cube-centre");
  await expect(cube).toHaveCount(1);

  const read = () => cube.evaluate((el) => getComputedStyle(el).transform);
  const first = await read();
  await page.waitForTimeout(1500);
  const second = await read();

  // A 34s full turn moves ~16 degrees in 1.5s -- plenty to change the matrix.
  expect(second).not.toBe(first);
});

test("the hero holds a smooth frame rate", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".cube-centre").waitFor();
  await page.waitForTimeout(2500);

  const measured = await fps(page);
  console.log(
    `\n  hero fps: ${measured.fps.toFixed(1)} (${measured.frames} frames in ` +
      `${measured.elapsed.toFixed(0)}ms)\n`,
  );

  // Chromium paces at 60. Anything under 50 means frames are being dropped.
  expect(measured.fps).toBeGreaterThan(50);
});
