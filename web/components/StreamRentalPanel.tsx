"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { formatEther, isAddress, parseEther } from "viem";
import { Timer, Play, Square, Loader2 } from "lucide-react";
import {
  LIQUID_PASS_ADDRESS,
  STREAM_RENTAL_ADDRESS,
  liquidPassAbi,
  streamRentalAbi,
  shortAddress,
  type Pass,
} from "@/lib/contract";
import { humanise, useFees } from "@/components/ui";

/**
 * Pay-per-second rental of a pass.
 *
 * Renders nothing at all unless StreamRental.sol has been deployed and
 * NEXT_PUBLIC_STREAM_RENTAL_ADDRESS points at it. Half a feature attached to
 * an address that does not exist is worse than no feature.
 *
 * The two-transaction setup is deliberate and the order is not cosmetic:
 * openStream() must happen while the caller still owns the pass, because a
 * stream claimable after the pass arrived could be claimed by anyone watching
 * the mempool, who could then reclaim() someone else's pass.
 */
export function StreamRentalPanel({
  pass,
  onDone,
}: {
  pass: Pass;
  onDone?: () => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();

  const configured = isAddress(STREAM_RENTAL_ADDRESS);
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  const [stream, setStream] = useState<{
    owner: `0x${string}`;
    ratePerSecond: bigint;
    renter: `0x${string}`;
    deposit: bigint;
  } | null>(null);
  const [renter, setRenter] = useState<`0x${string}` | null>(null);
  const [owed, setOwed] = useState<bigint>(0n);
  const [left, setLeft] = useState<bigint>(0n);
  const [escrowed, setEscrowed] = useState(false);

  const [ratePerHour, setRatePerHour] = useState("0.0001");
  const [budget, setBudget] = useState("0.001");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !configured) return;
    try {
      const [s, active, o, secs, holder] = await Promise.all([
        client.readContract({
          address: STREAM_RENTAL_ADDRESS,
          abi: streamRentalAbi,
          functionName: "streams",
          args: [pass.tokenId],
        }),
        client.readContract({
          address: STREAM_RENTAL_ADDRESS,
          abi: streamRentalAbi,
          functionName: "activeRenter",
          args: [pass.tokenId],
        }),
        client.readContract({
          address: STREAM_RENTAL_ADDRESS,
          abi: streamRentalAbi,
          functionName: "owedNow",
          args: [pass.tokenId],
        }),
        client.readContract({
          address: STREAM_RENTAL_ADDRESS,
          abi: streamRentalAbi,
          functionName: "secondsRemaining",
          args: [pass.tokenId],
        }),
        client.readContract({
          address: LIQUID_PASS_ADDRESS,
          abi: liquidPassAbi,
          functionName: "ownerOf",
          args: [pass.tokenId],
        }),
      ]);
      setStream({ owner: s[0], ratePerSecond: s[1], renter: s[2], deposit: s[4] });
      setRenter(active === "0x0000000000000000000000000000000000000000" ? null : active);
      setOwed(o);
      setLeft(secs);
      setEscrowed(holder.toLowerCase() === STREAM_RENTAL_ADDRESS.toLowerCase());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [client, configured, pass.tokenId]);

  useEffect(() => {
    void load();
    if (!configured) return;
    // A per-second charge should be visible ticking, not frozen between page loads.
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load, configured]);

  if (!configured) return null;

  const run = async (label: string, send: () => Promise<`0x${string}`>) => {
    if (!isConnected || wrongNetwork) return;
    setBusy(label);
    setError(null);
    try {
      const hash = await send();
      await client?.waitForTransactionReceipt({ hash });
      await load();
      onDone?.();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  };

  const hasStream = stream !== null && stream.owner !== "0x0000000000000000000000000000000000000000";
  const isStreamOwner = hasStream && address?.toLowerCase() === stream!.owner.toLowerCase();
  const isPassOwner = address?.toLowerCase() === pass.owner.toLowerCase();
  const isRenter = renter !== null && address?.toLowerCase() === renter.toLowerCase();

  /** Rate is entered per hour because per-second figures are unreadable. */
  const rateWeiPerSecond = (() => {
    try {
      return parseEther(ratePerHour.trim() || "0") / 3600n;
    } catch {
      return 0n;
    }
  })();

  const fmtDuration = (secs: bigint) => {
    const n = Number(secs);
    if (n <= 0) return "0s";
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${n % 60}s`;
  };

  return (
    <div className="space-y-4 border border-dark-border bg-dark-card p-6">
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-uranium">
          <Timer className="h-4 w-4" />
          <span>Pay per second</span>
        </div>
        <span className="font-mono text-[11px] text-zincGrey">StreamRental</span>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-500/10 p-3 font-mono text-[11px] text-red-400">
          {error}
        </div>
      )}

      {renter && (
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="border border-dark-border bg-dark p-3">
            <div className="text-[10px] uppercase text-zincGrey">Renter</div>
            <div className="text-alabaster">{shortAddress(renter)}</div>
          </div>
          <div className="border border-dark-border bg-dark p-3">
            <div className="text-[10px] uppercase text-zincGrey">Accrued</div>
            <div className="tnum text-uranium">{formatEther(owed)} ETH</div>
          </div>
          <div className="border border-dark-border bg-dark p-3">
            <div className="text-[10px] uppercase text-zincGrey">Funded for</div>
            <div className="tnum text-alabaster">{fmtDuration(left)}</div>
          </div>
          <div className="border border-dark-border bg-dark p-3">
            <div className="text-[10px] uppercase text-zincGrey">Rate</div>
            <div className="tnum text-alabaster">
              {stream ? formatEther(stream.ratePerSecond * 3600n) : "0"} ETH/hr
            </div>
          </div>
        </div>
      )}

      {/* ── Owner: open a stream ─────────────────────────────────────────── */}
      {!hasStream && isPassOwner && (
        <div className="space-y-3 font-mono text-xs">
          <p className="leading-relaxed text-zincGrey">
            Rent this pass out by the second. Renting happens in two steps, and the
            order matters: declare the stream while you still own the pass, then
            hand it to the contract.
          </p>
          <label className="block uppercase text-zincGrey" htmlFor={`r-${pass.tokenId}`}>
            Price per hour (ETH)
          </label>
          <input
            id={`r-${pass.tokenId}`}
            value={ratePerHour}
            onChange={(e) => setRatePerHour(e.target.value)}
            inputMode="decimal"
            className="w-full border border-dark-border bg-dark px-3 py-2 text-alabaster outline-none focus:border-uranium"
          />
          <button
            onClick={() =>
              run("open", async () => {
                if (rateWeiPerSecond <= 0n) throw new Error("Enter a price above zero.");
                return writeContractAsync({
                  address: STREAM_RENTAL_ADDRESS,
                  abi: streamRentalAbi,
                  functionName: "openStream",
                  args: [pass.tokenId, rateWeiPerSecond],
                  chainId: arbitrumSepolia.id,
                  gas: 400_000n,
                  ...(await fees()),
                });
              })
            }
            disabled={busy !== null || !isConnected || wrongNetwork}
            className="w-full bg-uranium py-2.5 font-extrabold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {busy === "open" ? "Confirm…" : "1 · Open stream"}
          </button>
        </div>
      )}

      {/* ── Owner: escrow the pass ───────────────────────────────────────── */}
      {hasStream && isStreamOwner && !escrowed && (
        <div className="space-y-3 font-mono text-xs">
          <p className="leading-relaxed text-zincGrey">
            Stream open at {stream ? formatEther(stream.ratePerSecond * 3600n) : "0"} ETH/hr.
            Now hand the pass to the rental contract so it can be rented. You can
            take it back any time no one is renting.
          </p>
          <button
            onClick={() =>
              run("escrow", async () =>
                writeContractAsync({
                  address: LIQUID_PASS_ADDRESS,
                  abi: liquidPassAbi,
                  functionName: "transferPass",
                  args: [STREAM_RENTAL_ADDRESS, pass.tokenId],
                  chainId: arbitrumSepolia.id,
                  gas: 400_000n,
                  ...(await fees()),
                }),
              )
            }
            disabled={busy !== null || !isConnected || wrongNetwork}
            className="w-full bg-uranium py-2.5 font-extrabold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {busy === "escrow" ? "Confirm…" : "2 · Hand over the pass"}
          </button>
        </div>
      )}

      {/* ── Owner: take it back ──────────────────────────────────────────── */}
      {hasStream && isStreamOwner && escrowed && !renter && (
        <button
          onClick={() =>
            run("reclaim", async () =>
              writeContractAsync({
                address: STREAM_RENTAL_ADDRESS,
                abi: streamRentalAbi,
                functionName: "reclaim",
                args: [pass.tokenId],
                chainId: arbitrumSepolia.id,
                gas: 400_000n,
                ...(await fees()),
              }),
            )
          }
          disabled={busy !== null || !isConnected || wrongNetwork}
          className="w-full border border-dark-border bg-dark-surface py-2.5 font-mono text-xs font-bold uppercase text-alabaster hover:border-uranium disabled:opacity-40"
        >
          {busy === "reclaim" ? "Confirm…" : "Take the pass back"}
        </button>
      )}

      {/* ── Renter: start ────────────────────────────────────────────────── */}
      {hasStream && escrowed && !renter && !isStreamOwner && (
        <div className="space-y-3 font-mono text-xs">
          <p className="leading-relaxed text-zincGrey">
            {stream ? formatEther(stream.ratePerSecond * 3600n) : "0"} ETH per hour,
            charged by the second. Everything you send is a budget — stop whenever
            you like and the unused remainder comes back.
          </p>
          <label className="block uppercase text-zincGrey" htmlFor={`b-${pass.tokenId}`}>
            Budget (ETH)
          </label>
          <input
            id={`b-${pass.tokenId}`}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            inputMode="decimal"
            className="w-full border border-dark-border bg-dark px-3 py-2 text-alabaster outline-none focus:border-uranium"
          />
          <button
            onClick={() =>
              run("start", async () =>
                writeContractAsync({
                  address: STREAM_RENTAL_ADDRESS,
                  abi: streamRentalAbi,
                  functionName: "startRent",
                  args: [pass.tokenId],
                  value: parseEther(budget.trim() || "0"),
                  chainId: arbitrumSepolia.id,
                  gas: 400_000n,
                  ...(await fees()),
                }),
              )
            }
            disabled={busy !== null || !isConnected || wrongNetwork}
            className="inline-flex w-full items-center justify-center gap-2 bg-uranium py-2.5 font-extrabold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy === "start" ? "Confirm…" : "Start renting"}
          </button>
        </div>
      )}

      {/* ── Stop ─────────────────────────────────────────────────────────── */}
      {renter && (isRenter || left === 0n) && (
        <button
          onClick={() =>
            run("settle", async () =>
              writeContractAsync({
                address: STREAM_RENTAL_ADDRESS,
                abi: streamRentalAbi,
                functionName: "settle",
                args: [pass.tokenId],
                chainId: arbitrumSepolia.id,
                gas: 400_000n,
                ...(await fees()),
              }),
            )
          }
          disabled={busy !== null || !isConnected || wrongNetwork}
          className="inline-flex w-full items-center justify-center gap-2 border border-dark-border bg-dark-surface py-2.5 font-mono text-xs font-bold uppercase text-alabaster hover:border-uranium disabled:opacity-40"
        >
          {busy === "settle" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          {busy === "settle"
            ? "Confirm…"
            : isRenter
              ? "Stop and settle"
              : "Settle (funds exhausted)"}
        </button>
      )}

      {renter && !isRenter && left > 0n && (
        <p className="font-mono text-[11px] text-zincGrey">
          Someone is renting this now. It can be settled by anyone once the budget
          runs out.
        </p>
      )}

      <p className="border-t border-dark-border pt-3 font-mono text-[10px] leading-relaxed text-zincGrey">
        While a pass is rented, <code>ownerOf()</code> reports the rental contract,
        not the renter. Access is proved by <code>activeRenter()</code>.
      </p>
    </div>
  );
}
