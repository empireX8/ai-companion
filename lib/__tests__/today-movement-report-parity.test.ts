import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  canUseLiveTodayEvidencePointerList,
  getInspectableEvidencePointers,
} from "../orvek-v0/production/today-evidence-pointer-parity";
import {
  buildParitySafeMovementObjects,
  buildParitySafeReportObjects,
  canUseLiveTodayReport,
  canUseLiveTodaySeeWhyMoved,
  hasOpenableReportObject,
  hasRecordedBeforeAfterMovement,
  isReferenceReportSlotWithoutLiveObject,
  mustNotSubstituteGlobalMovementForSelectedObject,
  REFERENCE_WEEKLY_REPORT_ID,
  resolveLiveMovementTarget,
  resolveLiveReportTarget,
  resolveSelectedObjectMovementTarget,
} from "../orvek-v0/production/today-movement-report-parity";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import {
  resolveOrvekObjectFromGraph,
} from "../orvek-v0/data-provider";
import type { TodayReentrySnapshot } from "../today-reentry";

const MOVEMENT_WITHOUT_RECORD_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [
    {
      id: "iu-1",
      updateTypeLabel: "Conclusion Added",
      affectedObjectType: "pattern_claim",
      affectedObjectTypeLabel: "Related map item",
      affectedObjectId: "pc-1",
      affectedObjectHref: "/patterns/pattern-1",
      userFacingSummary: "Evening stress pattern strengthened.",
      createdAt: "2026-06-20T10:00:00.000Z",
    },
  ],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function movementApi(overrides: Partial<ReturnType<typeof buildTodayProductionDataApi>> = {}) {
  return {
    ...buildTodayProductionDataApi({
      snapshot: MOVEMENT_WITHOUT_RECORD_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    }),
    ...overrides,
  };
}

describe("live Today movement/report parity", () => {
  it("accepts live movement targets with explicit before and after", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      today: {
        hero: { movementId: "live-mu-1", showSeeWhyMoved: true },
      } as never,
      getObject: (id?: string | null) => {
        if (id === "live-mu-1") {
          return {
            id: "live-mu-1",
            type: "model-update" as const,
            title: "Scope pressure increased",
            before: "Pressure treated as isolated.",
            after: "Pressure linked to scope reopening.",
            lastUpdated: "2 hours ago",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(hasRecordedBeforeAfterMovement(api.getObject("live-mu-1"))).toBe(true);
    expect(canUseLiveTodaySeeWhyMoved(api, "live-mu-1")).toBe(true);
    expect(resolveLiveMovementTarget(api, "live-mu-1")).toEqual({
      objectId: "live-mu-1",
      inspectorTab: "movement",
      before: "Pressure treated as isolated.",
      after: "Pressure linked to scope reopening.",
      provenanceLabel: "2 hours ago",
    });
    expect(buildParitySafeMovementObjects(api).has("live-mu-1")).toBe(true);
  });

  it("blocks See why it moved when live movement lacks before/after", () => {
    const api = movementApi();

    expect(canUseLiveTodaySeeWhyMoved(api, "iu-1")).toBe(false);
    expect(resolveLiveMovementTarget(api, "iu-1")).toBeNull();
    expect(buildParitySafeMovementObjects(api).has("iu-1")).toBe(false);
  });

  it("does not treat a movement id alone as parity-safe", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      getObject: (id?: string | null) => {
        if (id === "iu-1") {
          return {
            id: "iu-1",
            type: "model-update" as const,
            title: "Conclusion Added · Related map item",
            summary: "Evening stress pattern strengthened.",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(canUseLiveTodaySeeWhyMoved(api, "iu-1")).toBe(false);
  });

  it("does not substitute global recent movement for selected-object movement", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      getObject: (id?: string | null) => {
        if (id === "d1") {
          return { id: "d1", type: "decision" as const, title: "Review decision" };
        }
        if (id === "mu-1") {
          return {
            id: "mu-1",
            type: "model-update" as const,
            title: "Global recent movement",
            before: "Before read",
            after: "After read",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(resolveSelectedObjectMovementTarget(api, "d1")).toBeNull();
    expect(
      mustNotSubstituteGlobalMovementForSelectedObject(api, "d1", ["mu-1"]),
    ).toBe(false);
    expect(canUseLiveTodaySeeWhyMoved(api, "mu-1")).toBe(true);
  });

  it("resolves parity-safe movement through hybrid getObject with movement inspector tab", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = {
      ...movementApi(),
      getObject: (id?: string | null) => {
        if (id === "iu-1") {
          return {
            id: "iu-1",
            type: "model-update" as const,
            title: "Recorded movement",
            before: "Earlier understanding",
            after: "Updated understanding",
            lastUpdated: "Today",
          };
        }
        return movementApi().getObject(id);
      },
    };
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(resolveLiveMovementTarget(productionTodayApi, "iu-1")?.inspectorTab).toBe(
      "movement",
    );
    expect(hasRecordedBeforeAfterMovement(hybridApi.getObject("iu-1"))).toBe(true);
    expect(resolveOrvekObjectFromGraph(hybridApi, "iu-1")?.after).toBe(
      "Updated understanding",
    );
    expect(hasRecordedBeforeAfterMovement(hybridApi.getObject("mu-1"))).toBe(true);
  });

  it("accepts live report objects with meaningful contents", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      today: {
        report: { reportId: "rep-live-weekly", title: "Weekly Model Movement" },
      } as never,
      getObject: (id?: string | null) => {
        if (id === "rep-live-weekly") {
          return {
            id: "rep-live-weekly",
            type: "report" as const,
            title: "Weekly Model Movement",
            reportType: "Weekly Report",
            period: "This week",
            reportSummary: "3 loops, 2 decisions, 1 context update.",
            summary: "Your model shifted around launch pressure.",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(canUseLiveTodayReport(api, "rep-live-weekly")).toBe(true);
    expect(resolveLiveReportTarget(api, "rep-live-weekly")).toEqual({
      reportId: "rep-live-weekly",
      openable: true,
      title: "Weekly Model Movement",
      provenanceLabel: "This week",
    });
    expect(buildParitySafeReportObjects(api).has("rep-live-weekly")).toBe(true);
  });

  it("blocks report slot/id without an openable live report object", () => {
    const api = buildTodayProductionDataApi({
      snapshot: MOVEMENT_WITHOUT_RECORD_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(api.today?.report).toBeNull();
    expect(hasOpenableReportObject(api, REFERENCE_WEEKLY_REPORT_ID)).toBe(false);
    expect(isReferenceReportSlotWithoutLiveObject(api, REFERENCE_WEEKLY_REPORT_ID)).toBe(
      true,
    );
    expect(canUseLiveTodayReport(api, REFERENCE_WEEKLY_REPORT_ID)).toBe(false);
    expect(resolveLiveReportTarget(api, REFERENCE_WEEKLY_REPORT_ID)).toBeNull();
    expect(buildParitySafeReportObjects(api).size).toBe(0);
  });

  it("keeps reference sample report control isolated and avoids global production displayContract", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const hybridSource = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(todayPage).toContain("isProductionDisplay(data)");
    expect(todayPage).toContain("hasLiveTodayPresentation");
    expect(todayPage).toContain('openReport("rep-weekly")');
    expect(todayPage).toContain("REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL");
    expect(hybridSource).not.toMatch(/displayContract:\s*["']production["']/);
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("leaves evidence pointer parity from PR #105 unaffected", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-ok"],
      getObject: (id?: string | null) => {
        if (id === "receipt-ok") {
          return {
            id: "receipt-ok",
            type: "receipt" as const,
            title: "Grounded capture.",
            sourceText: "Grounded capture.",
            sourceOrigin: "Pattern",
            date: "recently",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(canUseLiveTodayEvidencePointerList(api, ["receipt-ok"])).toBe(true);
    expect(getInspectableEvidencePointers(api)[0]?.inspectorTab).toBe("evidence");
    expect(canUseLiveTodaySeeWhyMoved(api, "receipt-ok")).toBe(false);
  });
});
