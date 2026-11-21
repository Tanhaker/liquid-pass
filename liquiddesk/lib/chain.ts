import { createPublicClient, fallback, http, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * The whole integration: "does this wallet hold a valid pass that we issued?"
 *
 * This file is everything a SaaS company needs from Liquid Pass. There is no
 * SDK, no API key and no account with us -- just read-only contract calls,
 * which cost nothing.
 */

const env = (value: string | undefined, fallbackValue: string) =>
  (value && value.trim() ? value.trim() : fallbackValue) as `0x${string}`;

/** The Liquid Pass core on Arbitrum Sepolia. */
export const CORE = env(
  process.env.NEXT_PUBLIC_LIQUID_PASS_ADDRESS,
  "0xac20ef73723e7c620df1024eb04cc0b71fca1055",
);

/** Pay-per-second rental. A rented pass sits in this contract's custody. */
export const RENTAL = env(
  process.env.NEXT_PUBLIC_STREAM_RENTAL_ADDRESS,
  "0x3640ee44A5055ffd5Fd17989fFD95eF478929616",
);

/**
 * The company this app belongs to. Only passes on ITS plans unlock the app --
 * a pass for somebody else's product is a perfectly valid pass and still no
 * business of ours.
 */
export const ISSUER = env(
  process.env.NEXT_PUBLIC_ISSUER_ADDRESS,
  "0xf5AbE5a5092Af1a7fA31109C98635440fdD83174",
);

/**
 * Plans left over from testing the first deployment (plan #0, "Test Plan A").
 * They cannot be deleted from the chain, so a pass on one is ignored here,
 * exactly as the main site ignores it (HIDDEN_PLAN_IDS in web/lib/contract.ts).
 */
const HIDDEN_PLAN_IDS: readonly bigint[] = [
  // Plans 0-11: every plan created while building and testing (21 Nov 2026 reset
  // for the final demo). Fresh plans start at #12.
  0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n,
  12n, // rehearsal, 21 Nov 2026
];

const abi = parseAbi([
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isActive(uint256 tokenId) view returns (bool)",
  "function issuerOf(uint256 tokenId) view returns (address)",
  "function expiryOf(uint256 tokenId) view returns (uint256)",
  "function planOf(uint256 tokenId) view returns (uint256)",
  "function planName(uint256 planId) view returns (string)",
  "function nextPlanId() view returns (uint256)",
  "function planIssuerOf(uint256 planId) view returns (address)",
]);
const rentalAbi = parseAbi(["function activeRenter(uint256 tokenId) view returns (address)"]);

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: fallback([
    http("https://arbitrum-sepolia-rpc.publicnode.com", { timeout: 10_000, retryCount: 1 }),
    http("https://sepolia-rollup.arbitrum.io/rpc", { timeout: 10_000, retryCount: 1 }),
  ]),
});

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Which plans count as LiquidDesk's own.
 *
 * A product sells its own plan, so a pass for some other plan from the same
 * issuer should not open it. Any plan whose name starts with "LiquidDesk" is
 * LiquidDesk's. Until the issuer has created one, every plan of theirs is
 * accepted, so the app keeps working before that plan exists and narrows by
 * itself the moment it does -- no redeploy, no setting to change.
 */
const OWN_PLAN = /^liquid\s?desk/i;
const PLANS_MEMO_MS = 30_000;
let ownPlansMemo: { at: number; ids: bigint[] } | null = null;

async function ownPlans(): Promise<bigint[]> {
  if (ownPlansMemo && Date.now() - ownPlansMemo.at < PLANS_MEMO_MS) return ownPlansMemo.ids;
  const count = Number(await client.readContract({ address: CORE, abi, functionName: "nextPlanId" }));
  const ids = Array.from({ length: count }, (_, i) => BigInt(i)).filter((id) => !HIDDEN_PLAN_IDS.includes(id));
  const reads = await client.multicall({
    allowFailure: true,
    contracts: ids.flatMap(
      (id) =>
        [
          { address: CORE, abi, functionName: "planName", args: [id] },
          { address: CORE, abi, functionName: "planIssuerOf", args: [id] },
        ] as const,
    ),
  });
  const own = ids.filter((_, i) => {
    const [name, issuer] = [reads[i * 2], reads[i * 2 + 1]];
    return (
      name.status === "success" &&
      issuer.status === "success" &&
      OWN_PLAN.test(name.result as string) &&
      same(issuer.result as string, ISSUER)
    );
  });
  ownPlansMemo = { at: Date.now(), ids: own };
  return own;
}

export type PassAccess = {
  tokenId: number;
  planName: string;
  /** Unix seconds. Resale never moves this. */
  expiry: number;
  /** True when access comes from renting the pass rather than owning it. */
  rented: boolean;
};

export type Access =
  | { granted: true; pass: PassAccess }
  | { granted: false; reason: "no-pass" | "expired" };

/**
 * The check itself.
 *
 * For each pass: `isActive` says the time has not run out, `ownerOf` says who
 * holds it, `issuerOf` says whose product it is for. A pass that is being
 * rented out is held by the rental contract, so there the access belongs to
 * `activeRenter` instead -- reading `ownerOf` alone would lock the renter out.
 *
 * The core has no "passes of this wallet" lookup (it would not fit in the
 * 24 KB Stylus limit), so this walks every pass in one batched call. That is
 * fine at demo scale; a production integration would ask the subgraph for the
 * wallet's passes and then confirm them with the same three calls.
 */
export async function checkAccess(wallet: `0x${string}`): Promise<Access> {
  const count = Number(await client.readContract({ address: CORE, abi, functionName: "nextTokenId" }));
  if (count === 0) return { granted: false, reason: "no-pass" };

  const own = await ownPlans();
  const ids = Array.from({ length: count }, (_, i) => BigInt(i));
  // allowFailure: a pass burnt by `bundle` reverts on read and must not take
  // the whole check down with it.
  const reads = await client.multicall({
    allowFailure: true,
    contracts: ids.flatMap(
      (id) =>
        [
          { address: CORE, abi, functionName: "ownerOf", args: [id] },
          { address: CORE, abi, functionName: "isActive", args: [id] },
          { address: CORE, abi, functionName: "issuerOf", args: [id] },
          { address: CORE, abi, functionName: "expiryOf", args: [id] },
          { address: CORE, abi, functionName: "planOf", args: [id] },
        ] as const,
    ),
  });

  const ours = ids
    .map((id, i) => {
      const [owner, active, issuer, expiry, plan] = reads.slice(i * 5, i * 5 + 5);
      if ([owner, active, issuer, expiry, plan].some((r) => r.status !== "success")) return null;
      return {
        id,
        owner: owner.result as `0x${string}`,
        active: active.result as boolean,
        issuer: issuer.result as `0x${string}`,
        expiry: Number(expiry.result as bigint),
        plan: plan.result as bigint,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && same(p.issuer, ISSUER))
    .filter((p) => !HIDDEN_PLAN_IDS.includes(p.plan))
    // Only LiquidDesk's own plan, once the issuer has created one.
    .filter((p) => own.length === 0 || own.includes(p.plan));

  const escrowed = ours.filter((p) => p.active && same(p.owner, RENTAL));
  const renters = escrowed.length
    ? await client.multicall({
        allowFailure: true,
        contracts: escrowed.map(
          (p) => ({ address: RENTAL, abi: rentalAbi, functionName: "activeRenter", args: [p.id] }) as const,
        ),
      })
    : [];
  const rentedByWallet = new Set(
    escrowed
      .filter((_, i) => renters[i].status === "success" && same(renters[i].result as string, wallet))
      .map((p) => p.id),
  );

  const held = ours.filter((p) => same(p.owner, wallet) || rentedByWallet.has(p.id));
  const valid = held.filter((p) => p.active).sort((a, b) => b.expiry - a.expiry)[0];
  if (!valid) return { granted: false, reason: held.length ? "expired" : "no-pass" };

  const planName = await client.readContract({
    address: CORE,
    abi,
    functionName: "planName",
    args: [valid.plan],
  });
  return {
    granted: true,
    pass: {
      tokenId: Number(valid.id),
      planName,
      expiry: valid.expiry,
      rented: rentedByWallet.has(valid.id),
    },
  };
}
