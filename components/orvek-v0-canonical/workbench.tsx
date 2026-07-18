"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider"
import { InspectorProvider } from "@/components/inspector/InspectorContext"
import { ProductionInspectorBridge } from "@/components/orvek-v0/production/ProductionInspectorBridge"
import { EvidencePanel } from "@/components/orvek-v0-authority/evidence-panel"
import { OrvekShellLayout } from "@/components/orvek-v0/OrvekShellLayout"
import { Overlays } from "@/components/orvek-v0/overlays"
import { Sidebar } from "@/components/orvek-v0/sidebar"
import { WorkbenchProvider, useWorkbench, type OrvekPage } from "@/components/orvek-v0/store"
import { TopBar } from "@/components/orvek-v0/top-bar"
import { TodayPage } from "./pages/today"
import { MapPage } from "./pages/map"
import { TimelinePage } from "./pages/timeline"
import { DecisionsPage } from "./pages/decisions"
import { ExplorePage } from "./pages/explore"
import type { CanonicalRuntimeData } from "./canonical-contract"
import { CanonicalDataProvider } from "./canonical-data-context"

function resolveWorkbenchPageFromPathname(pathname: string | null): OrvekPage | null {
  if (!pathname || pathname === "/") {
    return "today"
  }
  if (pathname === "/your-map" || pathname.startsWith("/your-map/")) {
    return "map"
  }
  if (pathname === "/actions" || pathname.startsWith("/actions/")) {
    return "decisions"
  }
  if (pathname === "/timeline" || pathname.startsWith("/timeline/")) {
    return "timeline"
  }
  if (pathname === "/explore" || pathname.startsWith("/explore/")) {
    return "explore"
  }
  return null
}

function PageContent() {
  const { page } = useWorkbench()
  switch (page) {
    case "today":
      return <TodayPage />
    case "map":
      return <MapPage />
    case "timeline":
      return <TimelinePage />
    case "decisions":
      return <DecisionsPage />
    case "explore":
      return <ExplorePage />
    default:
      return <TodayPage />
  }
}

function RoutePageSync() {
  const pathname = usePathname()
  const { setPage } = useWorkbench()

  useEffect(() => {
    const nextPage = resolveWorkbenchPageFromPathname(pathname)
    if (nextPage) {
      setPage(nextPage)
    }
  }, [pathname, setPage])

  return null
}

function WorkbenchInner({ enableRouteSync }: { enableRouteSync: boolean }) {
  return (
    <>
      {enableRouteSync ? <RoutePageSync /> : null}
      <OrvekShellLayout
        topBar={<TopBar />}
        sidebar={<Sidebar />}
        inspector={<EvidencePanel />}
      >
        <PageContent />
      </OrvekShellLayout>
      <Overlays />
    </>
  )
}

/**
 * Canonical reference-derived presentation runtime.
 * Shell/chrome match frozen authority; page composition comes from providers.
 */
export function CanonicalWorkbench({
  data,
  enableRouteSync,
  enableProductionBridge = false,
}: {
  data: CanonicalRuntimeData
  enableRouteSync?: boolean
  enableProductionBridge?: boolean
}) {
  const routeSync = enableRouteSync ?? data.syncRoutesFromPathname
  const body = <WorkbenchInner enableRouteSync={routeSync} />

  return (
    <CanonicalDataProvider value={data}>
      <OrvekDataProvider value={data.orvekDataApi}>
        <WorkbenchProvider>
          {enableProductionBridge ? (
            <InspectorProvider syncNavigation={false}>
              <ProductionInspectorBridge>{body}</ProductionInspectorBridge>
            </InspectorProvider>
          ) : (
            body
          )}
        </WorkbenchProvider>
      </OrvekDataProvider>
    </CanonicalDataProvider>
  )
}
