import { SignIn } from "@clerk/nextjs";

import { clerkAppearance } from "@/components/auth/clerk-appearance";

export default function SignInPage() {
  return <SignIn appearance={clerkAppearance} />;
}
