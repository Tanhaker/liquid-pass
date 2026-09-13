"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { isAddress, getAddress } from "viem";
import { ShieldCheck, ShieldOff, KeyRound, Loader2, Send, Inbox } from "lucide-react";
import {
  ISSUER_REQUESTS_ADDRESS,
  LIQUID_PASS_ADDRESS,
  issuerRequestsAbi,
  liquidPassAbi,
  shortAddress,
} from "@/lib/contract";
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
type OpenRequest = {
  requester: `0x${string}`;
  company: string;
  note: string;
  requestedAt: number;
};

/** How many of the most recent requesters the admin list reads. */
const REQUEST_PAGE = 50;

const byteLength = (text: string) => new TextEncoder().encode(text).length;

type Busy =
  | "grant"
  | "revoke"
  | "request"
  | "withdraw"
  | `approve:${string}`
  | `dismiss:${string}`
  | null;

export function IssuerAccess({
  onChanged,
  onStatus,
}: {
  onChanged?: () => void;
  /** Reports whether the connected wallet may create plans, once known. */
  onStatus?: (status: { isIssuer: boolean | null; isAdmin: boolean }) => void;
}) {
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
  const [busy, setBusy] = useState<Busy>(null);

  // Requests (IssuerRequests.sol): the connected wallet's own open request,
  // and for the admin, everyone's.
  const [myRequest, setMyRequest] = useState<OpenRequest | null>(null);
  const [company, setCompany] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [openRequests, setOpenRequests] = useState<OpenRequest[] | null>(null);
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
        const allowed = await client.readContract({
          address: LIQUID_PASS_ADDRESS,
          abi: liquidPassAbi,
          functionName: "isIssuer",
          args: [address],
        });
        setSelfAllowed(allowed);

        const [c, n, at] = await client.readContract({
          address: ISSUER_REQUESTS_ADDRESS,
          abi: issuerRequestsAbi,
          functionName: "requests",
          args: [address],
        });
        setMyRequest(at > 0n ? { requester: address, company: c, note: n, requestedAt: Number(at) } : null);
      } else {
        setSelfAllowed(null);
        setMyRequest(null);
      }

      // Everyone's open requests, for the admin only.
      if (address && a.toLowerCase() === address.toLowerCase()) {
        const count = await client.readContract({
          address: ISSUER_REQUESTS_ADDRESS,
          abi: issuerRequestsAbi,
          functionName: "requesterCount",
        });
        const from = count > BigInt(REQUEST_PAGE) ? count - BigInt(REQUEST_PAGE) : 0n;
        const indexes: bigint[] = [];
        for (let i = count; i > from; i--) indexes.push(i - 1n); // newest first
        const who = await Promise.all(
          indexes.map((i) =>
            client.readContract({
              address: ISSUER_REQUESTS_ADDRESS,
              abi: issuerRequestsAbi,
              functionName: "requesters",
              args: [i],
            }),
          ),
        );
        const rows = await Promise.all(
          who.map(async (r) => {
            const [[c, n, at], allowed] = await Promise.all([
              client.readContract({
                address: ISSUER_REQUESTS_ADDRESS,
                abi: issuerRequestsAbi,
                functionName: "requests",
                args: [r],
              }),
              client.readContract({
                address: LIQUID_PASS_ADDRESS,
                abi: liquidPassAbi,
                functionName: "isIssuer",
                args: [r],
              }),
            ]);
            // Open = filed, not withdrawn or declined, and not already approved.
            return at > 0n && !allowed
              ? { requester: r, company: c, note: n, requestedAt: Number(at) }
              : null;
          }),
        );
        setOpenRequests(rows.filter((x): x is OpenRequest => x !== null));
      } else {
        setOpenRequests(null);
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

  useEffect(() => {
    onStatus?.({ isIssuer: isConnected ? selfAllowed : false, isAdmin });
  }, [onStatus, selfAllowed, isAdmin, isConnected]);

  /** Shared shape for the request-side writes. */
  const send = async (
    label: NonNullable<Busy>,
    title: string,
    write: () => Promise<`0x${string}`>,
    done: string,
  ) => {
    setError(null);
    setNote(null);
    setBusy(label);
    try {
      const hash = await txToast(title, write);
      setNote(`${done} — ${hash.slice(0, 10)}…`);
      await load();
      onChanged?.();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  };

  const fileRequest = () => {
    const name = company.trim();
    const why = requestNote.trim();
    if (!name) return setError("Enter your company or product name.");
    if (byteLength(name) > 64) return setError("Company name is too long (64 bytes max).");
    if (byteLength(why) > 280) return setError("Note is too long (280 bytes max).");
    void send(
      "request",
      "Requested issuer access",
      async () =>
        writeContractAsync({
          address: ISSUER_REQUESTS_ADDRESS,
          abi: issuerRequestsAbi,
          functionName: "request",
          args: [name, why],
          chainId: arbitrumSepolia.id,
          gas: 400_000n,
          ...(await fees()),
        }),
      "Request sent to the admin",
    );
  };

  const approve = (r: OpenRequest) =>
    void send(
      `approve:${r.requester}`,
      `Authorised ${shortAddress(r.requester)}`,
      async () =>
        writeContractAsync({
          address: LIQUID_PASS_ADDRESS,
          abi: liquidPassAbi,
          functionName: "setIssuer",
          args: [r.requester, true],
          chainId: arbitrumSepolia.id,
          gas: 400_000n,
          ...(await fees()),
        }),
      `Authorised ${r.company} (${shortAddress(r.requester)})`,
    );

  const decline = (r: OpenRequest) =>
    void send(
      `dismiss:${r.requester}`,
      `Declined ${shortAddress(r.requester)}`,
      async () =>
        writeContractAsync({
          address: ISSUER_REQUESTS_ADDRESS,
          abi: issuerRequestsAbi,
          functionName: "dismiss",
          args: [r.requester],
          chainId: arbitrumSepolia.id,
          gas: 300_000n,
          ...(await fees()),
        }),
      `Declined the request from ${r.company}`,
    );

  const withdraw = () =>
    void send(
      "withdraw",
      "Withdrew issuer access request",
      async () =>
        writeContractAsync({
          address: ISSUER_REQUESTS_ADDRESS,
          abi: issuerRequestsAbi,
          functionName: "withdraw",
          chainId: arbitrumSepolia.id,
          gas: 300_000n,
          ...(await fees()),
        }),
      "Request withdrawn",
    );

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

      {isAdmin && openRequests !== null && (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 uppercase text-zincGrey">
            <Inbox className="h-4 w-4 text-uranium" />
            <span>Access requests ({openRequests.length})</span>
          </div>
          {openRequests.length === 0 ? (
            <p className="border border-dashed border-dark-border bg-dark p-3 text-[11px] text-zincGrey">
              No open requests.
            </p>
          ) : (
            <div className="mini-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
              {openRequests.map((r) => (
                <div key={r.requester} className="space-y-2 border border-dark-border bg-dark p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-alabaster">{r.company}</span>
                    <span className="text-[10px] text-zincGrey">
                      {shortAddress(r.requester)} · {new Date(r.requestedAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  {r.note && (
                    <p className="break-words text-[11px] leading-relaxed text-zincGrey">{r.note}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(r)}
                      disabled={busy !== null || wrongNetwork}
                      className="flex-1 bg-uranium px-3 py-1.5 font-extrabold uppercase tracking-wider text-black hover:bg-uranium-glow disabled:opacity-40"
                    >
                      {busy === `approve:${r.requester}` ? "Confirm…" : "Approve"}
                    </button>
                    <button
                      onClick={() => decline(r)}
                      disabled={busy !== null || wrongNetwork}
                      className="flex-1 border border-dark-border bg-dark-surface px-3 py-1.5 font-bold uppercase tracking-wider text-alabaster hover:border-aviation hover:text-aviation disabled:opacity-40"
                    >
                      {busy === `dismiss:${r.requester}` ? "Confirm…" : "Decline"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin ? (
        <div className="space-y-3 border-t border-dark-border pt-5 font-mono text-xs">
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
      ) : !isConnected ? (
        <p className="font-mono text-[11px] leading-relaxed text-zincGrey">
          Connect a wallet to request access to issue plans.
        </p>
      ) : selfAllowed ? (
        <p className="font-mono text-[11px] leading-relaxed text-zincGrey">
          Your wallet can create plans. Only the contract admin can change issuer access.
        </p>
      ) : selfAllowed === false && myRequest ? (
        <div className="space-y-3 border border-uranium/40 bg-uranium/5 p-4 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold uppercase text-uranium">
            <Send className="h-4 w-4" />
            <span>Request sent</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zincGrey">
            Asked as <span className="text-alabaster">{myRequest.company}</span> on{" "}
            {new Date(myRequest.requestedAt * 1000).toLocaleString()}. The admin,{" "}
            {admin ? shortAddress(admin) : "the admin"}, sees it on this page. Once it is
            approved, the plan tools appear here for your wallet.
          </p>
          <button
            onClick={withdraw}
            disabled={busy !== null || wrongNetwork}
            className="border border-dark-border bg-dark-surface px-4 py-2 font-bold uppercase tracking-wider text-alabaster hover:border-aviation hover:text-aviation disabled:opacity-40"
          >
            {busy === "withdraw" ? "Confirm…" : "Withdraw request"}
          </button>
        </div>
      ) : selfAllowed === false ? (
        <div className="space-y-3 font-mono text-xs">
          <p className="text-[11px] leading-relaxed text-zincGrey">
            Only the contract admin, {admin ? shortAddress(admin) : "the admin"}, can let a wallet
            create plans. Ask for access below: the request is recorded on-chain and appears on
            this page for the admin to approve or decline.
          </p>
          <label className="block uppercase text-zincGrey" htmlFor="req-company">
            Company or product
          </label>
          <input
            id="req-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={64}
            placeholder="e.g. Acme AI"
            className="w-full border border-dark-border bg-dark px-3 py-2 text-alabaster outline-none focus:border-uranium"
          />
          <label className="block uppercase text-zincGrey" htmlFor="req-note">
            Note for the admin (optional)
          </label>
          <textarea
            id="req-note"
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="What plans you want to issue"
            className="w-full resize-none border border-dark-border bg-dark px-3 py-2 text-alabaster outline-none focus:border-uranium"
          />
          <button
            onClick={fileRequest}
            disabled={busy !== null || wrongNetwork || !company.trim()}
            className="inline-flex w-full items-center justify-center gap-2 bg-uranium px-4 py-2.5 font-extrabold uppercase tracking-wider text-black transition-all hover:bg-uranium-glow disabled:opacity-40"
          >
            {busy === "request" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy === "request" ? "Confirm…" : "Request access"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
