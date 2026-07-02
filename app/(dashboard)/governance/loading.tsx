import { Skeleton } from "@/components/ui/skeleton";

export default function GovernanceLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-72" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
