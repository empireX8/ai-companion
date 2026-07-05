import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MapTimelineDataInput } from "../orvek-adapters/timeline";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  buildTimelineProductionDataApi,
  buildNormalizedTimelineProductionDataApi,
} from "../../lib/orvek-v0/production/timeline-api";
import {
  areTimelineTextsNearIdentical,
  findDuplicateTimelineMovementRowIds,
  isTimelinePresentationReady,
  isTimelineRowPresentationReady,
  normalizeTimelineOrvekObject,
  normalizeTimelineProductionDataApi,
  normalizeTimelineSummary,
  resolveTimelineMovementPair,
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

describe("timeline presentation normalization", () => {
  it("caps long summaries without leaving raw overflow", () => {
    const normalized = normalizeTimelineSummary("word ".repeat(60));

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("suppresses identical before and after movement fields", () => {
    expect(
      resolveTimelineMovementPair({
        before: "Same understanding",
        after: "Same understanding",
      }),
    ).toEqual({});

    expect(areTimelineTextsNearIdentical("A", "a")).toBe(true);
  });

  it("clears asymmetric before/after pairs on timeline objects", () => {
    const normalized = normalizeTimelineOrvekObject({
      id: "model-mu-1",
      type: "timeline-event",
      title: "Map update · Map conclusion",
      summary: "Scope reopening under uncertainty.",
      eventType: "Map update",
      date: "24 Jun · 10:30",
      after: "Scope reopening under uncertainty.",
    });

    expect(normalized.before).toBeUndefined();
    expect(normalized.after).toBeUndefined();
    expect(normalized.eventType).toBe("Model Update");
  });

  it("dedupes duplicate model movement rows during normalization", () => {
    const rawApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      timelineEntries: [
        ...READY_TIMELINE_INPUT.timelineEntries,
        {
          id: "mu-1",
          occurredAt: "2026-06-24T10:30:00.000Z",
          chip: "Model Update",
          title: "Duplicate movement row",
          body: "Scope reopening under uncertainty.",
          href: null,
          kind: "model_update",
          lane: "model_movement",
          selectableObjectType: "model_update",
          selectableObjectId: "mu-1",
        },
      ],
    });

    expect(findDuplicateTimelineMovementRowIds(rawApi)).toContain("activity-mu-1");

    const normalized = normalizeTimelineProductionDataApi(rawApi);
    const rowIds = normalized.timelineGroups.flatMap((group) => group.ids);

    expect(rowIds).toContain("model-mu-1");
    expect(rowIds).not.toContain("activity-mu-1");
    expect(findDuplicateTimelineMovementRowIds(normalized)).toEqual([]);
  });
});

describe("timeline presentation readiness gate", () => {
  it("passes presentation-ready normalized Timeline data", () => {
    const normalized = buildNormalizedTimelineProductionDataApi(READY_TIMELINE_INPUT);

    expect(shouldMergeTimelineProductionApi(buildTimelineProductionDataApi(READY_TIMELINE_INPUT))).toBe(
      true,
    );
    expect(isTimelinePresentationReady(normalized)).toBe(true);
  });

  it("rejects raw production Timeline data with reference filter drift", () => {
    const rawApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);

    expect(isTimelinePresentationReady(rawApi)).toBe(false);
    expect(shouldMergeTimelineProductionApi(rawApi)).toBe(true);
  });

  it("rejects rows with missing date labels", () => {
    const object: OrvekObject = {
      id: "activity-journal-1",
      type: "timeline-event",
      title: "Scope note",
      summary: "Captured scope uncertainty in journal.",
      eventType: "Journal",
      tags: ["Journal"],
    };

    expect(isTimelineRowPresentationReady(object)).toBe(false);
  });

  it("rejects raw or overly long journal bodies", () => {
    const object: OrvekObject = {
      id: "activity-journal-1",
      type: "timeline-event",
      title: "Scope note",
      summary: `${"journal dump ".repeat(40)}`,
      eventType: "Journal",
      date: "24 Jun · 09:00",
      tags: ["Journal"],
    };

    expect(isTimelineRowPresentationReady(object)).toBe(false);
  });

  it("rejects unmapped event types", () => {
    const object: OrvekObject = {
      id: "activity-unknown-1",
      type: "timeline-event",
      title: "Mystery row",
      summary: "Unknown stream item.",
      eventType: "Mystery Widget",
      date: "24 Jun · 09:00",
      tags: ["Mystery Widget"],
    };

    expect(isTimelineRowPresentationReady(object)).toBe(false);
  });

  it("rejects duplicate movement rows before normalization", () => {
    const rawApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      timelineEntries: [
        ...READY_TIMELINE_INPUT.timelineEntries,
        {
          id: "mu-1",
          occurredAt: "2026-06-24T10:30:00.000Z",
          chip: "Model Update",
          title: "Duplicate movement row",
          body: "Scope reopening under uncertainty.",
          href: null,
          kind: "model_update",
          lane: "model_movement",
          selectableObjectType: "model_update",
          selectableObjectId: "mu-1",
        },
      ],
    });

    expect(isTimelinePresentationReady(normalizeTimelineProductionDataApi(rawApi))).toBe(true);
    expect(
      isTimelinePresentationReady({
        ...rawApi,
        timelineFilters: [...rawApi.timelineFilters],
      }),
    ).toBe(false);
  });

  it("keeps hybrid workbench on reference Timeline when timeline overlay is not passed", () => {
    const baseApi = createMockOrvekDataApi();
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);

    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("does not merge Timeline overlay when passed as mapApi by mistake", () => {
    const baseApi = createMockOrvekDataApi();
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, timelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("merges ready Timeline overlay through the hybrid workbench fourth argument", () => {
    const baseApi = createMockOrvekDataApi();
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, timelineApi);

    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
  });

  it("wires bounded Timeline fetch through the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("buildTimelineProductionDataApi");
    expect(hookSource).toContain("fetchTimelineSemanticEntries");
    expect(hookSource).toContain("buildTimelineRequestUrl");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(baseApi, todayApi, mapApi, timelineApi)");
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
