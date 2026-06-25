import type { OrvekDataApi } from "./data-provider";

export const EMPTY_ORVEK_DATA_API: OrvekDataApi = {
  getObject: () => undefined,
  getObjects: () => [],
  exploreGrounding: [],
  exploreMovement: [],
  mapCategories: [],
  timelineGroups: [],
  timelineFilters: [],
  decisionListGroups: [],
};
