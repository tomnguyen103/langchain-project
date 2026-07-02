"use client";

import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryTarget } from "@/app/(dashboard)/posts/actions";

/**
 * A plain `<form action={retryTarget.bind(null, targetId)}>` throws straight
 * to the group error boundary on a stale/blocked retry, losing the reason.
 * `retryTarget` is shared with components/posts/post-detail.tsx's
 * useTransition+toast call site (it throws on failure, doesn't return
 * state), so this mirrors that same pattern instead of converting the
 * action to useActionState, which would break that other caller.
 */
export function RetryTargetButton({ targetId }: { targetId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        await retryTarget(targetId);
        toast.success("Retrying.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Retry failed.");
      }
    });
  }

  return (
    <Button size="sm" onClick={onClick} disabled={pending}>
      <RotateCw className="size-3.5" />
      Retry
    </Button>
  );
}
