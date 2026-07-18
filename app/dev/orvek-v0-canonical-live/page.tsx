import type { Metadata } from "next"

import { CanonicalLiveEntry } from "@/components/orvek-v0-canonical/canonical-live-entry"

export const metadata: Metadata = {
  title: "Orvek Canonical Live (candidate)",
  robots: { index: false, follow: false },
}

/**
 * Blue/green live candidate route.
 * Same shared CanonicalLiveRuntimeEntry as production `/`
 * (syncRoutesFromPathname forced off for the /dev path).
 */
export default function OrvekV0CanonicalLivePage() {
  return <CanonicalLiveEntry />
}
