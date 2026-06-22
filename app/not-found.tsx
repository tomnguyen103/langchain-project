import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-primary text-6xl font-bold">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground mt-1">
        That page doesn&apos;t exist or has moved.
      </p>
      <Button asChild className="mt-5">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
