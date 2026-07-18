import { describe, expect, it } from "vitest";

import {
  buildV0TodayPropsFromCanonicalComposition,
  collectCompositionObjects,
} from "../canonical-today-composition";
import { CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION } from "../canonical-today-composition-contract";
import {
  buildExactFixtureIdMap,
  buildExactRoundTripCompositionPayload,
} from "../exact-fixture-round-trip-seed";
import { buildExactFixtureManifest } from "../exact-fixture-round-trip-manifest";
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

describe("canonical today composition contract", () => {
  it("emits exact fixture Today fields from composition without pickTodayHeroItem", () => {
    const manifest = buildExactFixtureManifest();
    const userId = "user_test_exact_rt";
    const fixtureIdMap = buildExactFixtureIdMap(userId);
    const reportId = fixtureIdMap["rep-weekly"]!;
    const composition = buildExactRoundTripCompositionPayload({
      userId,
      fixtureIdMap,
      reportId,
    });

    expect(composition.contractVersion).toBe(CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION);
    expect(composition.briefingTitle).toBe(manifest.today.briefingTitle);
    expect(composition.briefingMeta).toBe(manifest.today.briefingMeta);
    expect(composition.leadTitle).toBe(
      manifest.objects.find((o) => o.id === "d1")?.title,
    );
    expect(composition.movements.map((m) => m.previous)).toEqual(
      manifest.today.movements.map((m) => m.previous),
    );
    expect(composition.movements.map((m) => m.explanation)).toEqual(
      manifest.today.movements.map((m) => m.evidence),
    );

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

    const today = buildV0TodayPropsFromCanonicalComposition(composition, report);
    expect(today.hero?.title).toBe(composition.leadTitle);
    expect(today.hero?.whatChanged).toBe("Outcome window closed");
    expect(today.movements[0]?.evidence).toBe(
      "6 receipts tied pressure to repeated scope reopening.",
    );
    expect(today.report?.title).toBe("Weekly Model Movement report");
    expect(today.report?.meta).toBe(
      "Ready · 3 loops, 2 decisions, 1 context update",
    );
    expect(today.nowRows.map((r) => r.title)).toEqual(
      manifest.today.nowRows.map((r) => r.title),
    );

    const api = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "ignored",
      canonicalWorkbench: { composition, report },
    });

    expect(api.todayCopy?.briefingLine).toBe("Tuesday · since your last visit");
    expect(api.today?.report?.title).toBe("Weekly Model Movement report");
    expect(api.todayResurfacedIds).toHaveLength(3);
    expect(api.getObject(reportId)?.type).toBe("report");
    expect(api.getObject(composition.leadObjectId)?.type).toBe("decision");

    const objects = collectCompositionObjects(composition, report);
    expect(objects[reportId]?.title).toBe("Weekly Model Movement report");
  });
});
