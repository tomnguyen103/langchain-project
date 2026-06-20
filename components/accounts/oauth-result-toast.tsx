"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function OAuthResultToast({
  connected,
  error,
}: {
  connected?: string;
  error?: string;
}) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!connected && !error) return;
    fired.current = true;

    if (connected) {
      const n = Number(connected);
      toast.success(
        `Connected ${connected} account${n === 1 ? "" : "s"}.`,
      );
    } else if (error) {
      toast.error(`Couldn't connect: ${error.replace(/_/g, " ")}`);
    }
    // Clear the query params so the toast doesn't refire on refresh.
    router.replace("/accounts");
  }, [connected, error, router]);

  return null;
}
