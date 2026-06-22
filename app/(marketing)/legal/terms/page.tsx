import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <article className="prose dark:prose-invert mx-auto w-full max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground mt-4">
        This is a placeholder terms of service. By using SocialFlow you agree to
        use connected platforms in accordance with their respective terms. A
        complete agreement will be published before launch.
      </p>
    </article>
  );
}
