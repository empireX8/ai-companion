"use client";

import type { OrvekPage } from "@/components/orvek-v0/store";

const PAGE_ROUTE_BY_ID: Record<OrvekPage, string> = {
  today: "/",
  map: "/your-map",
  decisions: "/actions",
  timeline: "/timeline",
  explore: "/explore",
};

/** Dev / candidate workbenches that must not escape into production root paths. */
export const ISOLATED_WORKBENCH_PATH_PREFIXES = [
  "/dev/orvek-v0-canonical-live",
  "/dev/orvek-v0-canonical-reference",
  "/dev/orvek-v0-reference",
  "/dev/orvek-v0-parallel-production-rollback",
] as const;

export function isIsolatedWorkbenchPath(
  pathname: string | null | undefined =
    typeof window === "undefined" ? null : window.location.pathname,
): boolean {
  if (!pathname) return false;
  return ISOLATED_WORKBENCH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveIsolatedWorkbenchBasePath(
  pathname: string | null | undefined =
    typeof window === "undefined" ? null : window.location.pathname,
): string | null {
  if (!pathname) return null;
  const match = ISOLATED_WORKBENCH_PATH_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ?? null;
}

/**
 * Production root maps pages to real app paths.
 * Isolated /dev candidates keep the current candidate base path so navigation
 * stays inside the candidate runtime (page switches remain in-memory).
 */
export function resolveWorkbenchRoutePath(pageId: OrvekPage): string {
  if (typeof window !== "undefined" && isIsolatedWorkbenchPath()) {
    const base = resolveIsolatedWorkbenchBasePath() ?? window.location.pathname;
    return base;
  }
  return PAGE_ROUTE_BY_ID[pageId];
}

export function updateWorkbenchHistory(
  nextPath: string,
  mode: "push" | "replace" = "push",
): void {
  if (typeof window === "undefined") {
    return;
  }

  // Candidate / frozen / rollback routes must never push production pathnames
  // like `/`, `/your-map`, `/actions`, `/explore`, or `/timeline`.
  if (isIsolatedWorkbenchPath()) {
    return;
  }

  // Also refuse to navigate *into* an isolated prefix from production — production
  // root keeps its own history adapter.
  if (isIsolatedWorkbenchPath(nextPath.split("?")[0] ?? nextPath)) {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath === nextPath) {
    return;
  }

  if (mode === "replace") {
    window.history.replaceState(window.history.state, "", nextPath);
  } else {
    window.history.pushState(window.history.state, "", nextPath);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}
