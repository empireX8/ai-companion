import { describe, expect, it } from "vitest";

import { listV0TodayArrayEntries } from "../orvek-adapters/today";
import { buildDecisionsProductionDataApi } from "../orvek-v0/production/decisions-api";
import { buildExploreProductionDataApi } from "../orvek-v0/production/explore-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../orvek-v0/production/timeline-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import { buildWhatChangedProductionDataApi } from "../orvek-v0/production/what-changed-api";
import {
  isProductionDisplay,
  ORVEK_DISPLAY_CONTRACT_PRODUCTION,
} from "../orvek-v0/display-contract";
import type { TodayReentrySnapshot } from "../today-reentry";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

describe("orvek production display contract", () => {
  it("marks every production bridge with the production display contract", () => {
    const apis = [
      buildTodayProductionDataApi({
        snapshot: EMPTY_SNAPSHOT,
        isLoading: false,
        briefingDate: "Tuesday",
      }),
      buildMapProductionDataApi({
        items: [],
        isLoading: false,
        loadError: null,
        selectedId: null,
        detail: null,
        isDetailLoading: false,
        evidence: [],
        openQuestionsCount: 0,
        mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
        movementPreview: { isLoading: false, items: [] },
        openQuestionsPreview: { isLoading: false, items: [] },
      }),
      buildExploreProductionDataApi({
        activeTab: "free",
        hasActionHandoffRequest: false,
        handoffContext: null,
        isLoadingHandoff: false,
        handoffError: null,
        messages: [],
        composerDraft: "",
        isBooting: false,
        isSending: false,
        errorMessage: null,
        investigations: { isLoading: false, items: [], selectedId: null },
        questions: { isLoading: false, items: [], selectedId: null },
        fieldwork: { isLoading: false, items: [], selectedId: null },
      }),
      buildDecisionsProductionDataApi([]),
      buildTimelineProductionDataApi({
        timelineEntries: [],
        modelLayers: [],
        semanticFilter: "all",
        searchQuery: "",
        isLoadingActivity: false,
        isLoadingModelLayers: false,
        isLoadingSemantic: false,
        activityError: null,
        modelLayerError: null,
        selectedObjectId: null,
      }),
      buildWhatChangedProductionDataApi({
        primary: null,
        earlier: [],
        evidenceItems: [],
      }),
    ];

    for (const api of apis) {
      expect(api.displayContract).toBe(ORVEK_DISPLAY_CONTRACT_PRODUCTION);
      expect(isProductionDisplay(api)).toBe(true);
    }
  });

  it("never returns undefined entries from production getObjects", () => {
    const timelineApi = buildTimelineProductionDataApi({
      timelineEntries: [],
      modelLayers: [],
      semanticFilter: "all",
      searchQuery: "",
      isLoadingActivity: false,
      isLoadingModelLayers: false,
      isLoadingSemantic: false,
      activityError: null,
      modelLayerError: null,
      selectedObjectId: null,
    });

    expect(timelineApi.getObjects(["missing-id", undefined as never])).toEqual([]);
  });

  it("keeps adapter array slots free of undefined entries", () => {
    const today = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday",
    }).today;

    expect(today).toBeDefined();
    if (!today) return;
    expect(listV0TodayArrayEntries(today).some((entry) => entry === undefined)).toBe(false);
  });

  it("projects map production empty copy slots for conclusion detail skeleton", () => {
    const mapApi = buildMapProductionDataApi({
      items: [
        {
          id: "c-1",
          title: "Scope reopening under uncertainty",
          summary: "The most active loop; directly raises decision pressure.",
          area: "operating_logic",
          status: "disputed",
          confidenceLevel: "medium",
          evidenceCount: 6,
          updatedAt: "2026-06-24T10:00:00.000Z",
        },
      ],
      isLoading: false,
      loadError: null,
      selectedId: "c-1",
      detail: null,
      isDetailLoading: false,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    expect(mapApi.emptyCopyBySlot?.mapWhyEmpty).toBeTruthy();
    expect(mapApi.emptyCopyBySlot?.mapSupportingEmpty).toBeTruthy();
    expect(mapApi.emptyCopyBySlot?.mapConflictingEmpty).toBeTruthy();
    expect(mapApi.emptyCopyBySlot?.mapRelatedEmpty).toBeTruthy();
    expect(mapApi.emptyCopyBySlot?.mapCurrentUnderstandingEmpty).toBeTruthy();
  });
});
