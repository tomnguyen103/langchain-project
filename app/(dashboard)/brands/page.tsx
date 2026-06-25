import { Card, CardContent } from "@/components/ui/card";
import { requireUserId } from "@/lib/clerk";
import { listBrandsForUser } from "@/lib/repos/brands";

import { BrandCard } from "./brand-card";
import { CreateBrandForm } from "./brand-controls";

export default async function BrandsPage() {
  const userId = await requireUserId();
  const brandList = await listBrandsForUser(userId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <p className="text-muted-foreground text-sm">
          Manage brand workspaces. Each brand is an independent content namespace
          — accounts, posts, and AI runs can be scoped per brand.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-sm font-medium">Create a new brand</p>
          <CreateBrandForm />
        </CardContent>
      </Card>

      {brandList.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">No brands yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              Create your first brand above to start organizing content into
              separate workspaces.
            </p>
          </CardContent>
        </Card>
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
