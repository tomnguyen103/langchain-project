import { runContentAgent } from "@/lib/agent";
import { runResearch } from "@/lib/agent/research";
import { enqueuePublish, registerCommentPoll } from "@/lib/queue/jobs";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  getGeneratedContentByIds,
  markGeneratedContentAccepted,
  replaceIdeasForTopic,
} from "@/lib/repos/generated-content";
import {
  createPostWithTargets,
  getAccountIdsForTargets,
  getPostTarget,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";
import { saveReport } from "@/lib/repos/reports";
import {
  createResearchTopic,
  updateResearchTopic,
} from "@/lib/repos/research";

import { createAtlas } from "./atlas";
import { createLyra } from "./lyra";
import { createRigel } from "./rigel";
import {
  countFailedPublishes,
  fetchPublishedTargets,
  fetchRunOutcomes,
} from "./rigel/queries";
import { createSirius } from "./sirius";
import { AgentName, type AgentDefinition } from "./types";
import { createVega } from "./vega";

/**
 * The roster registry — also the composition root. It injects the real research
 * function, content StateGraph, queues, and repos into each agent factory. The
 * factory modules themselves stay free of runtime (db/env) imports so they
 * unit-test without a database. {@link getAgent} is the ONLY lookup — no
 * `switch` statements anywhere (mirrors lib/platforms/registry.ts).
 *
 * Populated incrementally as agents land: A1 wires Vega/Lyra/Atlas; A3 Sirius,
 * A4 Rigel, A5 Polaris. Until an agent is registered, {@link getAgent} throws a
 * clear error — expected for not-yet-implemented agents.
 */
const REGISTRY: Partial<Record<AgentName, AgentDefinition>> = {
  [AgentName.Vega]: createVega({
    runResearch,
    createResearchTopic,
    updateResearchTopic,
    replaceIdeasForTopic,
  }),
  [AgentName.Lyra]: createLyra({
    runContentAgent,
    markGeneratedContentAccepted,
  }),
  [AgentName.Atlas]: createAtlas({
    getGeneratedContentByIds,
    listSocialAccounts,
    createPostWithTargets,
    getPostTarget,
    enqueuePublish,
    updatePostTarget,
    recomputePostStatus,
  }),
  [AgentName.Sirius]: createSirius({
    registerCommentPoll,
    getAccountIdsForTargets,
  }),
  [AgentName.Rigel]: createRigel({
    fetchPublishedTargets,
    fetchRunOutcomes,
    countFailedPublishes,
    saveReport,
  }),
};

/** Resolve an agent's definition. Throws if the agent isn't registered yet. */
export function getAgent(name: AgentName): AgentDefinition {
  const agent = REGISTRY[name];
  if (!agent) {
    throw new Error(
      `Agent not registered: "${name}". Add its AgentDefinition to lib/agents/registry.ts.`,
    );
  }
  return agent;
}

/** Whether an agent currently has a registered implementation. */
export function hasAgent(name: AgentName): boolean {
  return Boolean(REGISTRY[name]);
}
