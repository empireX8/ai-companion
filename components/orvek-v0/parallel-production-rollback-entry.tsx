"use client"

/**
 * Temporary rollback / debug mount of the parallel production presentation.
 * NOT a reference authority. NOT production `/`.
 * Parallel pages remain available until Kay visually accepts the root cutover.
 */

import { useOrvekHybridWorkbenchDataApi } from "@/components/orvek-workbench/useOrvekHybridWorkbenchDataApi"
import { Workbench } from "@/components/orvek-v0/workbench"
import { DurableActionsRefreshProvider } from "@/lib/orvek-v0/durable-actions-context"

export function ParallelProductionRollbackEntry() {
  const { dataApi, handlers, durableActionsRevision, refreshAfterDurableWrite } =
    useOrvekHybridWorkbenchDataApi()

  return (
    <div data-testid="orvek-v0-parallel-production-rollback-route">
      <DurableActionsRefreshProvider
        value={{
          revision: durableActionsRevision,
          refreshAfterDurableWrite,
        }}
      >
        <Workbench dataApi={dataApi} handlers={handlers} />
      </DurableActionsRefreshProvider>
    </div>
  )
}
