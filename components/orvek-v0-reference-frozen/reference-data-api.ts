import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider"
import { CANONICAL_REFERENCE_MODEL_STATUS_CARD } from "@/lib/canonical-reference-model-status-card"

import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject,
  getObjects,
} from "./reference-data"

export function createFrozenReferenceDataApi(): OrvekDataApi {
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
    referenceSurface: true,
  }
}
