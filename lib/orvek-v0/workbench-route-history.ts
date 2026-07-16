"use client";

import type { OrvekPage } from "@/components/orvek-v0/store";

const PAGE_ROUTE_BY_ID: Record<OrvekPage, string> = {
  today: "/",
  map: "/your-map",
  decisions: "/actions",
  timeline: "/timeline",
  explore: "/explore",
};

export function resolveWorkbenchRoutePath(pageId: OrvekPage): string {
  return PAGE_ROUTE_BY_ID[pageId];
}

export function updateWorkbenchHistory(
  nextPath: string,
  mode: "push" | "replace" = "push",
): void {
  if (typeof window === "undefined") {
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
