import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

const LEGACY_PUBLIC_BLOCKED_ROUTE_PREFIXES = [
  "/help",
  "/chat",
  "/journal",
  "/patterns",
  "/history",
  "/contradictions",
  "/check-ins",
  "/active-questions",
  "/library",
  "/settings",
  "/account",
  "/import",
  "/context",
  "/memories",
  "/projections",
  "/references",
  "/audit",
  "/evidence",
  "/metrics",
] as const;

const INTERNAL_OR_DEV_PRESERVED_ROUTE_PREFIXES = [
  "/internal/user-map/review",
  "/dev/orvek-v0-reference",
] as const;

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") {
    return pathname === "/";
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRouteInPrefixes(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

function isLegacyPublicBlockedRoute(pathname: string): boolean {
  return isRouteInPrefixes(pathname, LEGACY_PUBLIC_BLOCKED_ROUTE_PREFIXES);
}

function isPreservedInternalOrDevRoute(pathname: string): boolean {
  return isRouteInPrefixes(pathname, INTERNAL_OR_DEV_PRESERVED_ROUTE_PREFIXES);
}

export default clerkMiddleware(async (auth, request) => {
  // Allow Stripe webhooks through without Clerk
  if (request.nextUrl.pathname.startsWith("/api/webhook")) {
    return;
  }

  const pathname = normalizePathname(request.nextUrl.pathname);

  if (
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/trpc") &&
    isLegacyPublicBlockedRoute(pathname) &&
    !isPreservedInternalOrDevRoute(pathname) &&
    !isPublicRoute(request)
  ) {
    return new NextResponse("Not Found", { status: 404 });
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
