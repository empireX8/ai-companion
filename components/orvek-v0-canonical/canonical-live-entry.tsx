"use client"

import { CanonicalLiveRuntimeEntry } from "@/components/orvek-v0-canonical/canonical-live-runtime-entry"

/**
 * Blue/green live candidate wrapper around the shared production live runtime.
 * Disables production pathname sync so the candidate stays on its /dev path.
 */
export function CanonicalLiveEntry() {
  return (
    <CanonicalLiveRuntimeEntry
      syncRoutesFromPathname={false}
      testId="orvek-v0-canonical-live-route"
    />
  )
}
