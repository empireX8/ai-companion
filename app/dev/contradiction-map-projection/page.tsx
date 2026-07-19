import type { Metadata } from "next"

import { ContradictionMapProjectionFixtureEntry } from "@/components/orvek-v0-canonical/contradiction-map-projection-fixture-entry"

export const metadata: Metadata = {
  title: "Contradiction Map projection fixture (dev)",
  robots: { index: false, follow: false },
}

/**
 * Dev/test-only presentation fixture for Wave 1.1.
 * Mounts the canonical Map with one synthetic open ContradictionNode object.
 * Does not read or write Kay production data; not a Wave 2.1 proof.
 */
export default function ContradictionMapProjectionFixturePage() {
  return <ContradictionMapProjectionFixtureEntry />
}
