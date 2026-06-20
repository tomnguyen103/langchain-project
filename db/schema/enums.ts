import { pgEnum } from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "linkedin",
  "pinterest",
  "discord",
  "x",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "partially_published",
]);

export const targetStatusEnum = pgEnum("target_status", [
  "pending",
  "queued",
  "publishing",
  "published",
  "failed",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "gif"]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "active",
  "completed",
  "failed",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "expired",
  "revoked",
]);

export const contentKindEnum = pgEnum("content_kind", [
  "caption",
  "post",
  "idea",
  "variation",
  "hashtags",
]);

export const researchStatusEnum = pgEnum("research_status", [
  "pending",
  "researching",
  "done",
  "failed",
]);

/** How an auto-reply rule's keywords are matched against a comment. */
export const matchTypeEnum = pgEnum("match_type", [
  "any", // any keyword appears
  "all", // every keyword appears
  "exact", // the comment equals a keyword
  "regex", // a keyword is a regex that matches
]);

/** Lifecycle of an ingested comment through the auto-reply pipeline. */
export const commentEventStatusEnum = pgEnum("comment_event_status", [
  "pending", // ingested, not yet evaluated
  "matched", // a rule matched; a reply job was enqueued
  "replied", // reply posted successfully
  "skipped", // no rule matched, or cooldown/daily-cap reached
  "failed", // reply attempt failed
]);

export type Platform = (typeof platformEnum.enumValues)[number];
export type AccountStatus = (typeof accountStatusEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type TargetStatus = (typeof targetStatusEnum.enumValues)[number];
export type MediaType = (typeof mediaTypeEnum.enumValues)[number];
export type MatchType = (typeof matchTypeEnum.enumValues)[number];
export type CommentEventStatus =
  (typeof commentEventStatusEnum.enumValues)[number];
