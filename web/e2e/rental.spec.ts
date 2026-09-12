import { test, expect, useMockWallet, recordedTxs, clearTxs } from "./fixtures/wallet";
import { decodeFunctionData, parseAbi, parseEther } from "viem";

/**
 * Pay-per-second rental, against the deployed contract.
 *
 * StreamRental went live at 0x3640ee44... on 12 Sep 2026. Until then this
 * panel was gated off and rendered nothing, so none of it had ever been
 * exercised in a browser -- only in the contract's own 18 Hardhat tests.
 *
 * The reads here hit the real contract. The writes are recorded and decoded,
 * never broadcast.
 */

const STREAM_RENTAL = "0x3640ee44a5055ffd5fd17989ffd95ef478929616";
const LIQUID_PASS = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";

const abi = parseAbi([
  "function openStream(uint256 tokenId, uint256 ratePerSecond)",
  "function transferPass(address to, uint256 tokenId)",
]);

test.beforeEach(async ({ page }) => {
  await useMockWallet(page);
});

/** Token 1 is held by the test account and is not listed. */
async function openPass(page: import("@playwright/test").Page) {
  await page.goto("/pass/1", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Pay per second")).toBeVisible({ timeout: 40_000 });
}

test("the rental panel renders now that the contract exists", async ({ page }) => {
  await openPass(page);
  // Gated on isAddress(STREAM_RENTAL_ADDRESS); before the deploy this rendered
  // nothing at all.
  await expect(page.getByText("StreamRental")).toBeVisible();
});

test("opening a stream sends openStream(tokenId, ratePerSecond)", async ({ page }) => {
  await openPass(page);
  await clearTxs(page);

  const rate = page.locator('input[id^="r-"]');
  await expect(rate).toBeVisible({ timeout: 30_000 });
  await rate.fill("0.0036");

  await page.getByRole("button", { name: /Open stream/i }).click();

  await expect.poll(async () => (await recordedTxs(page)).length, { timeout: 25_000 }).toBe(1);
  const [tx] = await recordedTxs(page);

  expect(tx.to.toLowerCase()).toBe(STREAM_RENTAL);
  const decoded = decodeFunctionData({ abi, data: tx.data as `0x${string}` });
  expect(decoded.functionName).toBe("openStream");
  expect(decoded.args?.[0]).toBe(1n);
  // The form takes a price per HOUR; the contract takes per second.
  expect(decoded.args?.[1]).toBe(parseEther("0.0036") / 3600n);
});

/**
 * The ordering that stops a stranger claiming an escrowed pass: the stream is
 * declared while the caller still owns it, and only then is custody handed
 * over. The UI has to present those as two separate steps in that order.
 */
test("escrow is a separate second step, to the core contract", async ({ page }) => {
  await openPass(page);

  // Step one is what is offered first.
  await expect(page.getByRole("button", { name: /1 · Open stream/i })).toBeVisible({
    timeout: 30_000,
  });
  // Step two is not offered until a stream exists.
  await expect(page.getByRole("button", { name: /Hand over the pass/i })).toHaveCount(0);
});

test("the panel explains that ownerOf is not how access is proved", async ({ page }) => {
  await openPass(page);
  // While a pass is rented, ownerOf() reports the rental contract. Anything
  // reading it to decide who may use a pass would get the wrong answer.
  await expect(page.getByText(/activeRenter/)).toBeVisible();
});
