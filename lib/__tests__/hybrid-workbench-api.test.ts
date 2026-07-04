import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../../lib/orvek-v0/production/today-api";
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

const LIVE_SNAPSHOT: TodayReentrySnapshot = {
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

describe("hybrid workbench data api", () => {
  it("preserves the reference Today branch while hydrating live evidence pointers", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.mapCategories).toEqual(baseApi.mapCategories);
    expect(hybridApi.timelineGroups).toEqual(baseApi.timelineGroups);
    expect(hybridApi.decisionListGroups).toEqual(baseApi.decisionListGroups);
    expect(hybridApi.todayCopy).toBeUndefined();
    expect(hybridApi.todayResurfacedIds).toBeUndefined();
    expect(hybridApi.getObjects(["r6", "r5", "r2"]).map((object) => object.id)).toEqual([
      "r6",
      "r5",
      "r2",
    ]);
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("d1")).toMatchObject(baseApi.getObject("d1") ?? {});
  });

  it("falls back to the reference baseline when production Today has no surfaced receipts", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(hybridApi).toBe(baseApi);
    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.todayResurfacedIds).toBeUndefined();
    expect(hybridApi.getObjects(["r6", "r5", "r2"]).map((object) => object.id)).toEqual([
      "r6",
      "r5",
      "r2",
    ]);
    expect(hybridApi.getObject("d1")).toMatchObject(baseApi.getObject("d1") ?? {});
  });
});
