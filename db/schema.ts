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
