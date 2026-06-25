/**
 * Drizzle schema barrel — the single entry for `import * as schema from "@/db/schema"`.
 * Domain tables live under db/schema/*. Later goals add generated_content (Goal 4),
 * research_topics (Goal 5), usage (Goal 6), auto_reply_rules + comment_events (Goal 7).
 */
export * from "./schema/enums";
export * from "./schema/social-accounts";
export * from "./schema/posts";
export * from "./schema/post-targets";
export * from "./schema/media-assets";
export * from "./schema/schedules";
export * from "./schema/generated-content";
export * from "./schema/research";
export * from "./schema/usage";
export * from "./schema/auto-reply";
export * from "./schema/comment-events";
export * from "./schema/agent-runs";
export * from "./schema/agent-steps";
export * from "./schema/brand-profiles";
export * from "./schema/reports";
export * from "./schema/rate-limits";
export * from "./schema/disclosure-ledger";
export * from "./schema/memberships";

export * from "./schema/posting-windows";
