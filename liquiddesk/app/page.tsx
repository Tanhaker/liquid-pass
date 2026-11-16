"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, stringToHex } from "viem";

/**
 * LiquidDesk: a sample SaaS product that shows "Unlock with Liquid Pass" at work.
 *
 * It wears Liquid Pass's own design system (see globals.css) so the pair read
 * as one product family, but it is a separate app with a separate job: it is
 * the SaaS company's side of the story. All it knows about Liquid Pass is the
 * read-only check in lib/chain.ts.
 *
 * The page holds no access logic of its own. It asks the server "am I in?"
 * every few seconds and draws the answer, which is why the app locks on
 * screen, mid-session, the moment the pass is sold to someone else.
 */

const LIQUID_PASS_URL = process.env.NEXT_PUBLIC_LIQUID_PASS_URL || "https://liquidpass.xyz";
const RECHECK_MS = 4_000;

/**
 * The main site's sections, so moving between the two apps feels like moving
 * between pages of one product. LiquidDesk itself is the highlighted entry.
 */
const SITE_LINKS = [
  { href: `${LIQUID_PASS_URL}/market`, label: "Market" },
  { href: `${LIQUID_PASS_URL}/dashboard`, label: "My Passes" },
  { href: `${LIQUID_PASS_URL}/use`, label: "Use Pass" },
];

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};
type Wallet = { id: string; name: string; icon?: string; provider: Eip1193 };

type Pass = { tokenId: number; planName: string; expiry: number; rented: boolean };
type Status =
  | { signedIn: false }
  | { signedIn: true; address: string; granted: true; pass: Pass }
  | { signedIn: true; address: string; granted: false; reason: "no-pass" | "expired" };
type Summary = { keyPoints: string[]; words: number; sentences: number; readingMinutes: number };

const SAMPLE = `Kickoff notes for the capstone project. We agreed the app will let students resell unused subscription time instead of losing it. Bhakti will own the contract tests and Darshan will own the front end. The first milestone is a working purchase flow on testnet by Friday. We also discussed pricing: the resale price should fall as the expiry gets closer, so a listing never goes stale. The biggest risk is the pitch failing on a slow network, so we will rehearse the full flow twice with two wallets. Open question: do we show the price in ETH or in dollars? We will decide after talking to five students this week.`;

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

function timeLeft(expiry: number, nowMs: number): string {
  let s = Math.max(0, expiry - Math.floor(nowMs / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/** Wallets announce themselves (EIP-6963); `window.ethereum` is the fallback. */
function useWallets(): Wallet[] {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  useEffect(() => {
    const found = new Map<string, Wallet>();
    const onAnnounce = (event: Event) => {
      const d = (event as CustomEvent).detail as
        | { info: { uuid: string; name: string; icon?: string }; provider: Eip1193 }
        | undefined;
      if (!d?.info?.uuid || !d.provider) return;
      found.set(d.info.uuid, { id: d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider });
      setWallets([...found.values()]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = setTimeout(() => {
      const injected = (window as unknown as { ethereum?: Eip1193 }).ethereum;
      if (found.size === 0 && injected) {
        setWallets([{ id: "injected", name: "Browser wallet", provider: injected }]);
      }
    }, 400);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(fallback);
    };
  }, []);
  return wallets;
}

export default function Page() {
  const wallets = useWallets();
  const [status, setStatus] = useState<Status | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [justLocked, setJustLocked] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const wasGranted = useRef(false);
  const provider = useRef<Eip1193 | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/access", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not check access");
      const next = body as Status;
      const granted = next.signedIn && next.granted;
      // Signed in, was unlocked, now is not: the pass left this wallet.
      if (wasGranted.current && next.signedIn && !granted) setJustLocked(true);
      if (granted) setJustLocked(false);
      wasGranted.current = granted;
      setStatus(next);
      setCheckedAt(Date.now());
      setProblem(null);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(tick);
  }, [refresh]);

  const signedIn = status?.signedIn === true;
  useEffect(() => {
    if (!signedIn) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, RECHECK_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [signedIn, refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    wasGranted.current = false;
    setJustLocked(false);
    await refresh();
  }, [refresh]);

  // Switching account in the wallet must not leave the old wallet signed in.
  const sessionAddress = status?.signedIn ? status.address : null;
  useEffect(() => {
    const p = provider.current;
    if (!p?.on || !sessionAddress) return;
    const onAccounts = (...args: unknown[]) => {
      const first = (args[0] as string[] | undefined)?.[0];
      if (!first || first.toLowerCase() !== sessionAddress.toLowerCase()) void signOut();
    };
    p.on("accountsChanged", onAccounts);
    return () => p.removeListener?.("accountsChanged", onAccounts);
  }, [sessionAddress, signOut]);

  async function signIn(wallet: Wallet) {
    setBusy(wallet.id);
    setProblem(null);
    try {
      const accounts = (await wallet.provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) throw new Error("The wallet did not share an account.");
      const address = getAddress(accounts[0]);

      const challenge = await fetch(`/api/nonce?address=${address}`).then((r) => r.json());
      if (!challenge.message) throw new Error(challenge.error ?? "Could not start sign-in.");

      const signature = await wallet.provider.request({
        method: "personal_sign",
        params: [stringToHex(challenge.message), address],
      });

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Sign-in failed.");

      provider.current = wallet.provider;
      await refresh();
    } catch (e) {
      const err = e as { code?: number; message?: string };
      setProblem(err.code === 4001 ? "You cancelled the request in your wallet." : (err.message ?? "Sign-in failed."));
    } finally {
      setBusy(null);
    }
  }

  const unlocked = status?.signedIn === true && status.granted;

  return (
    <div className="grain">
      <header className="nav">
        <div className="nav-in">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={35} height={36} />
            <span className="brand-text">
              <span className="brand-name">
                LIQUID<span className="accent">DESK</span>
              </span>
              <span className="brand-sub">Sample SaaS app // Unlocked by Liquid Pass</span>
            </span>
          </a>
          <nav className="nav-links" aria-label="Liquid Pass">
            {SITE_LINKS.map((l) => (
              <a key={l.href} className="nav-link" href={l.href}>
                {l.label}
              </a>
            ))}
            <span className="nav-link active" aria-current="page">
              LiquidDesk
            </span>
          </nav>
          <div className="nav-right">
            <a className="nav-item powered" href={LIQUID_PASS_URL}>
              <ZapIcon />
              <span>Powered by:</span>
              <b>LiquidPass</b>
            </a>
            {status?.signedIn && (
              <>
                <button className="nav-item" onClick={() => void signOut()}>
                  Sign out
                </button>
                <span className="nav-item wallet" title={status.address}>
                  {short(status.address)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="nav-row">
          {SITE_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <span className="active">LiquidDesk</span>
        </div>
      </header>

      <main className="wrap">
        <div className="head">
          <div className="chip">
            <ShieldIcon />
            <span>Unlock with Liquid Pass // Sample SaaS app</span>
          </div>
          <h1>LiquidDesk Pro Workspace</h1>
          <p className="lede">
            A notes tool that condenses long text into its key points. There is no account to create: Pro unlocks for
            any wallet holding a valid LiquidDesk pass, checked live on Arbitrum Stylus.
          </p>
        </div>

        <div className="cols">
          <section className="card" aria-live="polite">
            <div className="card-head">
              <h3>Pass-Gated Workspace</h3>
              <span className="tagline">Reads isActive() + ownerOf()</span>
            </div>

            {status === null ? (
              <>
                <div className="loading">{problem ?? "Querying Arbitrum Stylus contract..."}</div>
                {problem && (
                  <div className="actions">
                    <button className="btn outline" onClick={() => void refresh()}>
                      Try again
                    </button>
                  </div>
                )}
              </>
            ) : unlocked ? (
              <Unlocked pass={status.pass} address={status.address} now={now} />
            ) : (
              <Locked
                status={status}
                wallets={wallets}
                busy={busy}
                justLocked={justLocked}
                onSignIn={signIn}
                onSignOut={() => void signOut()}
              />
            )}

            {status !== null && problem && <div className="problem">{problem}</div>}

            {status?.signedIn && (
              <div className="status">
                <span className={`dot ${unlocked ? "ok" : "no"}`} aria-hidden="true" />
                <span>
                  Checked on-chain{" "}
                  {checkedAt && now ? `${Math.max(0, Math.round((now - checkedAt) / 1000))}s ago` : "just now"} //
                  Re-checked every {RECHECK_MS / 1000}s
                </span>
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-head">
              <div className="title">
                <CodeIcon />
                <h3>How the Unlock Works</h3>
              </div>
            </div>
            <p className="body-copy">
              LiquidDesk keeps no user database and no passwords. Holding the pass is the access, and the contract is
              the only source of truth.
            </p>
            <ol className="steps">
              <li>
                <strong>Sign in with a wallet</strong>
                You sign a one-time message. It is free and sends no transaction. The server verifies the signature, so
                it knows the wallet is yours.
              </li>
              <li>
                <strong>The server reads the pass contract</strong>
                <code>isActive</code> says the time has not run out, <code>ownerOf</code> says who holds the pass, and{" "}
                <code>issuerOf</code> says it is a LiquidDesk pass. These calls are free.
              </li>
              <li>
                <strong>It asks again on every request</strong>
                Sell or gift the pass and this app locks for you within seconds, then unlocks for the new holder. The
                expiry date never changes.
              </li>
            </ol>
            <pre aria-label="The access check">
              <code>{`const holdsPass =
  (await core.isActive(tokenId)) &&
  (await core.ownerOf(tokenId)) === wallet &&
  (await core.issuerOf(tokenId)) === LIQUIDDESK;`}</code>
            </pre>
            <div className="note">
              <b>Zero Backend Database Required</b>
              <p>
                No pass yet?{" "}
                <a href={`${LIQUID_PASS_URL}/dashboard`} target="_blank" rel="noreferrer">
                  Get one on Liquid Pass
                </a>
                , or buy someone&apos;s remaining days on the{" "}
                <a href={`${LIQUID_PASS_URL}/market`} target="_blank" rel="noreferrer">
                  resale market
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="foot-in">
          <span>
            LiquidDesk is a sample product built to show{" "}
            <a href={LIQUID_PASS_URL} target="_blank" rel="noreferrer">
              LiquidPass
            </a>{" "}
            in use
          </span>
          <span>Arbitrum Sepolia testnet // No real money moves</span>
        </div>
      </footer>
    </div>
  );
}

function Locked({
  status,
  wallets,
  busy,
  justLocked,
  onSignIn,
  onSignOut,
}: {
  status: Status;
  wallets: Wallet[];
  busy: string | null;
  justLocked: boolean;
  onSignIn: (w: Wallet) => void;
  onSignOut: () => void;
}) {
  if (!status.signedIn) {
    return (
      <>
        <div className="panel">
          <LockIcon />
          <div className="panel-body">
            <span className="verdict">Locked: sign in to check your pass</span>
            <p>Sign in with the wallet that holds your LiquidDesk pass. No email and no password.</p>
          </div>
        </div>
        {wallets.length === 0 ? (
          <p className="hint">No wallet found in this browser. Install a wallet such as MetaMask, then reload.</p>
        ) : (
          <div className="actions">
            {wallets.map((w) => (
              <button key={w.id} className="btn" disabled={busy !== null} onClick={() => onSignIn(w)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.icon && <img src={w.icon} alt="" />}
                {busy === w.id ? "Check your wallet..." : `Sign in with ${w.name}`}
              </button>
            ))}
          </div>
        )}
        <p className="hint">Signing in is free. It proves the wallet is yours and sends no transaction.</p>
      </>
    );
  }

  const expired = status.granted === false && status.reason === "expired";
  return (
    <>
      <div className="panel bad">
        <XIcon />
        <div className="panel-body">
          <span className="verdict">
            {justLocked ? "Access ended: pass left this wallet" : "Verified: access denied"}
          </span>
          <p>
            {justLocked ? (
              <>
                <strong>{short(status.address)}</strong> no longer holds the pass. It was sold, gifted or ran out of
                time, so Pro locked straight away. The new holder can sign in and use the days that are left.
              </>
            ) : expired ? (
              <>
                <strong>{short(status.address)}</strong> holds a LiquidDesk pass, but its time has run out.
              </>
            ) : (
              <>
                <strong>{short(status.address)}</strong> is signed in, but it does not hold an active LiquidDesk pass.
              </>
            )}
          </p>
          <dl className="rows">
            <div>
              <dt>Wallet:</dt>
              <dd>{short(status.address)}</dd>
            </div>
            <div>
              <dt>LiquidDesk pass:</dt>
              <dd className="red">{expired ? "EXPIRED" : "NONE HELD"}</dd>
            </div>
            <div>
              <dt>Pro workspace:</dt>
              <dd className="red">LOCKED</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="actions">
        <a className="btn" href={`${LIQUID_PASS_URL}/dashboard`} target="_blank" rel="noreferrer">
          Get a pass on Liquid Pass
        </a>
        <button className="btn outline" onClick={onSignOut}>
          Use another wallet
        </button>
      </div>
    </>
  );
}

function Unlocked({ pass, address, now }: { pass: Pass; address: string; now: number | null }) {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/summarise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not summarise.");
      setSummary(body as Summary);
    } catch (e) {
      setSummary(null);
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="panel ok">
        <CheckIcon />
        <div className="panel-body">
          <span className="verdict">Verified: access granted</span>
          <p>This wallet holds an active LiquidDesk pass, so the Pro workspace is unlocked.</p>
          <dl className="rows">
            <div>
              <dt>Plan:</dt>
              <dd>{pass.planName}</dd>
            </div>
            <div>
              <dt>Pass:</dt>
              <dd>Token #{pass.tokenId}</dd>
            </div>
            <div>
              <dt>{pass.rented ? "Rented by:" : "Access holder:"}</dt>
              <dd className="green">{short(address)}</dd>
            </div>
            <div>
              <dt>Time left:</dt>
              <dd className="green">{now ? timeLeft(pass.expiry, now) : "..."}</dd>
            </div>
            <div>
              <dt>Expires:</dt>
              <dd className="plain">{new Date(pass.expiry * 1000).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Paste your notes:</label>
        <textarea
          id="notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Meeting notes, a lecture transcript or a long message..."
          rows={7}
        />
        <div className="actions">
          <button className="btn" disabled={working || text.trim().length < 40} onClick={() => void run()}>
            {working ? "Summarising..." : "Summarise"}
          </button>
          <button className="btn outline" onClick={() => setText(SAMPLE)}>
            Use sample notes
          </button>
        </div>
      </div>

      {error && <div className="problem">{error}</div>}
      {summary && (
        <div className="result">
          <h4>Key points</h4>
          {summary.keyPoints.length ? (
            <ul>
              {summary.keyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">These notes are too short to summarise.</p>
          )}
          <p className="hint">
            {summary.words} words // {summary.sentences} sentences // about {summary.readingMinutes} min to read
          </p>
        </div>
      )}
    </>
  );
}

/* Icons drawn to match the lucide set the main site uses (24px grid, 2px stroke). */
const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function LockIcon() {
  return (
    <svg {...icon}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg {...icon}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg {...icon}>
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg {...icon}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}
