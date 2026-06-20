import { Zap } from "lucide-react";

import { PLAN_LIMITS, type PlanId } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";

export function QuotaBadge({ plan }: { plan: PlanId }) {
  return (
    <Badge variant="secondary" className="gap-1">
      <Zap className="size-3" /> {PLAN_LIMITS[plan].label}
    </Badge>
  );
}
