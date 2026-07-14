import { describe, expect, it } from "vitest";

import {
  LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL,
  REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL,
  isReferenceReportObjectId,
  reportOverlayProvenanceLabel,
  resolveReportOverlayProvenance,
} from "../model-movement-report-provenance";
import { buildMovementReportOrvekObject } from "../model-movement-report-contract";
import { REFERENCE_WEEKLY_REPORT_ID } from "../orvek-v0/production/today-movement-report-parity";

describe("model movement report provenance", () => {
  it("labels live ModelUpdate report objects explicitly", () => {
    const live = buildMovementReportOrvekObject({
      id: "mu-live-ready-001",
      before: "Before belief.",
      after: "After belief.",
      movementSummary: "Headline movement",
      movementRationale: "Distinct rationale from receipts across two weeks.",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-1",
      createdAt: "2026-07-14T10:00:00.000Z",
      evidenceLinkCount: 1,
      evidenceQuotes: ["I keep working past the stop point."],
    });

    expect(live?.reportProvenance).toBe("live_model_update");
    expect(resolveReportOverlayProvenance(live ?? undefined)).toBe("live_model_update");
    expect(reportOverlayProvenanceLabel("live_model_update")).toBe(
      LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL,
    );
  });

  it("labels zip/reference report objects as reference sample", () => {
    const reference = {
      id: REFERENCE_WEEKLY_REPORT_ID,
      type: "report" as const,
      title: "Weekly Model Movement",
      reportType: "Weekly Report",
      summary: "Sample zip report",
    };

    expect(isReferenceReportObjectId(REFERENCE_WEEKLY_REPORT_ID)).toBe(true);
    expect(resolveReportOverlayProvenance(reference)).toBe("reference_sample");
    expect(reportOverlayProvenanceLabel("reference_sample")).toBe(
      REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL,
    );
  });

  it("never treats rep-* ids as live ModelUpdate identity", () => {
    expect(isReferenceReportObjectId("rep-changed")).toBe(true);
    expect(
      resolveReportOverlayProvenance({
        id: "rep-changed",
        type: "report",
        title: "What Changed",
      }),
    ).toBe("reference_sample");
  });
});
