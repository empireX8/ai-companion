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

describe("fieldwork bridge alignment", () => {
  it("FieldworkBridge consumes exploreFieldworkIds when readiness-gated production data passes", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("exploreFieldworkIds");
    expect(explorePageSource).toContain("exploreFieldworkSelectedId");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
    expect(explorePageSource).toContain("resolveInspectorSelection");
  });

  it("can surface ready Fieldwork production data through the hybrid provider path", () => {
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

    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.exploreFieldworkSelectedId).toBe("fw-active");
    expect(hybridApi.getObject("fw-active")?.tags).toEqual(
      referenceTagsForFieldworkStatus("active", "Active"),
    );
    expect(hybridApi.displayContract).toBeUndefined();
  });

  it("falls back to reference Fieldwork Bridge when production data fails readiness", () => {
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

  it("falls back to reference Fieldwork Bridge when production fetch returns empty data", () => {
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
    expect(hybridApi.getObject("f2")?.title).toBe("Test architecture visually in v0");
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

  it("opens Inspector through safe selection for linked fieldwork targets", () => {
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

  it("preserves reference Fieldwork Bridge fallback wiring", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain('referenceFieldworkId = "f2"');
    expect(explorePageSource).toContain('referenceLinkedQuestionId = "aq-2"');
    expect(explorePageSource).toContain("Generate v0 architecture prototype and review against feature architecture.");
    expect(explorePageSource).toContain('onSelect(referenceFieldworkId)');
    expect(explorePageSource).toContain('onSelect(referenceLinkedQuestionId)');
  });

  it("leaves Investigations and Active Questions on reference/mock lists", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain('["inv-1", "inv-2", "inv-3"]');
    expect(explorePageSource).toContain('["aq-1", "aq-2", "aq-3", "aq-4"]');
    expect(explorePageSource).toContain("exploreInvestigationIds");
    expect(explorePageSource).toContain("exploreQuestionIds");
  });

  it("keeps Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain("function FreeExplore()");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("exploreFieldworkIds");
    expect(freeExploreBlock).not.toContain("resolveExperimentOpenSelectionId");
  });

  it("does not introduce /watch-for route navigation", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).not.toContain("/watch-for");
    expect(explorePageSource).not.toMatch(/router\.(push|replace)/);
    expect(explorePageSource).not.toContain("WatchForItemCard");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(workbenchSource).not.toContain("V0ExploreView");
  });
});
