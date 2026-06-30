import { SignUp } from "@clerk/nextjs";

import { clerkAppearance } from "@/components/auth/clerk-appearance";

export default function SignUpPage() {
  return <SignUp appearance={clerkAppearance} />;
}
