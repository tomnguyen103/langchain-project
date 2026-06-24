import { PricingTable } from "@clerk/nextjs";

import { getUsageSummary } from "@/lib/billing/entitlements";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { requireUserId } from "@/lib/clerk";
import { sumRunCostUsd } from "@/lib/repos/agent-runs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">
            {used} / {limit}
          </span>
        </div>
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`${label} usage`}
          aria-valuenow={Math.min(used, limit)}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuetext={`${used} of ${limit}`}
        >
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BillingPage() {
  const userId = await requireUserId();
  const usage = await getUsageSummary(userId);
  const limits = PLAN_LIMITS[usage.plan];

  // Estimated AI spend so far this (calendar, UTC) month — from token telemetry.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const aiCostUsd = await sumRunCostUsd(userId, monthStart);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="text-muted-foreground mt-1">Manage your plan and usage.</p>

      <Tabs defaultValue="plan" className="mt-6">
        <TabsList>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current plan:</span>
            <Badge>{limits.label}</Badge>
          </div>
          <PricingTable />
        </TabsContent>

        <TabsContent value="usage" className="grid gap-3 sm:grid-cols-2">
          <UsageBar
            label="Posts today"
            used={usage.posts.used}
            limit={usage.posts.limit}
          />
          <UsageBar
            label="AI generations this month"
            used={usage.ai.used}
            limit={usage.ai.limit}
          />
          <Card className="sm:col-span-2">
            <CardContent className="space-y-1 pt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Est. AI cost this month</span>
                <span className="text-muted-foreground tabular-nums">
                  ${aiCostUsd.toFixed(2)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Estimated from model token usage — not a billed amount.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
