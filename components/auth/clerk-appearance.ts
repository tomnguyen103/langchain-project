import type { Appearance } from "@clerk/types";

/**
 * Brand theming for the Clerk sign-in / sign-up forms, mapped to the
 * "Ink & Porcelain" system. Intentionally a fixed light treatment — the form
 * always sits on the porcelain side of the branded auth split.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#15141b",
    colorText: "#15141b",
    colorTextSecondary: "#56535e",
    colorTextOnPrimaryBackground: "#f6f4ef",
    colorBackground: "#fbfaf7",
    colorInputBackground: "#ffffff",
    colorInputText: "#15141b",
    colorDanger: "#b23b2d",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 bg-transparent w-full",
    headerTitle: "tracking-tight",
    socialButtonsBlockButton: "border-border",
    formButtonPrimary:
      "bg-[#15141b] text-[#f6f4ef] hover:bg-[#15141b]/90 text-sm normal-case",
    footerActionLink: "text-[#97461e] hover:text-[#97461e]",
    formFieldInput: "border-border",
  },
};
