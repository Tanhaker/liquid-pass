"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { ESCROW_ADDRESS, escrowAbi } from "@/lib/contract";
import { arbitrumSepolia } from "wagmi/chains";
import { useState } from "react";

export function YieldDashboard() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  const { data: balanceWei, refetch } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "lockedBalances",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  const hasBalance = balanceWei && balanceWei > 0n;
  const balanceEth = balanceWei ? Number(formatEther(balanceWei)).toFixed(5) : "0.00000";

  const handleClaim = async () => {
    if (!hasBalance) return;
    setBusy(true);
    setTx(null);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "withdraw",
        chainId: arbitrumSepolia.id,
      });
      setTx({ hash, what: "Claimed Yield!" });
      setTimeout(() => refetch(), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-none border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-none bg-life-mid/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-life-mid">
            Live
          </span>
          <h2 className="text-[15px] font-medium">Aave V3 Escrow Yield</h2>
        </div>
        {tx && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-life-mid hover:underline"
          >
            {tx.what} â
          </a>
        )}
      </div>

      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
        When you sell a pass, your proceeds are automatically routed to our Escrow 
        smart contract which supplies your ETH directly into <strong>Aave V3</strong>. 
        Your capital earns interest continuously while it sits here.
      </p>

      <div className="mt-6 rounded-none border border-line bg-ink p-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Total Locked Balance & Yield
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum text-[28px] font-semibold text-life-mid">
              {balanceEth}
            </span>
            <span className="text-[14px] text-muted">ETH</span>
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={!hasBalance || busy}
          className="rounded-none bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Claiming..." : "Claim Funds"}
        </button>
      </div>
      
      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        This is real, live data fetched from the EscrowYield contract on Arbitrum Sepolia.
      </p>
    </section>
  );
}
