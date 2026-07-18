import type { Metadata } from "next"

import { ParallelProductionRollbackEntry } from "@/components/orvek-v0/parallel-production-rollback-entry"

export const metadata: Metadata = {
  title: "Orvek Parallel Production Rollback (dev)",
  robots: { index: false, follow: false },
}

/**
 * Temporary non-authoritative rollback/debug route.
 * Mounts the inactive parallel orvek-v0 Workbench + pages for comparison only.
 * Not a reference. Not production.
 */
export default function OrvekV0ParallelProductionRollbackPage() {
  return <ParallelProductionRollbackEntry />
}
