import { describe, expect, it } from "vitest";

import type { MapMapDataInput } from "../orvek-adapters/map";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import {
  areMapTextsNearIdentical,
  isMapObjectPresentationReady,
  isMapPresentationReady,
  normalizeMapOrvekObject,
  normalizeMapSummary,
  resolveMapMovementPair,
  shouldMergeMapProductionApi,
} from "../../lib/orvek-v0/production/map-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

const READY_INPUT: MapMapDataInput = {
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
  detail: {
    id: "c-1",
    title: "Scope reopening under uncertainty",
    summary: "The most active loop; directly raises decision pressure.",
    area: "operating_logic",
    status: "disputed",
    confidenceLevel: "medium",
    evidenceCount: 6,
    updatedAt: "2026-06-24T10:00:00.000Z",
    sourceDiversity: 2,
    timeSpreadDays: 14,
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  isDetailLoading: false,
  evidence: [
    {
      sourceTypeLabel: "Journal",
      evidenceSummaryLabel: "Scope reopened twice this week",
      sourceObjectHref: "/library/journal-1",
      createdAt: "2026-06-24T10:00:00.000Z",
      hasEvidence: true,
    },
  ],
  openQuestionsCount: 1,
  mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
  movementPreview: { isLoading: false, items: [] },
  openQuestionsPreview: { isLoading: false, items: [] },
};

describe("map presentation normalization", () => {
  it("caps long summaries without leaving raw overflow", () => {
    const longSummary = "A".repeat(400);
    const normalized = normalizeMapSummary(longSummary);

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("removes duplicate recommendation when it matches summary", () => {
    const normalized = normalizeMapOrvekObject({
      id: "conclusion-c-1",
      type: "map-object",
      title: "Scope reopening under uncertainty",
      summary: "The most active loop; directly raises decision pressure.",
      recommendation: "The most active loop; directly raises decision pressure.",
    });

    expect(normalized.summary).toBe("The most active loop; directly raises decision pressure.");
    expect(normalized.recommendation).toBeUndefined();
  });

  it("suppresses identical before and after movement fields", () => {
    expect(
      resolveMapMovementPair({
        before: "Same understanding",
        after: "Same understanding",
      }),
    ).toEqual({});

    expect(
      resolveMapMovementPair({
        before: "Previously held understanding",
        after: "Current understanding",
      }),
    ).toEqual({});
  });

  it("filters linked-path noise from supporting bullets", () => {
    const normalized = normalizeMapOrvekObject({
      id: "goal-1",
      type: "model-goal",
      title: "Build Orvek",
      summary: "Make Orvek durable.",
      supporting: ["4 linked receipts", "Linked path: /your-map?selected=goal-1"],
    });

    expect(normalized.supporting).toEqual(["4 linked receipts"]);
  });
});

describe("map presentation readiness gate", () => {
  it("passes presentation-ready production Map data", () => {
    const api = buildMapProductionDataApi(READY_INPUT);

    expect(isMapPresentationReady(api)).toBe(true);
    expect(shouldMergeMapProductionApi(api)).toBe(true);
  });

  it("rejects duplicate before and after movement on detail objects", () => {
    const api = buildMapProductionDataApi({
      ...READY_INPUT,
      items: [
        {
          ...READY_INPUT.items[0],
          status: "superseded",
          summary: "Same text in both slots",
        },
      ],
      detail: {
        ...READY_INPUT.detail!,
        status: "superseded",
        summary: "Same text in both slots",
      },
      selectedId: "c-1",
      evidence: [],
    });

    const detail = api.getObject("conclusion-c-1");

    expect(detail?.before).toBeUndefined();
    expect(detail?.after).toBeUndefined();
  });

  it("rejects detail objects that require supporting evidence but have none", () => {
    const api = buildMapProductionDataApi({
      ...READY_INPUT,
      evidence: [],
    });

    expect(isMapPresentationReady(api)).toBe(false);
  });

  it("rejects raw long text even after partial normalization attempt", () => {
    const object: OrvekObject = {
      id: "conclusion-c-1",
      type: "map-object",
      title: "Broken import row",
      summary: `${"conversation dump ".repeat(40)}`,
      evidenceCount: 2,
      supporting: ["one receipt"],
      inspectorObjectType: "usermap_conclusion",
    };

    expect(isMapObjectPresentationReady(object)).toBe(false);
    expect(areMapTextsNearIdentical("A", "a")).toBe(true);
  });

  it("keeps hybrid workbench on reference Map when production Map fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeMapApi = buildMapProductionDataApi({
      ...READY_INPUT,
      evidence: [],
    });

    expect(shouldMergeMapProductionApi(unsafeMapApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, unsafeMapApi);

    expect(hybridApi).toBe(baseApi);
    expect(hybridApi.mapCategories).toEqual([]);
    expect(hybridApi.getObject("m-claim-1")).toMatchObject(baseApi.getObject("m-claim-1") ?? {});
  });

  it("allows hybrid Map merge only when presentation readiness passes", () => {
    const baseApi = createMockOrvekDataApi();
    const readyMapApi = buildMapProductionDataApi(READY_INPUT);

    expect(shouldMergeMapProductionApi(readyMapApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, readyMapApi);

    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.getObject("m-claim-1")).toMatchObject(baseApi.getObject("m-claim-1") ?? {});
  });
});
