"use client"

import { useEffect, useMemo } from "react"

import { buildCanonicalLiveRuntimeData } from "@/components/orvek-v0-canonical/live-provider"
import { CanonicalWorkbench } from "@/components/orvek-v0-canonical/workbench"
import { useWorkbench } from "@/components/orvek-v0/store"
import {
  createMapContradictionProjectionMapApi,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID,
} from "@/lib/map-contradiction-projection-fixture"

/**
 * Force Map page with the harmless claim selected — not the contradiction.
 * Human must click the Active conflicts row to select contradiction_node.
 */
function ForceMapInitialClaimSelection() {
  const { setPage, select } = useWorkbench()

  useEffect(() => {
    setPage("map")
    select(MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID)
  }, [select, setPage])

  return null
}

/**
 * Client-only bootstrap for the contradiction Map projection presentation fixture.
 * Uses the same production Map object contract + mounted canonical Map page.
 * Not wired into root/live hybrid fetch; no Kay DB writes.
 */
export function ContradictionMapProjectionFixtureEntry() {
  const data = useMemo(() => {
    const mapApi = createMapContradictionProjectionMapApi()
    const runtime = buildCanonicalLiveRuntimeData(mapApi)
    return {
      ...runtime,
      syncRoutesFromPathname: false,
      mapDefaultSelectedId: MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID,
    }
  }, [])

  return (
    <div
      data-testid="contradiction-map-projection-fixture"
      data-fixture-cn-id={MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID}
      data-fixture-initial-selection={MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID}
    >
      <CanonicalWorkbench
        data={data}
        enableRouteSync={false}
        enableProductionBridge
        bootstrap={<ForceMapInitialClaimSelection />}
      />
    </div>
  )
}

export function createMapContradictionProjectionRuntimeData() {
  const mapApi = createMapContradictionProjectionMapApi()
  const runtime = buildCanonicalLiveRuntimeData(mapApi)
  return {
    ...runtime,
    syncRoutesFromPathname: false,
    mapDefaultSelectedId: MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID,
  }
}
