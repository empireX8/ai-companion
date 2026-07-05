import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import type { WatchForItem } from "../watch-for";
import {
  areExperimentTextsNearIdentical,
  findDuplicateExperimentRowIds,
  hasProductionDisplayContractLeak,
  isExperimentPresentationReady,
  isExperimentRowPresentationReady,
  isKnownFieldworkBridgeStatus,
  normalizeExperimentOrvekObject,
  normalizeExperimentProductionDataApi,
  normalizeExperimentSummary,
  referenceTagsForFieldworkStatus,
  resolveExperimentOpenSelectionId,
  shouldMergeExperimentProductionApi,
} from "../../lib/orvek-v0/production/experiment-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

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

const READY_MAP_INPUT = {
  items: [
    {
      id: "c-1",
      title: "Scope reopening under uncertainty",
      summary: "The most active loop; directly raises decision pressure.",
      area: "operating_logic" as const,
      status: "disputed" as const,
      confidenceLevel: "medium" as const,
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
    area: "operating_logic" as const,
    status: "disputed" as const,
    confidenceLevel: "medium" as const,
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
      hasEvidence: true as const,
    },
  ],
  openQuestionsCount: 1,
  mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
  movementPreview: { isLoading: false, items: [] },
  openQuestionsPreview: { isLoading: false, items: [] },
};

const READY_TIMELINE_INPUT = {
  timelineEntries: [
    {
      id: "journal-1",
      occurredAt: "2026-06-24T09:00:00.000Z",
      chip: "Journal",
      title: "Scope note",
      body: "Captured scope uncertainty in journal.",
      href: "/library/journal-journal-1",
      kind: "journal" as const,
      lane: "receipts_activity" as const,
      sourceLabel: "Journal",
    },
  ],
  modelLayers: [],
  semanticFilter: "all" as const,
  searchQuery: "",
  isLoadingActivity: false,
  isLoadingModelLayers: false,
  isLoadingSemantic: false,
  activityError: null,
  modelLayerError: null,
  selectedObjectId: null,
  now: new Date("2026-06-24T12:00:00.000Z"),
};

describe("experiment presentation normalization", () => {
  it("caps long reasons without leaving raw overflow", () => {
    const normalized = normalizeExperimentSummary("word ".repeat(60));

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("removes duplicate purpose when it matches summary", () => {
    const normalized = normalizeExperimentOrvekObject({
      id: "fw-1",
      type: "fieldwork",
      title: "Notice scope pressure",
      summary: "Recent pattern signal suggests visibility triggers overbuilding.",
      purpose: "Recent pattern signal suggests visibility triggers overbuilding.",
      tags: referenceTagsForFieldworkStatus("assigned", "Assigned"),
    });

    expect(normalized.summary).toBe(
      "Recent pattern signal suggests visibility triggers overbuilding.",
    );
    expect(normalized.purpose).toBeUndefined();
    expect(areExperimentTextsNearIdentical("A", "a")).toBe(true);
  });

  it("registers linked object aliases during production normalization", () => {
    const rawApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const normalized = normalizeExperimentProductionDataApi(rawApi);

    expect(normalized.displayContract).toBeUndefined();
    expect(normalized.explore).toBeUndefined();
    expect(normalized.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
    expect(normalized.getObject("fw-active")?.relatedIds).toEqual(["pc-fw-2"]);
  });

  it("dedupes duplicate fieldwork rows during normalization", () => {
    const rawApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    rawApi.exploreFieldworkIds = [...(rawApi.exploreFieldworkIds ?? []), "fw-active"];

    expect(findDuplicateExperimentRowIds(rawApi)).toContain("fw-active");

    const normalized = normalizeExperimentProductionDataApi(rawApi);

    expect(normalized.exploreFieldworkIds?.filter((id) => id === "fw-active")).toHaveLength(1);
    expect(findDuplicateExperimentRowIds(normalized)).toEqual([]);
  });
});

describe("experiment presentation readiness gate", () => {
  it("passes presentation-ready normalized Fieldwork data", () => {
    const rawApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const normalized = normalizeExperimentProductionDataApi(rawApi);

    expect(shouldMergeExperimentProductionApi(rawApi)).toBe(true);
    expect(isExperimentPresentationReady(normalized)).toBe(true);
    expect(normalized.getObject("fw-active")?.tags).toEqual(
      referenceTagsForFieldworkStatus("active", "Active"),
    );
  });

  it("rejects raw production Fieldwork data with displayContract leak", () => {
    const rawApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);

    expect(hasProductionDisplayContractLeak(rawApi)).toBe(true);
    expect(isExperimentPresentationReady(rawApi)).toBe(false);
    expect(shouldMergeExperimentProductionApi(rawApi)).toBe(true);
  });

  it("rejects rows with missing prompt or reason", () => {
    const object: OrvekObject = {
      id: "fw-broken",
      type: "fieldwork",
      title: "   ",
      summary: "Recent pattern signal suggests visibility triggers overbuilding.",
      tags: referenceTagsForFieldworkStatus("assigned", "Assigned"),
    };

    expect(isExperimentRowPresentationReady(object)).toBe(false);
  });

  it("rejects unsafe status mapping", () => {
    expect(isKnownFieldworkBridgeStatus("assigned")).toBe(true);
    expect(isKnownFieldworkBridgeStatus("active")).toBe(true);
    expect(isKnownFieldworkBridgeStatus("completed")).toBe(false);
  });

  it("rejects partial rich fields that are present but not meaningful", () => {
    const object: OrvekObject = {
      id: "fw-broken",
      type: "fieldwork",
      title: "Notice scope pressure",
      summary: "Recent pattern signal suggests visibility triggers overbuilding.",
      hypotheses: [""],
      tags: referenceTagsForFieldworkStatus("assigned", "Assigned"),
    };

    expect(isExperimentRowPresentationReady(object)).toBe(false);
  });

  it("rejects linked objects that cannot resolve safely", () => {
    const brokenObject: OrvekObject = {
      id: "fw-missing-link",
      type: "fieldwork",
      title: "Notice scope pressure",
      summary: "Recent pattern signal suggests visibility triggers overbuilding.",
      relatedIds: ["pc-missing"],
      tags: referenceTagsForFieldworkStatus("assigned", "Assigned"),
    };
    const rawApi = {
      ...buildExperimentProductionDataApi([]),
      exploreFieldworkIds: ["fw-missing-link"],
      getObject: (id: string | null | undefined) => (id === "fw-missing-link" ? brokenObject : undefined),
      getObjects: (ids: string[] | undefined) =>
        (ids ?? [])
          .map((id) => (id === "fw-missing-link" ? brokenObject : undefined))
          .filter((object): object is OrvekObject => Boolean(object)),
    };

    expect(shouldMergeExperimentProductionApi(rawApi)).toBe(false);
  });

  it("keeps hybrid workbench on reference Explore when no experiment overlay is passed", () => {
    const baseApi = createMockOrvekDataApi();
    const readyExperimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
    expect(shouldMergeExperimentProductionApi(readyExperimentApi)).toBe(true);
  });

  it("wires bounded Experiment watch-for fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchWatchForItems");
    expect(hookSource).toContain("buildExperimentProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("experimentApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/watch-for/);
  });

  it("preserves Today, Map, Timeline, and Decisions parity in hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const mapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const decisionsApi = buildDecisionsProductionDataApi([]);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, mapApi, timelineApi, decisionsApi);

    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
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

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(explorePageSource).not.toContain("V0ExploreView");
    expect(explorePageSource).not.toContain("WatchForItemCard");
  });
});
