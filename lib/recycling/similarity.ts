export type SimilarityFinding = {
  rule: string;
  detail: string;
  level: "block";
};

const SOURCE_MARKER = "Original post:";
const SIMILARITY_THRESHOLD = 0.82;

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

export function extractRefreshSource(topic: string | null | undefined): string {
  if (!topic) return "";
  const index = topic.indexOf(SOURCE_MARKER);
  if (index === -1) return "";
  return topic.slice(index + SOURCE_MARKER.length).trim();
}

export function textSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / new Set([...left, ...right]).size;
}

export function recyclingSimilarityFinding(opts: {
  source: string;
  draft: string;
}): SimilarityFinding | null {
  const score = textSimilarity(opts.source, opts.draft);
  if (score < SIMILARITY_THRESHOLD) return null;
  return {
    rule: "evergreen_similarity",
    level: "block",
    detail: `Refreshed draft is too similar to the source post (${Math.round(score * 100)}% token overlap).`,
  };
}
