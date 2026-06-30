import { cookies } from "next/headers";

import { getCurrentPlan } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { listBrandsForUser } from "@/lib/repos/brands";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [plan, userId] = await Promise.all([getCurrentPlan(), requireUserId()]);
  const brands = await listBrandsForUser(userId);
  const rawBrandId = (await cookies()).get("current_brand_id")?.value ?? null;
  const currentBrandId = brands.some((b) => b.id === rawBrandId) ? rawBrandId : null;

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar plan={plan} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar plan={plan} brands={brands} currentBrandId={currentBrandId} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-6 outline-none lg:p-8"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
