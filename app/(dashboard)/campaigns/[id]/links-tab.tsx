import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttributionLink } from "@/db/schema";
import { createAttributionLinkAction } from "../actions";
import { ApprovalLinkForm } from "../approval-link-form";

export function LinksTab({
  campaignId,
  attributionLinks,
}: {
  campaignId: string;
  attributionLinks: AttributionLink[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Client approval link</p>
        <ApprovalLinkForm campaignId={campaignId} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Attribution links</p>
        <form
          action={createAttributionLinkAction}
          className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]"
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <Input name="label" placeholder="CTA link" />
          <Input name="destinationUrl" placeholder="https://example.com" />
          <Input name="utmSource" placeholder="linkedin" />
          <input type="hidden" name="utmMedium" value="social" />
          <Button type="submit" size="sm">
            Track
          </Button>
        </form>

        {attributionLinks.length > 0 ? (
          <div className="mt-2 space-y-2">
            {attributionLinks.map((link) => (
              <div key={link.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{link.label}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {link.trackedUrl}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
