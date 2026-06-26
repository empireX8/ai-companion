import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject,
  getObjects,
} from "./orvek-data";
import type { OrvekDataApi } from "./data-provider";

export function createMockOrvekDataApi(): OrvekDataApi {
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
  };
}
