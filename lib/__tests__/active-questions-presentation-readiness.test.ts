import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import type { ActiveQuestionItem } from "../active-questions";
import type { WatchForItem } from "../watch-for";
import {
  areActiveQuestionsTextsNearIdentical,
  findDuplicateActiveQuestionRowIds,
  hasProductionDisplayContractLeak,
  isActiveQuestionsPresentationReady,
  isActiveQuestionsRowPresentationReady,
  isKnownActiveQuestionStatus,
  mapActiveQuestionStatusToReferenceDisplay,
  normalizeActiveQuestionsOrvekObject,
  normalizeActiveQuestionsProductionDataApi,
  normalizeActiveQuestionsSummary,
  referenceTagsForActiveQuestionStatus,
  resolveActiveQuestionsOpenSelectionId,
  shouldMergeActiveQuestionsProductionApi,
} from "../../lib/orvek-v0/production/active-questions-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function activeQuestionItem(
  id: string,
  overrides: Partial<ActiveQuestionItem> = {},
): ActiveQuestionItem {
  return {
    id,
    title: "Does public visibility trigger overbuilding?",
    organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
    status: "open",
    statusLabel: "Open",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_ACTIVE_QUESTIONS: ActiveQuestionItem[] = [
  activeQuestionItem("aq-live-1", {
    status: "gathering_evidence",
    statusLabel: "Gathering evidence",
  }),
  activeQuestionItem("aq-live-2", {
    title: "Does visual prototyping reduce architecture uncertainty?",
    organizingQuestion: "Whether a v0 prototype meaningfully lowers uncertainty before design.",
    status: "testing",
    statusLabel: "Testing",
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

const READY_WATCH_FOR_ITEMS: WatchForItem[] = [
  {
    id: "fw-active",
    prompt: "Notice whether scope pressure rises before the next review.",
    reason: "Recent pattern signal suggests visibility triggers overbuilding.",
    status: "active",
    statusLabel: "Active",
    linkedObjectType: "pattern_claim",
    linkedObjectId: "pc-fw-2",
    linkedObjectHref: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

describe("active questions presentation normalization", () => {
  it("caps long organizing questions without leaving raw overflow", () => {
    const normalized = normalizeActiveQuestionsSummary("word ".repeat(60));

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("removes duplicate whyItMatters when it matches summary", () => {
    const normalized = normalizeActiveQuestionsOrvekObject({
      id: "aq-1",
      type: "active-question",
      title: "Does public visibility trigger overbuilding?",
      summary: "Testing whether anticipated visibility drives scope reopening.",
      whyItMatters: "Testing whether anticipated visibility drives scope reopening.",
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    });

    expect(normalized.summary).toBe(
      "Testing whether anticipated visibility drives scope reopening.",
    );
    expect(normalized.whyItMatters).toBe(
      "Testing whether anticipated visibility drives scope reopening.",
    );
    expect(areActiveQuestionsTextsNearIdentical("A", "a")).toBe(true);
  });

  it("registers linked object aliases during production normalization", () => {
    const rawApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS, [
      { linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" },
    ]);
    const normalized = normalizeActiveQuestionsProductionDataApi(rawApi);

    expect(normalized.displayContract).toBeUndefined();
    expect(normalized.explore).toBeUndefined();
    expect(normalized.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(normalized.getObject("aq-live-1")?.whyItMatters).toContain("visibility");
  });

  it("dedupes duplicate active-question rows during normalization", () => {
    const rawApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    rawApi.exploreQuestionIds = [...(rawApi.exploreQuestionIds ?? []), "aq-live-1"];

    expect(findDuplicateActiveQuestionRowIds(rawApi)).toContain("aq-live-1");

    const normalized = normalizeActiveQuestionsProductionDataApi(rawApi);

    expect(normalized.exploreQuestionIds?.filter((id) => id === "aq-live-1")).toHaveLength(1);
    expect(findDuplicateActiveQuestionRowIds(normalized)).toEqual([]);
  });
});

describe("active questions presentation readiness gate", () => {
  it("passes presentation-ready normalized Active Questions data", () => {
    const rawApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const normalized = normalizeActiveQuestionsProductionDataApi(rawApi);

    expect(shouldMergeActiveQuestionsProductionApi(rawApi)).toBe(true);
    expect(isActiveQuestionsPresentationReady(normalized)).toBe(true);
    expect(normalized.getObject("aq-live-1")?.tags).toEqual(
      referenceTagsForActiveQuestionStatus("gathering_evidence", "Gathering evidence"),
    );
    expect(mapActiveQuestionStatusToReferenceDisplay("gathering_evidence")).toBe("active");
  });

  it("rejects raw production Active Questions data with displayContract leak", () => {
    const rawApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    expect(hasProductionDisplayContractLeak(rawApi)).toBe(true);
    expect(isActiveQuestionsPresentationReady(rawApi)).toBe(false);
    expect(shouldMergeActiveQuestionsProductionApi(rawApi)).toBe(true);
  });

  it("rejects rows with missing title or organizing question", () => {
    const object: OrvekObject = {
      id: "aq-broken",
      type: "active-question",
      title: "   ",
      summary: "Testing whether anticipated visibility drives scope reopening.",
      whyItMatters: "Testing whether anticipated visibility drives scope reopening.",
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    };

    expect(isActiveQuestionsRowPresentationReady(object)).toBe(false);
  });

  it("rejects raw or thin organizingQuestion text", () => {
    const thinObject: OrvekObject = {
      id: "aq-thin",
      type: "active-question",
      title: "Does public visibility trigger overbuilding?",
      summary: "   ",
      whyItMatters: "   ",
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    };

    expect(isActiveQuestionsRowPresentationReady(thinObject)).toBe(false);

    const rawObject: OrvekObject = {
      id: "aq-raw",
      type: "active-question",
      title: "Does public visibility trigger overbuilding?",
      summary: "Traceback (most recent call last): overflow",
      whyItMatters: "Traceback (most recent call last): overflow",
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    };

    expect(isActiveQuestionsRowPresentationReady(rawObject)).toBe(false);
  });

  it("rejects unsafe status mapping at the API item layer", () => {
    expect(isKnownActiveQuestionStatus("open")).toBe(true);
    expect(isKnownActiveQuestionStatus("gathering_evidence")).toBe(true);
    expect(isKnownActiveQuestionStatus("resolved")).toBe(false);
    expect(isKnownActiveQuestionStatus("archived")).toBe(false);
  });

  it("rejects partial rich fields that are present but not meaningful", () => {
    const object: OrvekObject = {
      id: "aq-broken",
      type: "active-question",
      title: "Does public visibility trigger overbuilding?",
      summary: "Testing whether anticipated visibility drives scope reopening.",
      supporting: [""],
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    };

    expect(isActiveQuestionsRowPresentationReady(object)).toBe(false);
  });

  it("rejects linked objects that cannot resolve safely", () => {
    const brokenObject: OrvekObject = {
      id: "aq-missing-link",
      type: "active-question",
      title: "Does public visibility trigger overbuilding?",
      summary: "Testing whether anticipated visibility drives scope reopening.",
      whyItMatters: "Testing whether anticipated visibility drives scope reopening.",
      relatedIds: ["c-missing"],
      tags: referenceTagsForActiveQuestionStatus("open", "Open"),
    };
    const rawApi = {
      ...buildActiveQuestionsProductionDataApi([]),
      exploreQuestionIds: ["aq-missing-link"],
      getObject: (id: string | null | undefined) =>
        id === "aq-missing-link" ? brokenObject : undefined,
      getObjects: (ids: string[] | undefined) =>
        (ids ?? [])
          .map((id) => (id === "aq-missing-link" ? brokenObject : undefined))
          .filter((object): object is OrvekObject => Boolean(object)),
    };

    expect(shouldMergeActiveQuestionsProductionApi(rawApi)).toBe(false);
  });

  it("keeps hybrid workbench on reference Active Questions when no overlay is passed", () => {
    const baseApi = createMockOrvekDataApi();
    const readyQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
    expect(shouldMergeActiveQuestionsProductionApi(readyQuestionsApi)).toBe(true);
  });

  it("does not wire root Active Questions fetch yet", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).not.toContain("ACTIVE_QUESTIONS_ENDPOINT");
    expect(hookSource).not.toContain("buildActiveQuestionsProductionDataApi");
    expect(hookSource).not.toContain("shouldMergeActiveQuestionsProductionApi");
    expect(hookSource).not.toContain("activeQuestionsApi");
  });

  it("preserves Fieldwork Bridge, Today, Map, Timeline, and Decisions parity in hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const mapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const decisionsApi = buildDecisionsProductionDataApi([]);
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      mapApi,
      timelineApi,
      decisionsApi,
      experimentApi,
    );

    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active"]);
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("resolves linked inspector targets when provider lookup can resolve them", () => {
    const objects: Record<string, OrvekObject> = {
      "aq-live-1": {
        id: "aq-live-1",
        type: "active-question",
        title: "Does public visibility trigger overbuilding?",
        inspectorObjectId: "c-map-1",
        relatedIds: ["c-map-1"],
      },
      "c-map-1": {
        id: "c-map-1",
        type: "receipt",
        title: "Map conclusion",
        inspectorObjectType: "usermap_conclusion",
        inspectorObjectId: "c-map-1",
      },
      "aq-1": {
        id: "aq-1",
        type: "active-question",
        title: "Reference question",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveActiveQuestionsOpenSelectionId("aq-live-1", getObject)).toBe("c-map-1");
    expect(resolveActiveQuestionsOpenSelectionId("aq-1", getObject)).toBe("aq-1");
  });

  it("keeps Investigations reference/mock and Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain('["inv-1", "inv-2", "inv-3"]');
    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("exploreFieldworkIds");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("exploreQuestionIds");
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
    expect(explorePageSource).not.toMatch(/router\.(push|replace)\([^)]*\/active-questions/);
  });
});
