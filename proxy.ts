import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything not listed here requires authentication.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/legal(.*)",
  // Public brand/metadata images (favicon, app icon, social share cards). These
  // are dynamic routes with no file extension, so the static-file skip in the
  // matcher below doesn't catch them — without this, Clerk would redirect
  // browsers and social crawlers to sign-in and the assets would never load.
  "/icon(.*)",
  "/apple-icon(.*)",
  "/opengraph-image(.*)",
  "/twitter-image(.*)",
  // Health probes (liveness + queue depth) for uptime monitors. The queue
  // endpoint self-enforces HEALTH_CHECK_TOKEN / a session — see its route.
  "/api/health(.*)",
  // Inbound platform webhooks (e.g. Meta comments) authenticate via their own
  // HMAC signature, not a Clerk session, so they must bypass auth here.
  "/api/webhooks(.*)",
  // Tokenized/client routes self-enforce their own bearer-token or link-token
  // auth and must be reachable by non-Clerk external clients.
  "/approve(.*)",
  "/api/a2a",
  "/api/public(.*)",
  "/api/mcp",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
