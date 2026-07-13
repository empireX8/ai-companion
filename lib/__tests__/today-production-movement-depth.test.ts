import { describe, expect, it } from "vitest";

import { TODAY_RESULT_STATE_UNAVAILABLE_COPY } from "../orvek-adapters/today";
import { buildTimelineProductionDataApi } from "../orvek-v0/production/timeline-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  hasRecordedBeforeAfterMovement,
  REFERENCE_WEEKLY_REPORT_ID,
} from "../orvek-v0/production/today-movement-report-parity";
import type { TodayReentrySnapshot } from "../today-reentry";

const RUNTIME_MODEL_UPDATE_ID = "mu-production-ready-001";

const BASE_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [
    {
      id: RUNTIME_MODEL_UPDATE_ID,
      updateTypeLabel: "Pattern shift",
      affectedObjectTypeLabel: "Pattern",
      userFacingSummary: "Headline movement summary",
      createdAt: "2026-06-24T10:00:00.000Z",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-1",
      affectedObjectHref: "/patterns/pc-1",
    },
  ],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const READY_DEPTH = {
  [RUNTIME_MODEL_UPDATE_ID]: {
    id: RUNTIME_MODEL_UPDATE_ID,
    before: "Previously tentative.",
    after: "Now supported by receipts.",
    movementSummary: "Headline movement summary",
    movementRationale: "Receipts align across two weeks; scope reopened.",
    affectedObjectType: "pattern_claim" as const,
    affectedObjectId: "pc-1",
    createdAt: "2026-06-24T10:00:00.000Z",
    evidenceLinkCount: 2,
  },
};

const SPARSE_DEPTH = {
  [RUNTIME_MODEL_UPDATE_ID]: {
    id: RUNTIME_MODEL_UPDATE_ID,
    before: "Previously tentative.",
    after: null,
    movementSummary: "Headline movement summary",
    movementRationale: null,
    affectedObjectType: "pattern_claim" as const,
    affectedObjectId: "pc-1",
    createdAt: "2026-06-24T10:00:00.000Z",
    evidenceLinkCount: 1,
  },
};

describe("Today production movement depth composition", () => {
  it("preserves depth-enriched ModelUpdate through attention registration and honesty", () => {
    const api = buildTodayProductionDataApi({
      snapshot: BASE_SNAPSHOT,
      movementDepthById: READY_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    const object = api.getObject(RUNTIME_MODEL_UPDATE_ID);

    expect(hasRecordedBeforeAfterMovement(object)).toBe(true);
    expect(object).toMatchObject({
      id: RUNTIME_MODEL_UPDATE_ID,
      before: "Previously tentative.",
      after: "Now supported by receipts.",
      movementRationale: "Receipts align across two weeks; scope reopened.",
      canonicalReportId: RUNTIME_MODEL_UPDATE_ID,
    });
    expect(api.today?.hero?.showSeeWhyMoved).toBe(true);
    expect(api.today?.hero?.movementId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(api.today?.movements?.map((row) => row.id)).toContain(RUNTIME_MODEL_UPDATE_ID);
    expect(api.today?.report?.reportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(api.today?.report?.fullReportAvailable).toBe(true);
    expect(api.today?.report?.reportId).not.toBe(REFERENCE_WEEKLY_REPORT_ID);
    expect(api.getObject(REFERENCE_WEEKLY_REPORT_ID)).toBeUndefined();
  });

  it("withholds See Why, movements and full report when after snapshot is missing", () => {
    const api = buildTodayProductionDataApi({
      snapshot: BASE_SNAPSHOT,
      movementDepthById: SPARSE_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    expect(hasRecordedBeforeAfterMovement(api.getObject(RUNTIME_MODEL_UPDATE_ID))).toBe(false);
    expect(api.today?.hero?.showSeeWhyMoved).toBe(false);
    expect(api.today?.movements ?? []).toHaveLength(0);
    expect(api.today?.report).toBeNull();
  });

  it("resolves the same ModelUpdate id across Today, Timeline and report overlay object", () => {
    const todayApi = buildTodayProductionDataApi({
      snapshot: BASE_SNAPSHOT,
      movementDepthById: READY_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    const timelineApi = buildTimelineProductionDataApi({
      timelineEntries: [],
      modelLayers: [
        {
          id: RUNTIME_MODEL_UPDATE_ID,
          userFacingSummary: "Headline movement summary",
          createdAt: "2026-06-24T10:00:00.000Z",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Pattern",
          affectedObjectId: "pc-1",
          affectedObjectHref: "/patterns/pc-1",
          updateTypeLabel: "Pattern shift",
        },
      ],
      semanticFilter: "all",
      searchQuery: "",
      isLoadingActivity: false,
      isLoadingModelLayers: false,
      isLoadingSemantic: false,
      activityError: null,
      modelLayerError: null,
      selectedObjectId: RUNTIME_MODEL_UPDATE_ID,
      movementDepthById: READY_DEPTH,
    });

    const todayObject = todayApi.getObject(RUNTIME_MODEL_UPDATE_ID);
    const timelineObject = timelineApi.getObject(RUNTIME_MODEL_UPDATE_ID);
    const reportObject = todayApi.getObject(RUNTIME_MODEL_UPDATE_ID);

    expect(todayApi.today?.report?.reportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(timelineObject?.canonicalReportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(timelineObject?.inspectorObjectId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(reportObject?.canonicalReportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(todayObject?.after).toBe("Now supported by receipts.");
    expect(timelineObject?.after).toBe("Now supported by receipts.");
  });
});

describe("Today adapter after-state honesty", () => {
  it("uses explicit unavailable copy instead of movement summary when after is missing", async () => {
    const { mapTodayDataToV0Props } = await import("../orvek-adapters/today");

    const props = mapTodayDataToV0Props({
      snapshot: BASE_SNAPSHOT,
      movementDepthById: SPARSE_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    expect(props.movements[0]?.updated).toBe(TODAY_RESULT_STATE_UNAVAILABLE_COPY);
    expect(props.movements[0]?.updated).not.toBe("Headline movement summary");
    expect(props.report?.fullReportAvailable).toBe(false);
    expect(props.report?.reportId).toBeNull();
  });
});
