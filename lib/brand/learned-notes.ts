/**
 * Pure formatter turning Rigel's persisted `learnedMemory` into a short notes
 * string for Lyra's digest prompt. Dependency-free → unit-testable.
 */
export type LearnedMemory = {
  topTopics?: Array<{ topic?: string; engagement?: number }>;
};

export type LearnedMemoryFormInput = {
  topics: string;
};

const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 80;

export function topicsFromLearnedMemory(
  memory: Record<string, unknown> | null | undefined,
): string[] {
  if (!memory) return [];
  const topics = (memory as LearnedMemory).topTopics;
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (t && typeof t.topic === "string" ? t.topic.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TOPICS);
}

export function normalizeLearnedMemoryInput(
  input: LearnedMemoryFormInput,
): Record<string, unknown> | null {
  const seen = new Set<string>();
  const topics = input.topics
    .split(/\r?\n|,/)
    .map((topic) => topic.trim().slice(0, MAX_TOPIC_LENGTH))
    .filter((topic) => {
      if (!topic) return false;
      const key = topic.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TOPICS);

  if (topics.length === 0) return null;
  return { topTopics: topics.map((topic) => ({ topic })) };
}

export function formatLearnedNotes(
  memory: Record<string, unknown> | null | undefined,
): string {
  return topicsFromLearnedMemory(memory).slice(0, 5).join("; ");
}
