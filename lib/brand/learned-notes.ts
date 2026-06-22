/**
 * Pure formatter turning Rigel's persisted `learnedMemory` into a short notes
 * string for Lyra's digest prompt. Dependency-free → unit-testable.
 */
export type LearnedMemory = {
  topTopics?: Array<{ topic?: string; engagement?: number }>;
};

export function formatLearnedNotes(
  memory: Record<string, unknown> | null | undefined,
): string {
  if (!memory) return "";
  const topics = (memory as LearnedMemory).topTopics;
  if (!Array.isArray(topics)) return "";
  return topics
    .map((t) => (t && typeof t.topic === "string" ? t.topic.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 5)
    .join("; ");
}
