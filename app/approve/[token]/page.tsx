import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApprovalPortalByToken } from "@/lib/repos/approval-links";
import { decideApprovalLinkAction } from "./actions";

export default async function ApprovalPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; email?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (query.done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center p-6">
        <Card className="w-full">
          <CardContent className="py-10 text-center">
            <p className="font-medium">Response recorded</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const portal = await getApprovalPortalByToken(token);
  if (!portal?.campaign) notFound();
  const providedEmail = query.email?.trim().toLowerCase() ?? "";
  const emailMatches = providedEmail === portal.link.email.toLowerCase();
  if (!emailMatches) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Confirm recipient</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3">
              <Input
                type="email"
                name="email"
                required
                placeholder="client@example.com"
                defaultValue={providedEmail}
                aria-label="Client email"
              />
              {providedEmail ? (
                <p className="text-destructive text-sm">
                  That email is not assigned to this approval link.
                </p>
              ) : null}
              <Button type="submit">Continue</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {portal.campaign.name}
        </h1>
        {portal.campaign.brief ? (
          <p className="text-muted-foreground text-sm">{portal.campaign.brief}</p>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {portal.sources.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sources attached.</p>
          ) : (
            portal.sources.map((source) => (
              <div key={source.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{source.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {source.summary ?? source.sourceText.slice(0, 400)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <form action={decideApprovalLinkAction} className="flex justify-end gap-2">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={providedEmail} />
        <Button type="submit" name="decision" value="changes" variant="outline">
          Request changes
        </Button>
        <Button type="submit" name="decision" value="approve">
          Approve
        </Button>
      </form>
    </main>
  );
}
