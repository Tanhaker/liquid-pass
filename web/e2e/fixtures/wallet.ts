import { test as base, expect, type Page } from "@playwright/test";

/**
 * A mock EIP-1193 wallet for end-to-end tests.
 *
 * The split that makes this useful:
 *
 *   reads  (eth_call, eth_getLogs, eth_getBlockByNumber, ...) are proxied to
 *          the real Arbitrum Sepolia RPC, so every number on the page is
 *          genuine on-chain data
 *   writes (eth_sendTransaction) are RECORDED and answered with a synthetic
 *          hash. Nothing is ever broadcast and no key exists here.
 *
 * Tests then assert on the recorded calldata -- target address, function
 * selector, arguments, value. That is precisely the class of bug that shipped
 * before (the Market buy button calling `buy` on the wrong ABI at the wrong
 * address, which could only ever revert), and catching it costs no testnet ETH.
 *
 * Belt and braces: the RPC route below hard-fails eth_sendRawTransaction, so
 * even a bug in this file cannot put a transaction on chain.
 */

export const TEST_ACCOUNT = "0x1111111111111111111111111111111111111111";
export const ARBITRUM_SEPOLIA_HEX = "0x66eee"; // 421614
export const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

/** Shape of a recorded write, as the page saw it. */
export type RecordedTx = {
  to: string;
  from?: string;
  data?: string;
  value?: string;
  gas?: string;
};

declare global {
  interface Window {
    __txs: RecordedTx[];
  }
}

/**
 * Synthetic receipt hash. Deterministic so the RPC interceptor can recognise
 * its own fabrications and answer eth_getTransactionReceipt for them --
 * otherwise the app would sit in its pending state forever, because
 * waitForTransactionReceipt goes out through viem's own http transport rather
 * than through window.ethereum.
 */
export const FAKE_TX_PREFIX = "0xfeed";

function initScript(args: { account: string; chainIdHex: string; rpcUrl: string }) {
  // Everything in here runs in the page, before any app code. It cannot close
  // over anything from the module scope, and addInitScript passes exactly one
  // argument, hence the single bag.
  const { account: ACCOUNT, chainIdHex: CHAIN, rpcUrl: RPC } = args;

  (window as unknown as { __txs: unknown[] }).__txs = [];

  let txCount = 0;
  const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};

  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    async request({ method, params }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_chainId":
          return CHAIN;
        case "net_version":
          return String(parseInt(CHAIN, 16));
        case "eth_accounts":
        case "eth_requestAccounts":
          return [ACCOUNT];
        case "eth_coinbase":
          return ACCOUNT;
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;

        case "eth_sendTransaction": {
          const tx = (params?.[0] ?? {}) as Record<string, string>;
          (window as unknown as { __txs: unknown[] }).__txs.push(tx);
          txCount += 1;
          // 32 bytes: 0xfeed + a counter, padded.
          return "0xfeed" + String(txCount).padStart(60, "0");
        }

        // Never let a signed payload escape, even by accident.
        case "eth_sendRawTransaction":
          throw new Error("e2e: eth_sendRawTransaction is blocked");

        case "personal_sign":
        case "eth_sign":
        case "eth_signTypedData_v4":
          return "0x" + "22".repeat(65);

        default: {
          // Reads go to the real chain.
          const res = await fetch(RPC, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error.message);
          return json.result;
        }
      }
    },
    on(event: string, cb: (...a: unknown[]) => void) {
      (listeners[event] ||= []).push(cb);
      return provider;
    },
    removeListener(event: string, cb: (...a: unknown[]) => void) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== cb);
      return provider;
    },
  };

  Object.defineProperty(window, "ethereum", {
    value: provider,
    writable: true,
    configurable: true,
  });

  // EIP-6963. RainbowKit discovers wallets this way in addition to
  // window.ethereum, and announcing makes the mock selectable in its modal.
  const info = {
    uuid: "00000000-0000-4000-8000-000000000000",
    name: "E2E Mock Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
    rdns: "dev.liquidpass.e2e",
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info, provider }),
      }),
    );
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  // Makes wagmi's reconnect() prefer the injected connector on mount. The
  // connector reports authorized because eth_accounts above is non-empty.
  try {
    window.localStorage.setItem("wagmi.recentConnectorId", JSON.stringify("injected"));
  } catch {
    /* storage can be unavailable; reconnect still tries every connector */
  }
}

/**
 * Intercepts the app's own RPC transport (viem's http client, which does not
 * go through window.ethereum) to answer receipt lookups for the hashes the
 * mock invented, and to block raw sends.
 */
async function installRpcRoute(page: Page) {
  await page.route(
    (url) => url.href.startsWith(RPC_URL),
    async (route) => {
      const raw = route.request().postData();
      if (!raw) return route.continue();

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return route.continue();
      }

      const calls = Array.isArray(body) ? body : [body];
      const isFakeReceipt = (c: { method?: string; params?: unknown[] }) =>
        (c.method === "eth_getTransactionReceipt" ||
          c.method === "eth_getTransactionByHash") &&
        typeof c.params?.[0] === "string" &&
        (c.params[0] as string).startsWith(FAKE_TX_PREFIX);

      if (calls.some((c) => c.method === "eth_sendRawTransaction")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: calls[0]?.id ?? 1,
            error: { code: -32000, message: "e2e: raw sends are blocked" },
          }),
        });
      }

      if (!calls.some(isFakeReceipt)) return route.continue();

      const answer = calls.map((c: { id?: number; method?: string; params?: unknown[] }) => {
        if (!isFakeReceipt(c)) return { jsonrpc: "2.0", id: c.id, result: null };
        const hash = (c.params as string[])[0];
        if (c.method === "eth_getTransactionByHash") {
          return {
            jsonrpc: "2.0",
            id: c.id,
            result: {
              hash,
              blockHash: "0x" + "ab".repeat(32),
              blockNumber: "0x1",
              from: TEST_ACCOUNT,
              to: null,
              gas: "0x5208",
              gasPrice: "0x1",
              input: "0x",
              nonce: "0x0",
              transactionIndex: "0x0",
              value: "0x0",
              type: "0x2",
              v: "0x0",
              r: "0x0",
              s: "0x0",
            },
          };
        }
        return {
          jsonrpc: "2.0",
          id: c.id,
          result: {
            transactionHash: hash,
            transactionIndex: "0x0",
            blockHash: "0x" + "ab".repeat(32),
            blockNumber: "0x1",
            from: TEST_ACCOUNT,
            to: null,
            cumulativeGasUsed: "0x5208",
            gasUsed: "0x5208",
            contractAddress: null,
            logs: [],
            logsBloom: "0x" + "00".repeat(256),
            status: "0x1",
            effectiveGasPrice: "0x1",
            type: "0x2",
          },
        };
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(Array.isArray(body) ? answer : answer[0]),
      });
    },
  );
}

/** Reads the writes the page attempted since load. */
export async function recordedTxs(page: Page): Promise<RecordedTx[]> {
  return page.evaluate(() => window.__txs ?? []);
}

/** Clears the recorded writes, so one test can assert several actions apart. */
export async function clearTxs(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__txs = [];
  });
}

/**
 * Console and page errors, collected per test. A spec that passes while the
 * page is throwing is not actually passing.
 */
export type PageErrors = { console: string[]; page: string[] };

export const test = base.extend<{ errors: PageErrors }>({
  errors: [
    async ({ page }, use) => {
      const collected: PageErrors = { console: [], page: [] };
      page.on("console", (m) => {
        if (m.type() === "error") collected.console.push(m.text());
      });
      page.on("pageerror", (e) => collected.page.push(e.message));
      await use(collected);
    },
    { auto: true },
  ],
});

/**
 * Installs the mock wallet on a page. Call before the first navigation.
 *
 * Kept as an explicit call rather than an always-on fixture: the smoke specs
 * deliberately load the site with no wallet at all, which is how most visitors
 * arrive and a state that has to keep working.
 */
export async function useMockWallet(page: Page) {
  await page.addInitScript(initScript, {
    account: TEST_ACCOUNT,
    chainIdHex: ARBITRUM_SEPOLIA_HEX,
    rpcUrl: RPC_URL,
  });
  await installRpcRoute(page);
}

export { expect };
