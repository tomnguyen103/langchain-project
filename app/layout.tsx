import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TITLE = "SocialFlow — AI Social Content Automation";
const DESCRIPTION =
  "Research niches, generate platform-tailored content with AI, then schedule and auto-publish across every social platform.";

export const metadata: Metadata = {
  // Resolves relative URLs (incl. the opengraph-image/twitter-image routes) to
  // absolute ones so social crawlers can fetch them.
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: "%s · SocialFlow",
  },
  description: DESCRIPTION,
  applicationName: "SocialFlow",
  keywords: [
    "social media scheduling",
    "AI content generation",
    "social media automation",
    "content calendar",
  ],
  openGraph: {
    type: "website",
    siteName: "SocialFlow",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    // og image is supplied by app/opengraph-image.tsx (file convention).
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    // twitter image is supplied by app/twitter-image.tsx (file convention).
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col font-sans">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
