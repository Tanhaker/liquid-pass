import { defineConfig, devices } from "@playwright/test";

/**
 * The dev server is the target, not a production build: these specs assert on
 * live behaviour (animation, wallet call payloads, on-chain reads), and `next
 * dev` is what we iterate against. Running `next build` while a dev server is
 * live has corrupted `.next` here before, so the two are never run together.
 */
export default defineConfig({
  testDir: "./e2e",
  // Animation timing assertions are wall-clock sensitive, so they must not race
  // each other for CPU. Everything else is cheap enough that serial is fine.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Forces every route to compile before any spec runs. See warmup.setup.ts:
    // without it, specs race `next dev`'s on-demand compilation and read
    // truncated chunks, which presents as a fatal SyntaxError in the browser.
    { name: "warmup", testMatch: /warmup\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["warmup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["warmup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    // Cold Next.js compiles of these routes have taken 45s+ on this machine.
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
