"use client";

import React, { type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CanonicalLiveRuntimeEntry } from "@/components/orvek-v0-canonical/canonical-live-runtime-entry";

const CANONICAL_WORKBENCH_ROUTE_PREFIXES = [
  "/your-map",
  "/actions",
  "/timeline",
  "/explore",
] as const;

const APPROVED_ROUTE_CHILD_PATHS = ["/contradictions/candidates"] as const;

function isCanonicalWorkbenchRoute(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  return CANONICAL_WORKBENCH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isApprovedRouteChildPath(pathname: string): boolean {
  return APPROVED_ROUTE_CHILD_PATHS.some((path) => pathname === path);
}

/**
 * Production desktop root.
 * Mounts the shared canonical + live runtime entry (same path as
 * /dev/orvek-v0-canonical-live). Parallel orvek-v0/pages presentation is inactive.
 * Temporary rollback UI: /dev/orvek-v0-parallel-production-rollback
 */
export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const renderCanonicalWorkbench =
    isCanonicalWorkbenchRoute(pathname) || !isApprovedRouteChildPath(pathname);

  if (renderCanonicalWorkbench) {
    return (
      <div data-testid="orvek-v0-production-canonical-root">
        <CanonicalLiveRuntimeEntry syncRoutesFromPathname />
      </div>
    );
  }

  return <>{children}</>;
}
