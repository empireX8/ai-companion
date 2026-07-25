import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CANONICAL_REFERENCE_MAP_HEADER } from "../canonical-reference-map-header";
import {
  buildExactFixtureIdMap,
  buildExactRoundTripCompositionPayload,
} from "../exact-fixture-round-trip-seed";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import type { TodayReentrySnapshot } from "../today-reentry";
import type { MapMapDataInput } from "../orvek-adapters/map";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

describe("canonical reference Map global model summary", () => {
  it("defines the receipt/open-question contract from import evaluation (not densograph row counts)", () => {
    expect(CANONICAL_REFERENCE_MAP_HEADER).toEqual({
      confidenceLabel: "mixed / evolving",
      receiptsLabel: "243",
      openQuestionsLabel: "7",
    });
  });

  it("full-reference seed workbench embeds the receipt-count contract (243 / 7)", () => {
    const userId = "user_test_map_header";
    const fixtureIdMap = buildExactFixtureIdMap(userId);
    const reportId = fixtureIdMap["rep-weekly"]!;
    const composition = buildExactRoundTripCompositionPayload({
      userId,
      fixtureIdMap,
      reportId,
      includeWorkbench: true,
    });

    expect(composition.workbench?.mapHeader).toEqual(CANONICAL_REFERENCE_MAP_HEADER);
    expect(composition.workbench?.mapHeader?.receiptsLabel).toBe("243");
    expect(composition.workbench?.mapHeader?.openQuestionsLabel).toBe("7");

    // Densograph map rails are a different measure (~30 slots / 4 AQs) and must not
    // be treated as the global summary source.
    const mappedSlots =
      composition.workbench?.mapCategories.reduce((n, c) => n + c.ids.length, 0) ?? 0;
    const questionSlots =
      composition.workbench?.mapCategories.find((c) => c.id === "questions")?.ids
        .length ?? 0;
    expect(mappedSlots).toBeGreaterThan(0);
    expect(mappedSlots).not.toBe(243);
    expect(questionSlots).toBe(4);
    expect(questionSlots).not.toBe(7);
  });

  it("today-api + hybrid prefer composition mapHeader over live densograph map-api counts", () => {
    const userId = "user_test_map_header_hybrid";
    const fixtureIdMap = buildExactFixtureIdMap(userId);
    const reportId = fixtureIdMap["rep-weekly"]!;
    const composition = buildExactRoundTripCompositionPayload({
      userId,
      fixtureIdMap,
      reportId,
      includeWorkbench: true,
    });
    const report = {
      id: reportId,
      userId,
      reportType: "Weekly Report",
      title: "Weekly Model Movement report",
      status: "Ready",
      meta: "Ready · 3 loops, 2 decisions, 1 context update",
      period: "This week",
      sections: [{ id: "sec-summary", heading: "Summary", body: "body" }],
      relatedMovementIds: composition.movements.map((m) => m.id),
      relatedReceiptIds: composition.resurfacedObjectIds,
      generatedAt: "2026-07-14T12:00:00.000Z",
    };

    const todayApi = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "ignored",
      canonicalWorkbench: { composition, report },
    });

    expect(todayApi.mapHeader).toEqual(CANONICAL_REFERENCE_MAP_HEADER);

    const densographMapApi = {
      ...createMockOrvekDataApi(),
      mapHeader: {
        confidenceLabel: "mixed / evolving",
        receiptsLabel: "30",
        openQuestionsLabel: "4",
      },
      mapCategories: composition.workbench!.mapCategories,
      mapHasContent: true,
      mapIsLoading: false,
    };

    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayApi,
      densographMapApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { allowCompositionWorkbenchAuthority: true },
    );

    expect(hybrid.mapHeader).toEqual(CANONICAL_REFERENCE_MAP_HEADER);
    expect(hybrid.mapHeader?.receiptsLabel).toBe("243");
    expect(hybrid.mapHeader?.openQuestionsLabel).toBe("7");
  });

  it("normal accounts keep truthful live map-api receipt / open-question counts", () => {
    const input: MapMapDataInput = {
      items: [
        {
          id: "c-1",
          title: "Scope reopening under uncertainty",
          summary: "The most active loop.",
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
      openQuestionsCount: 3,
      mindContext: {
        isLoading: false,
        items: [],
        summaryCounts: { memories: 0, patterns: 0 },
      },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    };

    const api = buildMapProductionDataApi(input);
    expect(api.mapHeader?.receiptsLabel).not.toBe("243");
    expect(api.mapHeader?.openQuestionsLabel).toBe("3");
    expect(api.mapHeader).toEqual({
      confidenceLabel: "mixed / evolving",
      receiptsLabel: "6",
      openQuestionsLabel: "3",
    });
  });

  it("canonical Map page does not hardcode 243/7 and consumes provider mapHeader", () => {
    const source = readFileSync(
      join(process.cwd(), "components/orvek-v0-canonical/pages/map.tsx"),
      "utf8",
    );
    expect(source).toContain("MapPageHeaderStats");
    expect(source).toContain("mapHeader");
    expect(source).toContain("useOrvekData");
    expect(source).not.toMatch(/["'`]243["'`]/);
    expect(source).not.toMatch(/\b243\b/);
    expect(source).not.toContain('"7"');
    expect(source).not.toContain("mapped");
    expect(source).not.toMatch(/mapCategories\.reduce/);
  });
});
