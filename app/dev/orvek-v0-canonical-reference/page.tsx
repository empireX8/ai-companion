import type { Metadata } from "next"

import { CanonicalFixtureEntry } from "@/components/orvek-v0-canonical/canonical-fixture-entry"

export const metadata: Metadata = {
  title: "Orvek Canonical Reference (fixture)",
  robots: { index: false, follow: false },
}

/**
 * Server route for the fixture-backed canonical runtime.
 * Renders only the client entry — no non-serializable props.
 * Must match cold authority at /dev/orvek-v0-reference after Step 4.
 */
export default function OrvekV0CanonicalReferencePage() {
  return <CanonicalFixtureEntry />
}
