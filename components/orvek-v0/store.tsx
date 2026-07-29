"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { CanonicalCorrectionHandoffV1 } from "@/lib/canonical-correction-handoff"

export type OrvekPage = "today" | "map" | "decisions" | "timeline" | "explore"
export type OrvekOverlay = "capture" | "import" | "search" | null
export type InspectorTab = "evidence" | "movement"

export type WorkbenchHistoryEntry = {
  selectedId: string
  inspectorTab: InspectorTab
  trailLabel: string | null
  scrollTop: number
}

interface WorkbenchValue {
  page: OrvekPage
  setPage: (p: OrvekPage) => void
  selectedId: string | null
  /** select an object; optional tab defaults to evidence */
  select: (id: string | null, tab?: InspectorTab) => void
  /** push a linked object onto Inspector history and keep a return target */
  pushSelection: (id: string, tab?: InspectorTab, trailLabel?: string | null) => void
  inspectorTab: InspectorTab
  /** True when the current tab came from select(id, tab) or an explicit Inspector UI click. */
  inspectorTabExplicit: boolean
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
  /**
   * In-memory canonical correction handoff for Explore context.
   * Never mutates authority; cleared on dismiss.
   */
  canonicalCorrectionHandoff: CanonicalCorrectionHandoffV1 | null
  setCanonicalCorrectionHandoff: (handoff: CanonicalCorrectionHandoffV1 | null) => void
  canGoBack: boolean
  backTarget: WorkbenchHistoryEntry | null
  goBack: () => void
  /** Latest Inspector body scrollTop; EvidencePanel keeps this current. */
  captureInspectorScrollTop: () => number
  setInspectorScrollTopCapture: (getter: (() => number) | null) => void
  /** ScrollTop to restore after Back; EvidencePanel consumes this once. */
  pendingInspectorScrollTop: number | null
  consumePendingInspectorScrollTop: () => number | null
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null)

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<OrvekPage>("today")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTabState] = useState<InspectorTab>("evidence")
  const [inspectorTabExplicit, setInspectorTabExplicit] = useState(false)
  const [overlay, setOverlay] = useState<OrvekOverlay>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [extractions, setExtractions] = useState<Record<string, string>>({})
  const [exploreActive, setExploreActive] = useState(false)
  const [canonicalCorrectionHandoff, setCanonicalCorrectionHandoffState] =
    useState<CanonicalCorrectionHandoffV1 | null>(null)
  const [history, setHistory] = useState<WorkbenchHistoryEntry[]>([])
  const [pendingInspectorScrollTop, setPendingInspectorScrollTop] = useState<number | null>(
    null,
  )
  const scrollTopGetterRef = useRef<(() => number) | null>(null)
  const pendingScrollRef = useRef<number | null>(null)

  const setInspectorScrollTopCapture = useCallback((getter: (() => number) | null) => {
    scrollTopGetterRef.current = getter
  }, [])

  const captureInspectorScrollTop = useCallback(() => {
    return scrollTopGetterRef.current?.() ?? 0
  }, [])

  const consumePendingInspectorScrollTop = useCallback(() => {
    const value = pendingScrollRef.current
    pendingScrollRef.current = null
    setPendingInspectorScrollTop(null)
    return value
  }, [])

  const setInspectorTab = useCallback((tab: InspectorTab) => {
    setInspectorTabState(tab)
    setInspectorTabExplicit(true)
  }, [])

  const select = useCallback((id: string | null, tab?: InspectorTab) => {
    setSelectedId(id)
    setInspectorTabExplicit(tab !== undefined)
    setInspectorTabState(tab ?? "evidence")
    setHistory([])
    pendingScrollRef.current = 0
    setPendingInspectorScrollTop(0)
  }, [])
  const pushSelection = useCallback(
    (id: string, tab?: InspectorTab, trailLabel?: string | null) => {
      const scrollTop = scrollTopGetterRef.current?.() ?? 0
      setHistory((prev) =>
        selectedId
          ? [
              ...prev,
              {
                selectedId,
                inspectorTab,
                trailLabel: trailLabel?.trim() || null,
                scrollTop,
              },
            ]
          : prev,
      )
      setSelectedId(id)
      setInspectorTabExplicit(tab !== undefined)
      setInspectorTabState(tab ?? "evidence")
      pendingScrollRef.current = 0
      setPendingInspectorScrollTop(0)
    },
    [inspectorTab, selectedId],
  )
  const setPage = useCallback((p: OrvekPage) => setPageState(p), [])
  const openReport = useCallback((id: string | null) => setReportId(id), [])
  const applyCorrection = useCallback((objectId: string, label: string) => {
    setCorrections((prev) => ({ ...prev, [objectId]: label }))
  }, [])
  const setExtraction = useCallback((id: string, value: string) => {
    setExtractions((prev) => ({ ...prev, [id]: value }))
  }, [])
  const setCanonicalCorrectionHandoff = useCallback(
    (handoff: CanonicalCorrectionHandoffV1 | null) => {
      setCanonicalCorrectionHandoffState(handoff)
    },
    [],
  )
  const goBack = useCallback(() => {
    setHistory((prev) => {
      const nextEntry = prev[prev.length - 1] ?? null
      if (!nextEntry) {
        return prev
      }
      setSelectedId(nextEntry.selectedId)
      setInspectorTabExplicit(true)
      setInspectorTabState(nextEntry.inspectorTab)
      pendingScrollRef.current = nextEntry.scrollTop
      setPendingInspectorScrollTop(nextEntry.scrollTop)
      return prev.slice(0, -1)
    })
  }, [])

  const value = useMemo<WorkbenchValue>(
    () => ({
      page,
      setPage,
      selectedId,
      select,
      pushSelection,
      inspectorTab,
      inspectorTabExplicit,
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
      canonicalCorrectionHandoff,
      setCanonicalCorrectionHandoff,
      canGoBack: history.length > 0,
      backTarget: history[history.length - 1] ?? null,
      goBack,
      captureInspectorScrollTop,
      setInspectorScrollTopCapture,
      pendingInspectorScrollTop,
      consumePendingInspectorScrollTop,
    }),
    [
      page,
      setPage,
      selectedId,
      select,
      pushSelection,
      inspectorTab,
      inspectorTabExplicit,
      overlay,
      reportId,
      openReport,
      corrections,
      applyCorrection,
      extractions,
      setExtraction,
      exploreActive,
      canonicalCorrectionHandoff,
      setCanonicalCorrectionHandoff,
      history,
      goBack,
      captureInspectorScrollTop,
      setInspectorScrollTopCapture,
      pendingInspectorScrollTop,
      consumePendingInspectorScrollTop,
    ],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) throw new Error("useWorkbench must be used within WorkbenchProvider")
  return ctx
}

export function useOptionalWorkbench() {
  return useContext(WorkbenchContext)
}
