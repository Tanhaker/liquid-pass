"use client";

import { useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import {
  LIQUID_PASS_ADDRESS,
  MARKETPLACE_ADDRESS,
  liquidPassAbi,
  marketplaceAbi,
} from "@/lib/contract";
import { useFees } from "@/components/ui";

/**
 * Move a pass to another address without leaving its listing behind.
 *
 * THE BUG THIS EXISTS FOR
 * -----------------------
 * transferPass() on the core does not touch the Marketplace, so a listing
 * survives the pass changing hands. Marketplace.buy() then sells whoever holds
 * the pass NOW -- it never checks they are the one who listed it. So:
 *
 *   - gift a listed pass, and anyone can buy it from the recipient at the price
 *     the ORIGINAL owner set
 *   - "burn" a listed pass to 0x...dEaD, and anyone can buy it back out
 *   - escrow a listed pass into StreamRental, and it is safe today only because
 *     StreamRental has no receive() and the payout reverts -- which stops being
 *     true the moment an escrow is configured
 *
 * All three are reproduced in contracts/test/CrossContract.test.js.
 *
 * This closes the path through this app. It does NOT fix the contract: anyone
 * calling transferPass directly can still strand a listing. That needs
 * Marketplace.buy() to require the current owner to be the lister.
 *
 * TWO DETAILS THAT MATTER
 * -----------------------
 * 1. The listing is read from the chain at the moment of transfer, not taken
 *    from the page. A pass listed after the page loaded would otherwise be
 *    transferred with its listing intact.
 * 2. The unlist receipt must come back SUCCESSFUL before the transfer is sent.
 *    If the unlist reverts and the transfer goes ahead anyway, that is exactly
 *    the bug again, just with an extra wallet prompt.
 */
export function useTransferPass() {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();

  return useCallback(
    async (tokenId: bigint, to: `0x${string}`): Promise<`0x${string}`> => {
      if (!client) throw new Error("Not connected to Arbitrum Sepolia.");

      const listedFor = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "openingPrice",
        args: [tokenId],
      });

      if (listedFor > 0n) {
        const unlistHash = await writeContractAsync({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: "unlist",
          args: [tokenId],
          chainId: arbitrumSepolia.id,
          gas: 400_000n,
          ...(await fees()),
        });

        const receipt = await client.waitForTransactionReceipt({ hash: unlistHash });
        if (receipt.status !== "success") {
          throw new Error(
            "Couldn't remove the listing, so the pass was not moved. It is still yours and still listed.",
          );
        }
      }

      return writeContractAsync({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "transferPass",
        args: [to, tokenId],
        chainId: arbitrumSepolia.id,
        gas: 800_000n,
        ...(await fees()),
      });
    },
    [client, writeContractAsync, fees],
  );
}
