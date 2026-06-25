import { notFound } from "next/navigation";

import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { getContentPlan } from "@/lib/repos/content-plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanSlot } from "@/db/schema";
import { approvePlan } from "./actions";

export default async function PlanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const plan = await getContentPlan(id, userId);
  if (!plan) notFound();

  const slots = plan.slots as PlanSlot[];
  const isDraft = plan.status === "draft";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Content plan
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date(plan.periodStart).toLocaleDateString()} –{" "}
          {new Date(plan.periodEnd).toLocaleDateString()} ·{" "}
          <Badge variant={isDraft ? "secondary" : "default"}>{plan.status}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {slots.length} proposed post{slots.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slots.map((slot, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {PLATFORM_META[slot.platform]?.label ?? slot.platform}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(slot.proposedAt).toLocaleString()}
                </span>
                {slot.runId && (
                  <Badge variant="secondary" className="text-xs">queued</Badge>
                )}
              </div>
              <p className="mt-1 text-sm">{slot.topic}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {isDraft && (
        <form action={approvePlan}>
          <input type="hidden" name="planId" value={plan.id} />
          <Button type="submit" className="w-full sm:w-auto">
            Approve all — start {slots.length} pipeline run{slots.length !== 1 ? "s" : ""}
          </Button>
        </form>
      )}

      {!isDraft && plan.status === "approved" && (
        <p className="text-muted-foreground text-sm">
          Approved. Each slot is now in the review queue. Check the calendar for scheduled posts.
        </p>
      )}
    </div>
  );
}
