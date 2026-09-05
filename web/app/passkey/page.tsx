"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Fingerprint, ShieldCheck, XCircle, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import {
  PASSKEY_WALLET_ADDRESS,
  PASSKEY_EXPECTED_ORIGIN,
  passkeyWalletAbi,
} from "@/lib/contract";
import {
  createPasskey,
  signChallenge,
  extractChallenge,
  extractOrigin,
  base64urlToBytes,
  bytesToHex,
  hexToBytes,
  parseFlags,
  sha256,
  signedMessage,
  toHex32,
  verifyLocally,
  type CreatedPasskey,
  type SignedAssertion,
} from "@/lib/passkey";

/**
 * The P-256 verifier, made visible.
 *
 * This project exists because every passkey authenticator signs with
 * secp256r1, for which the EVM has no precompile, and Stylus turns that from
 * hand-rolled field arithmetic into a library call. That claim was previously
 * only asserted in copy -- the website never touched navigator.credentials.
 *
 * This page performs the whole ceremony for real and shows each intermediate
 * value, so the claim can be checked rather than believed.
 *
 * One honest limitation, stated on the page as well as here: the deployed
 * wallet was compiled with EXPECTED_ORIGIN = "http://localhost:3000" and must
 * not be redeployed, so execute() on chain can only ever accept an assertion
 * produced at that exact origin. Everywhere else, the signature is still
 * genuinely verified -- in the browser, against the same curve, by WebCrypto.
 */

type Row = { label: string; value: string; mono?: boolean; tone?: "ok" | "bad" | "warn" };

function Field({ label, value, mono = true, tone }: Row) {
  const colour =
    tone === "ok" ? "text-uranium" : tone === "bad" ? "text-red-400" : tone === "warn" ? "text-aviation" : "text-alabaster";
  return (
    <div className="border border-dark-border bg-dark p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-zincGrey">{label}</div>
      <div className={`mt-1 break-all ${mono ? "font-mono" : ""} text-[12px] ${colour}`}>{value}</div>
    </div>
  );
}

export default function PasskeyPage() {
  const client = usePublicClient();

  const [origin, setOrigin] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  const [onChain, setOnChain] = useState<{ nonce: bigint; x: bigint; y: bigint } | null>(null);
  const [challenge, setChallenge] = useState<`0x${string}` | null>(null);

  const [created, setCreated] = useState<CreatedPasskey | null>(null);
  const [assertion, setAssertion] = useState<SignedAssertion | null>(null);
  const [derived, setDerived] = useState<{
    challengeInClientData: string | null;
    challengeBytes: string;
    originInClientData: string | null;
    digest: string;
    flags: { userPresent: boolean; userVerified: boolean };
    locallyValid: boolean;
    challengeMatches: boolean;
  } | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setSupported(typeof window.PublicKeyCredential !== "undefined");
  }, []);

  const loadChain = useCallback(async () => {
    if (!client) return;
    try {
      const [nonce, pubkey, ch] = await Promise.all([
        client.readContract({
          address: PASSKEY_WALLET_ADDRESS,
          abi: passkeyWalletAbi,
          functionName: "nonce",
        }),
        client.readContract({
          address: PASSKEY_WALLET_ADDRESS,
          abi: passkeyWalletAbi,
          functionName: "pubkey",
        }),
        client.readContract({
          address: PASSKEY_WALLET_ADDRESS,
          abi: passkeyWalletAbi,
          functionName: "getChallenge",
          // A harmless no-op call: the challenge binds target, value, data,
          // the nonce and this contract's address, so any target demonstrates
          // the binding without implying a transaction is about to happen.
          args: ["0x0000000000000000000000000000000000000001", 0n, "0x"],
        }),
      ]);
      setOnChain({ nonce, x: pubkey[0], y: pubkey[1] });
      setChallenge(ch);
    } catch (e) {
      setError(`Could not read the wallet: ${(e as Error).message}`);
    }
  }, [client]);

  useEffect(() => {
    void loadChain();
  }, [loadChain]);

  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      setCreated(await createPasskey());
      setAssertion(null);
      setDerived(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleSign = async () => {
    if (!created || !challenge) return;
    setBusy("sign");
    setError(null);
    try {
      const a = await signChallenge(hexToBytes(challenge), created.credentialId);
      setAssertion(a);

      const challengeInClientData = extractChallenge(a.clientDataJSON);
      const originInClientData = extractOrigin(a.clientDataJSON);
      const challengeBytes = challengeInClientData
        ? bytesToHex(base64urlToBytes(challengeInClientData))
        : "0x";

      // The digest the contract computes and the curve verifies over.
      const digest = bytesToHex(
        await sha256(await signedMessage(a.authenticatorData, a.clientDataJSON)),
      );

      setDerived({
        challengeInClientData,
        challengeBytes,
        originInClientData,
        digest,
        flags: parseFlags(a.authenticatorData),
        locallyValid: await verifyLocally(
          created.x,
          created.y,
          a.authenticatorData,
          a.clientDataJSON,
          a.r,
          a.s,
        ),
        challengeMatches: challengeBytes.toLowerCase() === challenge.toLowerCase(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const originMatches = origin !== null && origin === PASSKEY_EXPECTED_ORIGIN;
  const registered = onChain !== null && (onChain.x !== 0n || onChain.y !== 0n);

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-dark-border pb-8">
        <div className="mb-2 inline-flex items-center space-x-2 border border-uranium bg-uranium/10 px-2.5 py-0.5 font-mono text-xs font-bold uppercase text-uranium">
          <Fingerprint className="h-3.5 w-3.5" />
          <span>SECP256R1 ON ARBITRUM STYLUS</span>
        </div>
        <h1 className="font-header text-3xl font-extrabold tracking-tight text-alabaster sm:text-5xl">
          Passkey Verifier
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-zincGrey">
          Create a real passkey, sign a challenge issued by the deployed Stylus
          wallet, and inspect every value the contract checks. Nothing here is
          simulated and nothing is stored.
        </p>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-500/10 p-4 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {supported === false && (
        <div className="border border-aviation bg-aviation/10 p-4 font-mono text-xs text-aviation">
          This browser does not expose the WebAuthn API, so nothing on this page can run.
        </div>
      )}

      {/* ── The deployed wallet ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-header text-2xl font-bold text-alabaster">The deployed wallet</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contract" value={PASSKEY_WALLET_ADDRESS} />
          <Field
            label="Nonce"
            value={onChain ? onChain.nonce.toString() : "reading…"}
          />
          <Field
            label="Registered key — x"
            value={onChain ? toHex32(onChain.x) : "reading…"}
            tone={registered ? "ok" : undefined}
          />
          <Field
            label="Registered key — y"
            value={onChain ? toHex32(onChain.y) : "reading…"}
            tone={registered ? "ok" : undefined}
          />
        </div>
        <p className="font-body text-[13px] leading-relaxed text-zincGrey">
          A key is already registered, and <code className="text-alabaster">register()</code> reverts
          with <code className="text-alabaster">&quot;already registered&quot;</code> once one is —
          so this wallet is permanently bound to the device that claimed it. Anyone
          else can still do everything below; only the final on-chain{" "}
          <code className="text-alabaster">execute()</code> needs that device.
        </p>
      </section>

      {/* ── Origin binding ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-header text-2xl font-bold text-alabaster">Origin binding</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="This page" value={origin ?? "…"} />
          <Field
            label="Compiled into the contract"
            value={PASSKEY_EXPECTED_ORIGIN}
            tone={originMatches ? "ok" : "warn"}
          />
        </div>
        <div
          className={`flex items-start gap-3 border p-4 ${
            originMatches
              ? "border-uranium bg-uranium/10 text-uranium"
              : "border-aviation bg-aviation/10 text-aviation"
          }`}
        >
          {originMatches ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="font-body text-[13px] leading-relaxed">
            {originMatches ? (
              <>
                This origin matches the one compiled into the wallet, so an assertion
                signed here would pass the contract&apos;s origin check.
              </>
            ) : (
              <>
                This origin does not match. The contract compares the{" "}
                <code>origin</code> field of clientDataJSON against a compile-time
                constant, so <code>execute()</code> would reject an assertion signed
                here — by design, and the contract is deployed and must not be
                redeployed. Everything below still runs for real; the signature is
                verified in the browser against the same curve instead.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ── Step 1 ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-header text-2xl font-bold text-alabaster">1 · Create a passkey</h2>
        <button
          onClick={handleCreate}
          disabled={busy !== null || supported === false}
          className="inline-flex items-center gap-2 bg-uranium px-5 py-3 font-extrabold uppercase tracking-wider text-black shadow-grunge-uranium transition-all hover:bg-uranium-glow disabled:opacity-40"
        >
          {busy === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {busy === "create" ? "Waiting for your device…" : "Create passkey"}
        </button>

        {created && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Credential id" value={bytesToHex(created.credentialId)} />
            <Field label="Algorithm" value="ES256 (-7) · secp256r1" tone="ok" />
            <Field label="Public key — x" value={toHex32(created.x)} />
            <Field label="Public key — y" value={toHex32(created.y)} />
          </div>
        )}
      </section>

      {/* ── Step 2 ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-header text-2xl font-bold text-alabaster">
          2 · Sign the contract&apos;s challenge
        </h2>
        <Field
          label="getChallenge(target, value, data) — read from chain"
          value={challenge ?? "reading…"}
        />
        <p className="font-body text-[13px] leading-relaxed text-zincGrey">
          The challenge is not a transaction hash. The contract derives it from the
          call, the current nonce and its own address, so an assertion cannot be
          replayed against another transaction or another deployment.
        </p>
        <button
          onClick={handleSign}
          disabled={!created || !challenge || busy !== null}
          className="inline-flex items-center gap-2 border border-dark-border bg-dark-surface px-5 py-3 font-extrabold uppercase tracking-wider text-alabaster transition-all hover:border-uranium disabled:opacity-40"
        >
          {busy === "sign" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="h-4 w-4" />
          )}
          {busy === "sign" ? "Waiting for your device…" : "Sign with passkey"}
        </button>
        {!created && (
          <p className="font-mono text-[11px] text-zincGrey">Create a passkey first.</p>
        )}
      </section>

      {/* ── Step 3 ──────────────────────────────────────────────────────── */}
      {assertion && derived && (
        <section className="space-y-4">
          <h2 className="font-header text-2xl font-bold text-alabaster">
            3 · What the contract checks
          </h2>

          <div
            className={`flex items-center gap-3 border p-4 ${
              derived.locallyValid
                ? "border-uranium bg-uranium/10 text-uranium"
                : "border-red-500 bg-red-500/10 text-red-400"
            }`}
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <p className="font-mono text-[13px]">
              {derived.locallyValid
                ? "secp256r1 signature VERIFIED against the public key"
                : "signature did NOT verify"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Challenge in clientDataJSON (base64url)"
              value={derived.challengeInClientData ?? "not found"}
            />
            <Field
              label="…decoded, vs the contract's challenge"
              value={derived.challengeMatches ? "MATCHES" : "DOES NOT MATCH"}
              tone={derived.challengeMatches ? "ok" : "bad"}
            />
            <Field label="Origin in clientDataJSON" value={derived.originInClientData ?? "—"} />
            <Field
              label="User presence / verification"
              value={`UP=${derived.flags.userPresent ? "1" : "0"} · UV=${
                derived.flags.userVerified ? "1" : "0"
              }`}
              tone={derived.flags.userPresent ? "ok" : "bad"}
            />
            <Field label="signature r" value={toHex32(assertion.r)} />
            <Field
              label={assertion.wasHighS ? "signature s (folded to low-s)" : "signature s"}
              value={toHex32(assertion.s)}
              tone={assertion.wasHighS ? "warn" : undefined}
            />
          </div>

          <Field
            label="sha256(authenticatorData ‖ sha256(clientDataJSON))"
            value={derived.digest}
          />

          {assertion.wasHighS && (
            <div className="border border-aviation bg-aviation/10 p-4 font-body text-[13px] leading-relaxed text-aviation">
              Your authenticator emitted a high-s signature and it was folded to{" "}
              <code>n − s</code> before use. Both are valid for the same message, but
              the contract rejects <code>s &gt; n/2</code> to close off malleability —
              two different-looking signatures authorising one action. Windows Hello
              emits high-s roughly half the time, which is why this runs on every
              signature rather than only when something looks wrong.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
