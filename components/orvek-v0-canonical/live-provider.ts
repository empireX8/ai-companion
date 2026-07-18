"use client"

/**
 * Maps existing live/hybrid OrvekDataApi into the canonical runtime contract.
 * No parallel page composition — presentation stays in orvek-v0-canonical pages.
 *
 * Honesty rules:
 * - Do not invent fixture identities (d1, rep-weekly, mu-1, …).
 * - Do not invent narrative/meta when live objects omit them.
 * - Loading titles may use restrained "Loading…" only while todayIsLoading.
 */

import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CircleHelp,
  Compass,
  FileText,
  HelpCircle,
  Plus,
  Repeat,
  Sparkles,
  Target,
  Telescope,
  User,
} from "lucide-react"

import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"

import type {
  CanonicalMapCategory,
  CanonicalRuntimeData,
  CanonicalTodayNowRow,
} from "./canonical-contract"

const MAP_ICON_BY_ID: Record<string, CanonicalMapCategory["icon"]> = {
  patterns: Repeat,
  claims: Compass,
  conflicts: AlertTriangle,
  goals: Target,
  context: User,
  questions: HelpCircle,
  updates: Sparkles,
  uncertainty: HelpCircle,
}

function nowIconForKicker(kicker: string | undefined): CanonicalTodayNowRow["icon"] {
  const key = (kicker ?? "").toLowerCase()
  if (key.includes("field")) return Telescope
  if (key.includes("outcome") || key.includes("decision")) return FileText
  if (key.includes("question")) return CircleHelp
  return BellRing
}

export function buildCanonicalLiveRuntimeData(liveApi: OrvekDataApi): CanonicalRuntimeData {
  const getObject = (id: string | null | undefined) => liveApi.getObject(id)
  const getObjects = (ids: string[] | undefined) => liveApi.getObjects(ids)

  const todayProps = liveApi.today
  const heroSelectionId =
    todayProps?.hero?.inspectSelectId ??
    todayProps?.hero?.selectionId ??
    todayProps?.hero?.movementId ??
    null

  const nowRows: CanonicalTodayNowRow[] = (todayProps?.nowRows ?? []).map((row) => ({
    id: row.id,
    kicker: row.kicker,
    icon: nowIconForKicker(row.kicker),
    title: row.title,
    status: row.status,
  }))

  const movements = (todayProps?.movements ?? []).map((m) => ({
    id: m.id,
    previous: m.previous ?? "",
    evidence: m.evidence ?? "",
    updated: m.updated ?? m.evidence ?? "",
  }))

  const resurfacedIds = (liveApi.todayResurfacedIds ?? []).filter((id) => {
    const obj = getObject(id)
    return Boolean(obj && (obj.sourceText?.trim() || obj.title?.trim()))
  })

  const reportTitle = todayProps?.report?.title?.trim() ?? ""
  const reportMeta = todayProps?.report?.meta?.trim() ?? ""
  // Never fall back to heroSelectionId — that produced a blank FileText+arrow card
  // when title/meta were empty (report absent but lead selected).
  const reportId =
    reportTitle &&
    (todayProps?.report?.reportId ?? todayProps?.report?.primaryMovement?.id)
      ? (todayProps?.report?.reportId ??
        todayProps?.report?.primaryMovement?.id ??
        "")
      : ""

  const mapCategories: CanonicalMapCategory[] = (liveApi.mapCategories ?? []).map((cat) => ({
    id: cat.id,
    label: cat.label,
    icon: MAP_ICON_BY_ID[cat.id] ?? Compass,
    ids: cat.ids,
  }))

  const firstMapId =
    liveApi.mapSelectedId ??
    mapCategories.find((c) => c.ids.length > 0)?.ids[0] ??
    ""

  const decisionListGroups = (liveApi.decisionListGroups ?? []).map((g) => ({
    heading: g.heading,
    ids: g.ids,
    tone: g.tone,
  }))

  const orvekDataApi: OrvekDataApi = {
    ...liveApi,
    referenceSurface: false,
    canonicalRuntime: true,
  }

  const briefingTitle =
    liveApi.todayCopy?.briefingTitle ??
    todayProps?.briefingTitle ??
    (liveApi.todayIsLoading ? "Loading…" : "")

  const nowRowsFiltered = nowRows.filter(
    (row) => Boolean(row.id?.trim() && row.title?.trim()),
  )
  const movementsFiltered = movements.filter(
    (m) => Boolean(m.id?.trim() && (m.updated?.trim() || m.previous?.trim())),
  )
  const primaryActions = (todayProps?.primaryActions ?? [])
    .filter((action) => Boolean(action.label?.trim()))
    .map((action) => ({
      label: action.label.trim(),
      primary: action.primary,
      icon: action.primary ? ArrowRight : Plus,
    }))

  return {
    orvekDataApi,
    getObject,
    getObjects,
    syncRoutesFromPathname: true,
    today: {
      briefingLine:
        liveApi.todayCopy?.briefingLine ?? todayProps?.briefingDate ?? "",
      briefingTitle,
      briefingMeta:
        liveApi.todayCopy?.briefingMeta ?? todayProps?.briefingMeta ?? "",
      leadId: heroSelectionId ?? decisionListGroups[0]?.ids[0] ?? "",
      leadNarrative: (() => {
        const lead = heroSelectionId ? getObject(heroSelectionId) : undefined
        return (
          todayProps?.hero?.summary ??
          todayProps?.hero?.whyItMatters ??
          lead?.summary ??
          ""
        )
      })(),
      // Map from live Today hero when present — do not invent fixture copy.
      leadWhatChanged: todayProps?.hero?.whatChanged ?? "",
      leadLastEvidence: todayProps?.hero?.lastEvidence ?? "",
      leadKicker: (() => {
        const heroKicker = todayProps?.hero?.kicker?.trim()
        if (heroKicker) {
          return heroKicker.toLowerCase().includes("most consequential")
            ? heroKicker
            : `Most consequential now · ${heroKicker}`
        }
        return heroSelectionId ? "Most consequential now" : ""
      })(),
      nowRows: nowRowsFiltered,
      movements: movementsFiltered,
      resurfacedIds,
      reportId,
      reportTitle: reportId ? reportTitle : "",
      reportMeta: reportId ? reportMeta : "",
      primaryActions,
    },
    mapCategories,
    mapDefaultSelectedId: firstMapId,
    timelineGroups: liveApi.timelineGroups ?? [],
    timelineFilters: liveApi.timelineFilters ?? [],
    decisionListGroups,
    decisionsDefaultId:
      liveApi.decisionsSelectedId ?? decisionListGroups[0]?.ids[0] ?? "",
    exploreGroundingIds: liveApi.exploreGrounding ?? [],
    exploreMovement: liveApi.exploreMovement ?? [],
    exploreQuestionIds: liveApi.exploreQuestionIds ?? [],
    exploreInvestigationIds: liveApi.exploreInvestigationIds ?? [],
    exploreFieldworkIds: liveApi.exploreFieldworkIds ?? [],
  }
}

/** Resolve a live object without inventing presentation fields. */
export function liveObjectOrUndefined(
  api: OrvekDataApi,
  id: string | null | undefined,
): OrvekObject | undefined {
  return api.getObject(id)
}
