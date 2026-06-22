import { AgentName, type AgentDefinition } from "../types";

export type SiriusInput = {
  /** Accounts to ensure polling for (e.g. the accounts Atlas just scheduled to). */
  socialAccountIds?: string[];
  /** Published targets whose accounts should be polled. */
  publishedTargetIds?: string[];
};

/** Sirius's side effects, injected for testability (no runtime db/env imports). */
export type SiriusDeps = {
  registerCommentPoll: (socialAccountId: string) => Promise<void>;
  getAccountIdsForTargets: (targetIds: string[]) => Promise<string[]>;
};

/**
 * Sirius — engagement / auto-reply. A thin relabel of the existing comment
 * machinery: it ensures each relevant account has an active comment poll
 * (registerCommentPoll is idempotent), so freshly-published posts get watched
 * and the existing reply pipeline handles matches unchanged. Terminal — no
 * handoff.
 */
export function createSirius(deps: SiriusDeps): AgentDefinition<SiriusInput> {
  return {
    name: AgentName.Sirius,
    async run(input) {
      const accountIds = new Set<string>(input.socialAccountIds ?? []);
      if (input.publishedTargetIds?.length) {
        for (const id of await deps.getAccountIdsForTargets(
          input.publishedTargetIds,
        )) {
          accountIds.add(id);
        }
      }

      for (const accountId of accountIds) {
        await deps.registerCommentPoll(accountId);
      }

      return { summary: { polling: accountIds.size } };
    },
  };
}
