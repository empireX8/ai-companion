import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  referenceTagsForFieldworkStatus,
  resolveExperimentOpenSelectionId,
  shouldMergeExperimentProductionApi,
} from "../../lib/orvek-v0/production/experiment-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";
import type { WatchForItem } from "../watch-for";
import { WATCH_FOR_ENDPOINT } from "../watch-for";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function watchForItem(
  id: string,
  overrides: Partial<WatchForItem> = {},
): WatchForItem {
  return {
    id,
    prompt: "Notice whether scope pressure rises before the next review.",
    reason: "Recent pattern signal suggests visibility triggers overbuilding.",
    status: "assigned",
    statusLabel: "Assigned",
    linkedObjectType: "pattern_claim",
    linkedObjectId: "pc-fw-1",
    linkedObjectHref: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_WATCH_FOR_ITEMS: WatchForItem[] = [
  watchForItem("fw-active", {
    status: "active",
    statusLabel: "Active",
    linkedObjectId: "pc-fw-2",
  }),
  watchForItem("fw-assigned", {
    status: "assigned",
    statusLabel: "Assigned",
    linkedObjectId: "pc-fw-3",
  }),
];

describe("bounded experiment hybrid fetch bridge", () => {
  it("wires Experiment watch-for production fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const watchForSource = readSource("lib/watch-for.ts");

    expect(hookSource).toContain("fetchWatchForItems");
    expect(hookSource).toContain("buildExperimentProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("experimentApi");
    expect(hookSource).toContain("isLoadingWatchFor");
    expect(watchForSource).toContain(WATCH_FOR_ENDPOINT);
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/watch-for/);
  });

  it("passes experimentApi as the sixth argument to buildHybridWorkbenchDataApi", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toMatch(
      /buildHybridWorkbenchDataApi\(\s*baseApi,\s*todayApi,\s*mapApi,\s*timelineApi,\s*decisionsApi,\s*experimentApi,\s*activeQuestionsApi,\s*investigationsApi,\s*freeExploreChatApi,\s*\{\s*allowCompositionWorkbenchAuthority:\s*allowCompositionAuthority,\s*\},\s*\)/,
    );
  });

  it("can surface ready watch-for production data through the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);

    expect(shouldMergeExperimentProductionApi(experimentApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.getObject("fw-active")?.tags).toEqual(
      referenceTagsForFieldworkStatus("active", "Active"),
    );
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("falls back to reference Fieldwork Bridge when production fetch fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeExperimentApi = buildExperimentProductionDataApi([
      watchForItem("fw-broken", {
        prompt: "   ",
        linkedObjectId: "pc-missing",
      }),
    ]);

    expect(shouldMergeExperimentProductionApi(unsafeExperimentApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeExperimentApi,
    );

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("falls back to reference Fieldwork Bridge when production data is thin or empty", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyExperimentApi = buildExperimentProductionDataApi([]);

    expect(shouldMergeExperimentProductionApi(emptyExperimentApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      emptyExperimentApi,
    );

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("falls back to reference Fieldwork Bridge while production Experiment data is loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingExperimentApi = {
      ...buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS),
      experimentIsLoading: true,
    };

    expect(shouldMergeExperimentProductionApi(loadingExperimentApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      loadingExperimentApi,
    );

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
  });

  it("preserves linked object aliases through the hybrid Experiment overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
    expect(hybridApi.getObject("fw-active")?.relatedIds).toEqual(["pc-fw-2"]);
  });

  it("resolves linked inspector targets when provider lookup can resolve them", () => {
    const objects: Record<string, OrvekObject> = {
      "fw-active": {
        id: "fw-active",
        type: "fieldwork",
        title: "Notice scope pressure",
        inspectorObjectType: "pattern_claim",
        inspectorObjectId: "pc-fw-2",
        relatedIds: ["pc-fw-2"],
      },
      "pc-fw-2": {
        id: "pc-fw-2",
        type: "receipt",
        title: "Linked pattern",
        inspectorObjectType: "pattern_claim",
        inspectorObjectId: "pc-fw-2",
      },
      f2: {
        id: "f2",
        type: "fieldwork",
        title: "Reference fieldwork",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveExperimentOpenSelectionId("fw-active", getObject)).toBe("pc-fw-2");
    expect(resolveExperimentOpenSelectionId("f2", getObject)).toBe("f2");
  });

  it("leaves Investigations, Active Questions, and Explore chat on reference/mock when Experiment merges", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("FieldworkBridge consumes readiness-gated exploreFieldworkIds", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("exploreFieldworkIds");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
    expect(explorePageSource).toContain('onSelect(referenceFieldworkId)');
    expect(explorePageSource).not.toContain("/watch-for");
    expect(explorePageSource).not.toContain("WatchForItemCard");
    expect(explorePageSource).not.toContain("V0ExploreView");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
