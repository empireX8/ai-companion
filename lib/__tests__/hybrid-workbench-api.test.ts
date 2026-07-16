import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import type { MapMapDataInput } from "../orvek-adapters/map";
import type { MapTimelineDataInput } from "../orvek-adapters/timeline";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildInvestigationsProductionDataApi } from "../../lib/orvek-v0/production/investigations-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import { buildTodayProductionDataApi } from "../../lib/orvek-v0/production/today-api";
import {
  findDuplicateDecisionRowIds,
  referenceTagsForDecisionGroup,
  shouldMergeDecisionsProductionApi,
} from "../../lib/orvek-v0/production/decisions-presentation";
import {
  findDuplicateExperimentRowIds,
  referenceTagsForFieldworkStatus,
  shouldMergeExperimentProductionApi,
} from "../../lib/orvek-v0/production/experiment-presentation";
import {
  findDuplicateActiveQuestionRowIds,
  referenceTagsForActiveQuestionStatus,
  shouldMergeActiveQuestionsProductionApi,
} from "../../lib/orvek-v0/production/active-questions-presentation";
import {
  findDuplicateInvestigationRowIds,
  referenceTagsForInvestigationStatus,
  shouldMergeInvestigationsProductionApi,
} from "../../lib/orvek-v0/production/investigations-presentation";
import { shouldMergeFreeExploreChatProductionApi } from "../../lib/orvek-v0/production/free-explore-chat-presentation";
import { withProductionContract } from "../../lib/orvek-v0/display-contract";
import { shouldMergeMapProductionApi } from "../../lib/orvek-v0/production/map-presentation";
import type { ActiveQuestionItem } from "../active-questions";
import type { ExploreInvestigationItem } from "../investigations";
import type { WatchForItem } from "../watch-for";
import {
  REFERENCE_TIMELINE_FILTERS,
  shouldMergeTimelineProductionApi,
} from "../../lib/orvek-v0/production/timeline-presentation";
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

function decisionAction(
  id: string,
  status: SurfacedActionView["status"],
  overrides: Partial<SurfacedActionView> = {},
): SurfacedActionView {
  return {
    id,
    title: `Choice ${id}`,
    whySuggested: "Because recent pattern signal supports it.",
    bucket: "stabilize",
    effort: "Low",
    linkedFamily: null,
    linkedFamilyLabel: null,
    linkedClaimId: "pc-1",
    linkedClaimSummary: "I overcommit when scope expands.",
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "Pattern",
    status,
    note: null,
    surfacedAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_DECISIONS_ACTIONS: SurfacedActionView[] = [
  decisionAction("act-active", "not_started"),
  decisionAction("act-chosen", "done", {
    note: "Chose the simpler path.",
    linkedClaimId: "pc-2",
    linkedClaimSummary: "Scope pressure rises near deadlines.",
  }),
  decisionAction("act-outcome", "done", {
    linkedClaimId: "pc-3",
    linkedClaimSummary: "Navigation complexity slows decisions.",
  }),
  decisionAction("act-reviewed", "helped", {
    note: "The change held through the release cycle.",
    linkedClaimId: "pc-4",
    linkedClaimSummary: "Investigations feel disconnected when isolated.",
  }),
];

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

const READY_INVESTIGATION_ENRICHMENTS = {
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

function readyFreeExploreChatInput(
  overrides: Partial<Parameters<typeof buildFreeExploreChatProductionDataApi>[0]> = {},
) {
  return {
    sessionId: "sess-ready-1",
    sessionTitle: "Architecture uncertainty thread",
    messages: [
      {
        id: "msg-user-1",
        role: "user" as const,
        content: "Why do I need to see the architecture visually before locking design?",
        createdAt: "2026-06-20T10:00:00.000Z",
      },
      {
        id: "msg-assistant-1",
        role: "assistant" as const,
        content:
          "You seem to trust decisions more once the system can express itself visually.",
        createdAt: "2026-06-20T10:00:05.000Z",
      },
    ],
    composerDraft: "",
    isBooting: false,
    isSending: false,
    errorMessage: null,
    sendHandlerAvailable: false,
    ...overrides,
  };
}

describe("hybrid workbench data api", () => {
  it("preserves non-Today shell state while hydrating live Today metadata", () => {
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
    expect(hybridApi.todayCopy).toMatchObject(productionTodayApi.todayCopy ?? {});
    expect(hybridApi.today).toMatchObject(productionTodayApi.today ?? {});
    expect(hybridApi.todayResurfacedIds).toBeDefined();
    expect(hybridApi.todayResurfacedIds).not.toEqual(["r6", "r5", "r2"]);
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("d1")).toMatchObject(baseApi.getObject("d1") ?? {});
    expect(hybridApi.todayObjectGraphParity?.inspectableEvidencePointerIds.length).toBeGreaterThan(
      0,
    );
  });

  it("keeps Today empty states honest when production has no surfaced receipts", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.todayResurfacedIds).toEqual([]);
    expect(hybridApi.today?.hero).toBeNull();
    expect(hybridApi.today?.receipts).toEqual([]);
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

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.mapCategories).toEqual([]);
    expect(hybridApi.getObject("conclusion-c-1")).toBeUndefined();
    expect(hybridApi.mapHasContent).toBe(true);
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

  it("keeps a live Map rail when selected detail evidence preload is absent", () => {
    const baseApi = createMockOrvekDataApi();
    const failingMapApi = buildMapProductionDataApi({
      ...READY_MAP_INPUT,
      evidence: [],
    });

    expect(shouldMergeMapProductionApi(failingMapApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, failingMapApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.mapCategories.some((category) => category.ids.includes("conclusion-c-1"))).toBe(
      true,
    );
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
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

  it("merges presentation-ready production Timeline overlay into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);

    expect(shouldMergeTimelineProductionApi(timelineApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, timelineApi);

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("falls back to reference Timeline when production Timeline overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeTimelineApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      timelineEntries: [
        {
          id: "journal-1",
          occurredAt: "2026-06-24T09:00:00.000Z",
          chip: "Journal",
          title: "Scope note",
          body: "Traceback (most recent call last): journal dump overflow",
          href: "/library/journal-journal-1",
          kind: "journal",
          lane: "receipts_activity",
          sourceLabel: "Journal",
        },
      ],
      modelLayers: [],
    });

    expect(shouldMergeTimelineProductionApi(unsafeTimelineApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, unsafeTimelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("falls back to reference Timeline when production Timeline overlay is still loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingTimelineApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      isLoadingActivity: true,
    });

    expect(shouldMergeTimelineProductionApi(loadingTimelineApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, loadingTimelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
  });

  it("falls back to reference Timeline when production rows have unmapped event types", () => {
    const baseApi = createMockOrvekDataApi();
    const invalidTimelineApi = buildTimelineProductionDataApi({
      ...READY_TIMELINE_INPUT,
      timelineEntries: [
        {
          id: "unknown-1",
          occurredAt: "2026-06-24T09:00:00.000Z",
          chip: "Mystery Widget",
          title: "Unknown row",
          body: "Unknown stream item.",
          href: null,
        },
      ],
      modelLayers: [],
    });

    expect(shouldMergeTimelineProductionApi(invalidTimelineApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, invalidTimelineApi);

    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("does not merge duplicate movement rows into the hybrid Timeline overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const duplicateTimelineApi = buildTimelineProductionDataApi({
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

    expect(shouldMergeTimelineProductionApi(duplicateTimelineApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, duplicateTimelineApi);
    const rowIds = hybridApi.timelineGroups.flatMap((group) => group.ids);

    expect(rowIds).toContain("model-mu-1");
    expect(rowIds).not.toContain("activity-mu-1");
    expect(hybridApi.getObject("t1")).toMatchObject(baseApi.getObject("t1") ?? {});
  });

  it("preserves Today and Map hybrid merges when Timeline overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
  });

  it("wires bounded Timeline fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("buildTimelineProductionDataApi");
    expect(hookSource).toContain("fetchTimelineSemanticEntries");
    expect(hookSource).toContain("buildTimelineRequestUrl");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("decisionsApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/timeline/);
  });

  it("merges presentation-ready production Decisions overlay into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const decisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);

    expect(shouldMergeDecisionsProductionApi(decisionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      decisionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.getObject("act-active")?.tags).toEqual(referenceTagsForDecisionGroup("Active"));
    expect(hybridApi.getObject("act-active")?.inspectorObjectType).toBe("reference_decision");
    expect(hybridApi.getObject("act-active")?.inspectorObjectId).toBe("act-active");
    expect(hybridApi.getObject("pc-1")?.inspectorObjectType).toBe("pattern_claim");
    expect(hybridApi.getObject("d1")).toMatchObject(baseApi.getObject("d1") ?? {});
  });

  it("falls back to reference Decisions when production Decisions overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeDecisionsApi = buildDecisionsProductionDataApi([
      decisionAction("act-active", "not_started", {
        linkedClaimId: "pc-missing",
        linkedClaimSummary: null,
      }),
    ]);

    expect(shouldMergeDecisionsProductionApi(unsafeDecisionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      unsafeDecisionsApi,
    );

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.decisionsHeaderStats).toEqual({ outcomesDue: 0, reviewed: 0 });
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("falls back to reference Decisions when thin production rows cannot resolve linked receipts", () => {
    const baseApi = createMockOrvekDataApi();
    const thinDecisionsApi = buildDecisionsProductionDataApi([
      decisionAction("act-active", "not_started", {
        title: "   ",
        whySuggested: "Because recent pattern signal supports it.",
      }),
    ]);

    expect(shouldMergeDecisionsProductionApi(thinDecisionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      thinDecisionsApi,
    );

    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("dedupes duplicate decision rows during hybrid Decisions overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const decisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    decisionsApi.decisionListGroups[0].ids.push("act-active");

    expect(findDuplicateDecisionRowIds(decisionsApi)).toContain("act-active");
    expect(shouldMergeDecisionsProductionApi(decisionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      decisionsApi,
    );
    const activeIds =
      hybridApi.decisionListGroups.find((group) => group.heading === "Active")?.ids ?? [];

    expect(activeIds.filter((id) => id === "act-active")).toHaveLength(1);
    expect(findDuplicateDecisionRowIds(hybridApi)).toEqual([]);
  });

  it("does not merge Decisions overlay when passed as timelineApi by mistake", () => {
    const baseApi = createMockOrvekDataApi();
    const decisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, undefined, decisionsApi);

    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.timelineGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("preserves Today, Map, and Timeline hybrid merges when Decisions overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
      readyDecisionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.getObject("pc-2")?.type).toBe("receipt");
  });

  it("wires bounded Decisions fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchActionsPageData");
    expect(hookSource).toContain("buildDecisionsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("decisionsApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/actions/);
  });

  it("merges presentation-ready production Experiment/Fieldwork overlay into the hybrid workbench", () => {
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
    expect(hybridApi.exploreFieldworkSelectedId).toBe("fw-active");
    expect(hybridApi.getObject("fw-active")?.tags).toEqual(
      referenceTagsForFieldworkStatus("active", "Active"),
    );
    expect(hybridApi.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("falls back to reference Fieldwork Bridge when production Experiment overlay fails readiness", () => {
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

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.experimentIsLoading).toBe(false);
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("falls back to reference Fieldwork Bridge when thin watch-for rows cannot resolve", () => {
    const baseApi = createMockOrvekDataApi();
    const thinExperimentApi = buildExperimentProductionDataApi([
      watchForItem("fw-thin", {
        prompt: "Notice scope pressure",
        reason: "   ",
      }),
    ]);

    expect(shouldMergeExperimentProductionApi(thinExperimentApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      thinExperimentApi,
    );

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("does not leak production displayContract into the root hybrid Experiment overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);

    expect(experimentApi.displayContract).toBeDefined();

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.explore).toBeUndefined();
  });

  it("dedupes duplicate fieldwork rows during hybrid Experiment overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    experimentApi.exploreFieldworkIds = [...(experimentApi.exploreFieldworkIds ?? []), "fw-active"];

    expect(findDuplicateExperimentRowIds(experimentApi)).toContain("fw-active");
    expect(shouldMergeExperimentProductionApi(experimentApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.exploreFieldworkIds?.filter((id) => id === "fw-active")).toHaveLength(1);
    expect(findDuplicateExperimentRowIds(hybridApi)).toEqual([]);
  });

  it("preserves linked object and inspector target aliases during Experiment overlay merge", () => {
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

    expect(hybridApi.getObject("fw-active")?.relatedIds).toEqual(["pc-fw-2"]);
    expect(hybridApi.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
    expect(hybridApi.getObject("pc-fw-2")?.type).toBe("receipt");
  });

  it("does not merge Experiment overlay when passed as decisionsApi by mistake", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      experimentApi,
    );

    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
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

  it("preserves Today, Map, Timeline, and Decisions hybrid merges when Experiment overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const readyExperimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
      readyDecisionsApi,
      readyExperimentApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
  });

  it("wires bounded Experiment watch-for fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchWatchForItems");
    expect(hookSource).toContain("buildExperimentProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("experimentApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/watch-for/);
  });

  it("merges presentation-ready production Active Questions overlay into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS, [
      { linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" },
    ]);

    expect(shouldMergeActiveQuestionsProductionApi(activeQuestionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.exploreQuestionSelectedId).toBe("aq-live-1");
    expect(hybridApi.getObject("aq-live-1")?.tags).toEqual(
      referenceTagsForActiveQuestionStatus("gathering_evidence", "Gathering evidence"),
    );
    expect(hybridApi.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("falls back to reference Active Questions when production overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeActiveQuestionsApi = buildActiveQuestionsProductionDataApi([
      activeQuestionItem("aq-broken", {
        title: "   ",
        organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
      }),
    ]);

    expect(shouldMergeActiveQuestionsProductionApi(unsafeActiveQuestionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeActiveQuestionsApi,
    );

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.activeQuestionsIsLoading).toBe(false);
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("falls back to reference Active Questions when thin production rows cannot resolve", () => {
    const baseApi = createMockOrvekDataApi();
    const thinActiveQuestionsApi = buildActiveQuestionsProductionDataApi([
      activeQuestionItem("aq-thin", {
        organizingQuestion: "   ",
      }),
    ]);

    expect(shouldMergeActiveQuestionsProductionApi(thinActiveQuestionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      thinActiveQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("does not leak production displayContract into the root hybrid Active Questions overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    expect(activeQuestionsApi.displayContract).toBeDefined();

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.explore).toBeUndefined();
  });

  it("dedupes duplicate active-question rows during hybrid Active Questions overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    activeQuestionsApi.exploreQuestionIds = [
      ...(activeQuestionsApi.exploreQuestionIds ?? []),
      "aq-live-1",
    ];

    expect(findDuplicateActiveQuestionRowIds(activeQuestionsApi)).toContain("aq-live-1");
    expect(shouldMergeActiveQuestionsProductionApi(activeQuestionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds?.filter((id) => id === "aq-live-1")).toHaveLength(1);
    expect(findDuplicateActiveQuestionRowIds(hybridApi)).toEqual([]);
  });

  it("preserves linked object and inspector target aliases during Active Questions overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS, [
      { linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" },
    ]);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(hybridApi.getObject("aq-live-1")?.whyItMatters).toContain("visibility");
  });

  it("does not merge Active Questions overlay when passed as experimentApi by mistake", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.exploreFieldworkIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("leaves Investigations and Explore chat on reference/mock when Active Questions merges", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("preserves Today, Map, Timeline, Decisions, and Experiment hybrid merges when Active Questions overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const readyExperimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const readyActiveQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
      readyDecisionsApi,
      readyExperimentApi,
      readyActiveQuestionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.getObject("activity-journal-1")?.title).toBe("Scope note");
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.getObject("pc-fw-2")?.inspectorObjectType).toBe("pattern_claim");
  });

  it("wires bounded Active Questions fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchActiveQuestionItems");
    expect(hookSource).toContain("buildActiveQuestionsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("activeQuestionsApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/active-questions/);
  });

  it("merges presentation-ready production Investigations overlay into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
      linkedAliases: [{ linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" }],
    });

    expect(shouldMergeInvestigationsProductionApi(investigationsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1", "inv-abandoned-1"]);
    expect(hybridApi.exploreInvestigationSelectedId).toBe("inv-resolved-1");
    expect(hybridApi.getObject("inv-resolved-1")?.tags).toEqual(
      referenceTagsForInvestigationStatus("resolved", "Resolved"),
    );
    expect(hybridApi.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("falls back to reference Investigations when production overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeInvestigationsApi = buildInvestigationsProductionDataApi(
      [
        exploreInvestigationItem("inv-broken", {
          title: "   ",
          organizingQuestion: "Understanding the trigger could break the most expensive loop.",
        }),
      ],
      { enrichments: READY_INVESTIGATION_ENRICHMENTS },
    );

    expect(shouldMergeInvestigationsProductionApi(unsafeInvestigationsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeInvestigationsApi,
    );

    expect(hybridApi).not.toBe(baseApi);
    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.investigationsIsLoading).toBe(false);
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("merges thin public-list-only Investigations without fabricating rich thread fields", () => {
    const baseApi = createMockOrvekDataApi();
    const thinInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS);

    expect(shouldMergeInvestigationsProductionApi(thinInvestigationsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      thinInvestigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1", "inv-abandoned-1"]);
    expect(hybridApi.getObject("inv-resolved-1")?.title).toBe(READY_INVESTIGATIONS[0]?.title);
    expect(hybridApi.getObject("inv-resolved-1")?.hypotheses).toBeUndefined();
  });

  it("rejects Active Questions-owned statuses from Investigations overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionOwnedApi = buildInvestigationsProductionDataApi([
      exploreInvestigationItem("inv-open", {
        status: "open",
        statusLabel: "Open",
      }),
    ]);

    expect(activeQuestionOwnedApi.exploreInvestigationIds).toEqual([]);
    expect(shouldMergeInvestigationsProductionApi(activeQuestionOwnedApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionOwnedApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
  });

  it("does not leak production displayContract into the root hybrid Investigations overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    expect(investigationsApi.displayContract).toBeDefined();

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.explore).toBeUndefined();
  });

  it("dedupes duplicate investigation rows during hybrid Investigations overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    investigationsApi.exploreInvestigationIds = [
      ...(investigationsApi.exploreInvestigationIds ?? []),
      "inv-resolved-1",
    ];

    expect(findDuplicateInvestigationRowIds(investigationsApi)).toContain("inv-resolved-1");
    expect(shouldMergeInvestigationsProductionApi(investigationsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds?.filter((id) => id === "inv-resolved-1")).toHaveLength(1);
    expect(findDuplicateInvestigationRowIds(hybridApi)).toEqual([]);
  });

  it("preserves linked object and inspector target aliases during Investigations overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
      linkedAliases: [{ linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" }],
    });

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(hybridApi.getObject("inv-resolved-1")?.whyItMatters).toContain("trigger");
  });

  it("does not merge Investigations overlay when passed as activeQuestionsApi by mistake", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("leaves Active Questions and Explore chat on reference/mock when Investigations merges", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("preserves Today, Map, Timeline, Decisions, Experiment, and Active Questions hybrid merges when Investigations overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const readyExperimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const readyActiveQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const readyInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
      readyDecisionsApi,
      readyExperimentApi,
      readyActiveQuestionsApi,
      readyInvestigationsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.getObject("r6")).toMatchObject(baseApi.getObject("r6") ?? {});
    expect(hybridApi.getObject("conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
    expect(hybridApi.timelineFilters).toEqual([...REFERENCE_TIMELINE_FILTERS]);
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1", "inv-abandoned-1"]);
  });

  it("wires bounded Explore Investigations fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchExploreInvestigationItems");
    expect(hookSource).toContain("buildInvestigationsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("investigationsApi");
    expect(hookSource).not.toContain("/api/investigations");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/investigations/);
  });

  it("keeps Investigations tab aligned to readiness-gated provider ids", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain('referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"]');
    expect(investigationsBlock).toContain("hasLiveInvestigations");
    expect(investigationsBlock).toContain("resolveInvestigationsOpenSelectionId");
    expect(investigationsBlock).not.toContain("isProductionDisplay");
  });

  it("merges presentation-ready Free Explore chat overlay into the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());

    expect(shouldMergeFreeExploreChatProductionApi(freeExploreChatApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      freeExploreChatApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
    expect(hybridApi.exploreMessages).toEqual([
      {
        id: "msg-user-1",
        role: "user",
        content: "Why do I need to see the architecture visually before locking design?",
        grounding: null,
      },
      {
        id: "msg-assistant-1",
        role: "orvek",
        content: "You seem to trust decisions more once the system can express itself visually.",
        grounding: null,
      },
    ]);
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
    expect(hybridApi.exploreMovement).toEqual([]);
  });

  it("merges safe empty-live Free Explore chat overlay when session is ready with no messages", () => {
    const baseApi = createMockOrvekDataApi();
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ messages: [] }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(freeExploreChatApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      freeExploreChatApi,
    );

    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.exploreMessages).toEqual([]);
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
  });

  it("falls back to reference Free Explore chat when production overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({
        isBooting: true,
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(unsafeChatApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeChatApi,
    );

    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.freeExploreChatSessionId).toBeUndefined();
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreMovement).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
  });

  it("falls back when Free Explore chat overlay has auth/session boot errors", () => {
    const baseApi = createMockOrvekDataApi();
    const authErrorApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({
        messages: [],
        errorMessage: "Please sign in to view sessions.",
      }),
    );

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      authErrorApi,
    );

    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.freeExploreChatSessionId).toBeUndefined();
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreMovement).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
  });

  it("passes freeExploreSendHandlerAvailable through overlay when upstream marks handler availability true", () => {
    const baseApi = createMockOrvekDataApi();
    const handlerTrueApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({
        sendHandlerAvailable: true,
      }),
    );

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      handlerTrueApi,
    );

    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(true);
  });

  it("rejects displayContract production leaks from Free Explore chat overlay merge", () => {
    const baseApi = createMockOrvekDataApi();
    const leakedApi = withProductionContract(
      buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput()),
    );

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      leakedApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreMessages).toBeUndefined();
  });

  it("does not merge fake grounding/movement/live-detection fields as production chat overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());
    const leakedOverlay = {
      ...freeExploreChatApi,
      exploreGrounding: ["r6"],
      exploreLiveDetectionCopy: "1 receipt extracted",
      exploreMovement: [{ id: "ex1", kind: "Receipt extracted", text: "Unsafe" }],
    };

    expect(shouldMergeFreeExploreChatProductionApi(leakedOverlay)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      leakedOverlay,
    );

    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
    expect(hybridApi.exploreMovement).toEqual([]);
  });

  it("strips mock explore bleed when a rejected chat overlay is paired with other ready merges", () => {
    const baseApi = createMockOrvekDataApi();
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());
    const leakedOverlay = {
      ...freeExploreChatApi,
      exploreGrounding: ["r6"],
      exploreLiveDetectionCopy: "1 receipt extracted",
      exploreMovement: [{ id: "ex1", kind: "Receipt extracted", text: "Unsafe" }],
    };

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      readyMapApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      leakedOverlay,
    );

    expect(shouldMergeMapProductionApi(readyMapApi)).toBe(true);
    expect(shouldMergeFreeExploreChatProductionApi(leakedOverlay)).toBe(false);
    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreMovement).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
  });

  it("preserves Today, Map, Timeline, Decisions, Experiment, Active Questions, and Investigations merges when Free Explore chat overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const readyMapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const readyTimelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const readyExperimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const readyActiveQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const readyInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      productionTodayApi,
      readyMapApi,
      readyTimelineApi,
      readyDecisionsApi,
      readyExperimentApi,
      readyActiveQuestionsApi,
      readyInvestigationsApi,
      freeExploreChatApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active", "fw-assigned"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1", "inv-abandoned-1"]);
    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.exploreMessages?.length).toBe(2);
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
  });

  it("keeps root hybrid hook wired for bounded Explore chat session read fetch and send handlers", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(hookSource).toContain("useOrvekExploreChat");
    expect(hookSource).toContain("buildFreeExploreChatProductionDataApi");
    expect(hookSource).toContain("freeExploreChatApi");
    expect(hookSource).toContain("sendHandlerAvailable: exploreChatSendReady");
    expect(hookSource).toContain("sendMessage");
    expect(workbenchSource).toContain("OrvekPageHandlersProvider");
    expect(shellSource).toContain("handlers={handlers}");
    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
  });

  it("keeps FreeExplore consuming gated live exploreMessages read-only", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("hasLiveExploreChat");
    expect(freeExploreBlock).toContain("hasLiveExploreChatFromProvider");
    expect(freeExploreBlock).not.toContain("isProductionDisplay");
    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable === true");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
  });
});
