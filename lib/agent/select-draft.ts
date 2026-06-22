/**
 * Pure best-of-N draft selection — the fan-in after drafting platform variants
 * in parallel. Prefers a variant that is clean (no banned terms) and within the
 * length budget; within a tier, the longest within-limit (most complete) draft,
 * else the shortest. Dependency-free → unit-testable.
 */
export function selectBestDraft(
  variants: string[],
  opts: { maxLength: number; bannedTerms?: string[] },
): string {
  const cleaned = variants.map((v) => v.trim()).filter((v) => v.length > 0);
  if (cleaned.length === 0) return "";

  const banned = (opts.bannedTerms ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const hasBanned = (text: string) =>
    banned.some((b) => text.toLowerCase().includes(b));

  // Tier: within-limit (+2) and clean (+1). Within a tier, prefer the longest
  // within-limit draft (more complete); for over-limit drafts, prefer shorter.
  const score = (text: string): [number, number] => {
    const within = text.length <= opts.maxLength;
    const tier = (within ? 2 : 0) + (hasBanned(text) ? 0 : 1);
    return [tier, within ? text.length : -text.length];
  };

  return cleaned.reduce((best, cur) => {
    const [bt, bl] = score(best);
    const [ct, cl] = score(cur);
    return ct > bt || (ct === bt && cl > bl) ? cur : best;
  });
}
