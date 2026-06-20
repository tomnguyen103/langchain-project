import { END, START, StateGraph } from "@langchain/langgraph";

import { ContentState } from "./state";
import { critiqueNode } from "./nodes/critique";
import { digestNode } from "./nodes/digest";
import { draftPerPlatformNode } from "./nodes/draft-per-platform";
import { finalizeNode } from "./nodes/finalize";
import { refineNode } from "./nodes/refine";

const MAX_REVISIONS = 2;

/**
 * Content-generation pipeline:
 * digest → draftPerPlatform → critique → (refine ↩ up to MAX_REVISIONS | finalize) → END
 */
export const contentGraph = new StateGraph(ContentState)
  .addNode("analyze", digestNode)
  .addNode("draftPerPlatform", draftPerPlatformNode)
  .addNode("critique", critiqueNode)
  .addNode("refine", refineNode)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "analyze")
  .addEdge("analyze", "draftPerPlatform")
  .addEdge("draftPerPlatform", "critique")
  .addConditionalEdges(
    "critique",
    (state) =>
      state.needsRevision && state.revisionCount < MAX_REVISIONS
        ? "refine"
        : "finalize",
    ["refine", "finalize"],
  )
  .addEdge("refine", "critique")
  .addEdge("finalize", END)
  .compile();
