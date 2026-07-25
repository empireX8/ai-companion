import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_REFERENCE_MODEL_STATUS_CARD,
  formatModelStatusCardCopy,
} from "../canonical-reference-model-status-card";
import {
  buildExactFixtureIdMap,
  buildExactRoundTripCompositionPayload,
} from "../exact-fixture-round-trip-seed";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
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

describe("canonical reference model-status card", () => {
  it("defines the living-status contract matching frozen reference TopBar copy", () => {
    expect(CANONICAL_REFERENCE_MODEL_STATUS_CARD).toEqual({
      movementPlaceCount: 4,
      openQuestionCount: 7,
      openReviewCount: 3,
      title: "Model moved · 4 places",
      meta: "7 questions · 3 reviews open",
      compactLabel: "4 moved",
      destination: { kind: "workbench-page", page: "map" },
    });
    expect(formatModelStatusCardCopy(CANONICAL_REFERENCE_MODEL_STATUS_CARD)).toEqual({
      title: "Model moved · 4 places",
      meta: "7 questions · 3 reviews open",
      compactLabel: "4 moved",
    });
  });

  it("full-reference seed embeds modelStatusCard on workbench", () => {
    const userId = "user_test_model_status";
    const fixtureIdMap = buildExactFixtureIdMap(userId);
    const reportId = fixtureIdMap["rep-weekly"]!;
    const composition = buildExactRoundTripCompositionPayload({
      userId,
      fixtureIdMap,
      reportId,
      includeWorkbench: true,
    });

    expect(composition.workbench?.modelStatusCard).toEqual(
      CANONICAL_REFERENCE_MODEL_STATUS_CARD,
    );
  });

  it("today-api + hybrid surface modelStatusCard for full-reference composition", () => {
    const userId = "user_test_model_status_hybrid";
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
    expect(todayApi.modelStatusCard).toEqual(CANONICAL_REFERENCE_MODEL_STATUS_CARD);

    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayApi,
      {
        ...createMockOrvekDataApi(),
        mapCategories: composition.workbench!.mapCategories,
        mapHasContent: true,
        mapIsLoading: false,
        modelStatusCard: null,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { allowCompositionWorkbenchAuthority: true },
    );

    expect(hybrid.modelStatusCard).toEqual(CANONICAL_REFERENCE_MODEL_STATUS_CARD);
  });

  it("normal accounts without a materialised card keep null (no reference counts)", () => {
    const todayApi = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday",
    });
    expect(todayApi.modelStatusCard).toBeUndefined();

    const hybrid = buildHybridWorkbenchDataApi(
      { ...createMockOrvekDataApi(), modelStatusCard: undefined },
      todayApi,
    );
    expect(hybrid.modelStatusCard).toBeUndefined();
  });

  it("TopBar consumes provider modelStatusCard and does not hardcode reference counts", () => {
    const source = readFileSync(
      join(process.cwd(), "components/orvek-v0/top-bar.tsx"),
      "utf8",
    );
    expect(source).toContain("modelStatusCard");
    expect(source).toContain("formatModelStatusCardCopy");
    expect(source).toContain("orvek-model-status-card");
    expect(source).not.toContain('"Model moved · 4 places"');
    expect(source).not.toContain('"7 questions · 3 reviews open"');
    expect(source).not.toContain('"4 moved"');
    expect(source).toContain('"Model movement"');
    expect(source).toContain('"Open your map"');
  });
});
