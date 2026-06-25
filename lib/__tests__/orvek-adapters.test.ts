import { describe, expect, it } from "vitest";

import { mapDecisionsDataToV0Props } from "../orvek-adapters/decisions";
import { mapExploreDataToV0Props } from "../orvek-adapters/explore";
import { mapMapDataToV0Props } from "../orvek-adapters/map";
import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import {
  mapTimelineDataToV0Props,
  resolveTimelineOpenTarget,
} from "../orvek-adapters/timeline";
import { mapWhatChangedDataToV0Props } from "../orvek-adapters/what-changed";
import type { SurfacedActionView } from "../actions-api";
import type { TodayReentrySnapshot } from "../today-reentry";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

describe("orvek adapters", () => {
  it("mapTodayDataToV0Props keeps v0 geometry slots with honest empty copy", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(props.hero).toBeNull();
    expect(props.nowRows).toEqual([]);
    expect(props.movements).toEqual([]);
    expect(props.report).toBeNull();
    expect(props.receipts).toEqual([]);
    expect(props.priorReadEmptyCopy).toContain("Prior read");
    expect(props.primaryActions.length).toBeGreaterThan(0);
    expect(props.checkIns.length).toBe(5);
  });

  it("mapTodayDataToV0Props maps movement without fabricating previous read", () => {
    const props = mapTodayDataToV0Props({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        intelligenceUpdates: [
          {
            id: "mu-1",
            updateTypeLabel: "Pattern shift",
            affectedObjectTypeLabel: "Pattern",
            userFacingSummary: "Updated summary",
            createdAt: "2026-06-24T10:00:00.000Z",
            affectedObjectType: "pattern_claim",
            affectedObjectId: "p-1",
            affectedObjectHref: "/patterns/p-1",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday",
    });

    expect(props.movements).toHaveLength(1);
    expect(props.movements[0]?.previous).toBeNull();
    expect(props.movements[0]?.updated).toBe("Updated summary");
    expect(props.report?.href).toBe("/what-changed");
  });

  it("mapExploreDataToV0Props keeps draft review and published movement as separate view slots", () => {
    const props = mapExploreDataToV0Props({
      activeTab: "free",
      hasActionHandoffRequest: false,
      handoffContext: null,
      isLoadingHandoff: false,
      handoffError: null,
      messages: [
        { id: "m-1", role: "user", content: "Hello" },
        { id: "m-2", role: "assistant", content: "" },
      ],
      composerDraft: "draft",
      isBooting: false,
      isSending: true,
      errorMessage: null,
    });

    expect(props.pageTitle).toBe("Explore");
    expect(props.messages).toHaveLength(2);
    expect(props.messages[1]?.isThinking).toBe(true);
    expect(props.handoff.show).toBe(false);
    expect(props.groundingChips.length).toBeGreaterThan(0);
    expect(JSON.stringify(props)).not.toContain("model_update");
  });

  it("mapWhatChangedDataToV0Props maps primary and earlier without beforeSummary", () => {
    const view = mapWhatChangedDataToV0Props({
      primary: {
        id: "mu-1",
        updateTypeLabel: "Pattern shift",
        affectedObjectTypeLabel: "Pattern",
        userFacingSummary: "Summary",
        createdAt: "2026-06-24T10:00:00.000Z",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "p-1",
        affectedObjectHref: "/patterns/p-1",
      },
      earlier: [],
      evidenceItems: [],
    });

    expect(view.primary?.title).toContain("Pattern shift");
    expect(view.primary?.summary).toBe("Summary");
    expect(JSON.stringify(view)).not.toContain("beforeSummary");
  });

  it("mapMapDataToV0Props maps groups and preserves real conclusion ids", () => {
    const view = mapMapDataToV0Props({
      items: [
        {
          id: "c-1",
          title: "Evening stress loop",
          area: "operating_logic",
          status: "supported",
          confidenceLevel: "medium",
          evidenceCount: 3,
          summary: "Summary",
          updatedAt: "2026-06-24T10:00:00.000Z",
        },
      ],
      isLoading: false,
      loadError: null,
      selectedId: "c-1",
      detail: {
        id: "c-1",
        title: "Evening stress loop",
        area: "operating_logic",
        status: "supported",
        confidenceLevel: "medium",
        evidenceCount: 3,
        sourceDiversity: 2,
        timeSpreadDays: 14,
        summary: "Summary",
        updatedAt: "2026-06-24T10:00:00.000Z",
        createdAt: "2026-06-20T10:00:00.000Z",
      },
      isDetailLoading: false,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [],
        summaryCounts: { memories: 0, patterns: 0 },
      },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    expect(view.ontologyGroups.some((group) => group.items.some((item) => item.rawId === "c-1"))).toBe(
      true
    );
    expect(view.detail?.id).toBe("c-1");
    expect(view.headerStats?.receipts).toBe(3);
    expect(view.showSecondaryPanels).toBe(true);
  });

  it("mapDecisionsDataToV0Props preserves fieldwork and explore handoff links", () => {
    const action: SurfacedActionView = {
      id: "a-field",
      title: "Pause evening commitments",
      whySuggested: "Pattern signal supports a smaller boundary.",
      bucket: "stabilize",
      effort: "Low",
      linkedFamily: null,
      linkedFamilyLabel: null,
      linkedClaimId: "pc-9",
      linkedClaimSummary: "I overcommit",
      linkedGoalId: null,
      linkedGoalStatement: null,
      linkedSourceLabel: "Pattern",
      status: "not_started",
      note: null,
      surfacedAt: "2026-06-20T10:00:00.000Z",
      updatedAt: "2026-06-20T10:00:00.000Z",
    };

    const view = mapDecisionsDataToV0Props({
      tab: "stabilize",
      list: [action],
      selectedDecisionId: "a-field",
      isLoading: false,
      errorMessage: null,
      createErrorByActionId: {},
    });

    expect(view.decision?.reflectHref).toContain("/explore");
    expect(view.decision?.reflectHref).toContain("a-field");
    expect(view.decision?.receiptHref).toContain("/library/receipt-pattern-pc-9");
    expect(view.decision?.showFieldwork).toBe(true);
  });

  it("mapDecisionsDataToV0Props preserves action ids, statuses, and stage index", () => {
    const action = (
      id: string,
      status: SurfacedActionView["status"]
    ): SurfacedActionView => ({
      id,
      title: `Choice ${id}`,
      whySuggested: "Because recent pattern signal supports it.",
      bucket: "stabilize",
      effort: "Low",
      linkedFamily: null,
      linkedFamilyLabel: null,
      linkedClaimId: "pc-1",
      linkedClaimSummary: "I overcommit",
      linkedGoalId: null,
      linkedGoalStatement: null,
      linkedSourceLabel: "Pattern",
      status,
      note: null,
      surfacedAt: "2026-06-20T10:00:00.000Z",
      updatedAt: "2026-06-20T10:00:00.000Z",
    });

    const view = mapDecisionsDataToV0Props({
      tab: "stabilize",
      list: [action("a-1", "not_started"), action("a-2", "helped")],
      selectedDecisionId: "a-2",
      isLoading: false,
      errorMessage: null,
      createErrorByActionId: {},
    });

    expect(view.sidebarGroups.map((group) => group.heading)).toEqual([
      "Active",
      "Chosen",
      "Outcome due",
      "Reviewed",
    ]);
    expect(view.sidebarGroups[0]?.items[0]?.id).toBe("a-1");
    expect(view.sidebarGroups[0]?.items[0]?.status).toBe("not_started");
    expect(view.decision?.id).toBe("a-2");
    expect(view.decision?.status).toBe("helped");
    expect(view.stageIndex).toBe(4);
    expect(view.headerStats).toEqual({ openCount: 1, reviewedCount: 1 });
    expect(JSON.stringify(view)).not.toContain("candidateLifecycleStatus");
  });

  it("mapTimelineDataToV0Props routes inspector targets only for supported objects", () => {
    const props = mapTimelineDataToV0Props({
      timelineEntries: [
        {
          id: "entry-1",
          kind: "journal",
          title: "Journal note",
          body: "Reflection",
          chip: "Journal",
          occurredAt: "2026-06-24T10:00:00.000Z",
          href: "/journal/journal-1",
          lane: "sessions_activity",
          selectableObjectType: null,
          selectableObjectId: null,
        },
      ],
      modelLayers: [
        {
          id: "mu-1",
          updateTypeLabel: "Pattern shift",
          affectedObjectTypeLabel: "Pattern",
          userFacingSummary: "Updated summary",
          createdAt: "2026-06-24T11:00:00.000Z",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "pc-1",
          affectedObjectHref: "/patterns/pc-1",
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
      now: new Date("2026-06-24T12:00:00.000Z"),
    });

    const rows = props.groups.flatMap((group) => group.rows);
    const modelRow = rows.find((row) => row.id === "model-mu-1");
    const journalRow = rows.find((row) => row.id === "activity-entry-1");

    expect(modelRow?.inspectorTarget).toMatchObject({
      objectType: "model_update",
      objectId: "mu-1",
      tab: "movement",
    });
    expect(journalRow?.href).toBe("/journal/journal-1");
    expect(journalRow?.inspectorTarget).toBeNull();

    const openTarget = resolveTimelineOpenTarget(rows, "model-mu-1");
    expect(openTarget?.objectType).toBe("model_update");
  });

  it("mapTimelineDataToV0Props groups stream rows with honest empty copy", () => {
    const props = mapTimelineDataToV0Props({
      timelineEntries: [],
      modelLayers: [],
      semanticFilter: "all",
      searchQuery: "",
      isLoadingActivity: false,
      isLoadingModelLayers: false,
      isLoadingSemantic: false,
      activityError: null,
      modelLayerError: null,
      selectedObjectId: null,
    });

    expect(props.groups).toEqual([]);
    expect(props.filters.length).toBeGreaterThan(0);
    expect(props.lanes).toHaveLength(4);
    expect(props.emptyCopy).toContain("No published evolution");
  });
});
