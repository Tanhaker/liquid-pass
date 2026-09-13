import type { PublicClient } from "viem";

/**
 * Wait for a transaction and fail loudly if it reverted.
 *
 * waitForTransactionReceipt() resolves for a REVERTED transaction too -- a
 * failed transaction still gets mined and still has a receipt, with
 * status "reverted". Every call site here awaited the receipt and treated
 * resolving as success, so a buy that MetaMask showed as failed was announced
 * on the site as confirmed.
 */
export async function waitForSuccess(
  client: Pick<PublicClient, "waitForTransactionReceipt"> | undefined,
  hash: `0x${string}`,
) {
  if (!client) return undefined;
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(
      `The transaction failed on-chain and nothing changed (${hash.slice(0, 10)}…). Check it on Arbiscan for the reason.`,
    );
  }
  return receipt;
}
