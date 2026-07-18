"use client"

import { useMemo } from "react"

import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider"

import { OrvekShellLayout } from "@/components/orvek-v0/OrvekShellLayout"
import { EvidencePanel } from "@/components/orvek-v0/evidence-panel"
import { Overlays } from "@/components/orvek-v0/overlays"
import { Sidebar } from "@/components/orvek-v0/sidebar"
import { WorkbenchProvider, useWorkbench } from "@/components/orvek-v0/store"
import { TopBar } from "@/components/orvek-v0/top-bar"
import { createFrozenReferenceDataApi } from "./reference-data-api"
import { DecisionsPage } from "./pages/decisions"
import { ExplorePage } from "./pages/explore"
import { MapPage } from "./pages/map"
import { TimelinePage } from "./pages/timeline"
import { TodayPage } from "./pages/today"

function PageContent() {
  const { page } = useWorkbench()

  switch (page) {
    case "today":
      return <TodayPage />
    case "map":
      return <MapPage />
    case "decisions":
      return <DecisionsPage />
    case "timeline":
      return <TimelinePage />
    case "explore":
      return <ExplorePage />
    default:
      return <TodayPage />
  }
}

export function FrozenReferenceWorkbench() {
  const api = useMemo(() => createFrozenReferenceDataApi(), [])

  return (
    <WorkbenchProvider>
      <OrvekDataProvider value={api}>
        <OrvekShellLayout topBar={<TopBar />} sidebar={<Sidebar />} inspector={<EvidencePanel />}>
          <PageContent />
        </OrvekShellLayout>
        <Overlays />
      </OrvekDataProvider>
    </WorkbenchProvider>
  )
}
