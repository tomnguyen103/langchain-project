import { Building2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentRole } from "@/lib/auth/current-role";
import { canManageTeam } from "@/lib/auth/roles";
import { getOrgId } from "@/lib/clerk";
import { listMemberships } from "@/lib/repos/memberships";

import { AddMemberForm, RoleSelect } from "./team-controls";

export default async function TeamPage() {
  const [role, orgId] = await Promise.all([getCurrentRole(), getOrgId()]);
  const members = orgId ? await listMemberships(orgId) : [];
  const manage = canManageTeam(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Team"
        description="Workspace roles gate sensitive actions — only an approver or above can clear the review queue."
        actions={
          <>
            <span className="text-muted-foreground text-sm">Your role:</span>
            <Badge variant="secondary">{role}</Badge>
          </>
        }
      />

      {!orgId ? (
        <EmptyState
          icon={Building2}
          title="No workspace yet"
          description="Create or switch to an organization to invite teammates and assign roles. Solo accounts have full access by default."
        />
      ) : (
        <>
          {manage ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <p className="text-sm font-medium">Add or update a member</p>
                <AddMemberForm />
                <p className="text-muted-foreground text-xs">
                  Enter a teammate&apos;s Clerk user id and pick a role.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members assigned"
              description="Members without an explicit app role fall back to their Clerk org role when it maps cleanly; otherwise they can only view the workspace."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                      <span className="truncate font-mono text-xs">
                        {member.clerkUserId}
                      </span>
                      {manage ? (
                        <RoleSelect
                          clerkUserId={member.clerkUserId}
                          role={member.role}
                        />
                      ) : (
                        <Badge variant="outline">{member.role}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
