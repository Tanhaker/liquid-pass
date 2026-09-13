/**
 * Number listings within their plan, for display.
 *
 * Several listings of one plan read as identical cards, so a plan with two or
 * more gets "#1", "#2", ... in token order, oldest first. A plan with a single
 * listing gets no number. This is an ordinal among the listings passed in, not
 * the on-chain token id.
 *
 * Returns tokenId (as a string) -> ordinal, only for tokens that need one.
 */
export function planOrdinals(listings: { tokenId: bigint; planId: bigint }[]): Map<string, number> {
  const byPlan = new Map<string, bigint[]>();
  for (const l of listings) {
    const key = l.planId.toString();
    byPlan.set(key, [...(byPlan.get(key) ?? []), l.tokenId]);
  }
  const out = new Map<string, number>();
  for (const ids of byPlan.values()) {
    if (ids.length < 2) continue;
    [...ids]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .forEach((id, i) => out.set(id.toString(), i + 1));
  }
  return out;
}
