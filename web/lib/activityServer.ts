import { DEPLOY_BLOCK, LIQUID_PASS_ADDRESS, MARKETPLACE_ADDRESS } from "./contract";
import { decodeActivity, type Activity, type RawLog } from "./activity";
import snapshot from "./activity-snapshot.json";

/**
 * The activity feed, read once on the server and shared by every visitor.
 *
 * SERVER ONLY -- import it from API routes, never from a component.
 *
 * What this replaces: each browser used to rebuild the feed itself by asking a
 * public RPC for the contract's whole history in 9,000-block windows, all at
 * once. That was a few requests in September. By mid-November it was ~2,800
 * per page view, the public Arbitrum RPC answered with a 60-second rate-limit
 * ban, and because its 429 carries no CORS header every OTHER page's reads
 * were blocked for that visitor too. It grew by ~38 requests a day.
 *
 * How this stays small however old the contract gets:
 *   1. lib/activity-snapshot.json holds the history up to a known block
 *      (written by scripts/snapshot-activity.mjs from real logs, cross-checked
 *      against a second RPC).
 *   2. Only the blocks after it are read live, and what is read is kept in
 *      memory, so a warm server asks for nothing but the newest blocks.
 *   3. /api/activity is cacheable at the CDN, so most visitors never reach
 *      this code at all.
 */

type Source = {
  name: string;
  url: string;
  /** Largest block span one eth_getLogs may cover; null means unlimited. */
  window: number | null;
};

/**
 * In order of preference. Tenderly's public gateway serves an address-filtered
 * eth_getLogs across the full history in one request; PublicNode caps a
 * request at 50,000 blocks and so is walked in windows.
 */
const SOURCES: Source[] = [
  { name: "tenderly", url: "https://arbitrum-sepolia.gateway.tenderly.co", window: null },
  { name: "publicnode", url: "https://arbitrum-sepolia-rpc.publicnode.com", window: 45_000 },
];

/** How long a result is reused before the head is checked again. */
const FRESH_MS = 3_000;
/** A failed refresh may fall back on a result at most this old. */
const STALE_OK_MS = 60_000;
/**
 * Blocks re-read on every refresh. A load-balanced RPC can report a head from
 * one node and serve logs from another that is a little behind; without the
 * overlap, a log in that gap would be skipped and never looked for again.
 * 400 blocks is ~100 seconds on Arbitrum Sepolia.
 */
const OVERLAP = 400;
const CONCURRENCY = 5;

const hex = (n: number) => "0x" + n.toString(16);
const keyOf = (l: RawLog) => `${l.transactionHash}:${l.logIndex}`;

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${method} answered HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error || body.result === undefined) {
    throw new Error(`${method}: ${body.error?.message ?? "no result"}`);
  }
  return body.result;
}

type RpcLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  topics: string[];
  data: string;
};

async function getLogs(url: string, from: number, to: number): Promise<RawLog[]> {
  const logs = await rpc<RpcLog[]>(url, "eth_getLogs", [
    { address: [LIQUID_PASS_ADDRESS, MARKETPLACE_ADDRESS], fromBlock: hex(from), toBlock: hex(to) },
  ]);
  return logs.map((l) => ({
    address: l.address.toLowerCase(),
    blockNumber: parseInt(l.blockNumber, 16),
    transactionHash: l.transactionHash,
    logIndex: parseInt(l.logIndex, 16),
    topics: l.topics,
    data: l.data,
  }));
}

/**
 * Every log in [from, head] from one source, plus the head it was read at.
 *
 * Any failed window fails the whole read. The previous code swallowed failed
 * windows and returned what it had, which made a rate-limited scan look like a
 * quiet contract. Here a gap would be worse still, because the result is
 * remembered: better to report the failure and let the next source try.
 */
async function readFrom(source: Source, from: number): Promise<{ logs: RawLog[]; head: number }> {
  const head = parseInt(await rpc<string>(source.url, "eth_blockNumber", []), 16);
  if (from > head) return { logs: [], head };
  if (source.window === null) return { logs: await getLogs(source.url, from, head), head };

  const ranges: Array<[number, number]> = [];
  for (let f = from; f <= head; f += source.window) {
    ranges.push([f, Math.min(f + source.window - 1, head)]);
  }
  const logs: RawLog[] = [];
  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      ranges.slice(i, i + CONCURRENCY).map(([f, t]) => getLogs(source.url, f, t)),
    );
    logs.push(...batch.flat());
  }
  return { logs, head };
}

type State = {
  logs: Map<string, RawLog>;
  /** Every block up to and including this one has been read. */
  scannedTo: number;
  /** When the head was last checked successfully; 0 = never, snapshot only. */
  checkedAt: number;
};

function initialState(): State {
  const logs = new Map<string, RawLog>();
  // The snapshot only describes the contracts it was taken from. If an env var
  // points the app at different ones, start from the deploy block instead of
  // showing another deployment's history.
  const matches =
    snapshot.core.toLowerCase() === LIQUID_PASS_ADDRESS.toLowerCase() &&
    snapshot.marketplace.toLowerCase() === MARKETPLACE_ADDRESS.toLowerCase();
  if (!matches) return { logs, scannedTo: Number(DEPLOY_BLOCK) - 1, checkedAt: 0 };
  for (const l of snapshot.logs as RawLog[]) logs.set(keyOf(l), l);
  return { logs, scannedTo: snapshot.toBlock, checkedAt: 0 };
}

let state: State = initialState();
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const from = Math.max(Number(DEPLOY_BLOCK), state.scannedTo - OVERLAP + 1);
  let lastError: unknown;
  for (const source of SOURCES) {
    try {
      const { logs, head } = await readFrom(source, from);
      for (const l of logs) state.logs.set(keyOf(l), l);
      state.scannedTo = Math.max(state.scannedTo, head);
      state.checkedAt = Date.now();
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No RPC could be reached");
}

export type ActivityResult = {
  activity: Activity[];
  /** The newest block the feed covers. */
  scannedTo: number;
};

/**
 * Recent on-chain activity, newest first.
 *
 * Real logs only. If no RPC can be reached and there is no recent result to
 * fall back on, this throws rather than serving the snapshot as if it were
 * current -- the caller shows a connection problem, not a feed that silently
 * stops at an old block.
 */
export async function loadActivity(limit = 25): Promise<ActivityResult> {
  if (Date.now() - state.checkedAt > FRESH_MS) {
    // One refresh at a time: concurrent requests wait on the same read.
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    try {
      await inflight;
    } catch (e) {
      if (Date.now() - state.checkedAt > STALE_OK_MS) throw e;
    }
  }
  return {
    activity: decodeActivity([...state.logs.values()]).slice(0, limit),
    scannedTo: state.scannedTo,
  };
}
