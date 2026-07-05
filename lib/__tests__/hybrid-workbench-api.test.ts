import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MapMapDataInput } from "../orvek-adapters/map";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTodayProductionDataApi } from "../../lib/orvek-v0/production/today-api";
import { shouldMergeMapProductionApi } from "../../lib/orvek-v0/production/map-presentation";
import type { TodayReentrySnapshot } from "../today-reentry";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const READY_MAP_INPUT: MapMapDataInput = {
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

  it("does not merge unsafe production Map data into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeMapApi = buildMapProductionDataApi({
      items: [
        {
          id: "c-1",
          title: "Broken row",
          summary: "A".repeat(400),
          area: "operating_logic",
          status: "disputed",
          confidenceLevel: "medium",
          evidenceCount: 3,
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

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, unsafeMapApi);

    expect(hybridApi).toBe(baseApi);
    expect(hybridApi.mapCategories).toEqual([]);
  });

  it("merges presentation-ready production Map data into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);

    expect(shouldMergeMapProductionApi(readyMapApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, readyMapApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.getObject("m-claim-1")).toMatchObject(baseApi.getObject("m-claim-1") ?? {});
  });

  it("falls back to reference Map when production Map fetch fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const failingMapApi = buildMapProductionDataApi({
      ...READY_MAP_INPUT,
      evidence: [],
    });

    expect(shouldMergeMapProductionApi(failingMapApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, failingMapApi);

    expect(hybridApi.mapCategories).toEqual([]);
    expect(hybridApi.getObject("m-claim-1")).toMatchObject(baseApi.getObject("m-claim-1") ?? {});
  });

  it("falls back to reference Map when production Map list fetch fails", () => {
    const baseApi = createMockOrvekDataApi();
    const failedFetchMapApi = buildMapProductionDataApi({
      ...READY_MAP_INPUT,
      items: [],
      detail: null,
      evidence: [],
      loadError: "Could not load your map.",
    });

    expect(failedFetchMapApi.mapHasContent).toBe(false);
    expect(shouldMergeMapProductionApi(failedFetchMapApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, failedFetchMapApi);

    expect(hybridApi.mapCategories).toEqual([]);
    expect(hybridApi.getObject("m-claim-1")).toMatchObject(baseApi.getObject("m-claim-1") ?? {});
  });

  it("wires bounded Map fetch into the root hybrid hook without /your-map navigation", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const handlersSource = readSource(
      "components/orvek-v0/reference/ReferencePageHandlersProvider.tsx",
    );

    expect(hookSource).toContain("fetchYourMapConclusions");
    expect(hookSource).toContain("buildMapProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/your-map/);
    expect(handlersSource).not.toMatch(/map:\s*\{[\s\S]*onOpenItem/);
  });
});
