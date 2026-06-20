import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ConnectMetaButton() {
  return (
    <Button asChild>
      {/* Full-page navigation to the OAuth start route (server redirect). */}
      <a href="/api/oauth/meta/start">
        <Plus className="size-4" /> Connect Facebook &amp; Instagram
      </a>
    </Button>
  );
}
