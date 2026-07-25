import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import type { MapMapDataInput } from "../orvek-adapters/map";
import {
  buildExactFixtureIdMap,
  buildExactRoundTripCompositionPayload,
} from "../exact-fixture-round-trip-seed";
import { reportRecordToOrvekObject } from "../canonical-today-composition-contract";
import { canServeAsCanonicalCurrentTruth } from "../orvek-intelligence-object-authority";
import { buildDecisionsProductionDataApi } from "../orvek-v0/production/decisions-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import type { TodayReentrySnapshot } from "../today-reentry";
import { mapContradictionObjectId } from "../map-open-contradictions";

const LIVE_MAP_INPUT: MapMapDataInput = {
  items: [
    {
      id: "umc-tag-1",
      title: "Live owned conclusion",
      summary: "Genuine live map row",
      area: "operating_logic",
      status: "supported",
      confidenceLevel: "medium",
      evidenceCount: 2,
      updatedAt: "2026-07-20T10:00:00.000Z",
    },
  ],
  openContradictions: [
    {
      id: "cn-tag-1",
      title: "Open conflict",
      status: "open",
      confidence: "medium",
      evidenceCount: 2,
      lastTouchedAt: "2026-07-20T09:00:00.000Z",
      sideA: "Claim A",
      sideB: "Claim B",
      sessionOrigin: "APP",
    },
  ],
  isLoading: false,
  loadError: null,
  selectedId: "umc-tag-1",
  detail: {
    id: "umc-tag-1",
    title: "Live owned conclusion",
    summary: "Genuine live map row",
    area: "operating_logic",
    status: "supported",
    confidenceLevel: "medium",
    evidenceCount: 2,
    updatedAt: "2026-07-20T10:00:00.000Z",
    sourceDiversity: 1,
    timeSpreadDays: 3,
    createdAt: "2026-07-18T10:00:00.000Z",
  },
  isDetailLoading: false,
  evidence: [],
  openQuestionsCount: 0,
  mindContext: {
    isLoading: false,
    items: [
      {
        id: "memory-ctx-mixed-1",
        kind: "memory",
        title: "I prefer quiet evenings when recovering from meetings",
        categoryLabel: "preference",
        statusLabel: "Active",
        evidenceCount: null,
        updatedAt: "2026-07-19T10:00:00.000Z",
        detailHref: "/references/ctx-mixed-1",
        inspectorObjectId: null,
      },
    ],
    summaryCounts: { memories: 1, patterns: 0 },
  },
  movementPreview: {
    isLoading: false,
    items: [
      {
        id: "mu-tag-1",
        updateTypeLabel: "Map update",
        affectedObjectType: "usermap_conclusion",
        affectedObjectTypeLabel: "Map conclusion",
        affectedObjectId: "umc-tag-1",
        affectedObjectHref: null,
        userFacingSummary: "Model moved on scope",
        createdAt: "2026-07-20T08:00:00.000Z",
      },
    ],
  },
  openQuestionsPreview: { isLoading: false, items: [] },
};

const LIVE_ACTION: SurfacedActionView = {
  id: "sa-tag-1",
  title: "Live action",
  whySuggested: "Owned SurfacedAction",
  bucket: "stabilize",
  effort: "Low",
  linkedFamily: null,
  linkedFamilyLabel: null,
  linkedClaimId: null,
  linkedClaimSummary: null,
  linkedGoalId: null,
  linkedGoalStatement: null,
  linkedSourceLabel: "Pattern",
  status: "not_started",
  note: null,
  surfacedAt: "2026-07-20T11:00:00.000Z",
  updatedAt: "2026-07-20T11:00:00.000Z",
};

describe("production adapter canonicalSourceType tagging", () => {
  it("tags Map list and detail UMC forms as UserMapConclusion", () => {
    const api = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const listId = "conclusion-umc-tag-1";
    const listObject = api.getObject(listId) ?? api.getObject("umc-tag-1");
    expect(listObject?.canonicalSourceType).toBe("UserMapConclusion");

    const detailObject =
      api.getObject(api.mapSelectedId!) ?? api.getObject(listId);
    expect(detailObject?.canonicalSourceType).toBe("UserMapConclusion");
    expect(detailObject?.inspectorObjectType).toBe("usermap_conclusion");
  });

  it("tags live contradiction rail as ContradictionNode", () => {
    const api = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const railId = mapContradictionObjectId("cn-tag-1");
    const object = api.getObject(railId);
    expect(object?.inspectorObjectType).toBe("contradiction_node");
    expect(object?.canonicalSourceType).toBe("ContradictionNode");
  });

  it("tags live model-movement projection as ModelUpdate", () => {
    const api = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const movement = api.getObject("movement-mu-tag-1");
    expect(movement?.inspectorObjectType).toBe("model_update");
    expect(movement?.canonicalSourceType).toBe("ModelUpdate");
    expect(canServeAsCanonicalCurrentTruth("ModelUpdate")).toBe(false);
  });

  it("tags SurfacedAction as SurfacedAction and not Decision", () => {
    const api = buildDecisionsProductionDataApi([LIVE_ACTION]);
    const object = api.getObject(LIVE_ACTION.id);
    expect(object?.type).toBe("decision");
    expect(object?.canonicalSourceType).toBe("SurfacedAction");
    expect(object?.canonicalSourceType).not.toBe("Decision");
    expect(canServeAsCanonicalCurrentTruth("SurfacedAction")).toBe(false);
  });

  it("does not falsely tag ambiguous mind-context / goal / receipt projections", () => {
    const api = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const contextObjects = (api.mapCategories ?? [])
      .filter((category) => category.id === "context")
      .flatMap((category) => category.ids)
      .map((id) => api.getObject(id))
      .filter(Boolean);

    for (const object of contextObjects) {
      expect(object?.canonicalSourceType).toBeUndefined();
    }

    const today = buildTodayProductionDataApi({
      snapshot: {
        surfacingCards: [],
        intelligenceUpdates: [],
        userMapConclusions: [],
        watchForItems: [],
        investigations: [],
        actions: [],
        timelineMovements: [],
      } satisfies TodayReentrySnapshot,
      isLoading: false,
      briefingDate: "Tuesday",
    });
    // Empty live Today has no false Decision/Reference tags.
    expect(today.getObject("ctx-mixed-1")?.canonicalSourceType).toBeUndefined();
  });

  it("tags canonical composition report as CanonicalModelMovementReport", () => {
    const userId = "user_tag_report";
    const fixtureIdMap = buildExactFixtureIdMap(userId);
    const reportId = fixtureIdMap["rep-weekly"]!;
    const composition = buildExactRoundTripCompositionPayload({
      userId,
      fixtureIdMap,
      reportId,
      includeWorkbench: false,
    });
    const report = reportRecordToOrvekObject({
      id: reportId,
      userId,
      reportType: "Weekly Report",
      title: "Weekly Model Movement report",
      status: "Ready",
      meta: "Ready",
      period: "This week",
      sections: [{ id: "sec-summary", heading: "Summary", body: "body" }],
      relatedMovementIds: composition.movements.map((m) => m.id),
      relatedReceiptIds: composition.resurfacedObjectIds,
      generatedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(report.reportProvenance).toBe("reference_sample");
    expect(report.canonicalSourceType).toBe("CanonicalModelMovementReport");
  });
});
