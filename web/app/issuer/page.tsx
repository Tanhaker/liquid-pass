"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { Banner, Empty, SkeletonGrid, humanise, useFees, useNow } from "@/components/ui";
import {
  EXPLORER,
  LIQUID_PASS_ADDRESS,
  formatRemaining,
  liquidPassAbi,
  remaining,
  shortAddress,
  type Pass,
  type Plan,
} from "@/lib/contract";
import { fetchPasses, fetchPlans } from "@/lib/data";

export default function Issuer() {
  const client = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const fees = useFees();
  const nowMs = useNow(1000);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tx, setTx] = useState<{ hash: string; what: string } | null>(null);

  // Whether this wallet may create plans at all. Read from the contract rather
  // than assumed, so the form can explain itself instead of failing on submit.
  const { data: allowed } = useReadContract({
    address: LIQUID_PASS_ADDRESS,
    abi: liquidPassAbi,
    functionName: "isIssuer",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const load = useCallback(async () => {
    if (!client) return;
    // No setState before the first await: doing so runs synchronously inside
    // the effect and triggers a cascading render.
    try {
      const [p, t] = await Promise.all([fetchPlans(client), fetchPasses(client)]);
      setPlans(p);
      setPasses(t);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const myPlans = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return plans.filter((p) => p.issuer.toLowerCase() === me);
  }, [plans, address]);

  /**
   * Per-plan numbers, all derived from chain state.
   *
   * `earned` counts only the primary sale: the royalty on each resale is real
   * but is not recoverable from a view call, since the contract stores the
   * original price rather than a running total. Showing a guessed figure would
   * be fabricating revenue, so resale income is labelled as not tracked here.
   */
  const statsByPlan = useMemo(() => {
    const now = Math.floor((nowMs ?? 0) / 1000);
    const m = new Map<string, { issued: number; active: number; expired: number; earned: bigint }>();
    for (const plan of plans) m.set(plan.id.toString(), { issued: 0, active: 0, expired: 0, earned: 0n });
    for (const pass of passes) {
      // paidOf is 0 for passes from mint(), which never had a primary sale.
      if (pass.paid === 0n) continue;
      const s = m.get(pass.planId.toString());
      if (!s) continue;
      s.issued++;
      if (Number(pass.expiry) > now) s.active++;
      else s.expired++;
      s.earned += pass.paid;
    }
    return m;
  }, [plans, passes, nowMs]);

  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  async function run(key: string, what: string, fn: () => Promise<`0x${string}`>) {
    setBusy(key);
    setTx(null);
    setError(null);
    try {
      const hash = await fn();
      setTx({ hash, what });
      await client?.waitForTransactionReceipt({ hash });
      await load();
    } catch (e) {
      setError(humanise(e as Error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Issuer console</h1>
      <p className="mt-2 max-w-lg text-[14px] text-muted">
        Publish a plan, and earn 10% every time one of its passes changes hands
        — for as long as it keeps trading.
      </p>

      {wrongNetwork && <Banner tone="warn">Switch your wallet to Arbitrum Sepolia.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {tx && (
        <Banner tone="ok">
          {tx.what} —{" "}
          <a
            className="underline underline-offset-2"
            href={`${EXPLORER}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            view on Arbiscan
          </a>
        </Banner>
      )}

      {!isConnected ? (
        <Empty
          title="Connect a wallet"
          body="Plans are owned by the address that creates them."
        />
      ) : (
        <>
          <NewPlan
            allowed={allowed === true}
            disabled={wrongNetwork}
            busy={busy === "create"}
            onCreate={(name, uri, price, duration) =>
              run("create", `Published ${name}`, async () =>
                writeContractAsync({
                  address: LIQUID_PASS_ADDRESS,
                  abi: liquidPassAbi,
                  functionName: "createPlan",
                  args: [name, uri, price, duration],
                  chainId: arbitrumSepolia.id,
                  ...(await fees()),
                }),
              )
            }
          />

          <h2 className="mt-14 text-[11px] uppercase tracking-[0.16em] text-faint">
            Your plans
          </h2>

          {loading ? (
            <SkeletonGrid n={2} />
          ) : myPlans.length === 0 ? (
            <Empty
              title="No plans published"
              body="Create one above and it appears on the market immediately."
            />
          ) : (
            <div className="mt-5 space-y-3">
              {myPlans.map((plan) => {
                const s = statsByPlan.get(plan.id.toString());
                return (
                  <div
                    key={plan.id.toString()}
                    className="hairline rounded-2xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-[15px] font-medium">{plan.name}</h3>
                        <p className="tnum mt-1 text-[11px] text-faint">
                          plan #{plan.id.toString()} · {formatEther(plan.price)} ETH ·{" "}
                          {formatRemaining(Number(plan.duration))} of access
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          run(
                            `p-${plan.id}`,
                            plan.open ? `Closed ${plan.name}` : `Reopened ${plan.name}`,
                            async () =>
                              writeContractAsync({
                                address: LIQUID_PASS_ADDRESS,
                                abi: liquidPassAbi,
                                functionName: "setPlanOpen",
                                args: [plan.id, !plan.open],
                                chainId: arbitrumSepolia.id,
                                ...(await fees()),
                              }),
                          )
                        }
                        disabled={busy === `p-${plan.id}` || wrongNetwork}
                        className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text disabled:opacity-40"
                      >
                        {busy === `p-${plan.id}`
                          ? "Confirm…"
                          : plan.open
                            ? "Close to new sales"
                            : "Reopen"}
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                      <Cell label="Issued" value={s?.issued ?? 0} />
                      <Cell label="Active" value={s?.active ?? 0} tone="var(--color-life-full)" />
                      <Cell label="Expired" value={s?.expired ?? 0} tone="var(--color-faint)" />
                      <div>
                        <p className="tnum text-[16px] font-semibold">
                          {formatEther(s?.earned ?? 0n)}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-faint">
                          ETH from sales
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] text-faint">
                      Resale royalties are paid straight to this address by the
                      contract and are not totalled here — the contract stores
                      each pass&rsquo;s original price, not a running sum, and
                      inventing one would be a made-up number.
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="tnum text-[16px] font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
    </div>
  );
}

function NewPlan({
  allowed,
  disabled,
  busy,
  onCreate,
}: {
  allowed: boolean;
  disabled: boolean;
  busy: boolean;
  onCreate: (name: string, uri: string, price: bigint, duration: bigint) => void;
}) {
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("30");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Give the plan a name — it shows on the market card.");
    let wei: bigint;
    try {
      wei = parseEther(price.trim() || "0");
    } catch {
      return setErr("Price must be a number, like 0.0002");
    }
    if (wei <= 0n) return setErr("Price must be above zero.");
    const d = Number(days);
    if (!Number.isFinite(d) || d <= 0) return setErr("Duration must be above zero.");
    onCreate(name.trim(), uri.trim(), wei, BigInt(Math.round(d * 86400)));
    setName("");
    setUri("");
    setPrice("");
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-[15px] font-medium">Publish a plan</h2>

      {!allowed && (
        <p className="mt-3 rounded-lg border border-life-low/30 bg-life-low/10 px-3 py-2 text-[12px] text-life-low">
          This address isn&rsquo;t on the issuer allowlist, so publishing will
          revert. The contract admin adds issuers with{" "}
          <code className="tnum">setIssuer</code>.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="Shown on the market card.">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Figma Pro"
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
          />
        </Field>
        <Field label="Metadata URI" hint="Optional. IPFS is never required to render a plan.">
          <input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="ipfs://…"
            className="tnum w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
          />
        </Field>
        <Field label="Price (ETH)" hint="Paid in full to you on every new pass.">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.0002"
            inputMode="decimal"
            className="tnum w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
          />
        </Field>
        <Field label="Duration (days)" hint="How long each pass lasts from purchase.">
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="30"
            inputMode="decimal"
            className="tnum w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-line-bright"
          />
        </Field>
      </div>

      {err && <p className="mt-3 text-[12px] text-life-crit">{err}</p>}

      <button
        onClick={submit}
        disabled={busy || disabled}
        className="mt-5 rounded-lg bg-text px-4 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Confirm in wallet…" : "Publish plan"}
      </button>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">{label}</span>
      <div className="mt-2">{children}</div>
      <span className="mt-1.5 block text-[11px] text-faint">{hint}</span>
    </label>
  );
}
