import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import { hasLiveTodayPresentation } from "../orvek-v0/production/today-presentation";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { REFERENCE_WEEKLY_REPORT_ID } from "../orvek-v0/production/today-movement-report-parity";
import type { TodayReentrySnapshot } from "../today-reentry";
import { mapTodayDataToV0Props } from "../orvek-adapters/today";

const RUNTIME_MODEL_UPDATE_ID = "mu-completion-ready-001";

const READY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [
    {
      id: RUNTIME_MODEL_UPDATE_ID,
      updateTypeLabel: "Pattern shift",
      affectedObjectTypeLabel: "Pattern",
      userFacingSummary: "Headline movement summary",
      createdAt: "2026-07-14T10:00:00.000Z",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-1",
      affectedObjectHref: "/patterns/pc-1",
    },
  ],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const READY_DEPTH = {
  [RUNTIME_MODEL_UPDATE_ID]: {
    id: RUNTIME_MODEL_UPDATE_ID,
    before: "Previously tentative.",
    after: "Now supported by receipts.",
    movementSummary: "Headline movement summary",
    movementRationale: "Receipts align across two weeks; scope reopened.",
    affectedObjectType: "pattern_claim" as const,
    affectedObjectId: "pc-1",
    createdAt: "2026-07-14T10:00:00.000Z",
    evidenceLinkCount: 1,
    evidenceQuotes: ["I keep working past the stop point."],
  },
};

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("movement report completion — production identity", () => {
  it("stamps the live report id into the weekly continuation action", () => {
    const props = mapTodayDataToV0Props({
      snapshot: READY_SNAPSHOT,
      movementDepthById: READY_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    const continueAction = props.primaryActions.find(
      (action) => action.label === "Continue from what changed",
    );

    expect(continueAction?.reportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(props.report?.reportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(props.report?.reportId).not.toBe(REFERENCE_WEEKLY_REPORT_ID);
  });

  it("merges live Today presentation onto hybrid without displayContract", () => {
    const todayApi = buildTodayProductionDataApi({
      snapshot: READY_SNAPSHOT,
      movementDepthById: READY_DEPTH,
      isLoading: false,
      briefingDate: "Tuesday",
    });
    const hybrid = buildHybridWorkbenchDataApi(createMockOrvekDataApi(), todayApi);

    expect(hybrid.displayContract).toBeUndefined();
    expect(hasLiveTodayPresentation(hybrid)).toBe(true);
    expect(hybrid.today?.report?.reportId).toBe(RUNTIME_MODEL_UPDATE_ID);
    expect(hybrid.getObject(RUNTIME_MODEL_UPDATE_ID)?.canonicalReportId).toBe(
      RUNTIME_MODEL_UPDATE_ID,
    );
    expect(hybrid.getObject(REFERENCE_WEEKLY_REPORT_ID)?.type).toBe("report");
  });

  it("production Today path uses live presentation helper and labels reference control", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const adapter = readSource("lib/orvek-adapters/today.ts");
    const overlay = readSource("components/orvek-v0/overlays.tsx");

    expect(todayPage).toContain("hasLiveTodayPresentation");
    expect(todayPage).toContain("REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL");
    expect(todayPage).toContain('openReport("rep-weekly")');
    expect(adapter).not.toContain('reportId: "rep-weekly"');
    expect(overlay).toContain("useOrvekObjectGraph");
    expect(overlay).toContain("report-overlay-provenance");
    expect(overlay).toContain("reportOverlayProvenanceLabel");
    expect(overlay).toContain("resolveReportOverlayProvenance");
  });
});
