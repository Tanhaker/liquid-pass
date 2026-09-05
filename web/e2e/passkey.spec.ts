import { test, expect } from "./fixtures/wallet";

/**
 * The passkey verifier, driven by a virtual authenticator.
 *
 * Chrome DevTools Protocol can attach a software authenticator to the page, so
 * navigator.credentials.create() and .get() run their real code paths and
 * produce a genuine secp256r1 keypair and genuine assertions -- with no
 * fingerprint reader and no human. That is the only honest way to test this in
 * CI; mocking WebAuthn would test the mock.
 */

async function attachVirtualAuthenticator(page: import("@playwright/test").Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

test.describe("passkey verifier", () => {
  test("reads the deployed wallet's registered key and nonce", async ({ page }) => {
    await page.goto("/passkey", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /passkey verifier/i })).toBeVisible();

    // Both come from the live contract, so neither should stay in its
    // loading state.
    const nonce = page.getByText("Nonce", { exact: true }).locator("xpath=following-sibling::div[1]");
    await expect(nonce).not.toHaveText(/reading/, { timeout: 30_000 });
    await expect(nonce).toHaveText(/^\d+$/);

    const x = page
      .getByText("Registered key — x", { exact: true })
      .locator("xpath=following-sibling::div[1]");
    await expect(x).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });
    // A key IS registered on this wallet, so it must not be all zeroes.
    await expect(x).not.toHaveText(/^0x0{64}$/);
  });

  test("states plainly whether this origin can execute on chain", async ({ page }) => {
    await page.goto("/passkey", { waitUntil: "domcontentloaded" });
    // The suite runs on localhost:3000, which is exactly the origin compiled
    // into the deployed contract.
    await expect(
      page.getByText(/matches the one compiled into the wallet/i),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("creates a real P-256 credential and verifies its assertion", async ({ page }) => {
    await attachVirtualAuthenticator(page);
    await page.goto("/passkey", { waitUntil: "domcontentloaded" });

    // Wait for the challenge to arrive from the chain before signing.
    const challenge = page
      .getByText(/getChallenge\(target, value, data\)/i)
      .locator("xpath=following-sibling::div[1]");
    await expect(challenge).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });

    await page.getByRole("button", { name: /create passkey/i }).click();

    const pubX = page
      .getByText("Public key — x", { exact: true })
      .locator("xpath=following-sibling::div[1]");
    await expect(pubX).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });
    await expect(page.getByText(/ES256 \(-7\)/)).toBeVisible();

    await page.getByRole("button", { name: /sign with passkey/i }).click();

    // The headline claim: a genuine secp256r1 signature, verified against the
    // public key by WebCrypto -- the same arithmetic the Stylus contract does.
    await expect(
      page.getByText(/secp256r1 signature VERIFIED/i),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("the challenge in clientDataJSON is the contract's own challenge", async ({ page }) => {
    await attachVirtualAuthenticator(page);
    await page.goto("/passkey", { waitUntil: "domcontentloaded" });

    await expect(
      page
        .getByText(/getChallenge\(target, value, data\)/i)
        .locator("xpath=following-sibling::div[1]"),
    ).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });

    await page.getByRole("button", { name: /create passkey/i }).click();
    await expect(
      page.getByText("Public key — x", { exact: true }).locator("xpath=following-sibling::div[1]"),
    ).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });

    await page.getByRole("button", { name: /sign with passkey/i }).click();

    // This is the check whose absence would be a total security break: a valid
    // signature proves a real finger, not consent to THIS action.
    await expect(page.getByText("MATCHES", { exact: true })).toBeVisible({ timeout: 30_000 });

    // And user presence must actually be asserted.
    const flags = page
      .getByText("User presence / verification", { exact: true })
      .locator("xpath=following-sibling::div[1]");
    await expect(flags).toHaveText(/UP=1/);
  });

  test("s is always low-s, whatever the authenticator emitted", async ({ page }) => {
    await attachVirtualAuthenticator(page);
    await page.goto("/passkey", { waitUntil: "domcontentloaded" });

    await expect(
      page
        .getByText(/getChallenge\(target, value, data\)/i)
        .locator("xpath=following-sibling::div[1]"),
    ).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });

    await page.getByRole("button", { name: /create passkey/i }).click();
    await expect(
      page.getByText("Public key — x", { exact: true }).locator("xpath=following-sibling::div[1]"),
    ).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });
    await page.getByRole("button", { name: /sign with passkey/i }).click();

    const sField = page.getByText(/^signature s/).locator("xpath=following-sibling::div[1]");
    await expect(sField).toHaveText(/^0x[0-9a-f]{64}$/, { timeout: 30_000 });

    // n/2 for P-256, where
    //   n = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
    // The contract rejects s above this, so whatever the authenticator
    // produced must have been folded before it got here.
    const HALF_N =
      0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8n;
    const s = BigInt(await sField.innerText());
    expect(s).toBeLessThanOrEqual(HALF_N);
  });
});
