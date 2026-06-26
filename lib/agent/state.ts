import { Annotation } from "@langchain/langgraph";

import type { Platform } from "@/db/schema";

/** The shared state of the content-generation graph. */
export const ContentState = Annotation.Root({
  // Inputs
  topic: Annotation<string>(),
  platforms: Annotation<Platform[]>(),
  userId: Annotation<string>(),
  // Brand context (optional; default empty so nodes always have a value).
  brandVoice: Annotation<string>({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  bannedTerms: Annotation<string[]>({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  learnedNotes: Annotation<string>({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  derivedFromTargetId: Annotation<string | null>({
    reducer: (_current, next) => next,
    default: () => null,
  }),

  // Working state
  digest: Annotation<string>({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  drafts: Annotation<Record<string, string>>({
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({}),
  }),
  needsRevision: Annotation<boolean>({
    reducer: (_current, next) => next,
    default: () => false,
  }),
  revisionCount: Annotation<number>({
    reducer: (current, next) => Math.max(current, next),
    default: () => 0,
  }),
  critiqueNotes: Annotation<string>({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  // Output: ids of the generated_content rows finalize persisted, so the caller
  // can stamp the LangSmith run id onto them.
  savedContentIds: Annotation<string[]>({
    reducer: (_current, next) => next,
    default: () => [],
  }),
});

export type ContentStateType = typeof ContentState.State;
