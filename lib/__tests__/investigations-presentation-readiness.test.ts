import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ExploreInvestigationItem } from "../investigations";
import { EXPLORE_INVESTIGATIONS_ENDPOINT } from "../investigations";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildInvestigationsProductionDataApi } from "../../lib/orvek-v0/production/investigations-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";
import type { WatchForItem } from "../watch-for";
import {
  areInvestigationsTextsNearIdentical,
  exploreInvestigationItemToInvestigationObject,
  findDuplicateInvestigationRowIds,
  hasInvestigationThreadDetailRichness,
  hasInvestigationsProductionDisplayContractLeak,
  isActiveQuestionOwnedInvestigationStatus,
  isExploreInvestigationBridgeStatus,
  isInvestigationItemBridgeEligible,
  isInvestigationsPresentationReady,
  isInvestigationsRowPresentationReady,
  looksLikeRawJsonInvestigationsBlob,
  mapInvestigationStatusToReferenceDisplay,
  normalizeInvestigationsOrvekObject,
  normalizeInvestigationsProductionDataApi,
  normalizeInvestigationsSummary,
  referenceTagsForInvestigationStatus,
  resolveInvestigationsOpenSelectionId,
  shouldMergeInvestigationsProductionApi,
} from "../../lib/orvek-v0/production/investigations-presentation";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function exploreInvestigationItem(
  id: string,
  overrides: Partial<ExploreInvestigationItem> = {},
): ExploreInvestigationItem {
  return {
    id,
    title: "Why do I reopen scope before design?",
    organizingQuestion: "Understanding the trigger could break the most expensive loop.",
    status: "resolved",
    statusLabel: "Resolved",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_INVESTIGATION_ENRICHMENTS: Record<
  string,
  {
    hypotheses: string[];
    missingEvidence: string[];
    evidenceCount: number;
  }
> = {
  "inv-resolved-1": {
    hypotheses: [
      "Visibility raises the stakes and triggers overbuilding.",
      "Uncertainty feels safer to expand than to narrow.",
    ],
    missingEvidence: ["A prototype result", "A shipped narrow test"],
    evidenceCount: 8,
  },
  "inv-abandoned-1": {
    hypotheses: ["Extract receipts, context updates, questions, and fieldwork separately."],
    missingEvidence: ["Labeled examples of good vs noise extraction"],
    evidenceCount: 3,
  },
};

const READY_INVESTIGATIONS: ExploreInvestigationItem[] = [
  exploreInvestigationItem("inv-resolved-1"),
  exploreInvestigationItem("inv-abandoned-1", {
    title: "How should Explore extract useful model data from conversation?",
    organizingQuestion: "Extraction quality determines how much conversation becomes model movement.",
    status: "abandoned",
    statusLabel: "Abandoned",
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

describe("investigations presentation normalization", () => {
  it("caps long organizing questions without leaving raw overflow", () => {
    const normalized = normalizeInvestigationsSummary("word ".repeat(60));

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("registers linked object aliases during production normalization", () => {
    const rawApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
      linkedAliases: [{ linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" }],
    });
    const normalized = normalizeInvestigationsProductionDataApi(rawApi);

    expect(normalized.displayContract).toBeUndefined();
    expect(normalized.explore).toBeUndefined();
    expect(normalized.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(normalized.getObject("inv-resolved-1")?.whyItMatters).toContain("trigger");
  });

  it("dedupes duplicate investigation rows during normalization", () => {
    const rawApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    rawApi.exploreInvestigationIds = [
      ...(rawApi.exploreInvestigationIds ?? []),
      "inv-resolved-1",
    ];

    expect(findDuplicateInvestigationRowIds(rawApi)).toContain("inv-resolved-1");

    const normalized = normalizeInvestigationsProductionDataApi(rawApi);

    expect(normalized.exploreInvestigationIds?.filter((id) => id === "inv-resolved-1")).toHaveLength(
      1,
    );
    expect(findDuplicateInvestigationRowIds(normalized)).toEqual([]);
  });

  it("uses only the Explore Investigations public list contract as the bridge source", () => {
    const investigationsSource = readSource("lib/investigations.ts");
    const presentationSource = readSource("lib/orvek-v0/production/investigations-api.ts");

    expect(investigationsSource).toContain(EXPLORE_INVESTIGATIONS_ENDPOINT);
    expect(investigationsSource).toContain("fetchExploreInvestigationItems");
    expect(investigationsSource).not.toContain("/api/investigations");
    expect(presentationSource).not.toContain("/api/investigations");
  });
});

describe("investigations presentation readiness gate", () => {
  it("passes presentation-ready normalized Investigations data with enriched thread detail", () => {
    const rawApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    const normalized = normalizeInvestigationsProductionDataApi(rawApi);

    expect(shouldMergeInvestigationsProductionApi(rawApi)).toBe(true);
    expect(isInvestigationsPresentationReady(normalized)).toBe(true);
    expect(normalized.getObject("inv-resolved-1")?.tags).toEqual(
      referenceTagsForInvestigationStatus("resolved", "Resolved"),
    );
    expect(mapInvestigationStatusToReferenceDisplay("resolved")).toBe("resolved");
    expect(areInvestigationsTextsNearIdentical("A", "a")).toBe(true);
  });

  it("rejects raw production Investigations data with displayContract leak before normalization", () => {
    const rawApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    expect(hasInvestigationsProductionDisplayContractLeak(rawApi)).toBe(true);
    expect(isInvestigationsPresentationReady(rawApi)).toBe(false);
    expect(shouldMergeInvestigationsProductionApi(rawApi)).toBe(true);
  });

  it("rejects rows with missing title or organizing question", () => {
    const object: OrvekObject = {
      id: "inv-broken",
      type: "investigation",
      title: "   ",
      summary: "Understanding the trigger could break the most expensive loop.",
      whyItMatters: "Understanding the trigger could break the most expensive loop.",
      hypotheses: ["Visibility raises the stakes and triggers overbuilding."],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };

    expect(isInvestigationsRowPresentationReady(object)).toBe(false);
  });

  it("rejects raw or thin organizingQuestion text", () => {
    const thinObject: OrvekObject = {
      id: "inv-thin",
      type: "investigation",
      title: "Why do I reopen scope before design?",
      summary: "   ",
      whyItMatters: "   ",
      hypotheses: ["Visibility raises the stakes and triggers overbuilding."],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };

    expect(isInvestigationsRowPresentationReady(thinObject)).toBe(false);

    const rawObject: OrvekObject = {
      id: "inv-raw",
      type: "investigation",
      title: "Why do I reopen scope before design?",
      summary: "Traceback (most recent call last): overflow",
      whyItMatters: "Traceback (most recent call last): overflow",
      hypotheses: ["Visibility raises the stakes and triggers overbuilding."],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };

    expect(isInvestigationsRowPresentationReady(rawObject)).toBe(false);
  });

  it("rejects unsafe status mapping and Active Questions-owned rows", () => {
    expect(isExploreInvestigationBridgeStatus("resolved")).toBe(true);
    expect(isExploreInvestigationBridgeStatus("abandoned")).toBe(true);
    expect(isExploreInvestigationBridgeStatus("open")).toBe(false);
    expect(isActiveQuestionOwnedInvestigationStatus("open")).toBe(true);
    expect(isActiveQuestionOwnedInvestigationStatus("resolved")).toBe(false);
    expect(
      isInvestigationItemBridgeEligible(
        exploreInvestigationItem("inv-open", { status: "open", statusLabel: "Open" }),
      ),
    ).toBe(false);
    expect(exploreInvestigationItemToInvestigationObject(
      exploreInvestigationItem("inv-open", { status: "open", statusLabel: "Open" }),
    )).toBeNull();
  });

  it("rejects raw JSON blobs in investigation thread detail", () => {
    expect(
      looksLikeRawJsonInvestigationsBlob('{"competingTheories":["one","two"]}'),
    ).toBe(true);

    const object: OrvekObject = {
      id: "inv-json",
      type: "investigation",
      title: "Why do I reopen scope before design?",
      summary: "Understanding the trigger could break the most expensive loop.",
      whyItMatters: "Understanding the trigger could break the most expensive loop.",
      hypotheses: ['{"competingTheories":["Visibility raises the stakes"]}'],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };

    expect(isInvestigationsRowPresentationReady(object)).toBe(false);
  });

  it("rejects thin public-list-only rows that would collapse rich reference Investigations cards", () => {
    const thinObject = exploreInvestigationItemToInvestigationObject(
      exploreInvestigationItem("inv-resolved-thin"),
    );

    expect(thinObject).not.toBeNull();
    expect(hasInvestigationThreadDetailRichness(thinObject!)).toBe(false);
    expect(isInvestigationsRowPresentationReady(thinObject!)).toBe(false);

    const rawApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS);
    expect(shouldMergeInvestigationsProductionApi(rawApi)).toBe(false);
  });

  it("rejects partial rich fields that are present but not meaningful", () => {
    const object: OrvekObject = {
      id: "inv-broken",
      type: "investigation",
      title: "Why do I reopen scope before design?",
      summary: "Understanding the trigger could break the most expensive loop.",
      hypotheses: [""],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };

    expect(isInvestigationsRowPresentationReady(object)).toBe(false);
  });

  it("rejects linked objects that cannot resolve safely", () => {
    const brokenObject: OrvekObject = {
      id: "inv-missing-link",
      type: "investigation",
      title: "Why do I reopen scope before design?",
      summary: "Understanding the trigger could break the most expensive loop.",
      whyItMatters: "Understanding the trigger could break the most expensive loop.",
      hypotheses: ["Visibility raises the stakes and triggers overbuilding."],
      relatedIds: ["c-missing"],
      tags: referenceTagsForInvestigationStatus("resolved", "Resolved"),
      status: "resolved",
    };
    const rawApi = {
      ...buildInvestigationsProductionDataApi([]),
      exploreInvestigationIds: ["inv-missing-link"],
      getObject: (id: string | null | undefined) =>
        id === "inv-missing-link" ? brokenObject : undefined,
      getObjects: (ids: string[] | undefined) =>
        (ids ?? [])
          .map((id) => (id === "inv-missing-link" ? brokenObject : undefined))
          .filter((object): object is OrvekObject => Boolean(object)),
    };

    expect(shouldMergeInvestigationsProductionApi(rawApi)).toBe(false);
  });

  it("keeps hybrid workbench on reference Investigations when no overlay is passed", () => {
    const baseApi = createMockOrvekDataApi();
    const readyInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
    expect(shouldMergeInvestigationsProductionApi(readyInvestigationsApi)).toBe(true);
  });

  it("does not wire Investigations fetch into the root hybrid hook yet", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).not.toContain("fetchExploreInvestigationItems");
    expect(hookSource).not.toContain("buildInvestigationsProductionDataApi");
    expect(hookSource).not.toContain("shouldMergeInvestigationsProductionApi");
  });

  it("preserves Active Questions, Fieldwork Bridge, Today, Map, Timeline, and Decisions parity", () => {
    const baseApi = createMockOrvekDataApi();
    const mapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const decisionsApi = buildDecisionsProductionDataApi([]);
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi([
      {
        id: "aq-live-1",
        title: "Does public visibility trigger overbuilding?",
        organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
        status: "open",
        statusLabel: "Open",
        createdAt: "2026-06-20T10:00:00.000Z",
        updatedAt: "2026-06-20T10:00:00.000Z",
      },
    ]);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      mapApi,
      timelineApi,
      decisionsApi,
      experimentApi,
      activeQuestionsApi,
    );

    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1"]);
    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("resolves linked inspector targets when provider lookup can resolve them", () => {
    const objects: Record<string, OrvekObject> = {
      "inv-resolved-1": {
        id: "inv-resolved-1",
        type: "investigation",
        title: "Why do I reopen scope before design?",
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
      "inv-1": {
        id: "inv-1",
        type: "investigation",
        title: "Reference investigation",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveInvestigationsOpenSelectionId("inv-resolved-1", getObject)).toBe("c-map-1");
    expect(resolveInvestigationsOpenSelectionId("inv-1", getObject)).toBe("inv-1");
  });

  it("keeps Investigations tab reference/mock and Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(investigationsBlock).toContain('["inv-1", "inv-2", "inv-3"]');
    expect(investigationsBlock).toContain("isProductionDisplay(data)");
    expect(investigationsBlock).not.toContain("hasLiveInvestigations");
    expect(explorePageSource).toContain("hasLiveQuestions");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("fetchExploreInvestigationItems");
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
