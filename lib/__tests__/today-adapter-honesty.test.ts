import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  normalizeTodayAffordancesForParity,
  shouldExposeEvidencePointerAffordance,
  shouldExposeLiveReport,
  shouldExposeSeeWhyMoved,
  withTodayAdapterHonesty,
} from "../orvek-v0/production/today-adapter-honesty";
import {
  canUseLiveTodayEvidencePointerList,
} from "../orvek-v0/production/today-evidence-pointer-parity";
import { REFERENCE_WEEKLY_REPORT_ID } from "../orvek-v0/production/today-movement-report-parity";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { TodayReentrySnapshot } from "../today-reentry";

const MOVEMENT_SNAPSHOT: TodayReentrySnapshot = {
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

describe("live Today adapter honesty", () => {
  it("withholds showSeeWhyMoved when movement id lacks before/after", () => {
    const api = buildTodayProductionDataApi({
      snapshot: MOVEMENT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    const raw = mapTodayDataToV0Props({
      snapshot: MOVEMENT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(raw.hero?.showSeeWhyMoved).toBe(true);
    expect(api.today?.hero?.showSeeWhyMoved).toBe(false);
    expect(shouldExposeSeeWhyMoved(api, api.today?.hero?.movementId)).toBe(false);
  });

  it("exposes showSeeWhyMoved only when movement has a parity-safe delta", () => {
    const base = buildTodayProductionDataApi({
      snapshot: MOVEMENT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const api = {
      ...base,
      getObject: (id?: string | null) => {
        if (id === "iu-1") {
          return {
            id: "iu-1",
            type: "model-update" as const,
            title: "Recorded movement",
            before: "Earlier understanding",
            after: "Updated understanding",
          };
        }
        return base.getObject(id);
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };
    const honest = withTodayAdapterHonesty(api);

    expect(shouldExposeSeeWhyMoved(honest, "iu-1", "iu-1")).toBe(true);
    expect(honest.today?.hero?.showSeeWhyMoved).toBe(true);
  });

  it("withholds live report affordance when only reference reportId is present", () => {
    const api = buildTodayProductionDataApi({
      snapshot: MOVEMENT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(shouldExposeLiveReport(api, REFERENCE_WEEKLY_REPORT_ID)).toBe(false);
    expect(api.today?.report).toBeNull();
    expect(
      api.today?.primaryActions.find((action) => action.label === "Continue from what changed")
        ?.reportId,
    ).toBeUndefined();
  });

  it("exposes safe live report metadata when an openable report object exists", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: [],
      today: mapTodayDataToV0Props({
        snapshot: MOVEMENT_SNAPSHOT,
        isLoading: false,
        briefingDate: "Tuesday · 24 June",
      }),
      getObject: (id?: string | null) => {
        if (id === "rep-live-weekly") {
          return {
            id: "rep-live-weekly",
            type: "report" as const,
            title: "Weekly Model Movement",
            reportSummary: "3 loops, 2 decisions, 1 context update.",
            summary: "Your model shifted around launch pressure.",
            period: "This week",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    const normalized = normalizeTodayAffordancesForParity(
      {
        ...api.today!,
        report: {
          ...api.today!.report!,
          reportId: "rep-live-weekly",
        },
      },
      api,
    );

    expect(shouldExposeLiveReport(api, "rep-live-weekly")).toBe(true);
    expect(normalized.report?.reportId).toBe("rep-live-weekly");
    expect(normalized.report?.fullReportAvailable).toBe(true);
  });

  it("does not expose evidence pointer affordance when receipts are not inspectable", () => {
    const lookup: OrvekDataApi = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-empty", "receipt-no-provenance"],
      today: {
        briefingDate: "Tuesday · 24 June",
        briefingTitle: "Current state",
        briefingMeta: "Meta",
        isLoading: false,
        loadingCopy: "Loading",
        heroEmptyCopy: "Empty",
        hero: {
          kicker: "State",
          title: "Lead",
          summary: "Summary",
          whyItMatters: null,
          whatChanged: "Delta",
          linkedReceipts: "2 receipts",
          lastEvidence: "Today",
          primaryAction: null,
          showSeeWhyMoved: false,
          inspectSelectId: "lead-1",
          movementId: null,
        },
        primaryActions: [],
        nowRows: [],
        nowEmptyCopy: "Empty",
        movements: [],
        movementEmptyCopy: "Empty",
        priorReadEmptyCopy: "Empty",
        report: null,
        receipts: [
          {
            id: "receipt-empty",
            quote: " ",
            meta: "Journal · Today",
            href: "#",
          },
          {
            id: "receipt-no-provenance",
            quote: "Some capture text.",
            meta: "Receipt",
            href: "#",
          },
        ],
        checkIns: [],
      },
      getObject: (id?: string | null) => {
        if (id === "receipt-empty") {
          return {
            id: "receipt-empty",
            type: "receipt" as const,
            title: " ",
            sourceText: " ",
            sourceOrigin: "Journal",
            date: "Today",
          };
        }
        if (id === "receipt-no-provenance") {
          return {
            id: "receipt-no-provenance",
            type: "receipt" as const,
            title: "Some capture text.",
            sourceText: "Some capture text.",
            sourceOrigin: "Receipt",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => lookup.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };
    const api = withTodayAdapterHonesty(lookup);

    expect(shouldExposeEvidencePointerAffordance(api)).toBe(false);
    expect(api.todayResurfacedIds).toEqual([]);
    expect(api.today?.hero?.linkedReceipts).toBe("—");
    expect(canUseLiveTodayEvidencePointerList(api, api.todayResurfacedIds)).toBe(false);
  });

  it("exposes safe evidence pointer metadata for parity-safe receipts", () => {
    const api = buildTodayProductionDataApi({
      snapshot: {
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
        intelligenceUpdates: [],
        userMapConclusions: [],
        watchForItems: [],
        investigations: [],
        actions: [],
        timelineMovements: [],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(shouldExposeEvidencePointerAffordance(api)).toBe(true);
    expect(api.todayResurfacedIds?.length).toBe(1);
    expect(api.today?.receipts).toHaveLength(1);
  });

  it("keeps hybrid root from overlaying incomplete live Today view props", () => {
    const hybridSource = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: MOVEMENT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);

    expect(hybridSource).toContain("liveTodayReady");
    expect(hybridSource).not.toMatch(/displayContract:\s*["']production["']/);
    expect(hybridApi.today).toBeUndefined();
    expect(productionTodayApi.today?.hero?.showSeeWhyMoved).toBe(false);
  });

  it("preserves reference Today UI and avoids global production displayContract", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(todayPage).toContain("isProductionDisplay(data)");
    expect(todayPage).toContain("hasLiveTodayPresentation");
    expect(todayPage).not.toContain("isTodayLiveReady");
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
  });
});
