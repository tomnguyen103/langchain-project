import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ConnectButton({ id, label }: { id: string; label: string }) {
  return (
    <Button asChild>
      {/* Full-page navigation to the OAuth start route (server redirect). */}
      <a href={`/api/oauth/${id}/start`}>
        <Plus className="size-4" /> Connect {label}
      </a>
    </Button>
  );
}
