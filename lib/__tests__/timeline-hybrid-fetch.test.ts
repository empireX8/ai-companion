import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MapTimelineDataInput } from "../orvek-adapters/timeline";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import {
  REFERENCE_TIMELINE_FILTERS,
  resolveTimelineOpenSelectionId,
  shouldMergeTimelineProductionApi,
} from "../../lib/orvek-v0/production/timeline-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const NOW = new Date("2026-06-24T12:00:00.000Z");

const READY_TIMELINE_INPUT: MapTimelineDataInput = {
  timelineEntries: [
    {
      id: "journal-1",
      occurredAt: "2026-06-24T09:00:00.000Z",
      chip: "Journal",
      title: "Scope note",
      body: "Captured scope uncertainty in journal.",
      href: "/library/journal-journal-1",
      kind: "journal",
      lane: "receipts_activity",
      sourceLabel: "Journal",
    },
  ],
  modelLayers: [
    {
      id: "mu-1",
      updateTypeLabel: "Map update",
      affectedObjectType: "usermap_conclusion",
      affectedObjectTypeLabel: "Map conclusion",
      affectedObjectId: "c-1",
      affectedObjectHref: null,
      userFacingSummary: "Scope reopening under uncertainty.",
      createdAt: "2026-06-24T10:30:00.000Z",
    },
  ],
  semanticFilter: "all",
  searchQuery: "",
  isLoadingActivity: false,
  isLoadingModelLayers: false,
  isLoadingSemantic: false,
  activityError: null,
  modelLayerError: null,
  selectedObjectId: null,
  now: NOW,
};

describe("bounded timeline hybrid fetch bridge", () => {
  it("wires Timeline production fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("buildTimelineProductionDataApi");
    expect(hookSource).toContain("fetchTimelineSemanticEntries");
    expect(hookSource).toContain("buildTimelineRequestUrl");
    expect(hookSource).toContain("buildTimelineModelLayersRequestUrl");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(baseApi, todayApi, mapApi, timelineApi)");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/timeline/);
  });

  it("can surface ready Timeline production data through the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);

    expect(shouldMergeTimelineProductionApi(timelineApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, timelineApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("falls back to reference Timeline when production fetch fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const failedTimelineApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      timelineEntries: [],
      modelLayers: [],
      activityError: "Could not load timeline.",
    });

    expect(shouldMergeTimelineProductionApi(failedTimelineApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, failedTimelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("falls back to reference Timeline while production Timeline data is loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingTimelineApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      isLoadingActivity: true,
    });

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, loadingTimelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
  });

  it("resolves inspectorObjectId aliases for model movement rows", () => {
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);

    expect(timelineApi.getObject("model-mu-1")?.inspectorObjectId).toBe("mu-1");
    expect(timelineApi.getObject("mu-1")?.title).toContain("Map update");
  });

  it("selects inspectorObjectId when provider lookup can resolve it", () => {
    const objects: Record<string, OrvekObject> = {
      "model-mu-1": {
        id: "model-mu-1",
        type: "timeline-event",
        title: "Map update · Map conclusion",
        inspectorObjectType: "model_update",
        inspectorObjectId: "mu-1",
      },
      "mu-1": {
        id: "mu-1",
        type: "timeline-event",
        title: "Map update · Map conclusion",
        inspectorObjectType: "model_update",
        inspectorObjectId: "mu-1",
      },
      t1: {
        id: "t1",
        type: "timeline-event",
        title: "Reference movement",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveTimelineOpenSelectionId("model-mu-1", getObject)).toBe("mu-1");
    expect(resolveTimelineOpenSelectionId("t1", getObject)).toBe("t1");
    expect(resolveTimelineOpenSelectionId("activity-journal-1", getObject)).toBe("activity-journal-1");
  });

  it("TimelinePage prefers inspectorObjectId when available", () => {
    const pageSource = readSource("components/orvek-v0/pages/timeline.tsx");

    expect(pageSource).toContain("row.inspectorObjectId");
    expect(pageSource).toContain("getObject(row.inspectorObjectId)");
    expect(pageSource).not.toContain("V0TimelineView");
    expect(pageSource).not.toContain("TimelineSurface");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(shellSource).not.toContain("V0TimelineView");
    expect(workbenchSource).toContain("<TimelinePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
