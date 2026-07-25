import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import type { MapMapDataInput } from "../orvek-adapters/map";
import type { MapTimelineDataInput } from "../orvek-adapters/timeline";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { buildDecisionsProductionDataApi } from "../orvek-v0/production/decisions-api";
import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "../orvek-v0/production/timeline-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  allowsCompositionWorkbenchAuthority,
  isCompositionWorkbenchApi,
} from "../orvek-v0/production/workbench-authority";
import {
  buildExactFixtureIdMap,
  buildExactRoundTripCompositionPayload,
} from "../exact-fixture-round-trip-seed";
import type { TodayReentrySnapshot } from "../today-reentry";

const ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

function compositionTodayApi(userId = "user_live_authority") {
  const fixtureIdMap = buildExactFixtureIdMap(userId);
  const reportId = fixtureIdMap["rep-weekly"]!;
  const composition = buildExactRoundTripCompositionPayload({
    userId,
    fixtureIdMap,
    reportId,
    includeWorkbench: true,
  });
  const report = {
    id: reportId,
    userId,
    reportType: "Weekly Report",
    title: "Weekly Model Movement report",
    status: "Ready",
    meta: "Ready · 3 loops, 2 decisions, 1 context update",
    period: "This week",
    sections: [{ id: "sec-summary", heading: "Summary", body: "body" }],
    relatedMovementIds: composition.movements.map((m) => m.id),
    relatedReceiptIds: composition.resurfacedObjectIds,
    generatedAt: "2026-07-14T12:00:00.000Z",
  };
  return {
    composition,
    todayApi: buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "ignored",
      canonicalWorkbench: { composition, report },
    }),
  };
}

const LIVE_MAP_INPUT: MapMapDataInput = {
  items: [
    {
      id: "live-umc-1",
      title: "Live owned conclusion",
      summary: "Genuine live map row",
      area: "operating_logic",
      status: "supported",
      confidenceLevel: "medium",
      evidenceCount: 2,
      updatedAt: "2026-07-20T10:00:00.000Z",
    },
  ],
  isLoading: false,
  loadError: null,
  selectedId: "live-umc-1",
  detail: {
    id: "live-umc-1",
    title: "Live owned conclusion",
    summary: "Genuine live map row",
    area: "operating_logic",
    status: "supported",
    confidenceLevel: "medium",
    evidenceCount: 2,
    updatedAt: "2026-07-20T10:00:00.000Z",
    sourceDiversity: 1,
    timeSpreadDays: 3,
    createdAt: "2026-07-18T10:00:00.000Z",
  },
  isDetailLoading: false,
  evidence: [],
  openQuestionsCount: 1,
  mindContext: {
    isLoading: false,
    items: [],
    summaryCounts: { memories: 0, patterns: 0 },
  },
  movementPreview: { isLoading: false, items: [] },
  openQuestionsPreview: { isLoading: false, items: [] },
};

const LIVE_TIMELINE_INPUT: MapTimelineDataInput = {
  timelineEntries: [
    {
      id: "journal-live-1",
      occurredAt: "2026-07-20T09:00:00.000Z",
      chip: "Journal",
      title: "Live journal",
      body: "Owned entry",
      href: "/library/journal-journal-live-1",
      kind: "journal",
      lane: "receipts_activity",
      sourceLabel: "Journal",
    },
  ],
  modelLayers: [],
  semanticFilter: "all",
  searchQuery: "",
  isLoadingActivity: false,
  isLoadingModelLayers: false,
  isLoadingSemantic: false,
  activityError: null,
  modelLayerError: null,
  selectedObjectId: null,
  now: new Date("2026-07-20T12:00:00.000Z"),
};

const LIVE_ACTION: SurfacedActionView = {
  id: "sa-live-1",
  title: "Live action",
  whySuggested: "Owned SurfacedAction",
  bucket: "stabilize",
  effort: "Low",
  linkedFamily: null,
  linkedFamilyLabel: null,
  linkedClaimId: null,
  linkedClaimSummary: null,
  linkedGoalId: null,
  linkedGoalStatement: null,
  linkedSourceLabel: "Pattern",
  status: "not_started",
  note: null,
  surfacedAt: "2026-07-20T11:00:00.000Z",
  updatedAt: "2026-07-20T11:00:00.000Z",
};

describe("DEL-003 live provider authority precedence", () => {
  it("production default: live Map/Timeline/Decisions win over composition densograph", () => {
    const { todayApi, composition } = compositionTodayApi();
    expect(isCompositionWorkbenchApi(todayApi)).toBe(true);

    const liveMap = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const liveTimeline = buildTimelineProductionDataApi(LIVE_TIMELINE_INPUT);
    const liveDecisions = buildDecisionsProductionDataApi([LIVE_ACTION]);

    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayApi,
      liveMap,
      liveTimeline,
      liveDecisions,
    );

    expect(
      hybrid.mapCategories?.some(
        (c) =>
          c.ids.includes("conclusion-live-umc-1") || c.ids.includes("live-umc-1"),
      ),
    ).toBe(true);

    const compositionGoalIds =
      composition.workbench?.mapCategories.find((c) => c.id === "goals")?.ids ?? [];
    for (const id of compositionGoalIds) {
      if (id.startsWith("m-goal-")) {
        expect(
          hybrid.mapCategories?.find((c) => c.id === "goals")?.ids ?? [],
        ).not.toContain(id);
      }
    }
    expect(hybrid.getObject(LIVE_ACTION.id)?.canonicalSourceType).toBe(
      "SurfacedAction",
    );
    expect(hybrid.decisionListGroups.some((g) => g.ids.includes(LIVE_ACTION.id))).toBe(
      true,
    );
    expect(
      hybrid.timelineGroups?.some((g) =>
        g.ids.some((id) => id.includes("journal-live-1")),
      ),
    ).toBe(true);
  });

  it("explicit composition authority mode still allows reference densograph rails", () => {
    const { todayApi, composition } = compositionTodayApi("user_ref_mode");
    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayApi,
      buildMapProductionDataApi(LIVE_MAP_INPUT),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { allowCompositionWorkbenchAuthority: true },
    );

    const compositionGoalIds =
      composition.workbench?.mapCategories.find((c) => c.id === "goals")?.ids ?? [];
    expect(compositionGoalIds.length).toBeGreaterThan(0);
    expect(hybrid.mapCategories?.find((c) => c.id === "goals")?.ids).toEqual(
      compositionGoalIds,
    );
  });

  it("production with composition but no live Map keeps honest empty rather than fixture rails", () => {
    const { todayApi } = compositionTodayApi("user_empty_live");
    const emptyLiveMap = buildMapProductionDataApi({
      ...LIVE_MAP_INPUT,
      items: [],
      selectedId: null,
      detail: null,
      openQuestionsCount: 0,
    });

    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayApi,
      emptyLiveMap,
    );

    expect(hybrid.mapHasContent).toBe(false);
    expect(
      (hybrid.mapCategories ?? []).every((category) => category.ids.length === 0),
    ).toBe(true);
    expect(hybrid.mapHeader?.receiptsLabel).not.toBe("243");
  });

  it("allowsCompositionWorkbenchAuthority only on explicit live-candidate path", () => {
    expect(allowsCompositionWorkbenchAuthority("/")).toBe(false);
    expect(allowsCompositionWorkbenchAuthority("/your-map")).toBe(false);
    expect(allowsCompositionWorkbenchAuthority("/explore")).toBe(false);
    expect(allowsCompositionWorkbenchAuthority("/dev/orvek-v0-canonical-reference")).toBe(
      false,
    );
    expect(allowsCompositionWorkbenchAuthority("/dev/orvek-v0-canonical-live")).toBe(true);
    expect(
      allowsCompositionWorkbenchAuthority(
        "/dev/orvek-v0-canonical-live/seed-full-reference-round-trip",
      ),
    ).toBe(true);
  });

  it("hook ignores persisted composition unless on composition-authority path", () => {
    const hook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hook).toContain("allowsCompositionWorkbenchAuthority(pathname)");
    expect(hook).toContain("allowCompositionWorkbenchAuthority: allowCompositionAuthority");
    expect(hook).toContain("canonicalWorkbench: authoritativeWorkbench");
  });

  it("import review override remains live over composition", () => {
    const hook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hook).toMatch(/Override any composition\/seed importReview/);
    expect(hook).toContain("importReview");
  });

  it("contradiction-conflict live merge remains after composition ownership path", () => {
    const hybridSource = readSource(
      "lib/orvek-v0/production/hybrid-workbench-api.ts",
    );
    expect(hybridSource).toContain("mergeLiveContradictionConflicts");
    expect(hybridSource).toContain(
      "Narrow conflicts overlay after composition ownership",
    );
  });

  it("refresh identity: live object ids are preserved across hybrid rebuild", () => {
    const liveMap = buildMapProductionDataApi(LIVE_MAP_INPUT);
    const first = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      buildTodayProductionDataApi({
        snapshot: EMPTY_SNAPSHOT,
        isLoading: false,
        briefingDate: "Tuesday",
      }),
      liveMap,
    );
    const second = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      buildTodayProductionDataApi({
        snapshot: EMPTY_SNAPSHOT,
        isLoading: false,
        briefingDate: "Tuesday",
      }),
      liveMap,
    );
    expect(first.mapSelectedId).toBe(second.mapSelectedId);
    expect(first.getObject(first.mapSelectedId!)?.id).toBe(
      second.getObject(second.mapSelectedId!)?.id,
    );
  });
});

describe("DEL-003 shell / navigation freeze source assertions", () => {
  it("does not expose new routes or alter page destinations in this delivery", () => {
    const middleware = readSource("middleware.ts");
    expect(middleware).toContain("/dev/orvek-v0-canonical-live");
    expect(middleware).toContain("/dev/orvek-v0-canonical-reference");

    const history = readSource("lib/orvek-v0/workbench-route-history.ts");
    expect(history).toContain('today: "/"');
    expect(history).toContain('map: "/your-map"');
    expect(history).toContain('decisions: "/actions"');
    expect(history).toContain('timeline: "/timeline"');
    expect(history).toContain('explore: "/explore"');
  });

  it("production hybrid refuses composition authority by default", () => {
    const source = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    expect(source).toContain("allowCompositionWorkbenchAuthority");
    expect(source).toContain(
      "options?.allowCompositionWorkbenchAuthority === true",
    );
  });
});
