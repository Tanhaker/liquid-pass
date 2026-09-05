import { test, expect } from "./fixtures/wallet";
import { createPublicClient, http, parseAbi, formatEther } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * The Dutch auction, on screen.
 *
 * Marketplace.currentPrice() has always decayed continuously to zero at
 * expiry. These assertions check two separate things:
 *
 *   1. the figure actually moves, which is what makes it a live price
 *   2. it agrees with what the contract would charge, which is what stops it
 *      being a decorative animation
 */

const MARKETPLACE = "0x63a9edec92baf3e74f19d301808c56104e786241";

const chain = createPublicClient({
  chain: arbitrumSepolia,
  transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
});

const abi = parseAbi(["function currentPrice(uint256 tokenId) view returns (uint256)"]);

test("the listed price ticks down on its own", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });

  const price = page.getByText(/Falling Now/i).first().locator("xpath=following-sibling::span[1]");
  await expect(price).toBeVisible({ timeout: 30_000 });

  const first = await price.innerText();
  // The 9th decimal turns over every ~2.6s on these listings, so sample wide
  // enough to be certain rather than lucky.
  await page.waitForTimeout(8000);
  const second = await price.innerText();

  expect(second).not.toBe(first);

  const toNum = (s: string) => parseFloat(s.replace(/[^\d.]/g, ""));
  expect(toNum(second)).toBeLessThan(toNum(first));
});

test("the displayed price is what the contract would charge", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });

  const card = page
    .locator("div")
    .filter({ hasText: /Falling Now/ })
    .last();
  await expect(card).toBeVisible({ timeout: 30_000 });

  // Which token is this card showing?
  const label = await page.locator("text=/TOKEN #\\d+/").first().innerText();
  const tokenId = BigInt(label.replace(/\D/g, ""));

  const shown = await page
    .getByText(/Falling Now/i)
    .first()
    .locator("xpath=following-sibling::span[1]")
    .innerText();
  const shownEth = parseFloat(shown.replace(/[^\d.]/g, ""));

  const onChain = await chain.readContract({
    address: MARKETPLACE,
    abi,
    functionName: "currentPrice",
    args: [tokenId],
  });
  const chainEth = parseFloat(formatEther(onChain));

  // They are computed from the same formula, so the only gap is the seconds
  // between the browser's clock and this RPC read. Well under a percent.
  expect(Math.abs(shownEth - chainEth) / Math.max(chainEth, 1e-12)).toBeLessThan(0.01);
});

test("the decay rate per hour is shown", async ({ page }) => {
  await page.goto("/market", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/ETH\/hr/i).first()).toBeVisible({ timeout: 30_000 });
});
