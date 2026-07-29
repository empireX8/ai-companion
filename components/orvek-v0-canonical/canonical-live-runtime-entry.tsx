"use client"

import { useMemo } from "react"

import { CanonicalWorkbench } from "@/components/orvek-v0-canonical/workbench"
import { buildCanonicalLiveRuntimeData } from "@/components/orvek-v0-canonical/live-provider"
import { useOrvekHybridWorkbenchDataApi } from "@/components/orvek-workbench/useOrvekHybridWorkbenchDataApi"
import { DurableActionsRefreshProvider } from "@/lib/orvek-v0/durable-actions-context"
import { OrvekPageHandlersProvider } from "@/lib/orvek-v0/page-handlers"

/**
 * Shared production + live-candidate runtime entry.
 * Canonical presentation + live hybrid provider — one path for `/` and
 * `/dev/orvek-v0-canonical-live` (route bootstrap only differs).
 */
export function CanonicalLiveRuntimeEntry({
  syncRoutesFromPathname = true,
  testId,
}: {
  /** Production keeps URL sync; blue/green candidate forces false. */
  syncRoutesFromPathname?: boolean
  testId?: string
}) {
  const { dataApi, handlers, durableActionsRevision, refreshAfterDurableWrite } =
    useOrvekHybridWorkbenchDataApi()

  const canonicalData = useMemo(
    () => ({
      ...buildCanonicalLiveRuntimeData(dataApi),
      syncRoutesFromPathname,
    }),
    [dataApi, syncRoutesFromPathname],
  )

  const body = (
    <DurableActionsRefreshProvider
      value={{
        revision: durableActionsRevision,
        refreshAfterDurableWrite,
      }}
    >
      <OrvekPageHandlersProvider value={handlers}>
        <CanonicalWorkbench data={canonicalData} enableProductionBridge />
      </OrvekPageHandlersProvider>
    </DurableActionsRefreshProvider>
  )

  if (!testId) {
    return body
  }

  return <div data-testid={testId}>{body}</div>
}
