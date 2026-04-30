import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { canUseDevMobileBypass } from "./lib/dev-mobile-api";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Allow Stripe webhooks through without Clerk
  if (request.nextUrl.pathname.startsWith("/api/webhook")) {
    return;
  }

  // Development-only bridge for the standalone local mobile prototype.
  // This does NOT run in production and requires an explicit request header.
  if (canUseDevMobileBypass(request)) {
    return;
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Match all routes except static assets and Next internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
