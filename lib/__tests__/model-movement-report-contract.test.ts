import { describe, expect, it } from "vitest";

import {
  assessMovementRationale,
  decodeMovementRationaleFromInternalNotes,
  encodeMovementRationaleInInternalNotes,
} from "../model-movement-rationale";
import {
  buildModelMovementDepthIndex,
  resolveCanonicalMovementReportFromDepth,
} from "../model-movement-report-contract";
import { resolveConclusionAddedSnapshotPair } from "../model-movement-snapshot";

describe("model movement rationale", () => {
  it("round-trips rationale in internal notes without clobbering other markers", () => {
    const encoded = encodeMovementRationaleInInternalNotes(
      "candidateLane:internal_only",
      "Evening overwork; missing stop point.",
    );

    expect(decodeMovementRationaleFromInternalNotes(encoded)).toBe(
      "Evening overwork; missing stop point.",
    );
    expect(encoded).toContain("candidateLane:internal_only");
  });

  it("rejects rationale that equals movement summary or evidence text", () => {
    const summaryAssessment = assessMovementRationale({
      rationale: "Pattern strengthened.",
      movementSummary: "Pattern strengthened.",
    });
    expect(summaryAssessment.recorded).toBe(false);
    expect(summaryAssessment.blockers).toContain("rationale_equals_movement_summary");

    const evidenceAssessment = assessMovementRationale({
      rationale: "Exact receipt quote.",
      movementSummary: "Pattern strengthened.",
      evidenceTexts: ["Exact receipt quote."],
    });
    expect(evidenceAssessment.recorded).toBe(false);
    expect(evidenceAssessment.blockers).toContain("rationale_equals_evidence_text");
  });
});

describe("canonical movement report contract", () => {
  it("marks report ready only with before, after, summary, evidence links and rationale", () => {
    const ready = resolveCanonicalMovementReportFromDepth({
      id: "mu-ready",
      before: "Treated as isolated pressure.",
      after: "Linked to scope reopening.",
      movementSummary: "Scope pressure increased.",
      movementRationale: "Three receipts tie reopening to deadline slips.",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-1",
      affectedObjectTypeLabel: "Pattern claim",
      affectedObjectHref: "/patterns/pc-1",
      createdAt: "2026-06-20T10:00:00.000Z",
      evidenceLinkCount: 2,
    });

    expect(ready?.reportReady).toBe(true);
    expect(ready?.reportId).toBe("mu-ready");
    expect(ready?.modelUpdateId).toBe("mu-ready");
    expect(ready?.rationale.recorded).toBe(true);
  });

  it("keeps sparse updates honest when before or evidence is missing", () => {
    const sparse = resolveCanonicalMovementReportFromDepth({
      id: "mu-sparse",
      before: null,
      after: "Updated read only.",
      movementSummary: "Updated read only.",
      movementRationale: null,
      affectedObjectType: "usermap_conclusion",
      affectedObjectId: "c-1",
      createdAt: "2026-06-20T10:00:00.000Z",
      evidenceLinkCount: 0,
    });

    expect(sparse?.reportReady).toBe(false);
    expect(sparse?.blockers).toContain("missing_before_snapshot");
    expect(sparse?.blockers).toContain("missing_evidence_links");
    expect(sparse?.blockers).toContain("missing_rationale");
  });

  it("blocks report readiness when rationale is missing even if snapshots exist", () => {
    const withoutRationale = resolveCanonicalMovementReportFromDepth({
      id: "mu-no-rationale",
      before: "Before",
      after: "After",
      movementSummary: "Changed",
      movementRationale: null,
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-1",
      createdAt: "2026-06-20T10:00:00.000Z",
      evidenceLinkCount: 2,
    });

    expect(withoutRationale?.reportReady).toBe(false);
    expect(withoutRationale?.blockers).toContain("missing_rationale");
  });

  it("indexes depth records by model update id", () => {
    const index = buildModelMovementDepthIndex([
      {
        id: "mu-1",
        before: "A",
        after: "B",
        movementSummary: "Changed",
        movementRationale: "Because",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-1",
        createdAt: "2026-06-20T10:00:00.000Z",
        evidenceLinkCount: 1,
      },
    ]);

    expect(index["mu-1"]?.after).toBe("B");
  });
});

describe("conclusion publish snapshots", () => {
  it("records explicit before/after for newly published conclusions", () => {
    expect(
      resolveConclusionAddedSnapshotPair({
        conclusionTitle: "Evening stop point matters",
        conclusionSummary: "Commitments lock before the body signals a stop.",
      }),
    ).toEqual({
      beforeSummary: "No prior published conclusion on this map item.",
      afterSummary:
        "Evening stop point matters — Commitments lock before the body signals a stop.",
    });
  });
});
