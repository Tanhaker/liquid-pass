"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { PASSKEY_WALLET_ADDRESS, REQUIRED_ORIGIN, passKeyWalletAbi } from "@/lib/abi";
import type { Bytes } from "@/lib/passkey";
import {
  bytesToHex,
  createPasskey,
  hexToBytes,
  signChallenge,
  toHex32,
} from "@/lib/passkey";

const STORAGE_KEY = "passkey-wallet-credential-id";
const EXPLORER = "https://sepolia.arbiscan.io";

type LogLine = { text: string; kind?: "ok" | "bad" | "warn" };

/**
 * Explicit fee cap with headroom.
 *
 * Arbitrum Sepolia's base fee moves between the moment the wallet builds a
 * transaction and the moment the sequencer receives it. MetaMask's default cap
 * sits too close to the current base fee, so the node rejects the submission
 * with "max fee per gas less than block base fee" -- which viem surfaces as
 * "the contract function reverted", pointing at the contract rather than the
 * fee. Overpaying the cap is free: you are charged the actual base fee plus
 * tip, and the difference is never taken.
 */
async function feeOverrides(client: NonNullable<ReturnType<typeof usePublicClient>>) {
  const block = await client.getBlock();
  const base = block.baseFeePerGas ?? 100_000_000n;
  const tip = 1_000_000n;
  return { maxFeePerGas: base * 4n + tip, maxPriorityFeePerGas: tip };
}

export default function Page() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [credentialId, setCredentialId] = useState<Bytes | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [onChain, setOnChain] = useState<{ nonce: bigint; x: bigint; y: bigint } | null>(null);
  const [target, setTarget] = useState("");

  const say = useCallback((text: string, kind?: LogLine["kind"]) => {
    setLog((prev) => [...prev, { text, kind }]);
  }, []);

  // Restore the credential id across reloads; without it we cannot re-sign.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCredentialId(hexToBytes(stored));
  }, []);

  useEffect(() => {
    if (address && !target) setTarget(address);
  }, [address, target]);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    try {
      const [nonce, pubkey] = await Promise.all([
        publicClient.readContract({
          address: PASSKEY_WALLET_ADDRESS,
          abi: passKeyWalletAbi,
          functionName: "nonce",
        }),
        publicClient.readContract({
          address: PASSKEY_WALLET_ADDRESS,
          abi: passKeyWalletAbi,
          functionName: "pubkey",
        }),
      ]);
      setOnChain({ nonce, x: pubkey[0], y: pubkey[1] });
    } catch (e) {
      say(`read failed: ${(e as Error).message}`, "bad");
    }
  }, [publicClient, say]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * The fastest possible check that the SHA-256 precompile works: getChallenge
   * is a view that calls 0x02 internally, so a free eth_call proves the
   * precompile path before any passkey or gas is involved.
   */
  const probePrecompile = async () => {
    if (!publicClient) return;
    setBusy(true);
    try {
      say("eth_call getChallenge(0x0, 0, 0x) -- exercises the 0x02 precompile...");
      const digest = await publicClient.readContract({
        address: PASSKEY_WALLET_ADDRESS,
        abi: passKeyWalletAbi,
        functionName: "getChallenge",
        args: ["0x0000000000000000000000000000000000000000", 0n, "0x"],
      });
      say(`digest = ${digest}`, "ok");
      say("SHA-256 precompile works: the contract hashed and returned.", "ok");
    } catch (e) {
      say(`precompile probe FAILED: ${(e as Error).message}`, "bad");
      say("execute() cannot succeed until this does.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    setBusy(true);
    try {
      say("navigator.credentials.create, ES256 (-7) only...");
      const { credentialId: id, x, y } = await createPasskey();
      setCredentialId(id);
      localStorage.setItem(STORAGE_KEY, bytesToHex(id).slice(2));
      say(`passkey created, credential id ${bytesToHex(id).slice(0, 18)}...`, "ok");
      say(`x = ${toHex32(x)}`);
      say(`y = ${toHex32(y)}`);
      // localStorage, not sessionStorage: a reload between "create" and
      // "register" would otherwise lose the pubkey and force a new passkey.
      localStorage.setItem("pk-x", x.toString());
      localStorage.setItem("pk-y", y.toString());
    } catch (e) {
      say(`create failed: ${(e as Error).message}`, "bad");
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async () => {
    const xs = localStorage.getItem("pk-x");
    const ys = localStorage.getItem("pk-y");
    if (!xs || !ys) {
      say("create a passkey first", "bad");
      return;
    }
    setBusy(true);
    try {
      say("register(x, y)...");
      const fees = await feeOverrides(publicClient!);
      say(`maxFeePerGas ${fees.maxFeePerGas} wei`);
      const hash = await writeContractAsync({
        address: PASSKEY_WALLET_ADDRESS,
        abi: passKeyWalletAbi,
        functionName: "register",
        chainId: arbitrumSepolia.id,
        args: [BigInt(xs), BigInt(ys)],
        ...fees,
      });
      say(`register tx ${hash}`, "ok");
      await publicClient?.waitForTransactionReceipt({ hash });
      say("registered.", "ok");
      await refresh();
    } catch (e) {
      say(`register failed: ${(e as Error).message}`, "bad");
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!credentialId) {
      say("no passkey on this device yet", "bad");
      return;
    }
    if (!publicClient) return;
    setBusy(true);
    setTxHash(null);
    try {
      const to = (target || address) as `0x${string}`;
      const value = 0n;
      const data = "0x" as const;

      // 1. Ask the contract what the passkey must sign. The preimage binds the
      //    contract address and the current nonce (rule 6), so this has to be
      //    read fresh, not constructed client-side.
      say(`getChallenge(${to.slice(0, 10)}..., 0, 0x)...`);
      const challenge = await publicClient.readContract({
        address: PASSKEY_WALLET_ADDRESS,
        abi: passKeyWalletAbi,
        functionName: "getChallenge",
        args: [to, value, data],
      });
      say(`challenge = ${challenge}`, "ok");

      // 2. Sign it with the passkey.
      say("navigator.credentials.get -- touch your authenticator...");
      const assertion = await signChallenge(hexToBytes(challenge), credentialId);
      say(
        assertion.wasHighS
          ? "authenticator returned HIGH-s; normalised to n - s"
          : "authenticator returned low-s already",
        assertion.wasHighS ? "warn" : "ok",
      );
      say(`r = ${toHex32(assertion.r)}`);
      say(`s = ${toHex32(assertion.s)} (submitted)`);

      // 3. Relay it. The connected wallet pays gas; the passkey authorises.
      say("execute(...)...");
      const fees = await feeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: PASSKEY_WALLET_ADDRESS,
        abi: passKeyWalletAbi,
        functionName: "execute",
        chainId: arbitrumSepolia.id,
        ...fees,
        args: [
          to,
          value,
          data,
          bytesToHex(assertion.authenticatorData),
          bytesToHex(assertion.clientDataJSON),
          toHex32(assertion.r),
          toHex32(assertion.s),
        ],
      });
      setTxHash(hash);
      say(`execute tx ${hash}`, "ok");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        say("EXECUTE SUCCEEDED -- P-256 verified on chain.", "ok");
      } else {
        say("execute reverted", "bad");
      }
      await refresh();
    } catch (e) {
      say(`execute failed: ${(e as Error).message}`, "bad");
    } finally {
      setBusy(false);
    }
  };

  const wrongOrigin =
    typeof window !== "undefined" && window.location.origin !== REQUIRED_ORIGIN;
  const wrongChain = isConnected && chainId !== arbitrumSepolia.id;
  const registered = onChain !== null && !(onChain.x === 0n && onChain.y === 0n);

  return (
    <main>
      <h1>PassKey Wallet</h1>
      <p className="sub">
        secp256r1 verified on-chain by an Arbitrum Stylus contract.{" "}
        <a href={`${EXPLORER}/address/${PASSKEY_WALLET_ADDRESS}`} target="_blank" rel="noreferrer">
          {PASSKEY_WALLET_ADDRESS.slice(0, 10)}...
        </a>
      </p>

      {wrongOrigin && (
        <div className="card bad">
          Served from {typeof window !== "undefined" ? window.location.origin : "?"} but the
          contract requires {REQUIRED_ORIGIN}. Assertions will be rejected on origin binding.
        </div>
      )}
      {wrongChain && (
        <div className="card bad">Wrong network. Switch to Arbitrum Sepolia (421614).</div>
      )}

      <h2>0 · Precompile probe (free)</h2>
      <div className="card">
        <p className="muted" style={{ margin: "0 0 .6rem" }}>
          getChallenge is a view that calls the SHA-256 precompile at 0x02. This costs
          nothing and proves that path works before spending gas.
        </p>
        <button onClick={probePrecompile} disabled={busy}>
          Probe precompile
        </button>
      </div>

      <h2>1 · Relayer</h2>
      <div className="card row">
        {isConnected ? (
          <>
            <span className="ok">{address}</span>
            <button onClick={() => disconnect()}>Disconnect</button>
          </>
        ) : (
          connectors.map((c) => (
            <button key={c.uid} onClick={() => connect({ connector: c })}>
              Connect {c.name}
            </button>
          ))
        )}
      </div>

      <h2>2 · Passkey</h2>
      <div className="card">
        <div className="row">
          <button onClick={onCreate} disabled={busy}>
            Create passkey
          </button>
          <button onClick={onRegister} disabled={busy || !isConnected}>
            Register on chain
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {credentialId
            ? `credential on this device: ${bytesToHex(credentialId).slice(0, 18)}...`
            : "no credential on this device yet"}
          {registered ? " · contract has a pubkey registered" : " · contract not registered"}
        </p>
      </div>

      <h2>3 · Send transaction</h2>
      <div className="card">
        <label htmlFor="target">target (value 0, empty calldata)</label>
        <input
          id="target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0x..."
        />
        <div className="row" style={{ marginTop: ".8rem" }}>
          <button
            className="primary"
            onClick={onSend}
            disabled={busy || !isConnected || !credentialId}
          >
            Sign with passkey &amp; execute
          </button>
        </div>
      </div>

      {txHash && (
        <div className="card">
          <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
            View {txHash.slice(0, 18)}... on Arbiscan
          </a>
        </div>
      )}

      <h2>State</h2>
      <pre>
        {onChain
          ? `nonce = ${onChain.nonce}\nx     = ${toHex32(onChain.x)}\ny     = ${toHex32(onChain.y)}`
          : "reading..."}
      </pre>

      <h2>Log</h2>
      <pre className="log">
        {log.length === 0
          ? "(nothing yet)"
          : log.map((l, i) => (
              <div key={i} className={l.kind ?? ""}>
                {l.text}
              </div>
            ))}
      </pre>
    </main>
  );
}
