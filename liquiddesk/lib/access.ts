import { checkAccess, type Access } from "./chain";
import { sessionAddress } from "./session";

/**
 * The gate every protected route goes through: who is signed in, and does
 * that wallet hold a valid pass RIGHT NOW.
 *
 * Asked again on every request rather than remembered in the session. That is
 * the point of the demo -- when a pass is sold, the seller's very next request
 * is refused, with no logout, webhook or revocation list involved.
 *
 * A two-second memo only stops one page load (status + feature call) from
 * reading the chain twice.
 */

const MEMO_MS = 2_000;
const memo = new Map<string, { at: number; access: Access }>();

export type Gate =
  | { signedIn: false }
  | ({ signedIn: true; address: `0x${string}` } & Access);

export async function gate(): Promise<Gate> {
  const address = await sessionAddress();
  if (!address) return { signedIn: false };

  const hit = memo.get(address);
  if (hit && Date.now() - hit.at < MEMO_MS) return { signedIn: true, address, ...hit.access };

  const access = await checkAccess(address);
  memo.set(address, { at: Date.now(), access });
  return { signedIn: true, address, ...access };
}
