import { Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function QuotaBadge() {
  // Placeholder until usage metering + plans land in Goal 6.
  return (
    <Badge variant="secondary" className="gap-1">
      <Zap className="size-3" /> Free plan
    </Badge>
  );
}
