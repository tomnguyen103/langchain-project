import { currentUser } from "@clerk/nextjs/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export default async function OverviewPage() {
  const user = await currentUser();
  const name = user?.firstName ?? "there";

  return (
    <PagePlaceholder
      title={`Welcome back, ${name}`}
      description="Your content engine at a glance."
      note="Overview widgets — upcoming posts, quota and recent ideas — arrive as later goals ship."
    />
  );
}
