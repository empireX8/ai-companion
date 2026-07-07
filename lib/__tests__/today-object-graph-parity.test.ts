import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  assessLiveTodayObjectGraphParity,
  buildParitySafeTodayObjectMap,
  canUseLiveTodayEvidencePointerList,
  canUseLiveTodayHero,
  canUseLiveTodaySeeWhyMoved,
  filterInspectableEvidencePointerIds,
  hasOpenableReportObject,
  hasRecordedBeforeAfterMovement,
  isEvidencePointerInspectable,
  shouldMergeTodayObjectGraph,
} from "../orvek-v0/production/today-object-graph-parity";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
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

const LIVE_RECEIPT_SNAPSHOT: TodayReentrySnapshot = {
  ...EMPTY_SNAPSHOT,
  surfacingCards: [
    {
      kind: "Recent Pattern",
      title: "Evening stress",
      body: "Grounded capture.",
      meta: "recently",
      detailHref: "/patterns/pattern-1",
      receiptHref: "/patterns/pattern-1",
    },
  ],
};

const MOVEMENT_WITHOUT_RECORD_SNAPSHOT: TodayReentrySnapshot = {
  ...EMPTY_SNAPSHOT,
  intelligenceUpdates: [
    {
      id: "iu-1",
      updateTypeLabel: "Conclusion Added",
      affectedObjectType: "pattern_claim",
      affectedObjectTypeLabel: "Related map item",
      affectedObjectId: "pc-1",
      affectedObjectHref: "/patterns/pattern-1",
      userFacingSummary: "Evening stress pattern strengthened.",
      createdAt: "2026-06-20T10:00:00.000Z",
    },
  ],
};

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live Today object graph parity", () => {
  it("blocks See why it moved when the live movement object lacks before/after", () => {
    const api = buildTodayProductionDataApi({
      snapshot: MOVEMENT_WITHOUT_RECORD_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    const movementId = api.today?.hero?.movementId;
    expect(movementId).toBe("iu-1");
    expect(api.today?.hero?.showSeeWhyMoved).toBe(true);
    expect(hasRecordedBeforeAfterMovement(api.getObject(movementId ?? ""))).toBe(false);
    expect(canUseLiveTodaySeeWhyMoved(api, movementId)).toBe(false);
    expect(canUseLiveTodayHero(api)).toBe(false);

    const parity = assessLiveTodayObjectGraphParity(api);
    expect(parity.seeWhyMovedReady).toBe(false);
    expect(parity.heroBlockers).toContain("see_why_without_before_after");
    expect(buildParitySafeTodayObjectMap(api).has("iu-1")).toBe(false);
  });

  it("does not treat evidence count alone as inspectable evidence pointers", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-empty", "receipt-ok"],
      getObject: (id?: string | null) => {
        if (id === "receipt-empty") {
          return {
            id: "receipt-empty",
            type: "receipt" as const,
            title: " ",
            sourceText: " ",
          };
        }
        if (id === "receipt-ok") {
          return {
            id: "receipt-ok",
            type: "receipt" as const,
            title: "Grounded capture.",
            sourceText: "Grounded capture.",
            sourceOrigin: "Pattern",
            date: "recently",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(filterInspectableEvidencePointerIds(api, api.todayResurfacedIds)).toEqual([
      "receipt-ok",
    ]);
    expect(canUseLiveTodayEvidencePointerList(api, api.todayResurfacedIds)).toBe(false);
    expect(isEvidencePointerInspectable(api, "receipt-empty")).toBe(false);
  });

  it("keeps reference movement objects when live hero movement lacks a recorded delta", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: MOVEMENT_WITHOUT_RECORD_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hasRecordedBeforeAfterMovement(hybridApi.getObject("mu-1"))).toBe(true);
    expect(canUseLiveTodaySeeWhyMoved(productionTodayApi, "iu-1")).toBe(false);
  });

  it("merges only parity-safe receipt objects and keeps reference Today presentation props", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_RECEIPT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);
    const receiptIds = productionTodayApi.todayResurfacedIds ?? [];

    expect(shouldMergeTodayObjectGraph(productionTodayApi)).toBe(true);
    expect(hybridApi.today).toBeUndefined();
    expect(hybridApi.todayResurfacedIds).toBeUndefined();
    expect(hybridApi.todayObjectGraphParity?.inspectableEvidencePointerIds.length).toBeGreaterThan(
      0,
    );
    expect(hybridApi.getObjects(["r6", "r5", "r2"]).map((object) => object.id)).toEqual([
      "r6",
      "r5",
      "r2",
    ]);

    for (const id of receiptIds) {
      const liveReceipt = productionTodayApi.getObject(id);
      expect(liveReceipt?.sourceText).toBeTruthy();
      expect(hybridApi.getObject(id)).toMatchObject(liveReceipt ?? {});
    }
  });

  it("does not merge live Today when no parity-safe objects exist", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(shouldMergeTodayObjectGraph(productionTodayApi)).toBe(false);
    expect(buildHybridWorkbenchDataApi(baseApi, productionTodayApi)).toBe(baseApi);
  });

  it("does not register an openable live report without a report object", () => {
    const api = buildTodayProductionDataApi({
      snapshot: LIVE_RECEIPT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(hasOpenableReportObject(api, "rep-weekly")).toBe(false);
    expect(assessLiveTodayObjectGraphParity(api).reportReady).toBe(false);
  });

  it("does not flip Today UI via surface live gating or global production display", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(todayPage).toContain("isProductionDisplay(data)");
    expect(todayPage).not.toContain("isTodayLiveReady");
    expect(todayPage).not.toContain("surfaceReadiness");
    expect(hybridApi).not.toMatch(/displayContract:\s*["']production["']/);
    expect(hybridApi).not.toContain("today: todayApi.today");
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(referenceRoute).not.toContain("buildHybridWorkbenchDataApi");
  });
});
