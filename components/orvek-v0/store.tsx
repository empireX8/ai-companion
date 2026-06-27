"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type OrvekPage = "today" | "map" | "decisions" | "timeline" | "explore"
export type OrvekOverlay = "capture" | "import" | "search" | null
export type InspectorTab = "evidence" | "movement"

interface WorkbenchValue {
  page: OrvekPage
  setPage: (p: OrvekPage) => void
  selectedId: string | null
  /** select an object; optional tab defaults to evidence */
  select: (id: string | null, tab?: InspectorTab) => void
  inspectorTab: InspectorTab
  setInspectorTab: (t: InspectorTab) => void
  overlay: OrvekOverlay
  setOverlay: (o: OrvekOverlay) => void
  reportId: string | null
  openReport: (id: string | null) => void
  corrections: Record<string, string>
  applyCorrection: (objectId: string, label: string) => void
  /** shared Explore extraction decisions, surfaced live in the inspector */
  extractions: Record<string, string>
  setExtraction: (id: string, value: string) => void
  /** true while an Explore conversation is producing possible movement */
  exploreActive: boolean
  setExploreActive: (v: boolean) => void
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null)

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<OrvekPage>("today")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("evidence")
  const [overlay, setOverlay] = useState<OrvekOverlay>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [extractions, setExtractions] = useState<Record<string, string>>({})
  const [exploreActive, setExploreActive] = useState(false)

  const select = useCallback((id: string | null, tab?: InspectorTab) => {
    setSelectedId(id)
    setInspectorTab(tab ?? "evidence")
  }, [])
  const setPage = useCallback((p: OrvekPage) => setPageState(p), [])
  const openReport = useCallback((id: string | null) => setReportId(id), [])
  const applyCorrection = useCallback((objectId: string, label: string) => {
    setCorrections((prev) => ({ ...prev, [objectId]: label }))
  }, [])
  const setExtraction = useCallback((id: string, value: string) => {
    setExtractions((prev) => ({ ...prev, [id]: value }))
  }, [])

  const value = useMemo<WorkbenchValue>(
    () => ({
      page,
      setPage,
      selectedId,
      select,
      inspectorTab,
      setInspectorTab,
      overlay,
      setOverlay,
      reportId,
      openReport,
      corrections,
      applyCorrection,
      extractions,
      setExtraction,
      exploreActive,
      setExploreActive,
    }),
    [
      page,
      setPage,
      selectedId,
      select,
      inspectorTab,
      overlay,
      reportId,
      openReport,
      corrections,
      applyCorrection,
      extractions,
      setExtraction,
      exploreActive,
    ],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) throw new Error("useWorkbench must be used within WorkbenchProvider")
  return ctx
}
