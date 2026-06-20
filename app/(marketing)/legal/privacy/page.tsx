import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SocialFlow",
};

export default function PrivacyPage() {
  return (
    <article className="prose dark:prose-invert mx-auto w-full max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-4">
        This is a placeholder privacy policy. SocialFlow stores the social
        accounts you connect and the content you create in order to schedule and
        publish on your behalf. Full data-handling and security details will be
        published before launch.
      </p>
    </article>
  );
}
