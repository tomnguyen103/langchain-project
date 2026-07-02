import { Building2, Layers, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentRole } from "@/lib/auth/current-role";
import { canManageTeam } from "@/lib/auth/roles";
import { getOrgId, requireUserId } from "@/lib/clerk";
import { listBrandsForUser } from "@/lib/repos/brands";
import { listMemberships } from "@/lib/repos/memberships";

import { BrandCard } from "./brand-card";
import { CreateBrandForm } from "./brand-controls";
import { AddMemberForm, RoleSelect } from "./team-controls";

const TABS = ["brands", "team"] as const;
type WorkspaceTab = (typeof TABS)[number];

function isWorkspaceTab(value: string | undefined): value is WorkspaceTab {
  return TABS.includes(value as WorkspaceTab);
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const requestedTab = firstValue(sp.tab);
  const defaultTab: WorkspaceTab = isWorkspaceTab(requestedTab)
    ? requestedTab
    : "brands";

  const [role, orgId, brandList] = await Promise.all([
    getCurrentRole(),
    getOrgId(),
    listBrandsForUser(userId),
  ]);
  const members = orgId ? await listMemberships(orgId) : [];
  const manage = canManageTeam(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Org admin"
        description="Manage brand workspaces and teammate roles."
        actions={
          <>
            <span className="text-muted-foreground text-sm">Your role:</span>
            <Badge variant="secondary">{role}</Badge>
          </>
        }
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Each brand is an independent content namespace — accounts, posts,
            and AI runs can be scoped per brand.
          </p>
          <Card>
            <CardContent className="space-y-3 py-4">
              <p className="text-sm font-medium">Create a new brand</p>
              <CreateBrandForm />
            </CardContent>
          </Card>

          {brandList.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No brands yet"
              description="Create your first brand above to start organizing content into separate workspaces."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brandList.map((brand) => (
                <BrandCard key={brand.id} brand={brand} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Workspace roles gate sensitive actions — only an approver or above
            can clear the review queue.
          </p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
