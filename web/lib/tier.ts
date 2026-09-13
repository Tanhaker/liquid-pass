/**
 * The tier tag shown on a pass card, read from the plan's name.
 *
 * Plans on chain have a name and nothing else describing their tier, and every
 * card used to be hard-coded "PRO" -- so an issuer's "ChatGPT Plus" was sold
 * under a PRO badge. The tier is the last word of the name when that word is a
 * recognised tier; otherwise there is no tag rather than a guessed one.
 */
const TIERS = new Set([
  "FREE", "BASIC", "STARTER", "STANDARD", "PLUS", "PRO", "PREMIUM", "MAX",
  "ULTRA", "TEAM", "TEAMS", "BUSINESS", "ENTERPRISE", "UNLIMITED",
]);

export function tierOf(name: string | undefined | null): string | undefined {
  const words = (name ?? "").trim().split(/\s+/);
  if (words.length < 2) return undefined;
  const last = words[words.length - 1].toUpperCase();
  return TIERS.has(last) ? last : undefined;
}
