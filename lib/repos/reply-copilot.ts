import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  commentEvents,
  replyCopilotDrafts,
  socialAccounts,
  type CommentEvent,
  type NewReplyCopilotDraft,
  type ReplyCopilotDraft,
  type SocialAccount,
} from "@/db/schema";

export type ReplyCopilotInboxItem = {
  comment: CommentEvent;
  draft: ReplyCopilotDraft | null;
  account: SocialAccount;
};

const COPILOT_INTENTS = ["abuse", "complaint", "lead", "question"] as const;

export async function listReplyCopilotInbox(
  clerkUserId: string,
  limit = 50,
): Promise<ReplyCopilotInboxItem[]> {
  return db
    .select({
      comment: commentEvents,
      draft: replyCopilotDrafts,
      account: socialAccounts,
    })
    .from(commentEvents)
    .innerJoin(
      socialAccounts,
      eq(commentEvents.socialAccountId, socialAccounts.id),
    )
    .leftJoin(
      replyCopilotDrafts,
      eq(replyCopilotDrafts.commentEventId, commentEvents.id),
    )
    .where(
      and(
        eq(socialAccounts.clerkUserId, clerkUserId),
        inArray(commentEvents.intent, [...COPILOT_INTENTS]),
      ),
    )
    .orderBy(desc(commentEvents.createdAt))
    .limit(limit);
}

export async function createReplyCopilotDraft(
  data: NewReplyCopilotDraft,
): Promise<ReplyCopilotDraft> {
  const [inserted] = await db
    .insert(replyCopilotDrafts)
    .values(data)
    .onConflictDoNothing({ target: replyCopilotDrafts.commentEventId })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(replyCopilotDrafts)
    .where(eq(replyCopilotDrafts.commentEventId, data.commentEventId))
    .limit(1);
  if (!existing) throw new Error("Could not create reply copilot draft.");
  return existing;
}

export async function getUserReplyCopilotDraft(
  id: string,
  clerkUserId: string,
): Promise<ReplyCopilotInboxItem | undefined> {
  const [row] = await db
    .select({
      comment: commentEvents,
      draft: replyCopilotDrafts,
      account: socialAccounts,
    })
    .from(replyCopilotDrafts)
    .innerJoin(
      commentEvents,
      eq(replyCopilotDrafts.commentEventId, commentEvents.id),
    )
    .innerJoin(
      socialAccounts,
      eq(commentEvents.socialAccountId, socialAccounts.id),
    )
    .where(
      and(
        eq(replyCopilotDrafts.id, id),
        eq(replyCopilotDrafts.clerkUserId, clerkUserId),
        eq(socialAccounts.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  if (!row) return undefined;
  return row;
}

export async function updateReplyCopilotDraft(
  id: string,
  clerkUserId: string,
  data: Partial<NewReplyCopilotDraft>,
): Promise<void> {
  await db
    .update(replyCopilotDrafts)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(replyCopilotDrafts.id, id),
        eq(replyCopilotDrafts.clerkUserId, clerkUserId),
      ),
    );
}

export async function claimCopilotReply(commentEventId: string): Promise<boolean> {
  const rows = await db
    .update(commentEvents)
    .set({ status: "replying", updatedAt: new Date() })
    .where(
      and(
        eq(commentEvents.id, commentEventId),
        eq(commentEvents.replied, false),
        ne(commentEvents.status, "replying"),
      ),
    )
    .returning({ id: commentEvents.id });
  return rows.length > 0;
}
