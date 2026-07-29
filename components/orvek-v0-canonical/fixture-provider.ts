"use client"

/**
 * Fixture provider for the canonical runtime.
 * Client-only: reads cold-authority fixtures from the frozen package without modifying it.
 * Must not be instantiated from a Server Component — use CanonicalFixtureEntry.
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

import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject,
  getObjects,
} from "../orvek-v0-reference-frozen/reference-data"
import { CANONICAL_REFERENCE_MODEL_STATUS_CARD } from "../../lib/canonical-reference-model-status-card"
import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider"

import type { CanonicalRuntimeData } from "./canonical-contract"

function createFixtureOrvekDataApi(): OrvekDataApi {
  return {
    getObject,
    getObjects,
    exploreGrounding: EXPLORE_GROUNDING,
    exploreMovement: EXPLORE_MOVEMENT,
    mapCategories: [],
    timelineGroups: [],
    timelineFilters: [],
    decisionListGroups: [],
    exploreLiveDetectionCopy:
      "Orvek is reading the model · 1 receipt extracted · 1 question detected",
    emptyCopyBySlot: {},
    mapHeader: {
      confidenceLabel: "mixed / evolving",
      receiptsLabel: "243",
      openQuestionsLabel: "7",
    },
    modelStatusCard: { ...CANONICAL_REFERENCE_MODEL_STATUS_CARD },
    exploreQuestionIds: ["aq-1", "aq-2", "aq-3", "aq-4"],
    exploreInvestigationIds: ["inv-1", "inv-2", "inv-3"],
    exploreFieldworkIds: ["f1", "f2"],
    referenceSurface: true,
    canonicalRuntime: true,
  }
}

/** Exact composition previously hard-coded in the frozen Today/Map/Timeline/Decisions/Explore pages. */
export function createCanonicalFixtureRuntimeData(): CanonicalRuntimeData {
  return {
    orvekDataApi: createFixtureOrvekDataApi(),
    getObject,
    getObjects,
    syncRoutesFromPathname: false,
    today: {
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
          icon: BellRing,
          title: "Scope-reopening pattern triggered again",
          status: "Active",
        },
        {
          id: "f1",
          kicker: "Fieldwork",
          icon: Telescope,
          title: "Small public test — narrow version before reopening",
          status: "Due today",
        },
        {
          id: "d1",
          kicker: "Outcome review",
          icon: FileText,
          title: "Ship prototype or keep refining architecture?",
          status: "Review due",
        },
        {
          id: "aq-3",
          kicker: "Open question",
          icon: CircleHelp,
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
        { label: "Continue from what changed", primary: true, icon: ArrowRight },
        { label: "Add what happened", icon: Plus },
        { label: "Review outcome", icon: FileText },
        { label: "Check in on fieldwork", icon: BellRing },
        { label: "Capture new signal", icon: Telescope },
      ],
    },
    mapCategories: [
      { id: "patterns", label: "Patterns", icon: Repeat, ids: ["m-loop-1", "m-loop-2", "m-loop-3"] },
      {
        id: "claims",
        label: "Claims",
        icon: Compass,
        ids: ["m-claim-1", "m-claim-2", "m-claim-3"],
      },
      {
        id: "conflicts",
        label: "Active conflicts",
        icon: AlertTriangle,
        ids: ["m-conflict-1", "m-conflict-2", "m-conflict-3", "m-conflict-4"],
      },
      {
        id: "goals",
        label: "Goals / directions",
        icon: Target,
        ids: ["m-goal-1", "m-goal-2", "m-goal-3"],
      },
      {
        id: "context",
        label: "Background / Context",
        icon: User,
        ids: ["ctx-current", "ctx-values", "ctx-interests", "ctx-constraints", "ctx-self"],
      },
      {
        id: "questions",
        label: "Active questions",
        icon: HelpCircle,
        ids: ["aq-1", "aq-2", "aq-3", "aq-4"],
      },
      {
        id: "updates",
        label: "Model updates",
        icon: Sparkles,
        ids: ["mu-1", "mu-2", "mu-3", "mu-4", "mu-5"],
      },
      {
        id: "uncertainty",
        label: "Uncertainty",
        icon: HelpCircle,
        ids: ["m-conflict-2", "aq-2", "m-conflict-4"],
      },
    ],
    mapDefaultSelectedId: "m-claim-1",
    timelineGroups: [
      { heading: "Today", ids: ["t1", "t2", "t3", "t4"] },
      { heading: "This week", ids: ["t5", "t6", "t7"] },
      { heading: "Last week", ids: ["t8", "t9", "t10", "t11"] },
      { heading: "Earlier", ids: ["t12", "t13", "t14"] },
      { heading: "Imported history", ids: ["imp-1"] },
    ],
    timelineFilters: [
      "All",
      "Model Updates",
      "Receipts",
      "Decisions",
      "Reports",
      "Fieldwork",
      "Context Profile",
      "Imports",
    ],
    decisionListGroups: [
      { heading: "Active", ids: ["d1", "d2", "d3"] },
      { heading: "Chosen", ids: ["d-public"] },
      { heading: "Outcome due", ids: ["d-nav"], tone: "action" },
      { heading: "Reviewed", ids: ["d-rev-1", "d-rev-2", "d-rev-3"] },
    ],
    decisionsDefaultId: "d1",
    exploreGroundingIds: EXPLORE_GROUNDING,
    exploreMovement: EXPLORE_MOVEMENT,
    exploreQuestionIds: ["aq-1", "aq-2", "aq-3", "aq-4"],
    exploreInvestigationIds: ["inv-1", "inv-2", "inv-3"],
    exploreFieldworkIds: ["f1", "f2"],
  }
}
