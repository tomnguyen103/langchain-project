import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { listBrandsForUser } from "@/lib/repos/brands";

import { BrandCard } from "./brand-card";
import { CreateBrandForm } from "./brand-controls";

export default async function BrandsPage() {
  const userId = await requireUserId();
  const brandList = await listBrandsForUser(userId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Brands"
        description="Manage brand workspaces. Each brand is an independent content namespace — accounts, posts, and AI runs can be scoped per brand."
      />

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
    </div>
  );
}
