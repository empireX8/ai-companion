import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject as mockGetObject,
  getObjects as mockGetObjects,
  OBJECTS,
} from "./mock-orvek-data";
import {
  buildReferenceDecisionsProps,
  buildReferenceExploreProps,
  buildReferenceTimelineProps,
  buildReferenceTodayProps,
  buildReferenceWhatChangedProps,
} from "./reference-props";
import type { OrvekDataApi, OrvekDecisionListGroup, OrvekMapCategory, OrvekTimelineGroup } from "./data-provider";

const MAP_CATEGORIES: OrvekMapCategory[] = [
  {
    id: "patterns",
    label: "Patterns",
    ids: ["m-loop-1", "m-loop-2", "m-loop-3"],
  },
  {
    id: "claims",
    label: "Claims",
    ids: ["m-claim-1", "m-claim-2", "m-claim-3"],
  },
  {
    id: "conflicts",
    label: "Active conflicts",
    ids: ["m-conflict-1", "m-conflict-2", "m-conflict-3", "m-conflict-4"],
  },
  {
    id: "goals",
    label: "Goals / directions",
    ids: ["m-goal-1", "m-goal-2", "m-goal-3"],
  },
  {
    id: "context",
    label: "Background / Context",
    ids: ["ctx-current", "ctx-values", "ctx-interests", "ctx-constraints", "ctx-self"],
  },
  {
    id: "questions",
    label: "Active questions",
    ids: ["aq-1", "aq-2", "aq-3", "aq-4"],
  },
  {
    id: "updates",
    label: "Model updates",
    ids: ["mu-1", "mu-2", "mu-3", "mu-4", "mu-5"],
  },
  {
    id: "uncertainty",
    label: "Uncertainty",
    ids: ["m-conflict-2", "aq-2", "m-conflict-4"],
  },
];

const TIMELINE_GROUPS: OrvekTimelineGroup[] = [
  { heading: "Today", ids: ["t1", "t2", "t3", "t4"] },
  { heading: "This week", ids: ["t5", "t6", "t7"] },
  { heading: "Last week", ids: ["t8", "t9", "t10", "t11"] },
  { heading: "Earlier", ids: ["t12", "t13", "t14"] },
  { heading: "Imported history", ids: ["imp-1"] },
];

const DECISION_LIST_GROUPS: OrvekDecisionListGroup[] = [
  { heading: "Active", ids: ["d1", "d2", "d3"] },
  { heading: "Chosen", ids: ["d-public"] },
  { heading: "Outcome due", ids: ["d-nav"], tone: "action" },
  { heading: "Reviewed", ids: ["d-rev-1", "d-rev-2", "d-rev-3"] },
];

export function createMockOrvekDataApi(): OrvekDataApi {
  return {
    getObject: mockGetObject,
    getObjects: mockGetObjects,
    exploreGrounding: EXPLORE_GROUNDING,
    exploreMovement: EXPLORE_MOVEMENT,
    mapCategories: MAP_CATEGORIES,
    timelineGroups: TIMELINE_GROUPS,
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
    decisionListGroups: DECISION_LIST_GROUPS,
    exploreLiveDetectionCopy:
      "Orvek is reading the model · 1 receipt extracted · 1 question detected",
    emptyCopyBySlot: {},
    today: buildReferenceTodayProps(),
    explore: buildReferenceExploreProps(),
    decisions: buildReferenceDecisionsProps(),
    timeline: buildReferenceTimelineProps(),
    whatChanged: buildReferenceWhatChangedProps(),
    mapHeader: {
      confidenceLabel: "mixed / evolving",
      receiptsLabel: "243",
      openQuestionsLabel: "7",
    },
    mapSelectedId: MAP_CATEGORIES.flatMap((category) => category.ids)[0] ?? null,
  };
}

export function listMockObjectIds(): string[] {
  return Object.keys(OBJECTS);
}
