"use client";

import { type ReactNode } from "react";

import { CanonicalLiveRuntimeEntry } from "@/components/orvek-v0-canonical/canonical-live-runtime-entry";

/**
 * Production desktop root.
 * Mounts the shared canonical + live runtime entry (same path as
 * /dev/orvek-v0-canonical-live). Parallel orvek-v0/pages presentation is inactive.
 * Temporary rollback UI: /dev/orvek-v0-parallel-production-rollback
 */
export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  void children;
  return (
    <div data-testid="orvek-v0-production-canonical-root">
      <CanonicalLiveRuntimeEntry syncRoutesFromPathname />
    </div>
  );
}
