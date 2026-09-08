"use client";

import { useCallback } from "react";
import { usePublicClient } from "wagmi";
import { useLiquidPass } from "@/lib/store";
import { humanise } from "@/components/ui";

/**
 * One transaction, three toasts' worth of lifecycle.
 *
 * TransactionToasts was written, styled and then rendered on no page -- and
 * nothing anywhere called addNotification, so mounting it on its own would
 * have produced an empty fixed div forever. This is the missing half: it wraps
 * a write so the toast goes broadcast -> confirmed (or failed) without every
 * call site repeating the sequence.
 *
 * Deliberately does NOT replace the existing per-page Banner state. Those
 * banners are inline next to the control that caused them and survive a page
 * change; the toast is the transient, global "something is happening" signal.
 * Removing the banners would lose the durable record.
 */
export function useTxToast() {
  const { addNotification, updateNotification } = useLiquidPass();
  const client = usePublicClient();

  /**
   * Runs `send`, showing a pending toast until the receipt lands.
   *
   * Rethrows on failure so existing per-page error handling still runs -- this
   * adds a signal, it does not swallow anything.
   */
  return useCallback(
    async (
      title: string,
      send: () => Promise<`0x${string}`>,
      opts?: { awaitReceipt?: boolean },
    ): Promise<`0x${string}`> => {
      const id = addNotification({
        status: "pending",
        title,
        message: "Waiting for your wallet…",
      });

      try {
        const hash = await send();
        updateNotification(id, {
          message: "Broadcast. Waiting for confirmation…",
          txHash: hash,
        });

        if (opts?.awaitReceipt !== false) {
          await client?.waitForTransactionReceipt({ hash });
        }

        updateNotification(id, {
          status: "success",
          message: "Confirmed on Arbitrum Sepolia.",
          txHash: hash,
        });
        return hash;
      } catch (e) {
        updateNotification(id, {
          status: "error",
          // humanise pulls the actual revert reason out, which viem puts on
          // the second line of the message.
          message: humanise(e as Error),
        });
        throw e;
      }
    },
    [addNotification, updateNotification, client],
  );
}
