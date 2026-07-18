import { writeFileSync } from "node:fs"

import type { OrvekObject } from "./orvek-v0/orvek-types"
import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  OBJECTS,
  getObject,
  getObjects,
} from "../components/orvek-v0-reference-frozen/reference-data"

export const EXACT_FIXTURE_MANIFEST_VERSION = "1.0.0"
export const EXACT_FIXTURE_GENERATED_AT = "fixture-authority"

export type ExactFixtureTodayNowRow = {
  id: string
  kicker: string
  iconKey: string
  title: string
  status: string
}

export type ExactFixtureTodayMovement = {
  id: string
  previous: string
  evidence: string
  updated: string
}

export type ExactFixtureTodayPrimaryAction = {
  label: string
  primary?: boolean
  iconKey?: string
}

export type ExactFixtureTodayComposition = {
  briefingLine: string
  briefingTitle: string
  briefingMeta: string
  leadId: string
  leadNarrative: string
  leadWhatChanged: string
  leadLastEvidence: string
  leadKicker: string
  nowRows: ExactFixtureTodayNowRow[]
  movements: ExactFixtureTodayMovement[]
  resurfacedIds: string[]
  reportId: string
  reportTitle: string
  reportMeta: string
  primaryActions: ExactFixtureTodayPrimaryAction[]
}

export type ExactFixtureMapCategory = {
  id: string
  label: string
  iconKey: string
  ids: string[]
}

export type ExactFixtureTimelineGroup = {
  heading: string
  ids: string[]
}

export type ExactFixtureDecisionListGroup = {
  heading: string
  ids: string[]
  tone?: "action"
}

export type ExactFixtureExploreMovement = {
  id: string
  kind: string
  text: string
  linkId?: string
}

export type ExactFixtureReviewPathStep = {
  id: string
  label: string
  route: string
  page: "today" | "inspector" | "map" | "timeline" | "decisions" | "explore"
  selectedObjectId?: string | null
  inspectorTab?: "Evidence / Context" | "Model Movement"
  expectedTitles: string[]
  expectedSections?: string[]
}

export type ExactFixtureManifest = {
  version: string
  generatedAt: string
  today: ExactFixtureTodayComposition
  objects: OrvekObject[]
  mapCategories: ExactFixtureMapCategory[]
  mapDefaultSelectedId: string
  timelineGroups: ExactFixtureTimelineGroup[]
  timelineFilters: string[]
  decisionListGroups: ExactFixtureDecisionListGroup[]
  decisionsDefaultId: string
  exploreGroundingIds: string[]
  exploreMovement: ExactFixtureExploreMovement[]
  exploreQuestionIds: string[]
  exploreInvestigationIds: string[]
  exploreFieldworkIds: string[]
  reviewPath: ExactFixtureReviewPathStep[]
}

/** Plain JSON today composition copied from fixture-provider (iconKey replaces Lucide icons). */
const FIXTURE_TODAY: ExactFixtureTodayComposition = {
  briefingLine: "Tuesday · since your last visit",
  briefingTitle: "Your model moved in 3 places.",
  briefingMeta:
    "2 reviews are due and 1 report is ready. Start where the change is most consequential.",
  leadId: "d1",
  leadNarrative:
    "You set a review window after choosing to prototype the architecture first. Recording what happened is what lets Orvek tell whether the scope-reopening loop actually eased.",
  leadWhatChanged: "Outcome window closed",
  leadLastEvidence: "2 hours ago",
  leadKicker: "Most consequential now · decision outcome due",
  nowRows: [
    {
      id: "m-loop-1",
      kicker: "Watch For",
      iconKey: "BellRing",
      title: "Scope-reopening pattern triggered again",
      status: "Active",
    },
    {
      id: "f1",
      kicker: "Fieldwork",
      iconKey: "Telescope",
      title: "Small public test — narrow version before reopening",
      status: "Due today",
    },
    {
      id: "d1",
      kicker: "Outcome review",
      iconKey: "FileText",
      title: "Ship prototype or keep refining architecture?",
      status: "Review due",
    },
    {
      id: "aq-3",
      kicker: "Open question",
      iconKey: "CircleHelp",
      title: "Which features are essential for a first version?",
      status: "Needs input",
    },
  ],
  movements: [
    {
      id: "mu-1",
      previous: "Decision pressure was treated as an isolated state.",
      evidence: "6 receipts tied pressure to repeated scope reopening.",
      updated: "Pressure is now modeled as an output of the scope-reopening loop.",
    },
    {
      id: "mu-2",
      previous: "Background context was held as loose metadata.",
      evidence: "Recent captures referenced current build constraints directly.",
      updated: "Context Profile promoted to a first-class, correctable model layer.",
    },
    {
      id: "aq-1",
      previous: "Avoidance read as a general tendency under pressure.",
      evidence: "A decision review added social-consequence detail.",
      updated: "Avoidance appears strongest when social consequence is uncertain.",
    },
  ],
  resurfacedIds: ["r6", "r5", "r2"],
  reportId: "rep-weekly",
  reportTitle: "Weekly Model Movement report",
  reportMeta: "Ready · 3 loops, 2 decisions, 1 context update",
  primaryActions: [
    { label: "Continue from what changed", primary: true, iconKey: "ArrowRight" },
    { label: "Add what happened", iconKey: "Plus" },
    { label: "Review outcome", iconKey: "FileText" },
    { label: "Check in on fieldwork", iconKey: "BellRing" },
    { label: "Capture new signal", iconKey: "Telescope" },
  ],
}

const FIXTURE_MAP_CATEGORIES: ExactFixtureMapCategory[] = [
  { id: "patterns", label: "Patterns", iconKey: "Repeat", ids: ["m-loop-1", "m-loop-2", "m-loop-3"] },
  {
    id: "claims",
    label: "Claims",
    iconKey: "Compass",
    ids: ["m-claim-1", "m-claim-2", "m-claim-3"],
  },
  {
    id: "conflicts",
    label: "Active conflicts",
    iconKey: "AlertTriangle",
    ids: ["m-conflict-1", "m-conflict-2", "m-conflict-3", "m-conflict-4"],
  },
  {
    id: "goals",
    label: "Goals / directions",
    iconKey: "Target",
    ids: ["m-goal-1", "m-goal-2", "m-goal-3"],
  },
  {
    id: "context",
    label: "Background / Context",
    iconKey: "User",
    ids: ["ctx-current", "ctx-values", "ctx-interests", "ctx-constraints", "ctx-self"],
  },
  {
    id: "questions",
    label: "Active questions",
    iconKey: "HelpCircle",
    ids: ["aq-1", "aq-2", "aq-3", "aq-4"],
  },
  {
    id: "updates",
    label: "Model updates",
    iconKey: "Sparkles",
    ids: ["mu-1", "mu-2", "mu-3", "mu-4", "mu-5"],
  },
  {
    id: "uncertainty",
    label: "Uncertainty",
    iconKey: "HelpCircle",
    ids: ["m-conflict-2", "aq-2", "m-conflict-4"],
  },
]

const FIXTURE_MAP_DEFAULT_SELECTED_ID = "m-claim-1"

const FIXTURE_TIMELINE_GROUPS: ExactFixtureTimelineGroup[] = [
  { heading: "Today", ids: ["t1", "t2", "t3", "t4"] },
  { heading: "This week", ids: ["t5", "t6", "t7"] },
  { heading: "Last week", ids: ["t8", "t9", "t10", "t11"] },
  { heading: "Earlier", ids: ["t12", "t13", "t14"] },
  { heading: "Imported history", ids: ["imp-1"] },
]

const FIXTURE_TIMELINE_FILTERS = [
  "All",
  "Model Updates",
  "Receipts",
  "Decisions",
  "Reports",
  "Fieldwork",
  "Context Profile",
  "Imports",
]

const FIXTURE_DECISION_LIST_GROUPS: ExactFixtureDecisionListGroup[] = [
  { heading: "Active", ids: ["d1", "d2", "d3"] },
  { heading: "Chosen", ids: ["d-public"] },
  { heading: "Outcome due", ids: ["d-nav"], tone: "action" },
  { heading: "Reviewed", ids: ["d-rev-1", "d-rev-2", "d-rev-3"] },
]

const FIXTURE_DECISIONS_DEFAULT_ID = "d1"

const FIXTURE_EXPLORE_GROUNDING_IDS = [...EXPLORE_GROUNDING]
const FIXTURE_EXPLORE_MOVEMENT: ExactFixtureExploreMovement[] = EXPLORE_MOVEMENT.map((entry) => ({
  id: entry.id,
  kind: entry.kind,
  text: entry.text,
  ...(entry.linkId ? { linkId: entry.linkId } : {}),
}))
const FIXTURE_EXPLORE_QUESTION_IDS = ["aq-1", "aq-2", "aq-3", "aq-4"]
const FIXTURE_EXPLORE_INVESTIGATION_IDS = ["inv-1", "inv-2", "inv-3"]
const FIXTURE_EXPLORE_FIELDWORK_IDS = ["f1", "f2"]

type ExactFixtureComposition = Omit<
  ExactFixtureManifest,
  "version" | "generatedAt" | "reviewPath" | "objects"
>

function collectReferencedObjectIds(manifest: ExactFixtureComposition): string[] {
  const ids = new Set<string>()

  ids.add(manifest.today.leadId)
  ids.add(manifest.today.reportId)
  for (const row of manifest.today.nowRows) ids.add(row.id)
  for (const movement of manifest.today.movements) ids.add(movement.id)
  for (const resurfacedId of manifest.today.resurfacedIds) ids.add(resurfacedId)

  for (const category of manifest.mapCategories) {
    for (const id of category.ids) ids.add(id)
  }

  for (const group of manifest.timelineGroups) {
    for (const id of group.ids) ids.add(id)
  }

  for (const group of manifest.decisionListGroups) {
    for (const id of group.ids) ids.add(id)
  }

  for (const id of manifest.exploreGroundingIds) ids.add(id)
  for (const id of manifest.exploreQuestionIds) ids.add(id)
  for (const id of manifest.exploreInvestigationIds) ids.add(id)
  for (const id of manifest.exploreFieldworkIds) ids.add(id)
  for (const movement of manifest.exploreMovement) {
    if (movement.linkId) ids.add(movement.linkId)
  }

  return [...ids].sort()
}

function serializeObject(object: OrvekObject): OrvekObject {
  return JSON.parse(JSON.stringify(object)) as OrvekObject
}

function buildReviewPath(today: ExactFixtureTodayComposition): ExactFixtureReviewPathStep[] {
  const lead = getObject(today.leadId)
  const movement = getObject("mu-1")
  const report = getObject(today.reportId)
  const mapDefault = getObject(FIXTURE_MAP_DEFAULT_SELECTED_ID)

  return [
    {
      id: "01-today-initial",
      label: "Today initial state",
      route: "/dev/orvek-v0-reference",
      page: "today",
      expectedTitles: [today.briefingTitle, today.reportTitle],
      expectedSections: ["NOW", "Model movement"],
    },
    {
      id: "02-today-selected-object",
      label: "Today selected object",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: today.leadId,
      inspectorTab: "Evidence / Context",
      expectedTitles: [lead?.title ?? today.leadId],
      expectedSections: ["Evidence / Context", "Model Movement"],
    },
    {
      id: "03-evidence-context-top",
      label: "Evidence / Context top",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Evidence / Context",
      expectedTitles: [movement?.title ?? "mu-1"],
    },
    {
      id: "04-evidence-context-lower",
      label: "Evidence / Context lower sections",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Evidence / Context",
      expectedTitles: [movement?.title ?? "mu-1"],
      expectedSections: ["Receipts", "Supporting", "Related"],
    },
    {
      id: "05-linked-receipt",
      label: "Linked receipt detail",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "r5",
      inspectorTab: "Evidence / Context",
      expectedTitles: [getObject("r5")?.title ?? "r5"],
    },
    {
      id: "06-linked-back-navigation",
      label: "Back restoration at prior scroll position",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Evidence / Context",
      expectedTitles: [movement?.title ?? "mu-1"],
    },
    {
      id: "07-movement-top",
      label: "Model Movement top",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Model Movement",
      expectedTitles: [movement?.title ?? "mu-1"],
      expectedSections: ["Recent movement"],
    },
    {
      id: "08-report-overlay-open",
      label: "Report overlay open",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Model Movement",
      expectedTitles: [report?.title ?? today.reportId, today.reportTitle],
    },
    {
      id: "09-report-overlay-close",
      label: "Overlay close/return state",
      route: "/dev/orvek-v0-reference",
      page: "inspector",
      selectedObjectId: "mu-1",
      inspectorTab: "Model Movement",
      expectedTitles: [movement?.title ?? "mu-1"],
    },
    {
      id: "10-map",
      label: "Map category inventory",
      route: "/dev/orvek-v0-reference",
      page: "map",
      selectedObjectId: FIXTURE_MAP_DEFAULT_SELECTED_ID,
      expectedTitles: [mapDefault?.title ?? FIXTURE_MAP_DEFAULT_SELECTED_ID],
      expectedSections: FIXTURE_MAP_CATEGORIES.map((category) => category.label),
    },
    {
      id: "11-decisions",
      label: "Decisions list groups",
      route: "/dev/orvek-v0-reference",
      page: "decisions",
      selectedObjectId: FIXTURE_DECISIONS_DEFAULT_ID,
      expectedTitles: [lead?.title ?? FIXTURE_DECISIONS_DEFAULT_ID],
      expectedSections: FIXTURE_DECISION_LIST_GROUPS.map((group) => group.heading),
    },
    {
      id: "12-explore",
      label: "Explore grounding and movement",
      route: "/dev/orvek-v0-reference",
      page: "explore",
      expectedTitles: FIXTURE_EXPLORE_MOVEMENT.map((entry) => entry.kind),
      expectedSections: ["Grounding", "Possible model movement"],
    },
    {
      id: "13-timeline",
      label: "Timeline grouped history",
      route: "/dev/orvek-v0-reference",
      page: "timeline",
      expectedTitles: FIXTURE_TIMELINE_GROUPS.map((group) => group.heading),
      expectedSections: FIXTURE_TIMELINE_GROUPS.map((group) => group.heading),
    },
  ]
}

export function buildExactFixtureManifest(): ExactFixtureManifest {
  const partial = {
    today: FIXTURE_TODAY,
    mapCategories: FIXTURE_MAP_CATEGORIES,
    mapDefaultSelectedId: FIXTURE_MAP_DEFAULT_SELECTED_ID,
    timelineGroups: FIXTURE_TIMELINE_GROUPS,
    timelineFilters: FIXTURE_TIMELINE_FILTERS,
    decisionListGroups: FIXTURE_DECISION_LIST_GROUPS,
    decisionsDefaultId: FIXTURE_DECISIONS_DEFAULT_ID,
    exploreGroundingIds: FIXTURE_EXPLORE_GROUNDING_IDS,
    exploreMovement: FIXTURE_EXPLORE_MOVEMENT,
    exploreQuestionIds: FIXTURE_EXPLORE_QUESTION_IDS,
    exploreInvestigationIds: FIXTURE_EXPLORE_INVESTIGATION_IDS,
    exploreFieldworkIds: FIXTURE_EXPLORE_FIELDWORK_IDS,
  }

  const referencedIds = collectReferencedObjectIds(partial)
  // Full frozen OBJECTS graph (authority = /dev/orvek-v0-reference), plus any
  // layout-referenced ids that might not appear in OBJECTS keys.
  const allIds = [
    ...new Set([...Object.keys(OBJECTS), ...referencedIds]),
  ].sort()
  const objects = getObjects(allIds).map(serializeObject)

  return {
    version: EXACT_FIXTURE_MANIFEST_VERSION,
    generatedAt: EXACT_FIXTURE_GENERATED_AT,
    ...partial,
    objects,
    reviewPath: buildReviewPath(FIXTURE_TODAY),
  }
}

export function writeExactFixtureManifest(path: string): ExactFixtureManifest {
  const manifest = buildExactFixtureManifest()
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  return manifest
}
