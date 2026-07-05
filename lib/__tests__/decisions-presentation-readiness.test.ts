import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../../lib/orvek-v0/production/timeline-api";
import {
  areDecisionsTextsNearIdentical,
  findDuplicateDecisionRowIds,
  hasProductionDisplayContractLeak,
  isDecisionsPresentationReady,
  isDecisionsRowPresentationReady,
  isKnownDecisionActionStatus,
  mapDecisionStatusToReferenceGroup,
  normalizeDecisionsOrvekObject,
  normalizeDecisionsProductionDataApi,
  normalizeDecisionsSummary,
  referenceTagsForDecisionGroup,
  shouldMergeDecisionsProductionApi,
} from "../../lib/orvek-v0/production/decisions-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function action(
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

const READY_ACTIONS: SurfacedActionView[] = [
  action("act-active", "not_started"),
  action("act-chosen", "done", { note: "Chose the simpler path.", linkedClaimId: "pc-2", linkedClaimSummary: "Scope pressure rises near deadlines." }),
  action("act-outcome", "done", { linkedClaimId: "pc-3", linkedClaimSummary: "Navigation complexity slows decisions." }),
  action("act-reviewed", "helped", {
    note: "The change held through the release cycle.",
    linkedClaimId: "pc-4",
    linkedClaimSummary: "Investigations feel disconnected when isolated.",
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

describe("decisions presentation normalization", () => {
  it("caps long summaries without leaving raw overflow", () => {
    const normalized = normalizeDecisionsSummary("word ".repeat(60));

    expect(normalized).not.toBeNull();
    expect(normalized!.length).toBeLessThanOrEqual(200);
    expect(normalized!.endsWith("…")).toBe(true);
  });

  it("removes duplicate recommendation when it matches summary", () => {
    const normalized = normalizeDecisionsOrvekObject(
      {
        id: "act-1",
        type: "decision",
        title: "Publish scope note",
        summary: "Recent pattern signal supports resolving scope uncertainty.",
        recommendation: "Recent pattern signal supports resolving scope uncertainty.",
      },
      "Active",
    );

    expect(normalized.summary).toBe("Recent pattern signal supports resolving scope uncertainty.");
    expect(normalized.recommendation).toBeUndefined();
    expect(normalized.tags).toEqual(referenceTagsForDecisionGroup("Active"));
    expect(areDecisionsTextsNearIdentical("A", "a")).toBe(true);
  });

  it("keeps meaningful options and strips empty option shells", () => {
    const normalized = normalizeDecisionsOrvekObject({
      id: "act-1",
      type: "decision",
      title: "Publish scope note",
      summary: "Recent pattern signal supports resolving scope uncertainty.",
      options: [
        { label: "Ship", text: "Ship the narrower scope now." },
        { label: "", text: "" },
      ],
    });

    expect(normalized.options).toEqual([{ label: "Ship", text: "Ship the narrower scope now." }]);
  });

  it("registers linked claim aliases during production normalization", () => {
    const rawApi = buildDecisionsProductionDataApi(READY_ACTIONS);
    const normalized = normalizeDecisionsProductionDataApi(rawApi);

    expect(normalized.displayContract).toBeUndefined();
    expect(normalized.decisions).toBeUndefined();
    expect(normalized.getObject("pc-1")?.type).toBe("receipt");
    expect(normalized.getObject("pc-1")?.inspectorObjectType).toBe("pattern_claim");
    expect(normalized.getObject("act-active")?.receiptIds).toEqual(["pc-1"]);
  });

  it("dedupes duplicate decision rows during normalization", () => {
    const rawApi = buildDecisionsProductionDataApi(READY_ACTIONS);
    rawApi.decisionListGroups[0].ids.push("act-active");

    expect(findDuplicateDecisionRowIds(rawApi)).toContain("act-active");

    const normalized = normalizeDecisionsProductionDataApi(rawApi);
    const activeIds = normalized.decisionListGroups.find((group) => group.heading === "Active")?.ids ?? [];

    expect(activeIds.filter((id) => id === "act-active")).toHaveLength(1);
    expect(findDuplicateDecisionRowIds(normalized)).toEqual([]);
  });
});

describe("decisions presentation readiness gate", () => {
  it("passes presentation-ready normalized Decisions data", () => {
    const rawApi = buildDecisionsProductionDataApi(READY_ACTIONS);
    const normalized = normalizeDecisionsProductionDataApi(rawApi);

    expect(shouldMergeDecisionsProductionApi(rawApi)).toBe(true);
    expect(isDecisionsPresentationReady(normalized)).toBe(true);
    expect(normalized.getObject("act-outcome")?.tags).toEqual(
      referenceTagsForDecisionGroup("Outcome due"),
    );
  });

  it("rejects raw production Decisions data with displayContract leak", () => {
    const rawApi = buildDecisionsProductionDataApi(READY_ACTIONS);

    expect(hasProductionDisplayContractLeak(rawApi)).toBe(true);
    expect(isDecisionsPresentationReady(rawApi)).toBe(false);
    expect(shouldMergeDecisionsProductionApi(rawApi)).toBe(true);
  });

  it("rejects rows with missing title or summary", () => {
    const object: OrvekObject = {
      id: "act-broken",
      type: "decision",
      title: "   ",
      summary: "Because recent pattern signal supports it.",
      tags: referenceTagsForDecisionGroup("Active"),
    };

    expect(isDecisionsRowPresentationReady(object, "Active")).toBe(false);
  });

  it("rejects unsafe status mapping", () => {
    expect(isKnownDecisionActionStatus("archived")).toBe(false);
    expect(mapDecisionStatusToReferenceGroup("not_started", null)).toBe("Active");
    expect(mapDecisionStatusToReferenceGroup("done", "note")).toBe("Chosen");
    expect(mapDecisionStatusToReferenceGroup("done", null)).toBe("Outcome due");
    expect(mapDecisionStatusToReferenceGroup("helped", "held")).toBe("Reviewed");
  });

  it("rejects partial rich fields that are present but not meaningful", () => {
    const object: OrvekObject = {
      id: "act-broken",
      type: "decision",
      title: "Publish scope note",
      summary: "Recent pattern signal supports resolving scope uncertainty.",
      options: [{ label: "", text: "" }],
      tags: referenceTagsForDecisionGroup("Active"),
    };

    expect(isDecisionsRowPresentationReady(object, "Active")).toBe(false);
  });

  it("rejects linked receipts that cannot resolve safely", () => {
    const rawApi = buildDecisionsProductionDataApi([
      action("act-active", "not_started", {
        linkedClaimId: "pc-missing",
        linkedClaimSummary: null,
      }),
    ]);

    expect(shouldMergeDecisionsProductionApi(rawApi)).toBe(false);
  });

  it("keeps hybrid workbench on reference Decisions when no decisions overlay is passed", () => {
    const baseApi = createMockOrvekDataApi();
    const readyDecisionsApi = buildDecisionsProductionDataApi(READY_ACTIONS);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);

    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
    expect(shouldMergeDecisionsProductionApi(readyDecisionsApi)).toBe(true);
  });

  it("wires bounded Decisions fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchActionsPageData");
    expect(hookSource).toContain("buildDecisionsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("decisionsApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/actions/);
  });

  it("preserves Today, Map, and Timeline parity in hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const mapApi = buildMapProductionDataApi(READY_MAP_INPUT);
    const timelineApi = buildTimelineProductionDataApi(READY_TIMELINE_INPUT);
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, undefined, mapApi, timelineApi);

    expect(hybridApi.mapHasContent).toBe(true);
    expect(hybridApi.timelineGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const decisionsPageSource = readSource("components/orvek-v0/pages/decisions.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(workbenchSource).toContain("<DecisionsPage />");
    expect(decisionsPageSource).not.toContain("V0DecisionsView");
    expect(decisionsPageSource).not.toContain("DECISIONS_STABILIZE_TAB_LABEL");
  });
});
