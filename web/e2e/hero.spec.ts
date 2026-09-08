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
  /*
   * Measured RELATIVE to a control page, not against a fixed fps number.
   *
   * An absolute threshold measures the machine as much as the page. Alone,
   * this scene reads 57 fps at 1280px; inside the full suite -- a dev server
   * compiling, other browser contexts live -- the same code read 43.7 / 41.9 /
   * 48.0 and "failed". Nothing about the hero had changed.
   *
   * So the ceiling is measured first, on a route with no canvas and no
   * animation loop, and the hero is required to stay close to it. When the
   * machine is busy BOTH numbers fall and the ratio holds; when the hero
   * genuinely regresses only the hero falls. That is the difference this test
   * is supposed to detect -- and it does: with backdrop-filter still on the
   * data panels the ratio was 38.3/58.7 = 0.65, well under the bar.
   */
  await page.goto("/verify", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const ceiling = Math.max((await fps(page)).fps, (await fps(page)).fps);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".cube-centre").waitFor();
  await page.waitForTimeout(2500);

  const samples = [] as Array<{ fps: number; frames: number; elapsed: number }>;
  for (let i = 0; i < 3; i++) {
    samples.push(await fps(page));
  }
  const best = samples.reduce((a, b) => (b.fps > a.fps ? b : a));
  const ratio = best.fps / ceiling;

  console.log(
    `\n  hero fps: ${samples.map((s) => s.fps.toFixed(1)).join(" / ")} ` +
      `(best ${best.fps.toFixed(1)}) vs ceiling ${ceiling.toFixed(1)} ` +
      `= ${(ratio * 100).toFixed(0)}% of an idle page\n`,
  );

  // Within 20% of a page doing no animation at all.
  expect(ratio).toBeGreaterThan(0.8);
});
