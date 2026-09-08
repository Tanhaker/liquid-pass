"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { isAddress, getAddress } from "viem";
import { ShieldCheck, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { LIQUID_PASS_ADDRESS, liquidPassAbi, shortAddress } from "@/lib/contract";
import { humanise, useFees } from "@/components/ui";
import { useTxToast } from "@/lib/useTxToast";

/**
 * Issuer authorisation.
 *
 * `setIssuer(address, bool)` is how a SaaS company is allowed to create plans
 * -- the B2B onboarding step the whole product story rests on. It existed in
 * the Rust contract from the start and had no ABI entry and no UI, so the only
 * way to authorise an issuer was to send the calldata by hand. Every issuer on
 * chain today was added that way.
 *
 * The contract enforces two rules and this mirrors both rather than letting a
 * transaction fail in a wallet: only `admin()` may call it, and the zero
 * address is rejected.
 */
export function IssuerAccess({ onChanged }: { onChanged?: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const txToast = useTxToast();
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  const [admin, setAdmin] = useState<`0x${string}` | null>(null);
  const [selfAllowed, setSelfAllowed] = useState<boolean | null>(null);
  const [target, setTarget] = useState("");
  const [targetAllowed, setTargetAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"grant" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const a = await client.readContract({
        address: LIQUID_PASS_ADDRESS,
        abi: liquidPassAbi,
        functionName: "admin",
      });
      setAdmin(a);
      if (address) {
        setSelfAllowed(
          await client.readContract({
            address: LIQUID_PASS_ADDRESS,
            abi: liquidPassAbi,
            functionName: "isIssuer",
            args: [address],
          }),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [client, address]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin =
    admin !== null && address !== undefined && admin.toLowerCase() === address.toLowerCase();

  /** Look up whoever is typed in the box, so the button says the right thing. */
  const checkTarget = useCallback(async () => {
    if (!client || !isAddress(target.trim())) {
      setTargetAllowed(null);
      return;
    }
    try {
      setTargetAllowed(
        await client.readContract({
          address: LIQUID_PASS_ADDRESS,
          abi: liquidPassAbi,
          functionName: "isIssuer",
          args: [getAddress(target.trim())],
        }),
      );
    } catch {
      setTargetAllowed(null);
    }
  }, [client, target]);

  useEffect(() => {
    const id = setTimeout(() => void checkTarget(), 400);
    return () => clearTimeout(id);
  }, [checkTarget]);

  const submit = async (allowed: boolean) => {
    setError(null);
    setNote(null);

    const raw = target.trim();
    if (!isAddress(raw)) {
      setError("That doesn't look like an address.");
      return;
    }
    const who = getAddress(raw);
    // The contract rejects the zero address; say so here rather than spending
    // gas to be told.
    if (who === "0x0000000000000000000000000000000000000000") {
      setError("The zero address can't be an issuer.");
      return;
    }

    setBusy(allowed ? "grant" : "revoke");
    try {
      const hash = await txToast(
        `${allowed ? "Authorised" : "Revoked"} ${shortAddress(who)}`,
        async () =>
          writeContractAsync({
            address: LIQUID_PASS_ADDRESS,
            abi: liquidPassAbi,
            functionName: "setIssuer",
            args: [who, allowed],
            chainId: arbitrumSepolia.id,
            gas: 400_000n,
            ...(await fees()),
          }),
      );
      setNote(
        `${allowed ? "Authorised" : "Revoked"} ${shortAddress(who)} — ${hash.slice(0, 10)}…`,
      );
      await load();
      await checkTarget();
      onChanged?.();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 border border-dark-border bg-dark-card p-8">
      <div className="flex flex-col gap-2 border-b border-dark-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-uranium">
            <KeyRound className="h-4 w-4" />
            <span>Issuer access</span>
          </div>
          <h3 className="mt-1 font-header text-2xl font-bold text-alabaster">
            Who is allowed to create plans
          </h3>
        </div>
        <span className="font-mono text-[11px] text-zincGrey">
          Executes Stylus: <code>setIssuer(address, bool)</code>
        </span>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-500/10 p-3 font-mono text-[11px] text-red-400">
          {error}
        </div>
      )}
      {note && (
        <div className="border border-uranium bg-uranium/10 p-3 font-mono text-[11px] text-uranium">
          {note}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-2">
        <div className="border border-dark-border bg-dark p-3">
          <div className="text-[10px] uppercase text-zincGrey">Your wallet</div>
          <div className="mt-1 flex items-center gap-2">
            {selfAllowed === null ? (
              <span className="text-zincGrey">
                {isConnected ? "checking…" : "not connected"}
              </span>
            ) : selfAllowed ? (
              <>
                <ShieldCheck className="h-4 w-4 text-uranium" />
                <span className="font-bold text-uranium">AUTHORISED ISSUER</span>
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4 text-zincGrey" />
                <span className="text-zincGrey">NOT AN ISSUER</span>
              </>
            )}
          </div>
        </div>

        <div className="border border-dark-border bg-dark p-3">
          <div className="text-[10px] uppercase text-zincGrey">Contract admin</div>
          <div className="mt-1 text-alabaster">
            {admin ? shortAddress(admin) : "reading…"}
            {isAdmin && <span className="ml-2 text-uranium">(you)</span>}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="space-y-3 font-mono text-xs">
          <label className="block uppercase text-zincGrey" htmlFor="issuer-addr">
            Issuer address
          </label>
          <input
            id="issuer-addr"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className="w-full border border-dark-border bg-dark px-3 py-2 text-alabaster outline-none focus:border-uranium"
          />

          {targetAllowed !== null && (
            <p className="text-[11px] text-zincGrey">
              That address is currently{" "}
              <span className={targetAllowed ? "text-uranium" : "text-aviation"}>
                {targetAllowed ? "an authorised issuer" : "not an issuer"}
              </span>
              .
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => void submit(true)}
              disabled={busy !== null || !isConnected || wrongNetwork || !target.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 bg-uranium px-4 py-2.5 font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
            >
              {busy === "grant" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy === "grant" ? "Confirm…" : "Authorise"}
            </button>
            <button
              onClick={() => void submit(false)}
              disabled={busy !== null || !isConnected || wrongNetwork || !target.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-dark-border bg-dark-surface px-4 py-2.5 font-bold uppercase tracking-wider text-alabaster transition-all hover:border-aviation hover:text-aviation disabled:opacity-40"
            >
              {busy === "revoke" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy === "revoke" ? "Confirm…" : "Revoke"}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-zincGrey">
            An authorised issuer can call <code>createPlan()</code> and mint passes
            against their own plans. Revoking stops them creating new plans; passes
            already issued are unaffected and keep working until they expire.
          </p>
        </div>
      ) : (
        <p className="font-mono text-[11px] leading-relaxed text-zincGrey">
          Only the contract admin can change issuer access. Connect as{" "}
          {admin ? shortAddress(admin) : "the admin"} to grant or revoke it.
        </p>
      )}
    </div>
  );
}
