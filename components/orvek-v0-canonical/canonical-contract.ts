"use client"

import type { LucideIcon } from "lucide-react"

import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"
import type { ExploreMovement } from "../orvek-v0-reference-frozen/reference-data"

/** Explicit composition + object contract for the canonical presentation runtime. */
export type CanonicalTodayNowRow = {
  id: string
  kicker: string
  icon: LucideIcon
  title: string
  status: string
}

export type CanonicalTodayMovement = {
  id: string
  previous: string
  evidence: string
  updated: string
}

export type CanonicalTodayPrimaryAction = {
  label: string
  primary?: boolean
  icon?: LucideIcon
}

export type CanonicalTodayComposition = {
  briefingLine: string
  briefingTitle: string
  briefingMeta: string
  leadId: string
  leadNarrative: string
  leadWhatChanged: string
  leadLastEvidence: string
  leadKicker: string
  nowRows: CanonicalTodayNowRow[]
  movements: CanonicalTodayMovement[]
  resurfacedIds: string[]
  reportId: string
  reportTitle: string
  reportMeta: string
  primaryActions: CanonicalTodayPrimaryAction[]
}

export type CanonicalMapCategory = {
  id: string
  label: string
  icon: LucideIcon
  ids: string[]
}

export type CanonicalTimelineGroup = {
  heading: string
  ids: string[]
}

export type CanonicalDecisionListGroup = {
  heading: string
  ids: string[]
  tone?: "action"
}

export type CanonicalRuntimeData = {
  /** Object graph + inspector/overlay fields */
  orvekDataApi: OrvekDataApi
  getObject: (id: string | null | undefined) => OrvekObject | undefined
  getObjects: (ids: string[] | undefined) => OrvekObject[]
  today: CanonicalTodayComposition
  mapCategories: CanonicalMapCategory[]
  mapDefaultSelectedId: string
  timelineGroups: CanonicalTimelineGroup[]
  timelineFilters: string[]
  decisionListGroups: CanonicalDecisionListGroup[]
  decisionsDefaultId: string
  exploreGroundingIds: string[]
  exploreMovement: ExploreMovement[]
  exploreQuestionIds: string[]
  exploreInvestigationIds: string[]
  exploreFieldworkIds: string[]
  /** Production-only route sync; false on fixture verification routes */
  syncRoutesFromPathname: boolean
}

export function resolveCanonicalObject(
  data: CanonicalRuntimeData,
  id: string | null | undefined,
): OrvekObject | undefined {
  return data.getObject(id)
}
