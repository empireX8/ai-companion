import { describe, expect, it } from "vitest";

import {
  assessSurfacedEvidencePointerWrite,
  graphSlotFromUelMeta,
  isGenericSurfacingRationale,
  isAllowedSurfacedPointerId,
  uelMetaWithGraphSlot,
  type SurfacedEvidencePointerLinkWriteInput,
  type SurfacedEvidencePointerWriteInput,
} from "../live-evidence-depth-write-contract";

const BASE_POINTER: SurfacedEvidencePointerWriteInput = {
  id: "receipt-pattern-claim-1",
  userId: "user-1",
  pointerKind: "pattern",
  sourceObjectType: "pattern_claim",
  sourceObjectId: "claim-1",
  sourceText: "I keep working past the stop point even when I said I would not.",
  sourceOrigin: "Recent Pattern",
  surfacedAt: new Date("2026-06-24T10:00:00.000Z"),
  whyItMatters:
    "Connects evening overwork to the missing stop point before commitments lock.",
};

const BASE_LINK: SurfacedEvidencePointerLinkWriteInput = {
  sourceObjectType: "pattern_claim",
  sourceObjectId: "claim-1",
  targetType: "usermap_conclusion",
  targetId: "conclusion-1",
  role: "supports",
  graphSlot: "related",
  publicEligible: true,
  summary: "Supported by three journal captures in the same week.",
};

describe("live evidence depth write contract", () => {
  it("rejects generic surfacing rationale strings", () => {
    expect(isGenericSurfacingRationale("Surfaced from your recent material.")).toBe(
      true,
    );
    expect(isGenericSurfacingRationale("3 evidence receipts in recent material.")).toBe(
      true,
    );
    expect(
      isGenericSurfacingRationale(
        "Connects evening overwork to the missing stop point before commitments lock.",
      ),
    ).toBe(false);
  });

  it("accepts a pointer write with stored whyItMatters and eligible links", () => {
    const assessment = assessSurfacedEvidencePointerWrite(BASE_POINTER, [BASE_LINK]);
    expect(assessment.writeReady).toBe(true);
    expect(assessment.blockers).toEqual([]);
  });

  it("fails when whyItMatters is missing or generic", () => {
    expect(
      assessSurfacedEvidencePointerWrite(
        { ...BASE_POINTER, whyItMatters: "" },
        [BASE_LINK],
      ).blockers,
    ).toContain("missing_why_it_matters");

    expect(
      assessSurfacedEvidencePointerWrite(
        { ...BASE_POINTER, whyItMatters: "Surfaced from your recent material." },
        [BASE_LINK],
      ).blockers,
    ).toContain("generic_why_it_matters");
  });

  it("fails when whyItMatters merely duplicates sourceText", () => {
    const assessment = assessSurfacedEvidencePointerWrite(
      { ...BASE_POINTER, whyItMatters: BASE_POINTER.sourceText },
      [BASE_LINK],
    );
    expect(assessment.blockers).toContain("why_it_matters_equals_source_text");
  });

  it("fails when no public-eligible links are provided", () => {
    const assessment = assessSurfacedEvidencePointerWrite(BASE_POINTER, [
      { ...BASE_LINK, publicEligible: false },
    ]);
    expect(assessment.blockers).toContain("no_eligible_links");
  });

  it("requires stable public receipt namespace pointer ids", () => {
    expect(isAllowedSurfacedPointerId("receipt-pattern-claim-1")).toBe(true);
    expect(isAllowedSurfacedPointerId("receipt-tension-node-1")).toBe(true);
    expect(isAllowedSurfacedPointerId("receipt-0-evening-stress")).toBe(false);
  });

  it("round-trips graphSlot through UEL meta helper", () => {
    const meta = uelMetaWithGraphSlot("context", { source: "surfacing" });
    expect(graphSlotFromUelMeta(meta)).toBe("context");
    expect(graphSlotFromUelMeta({ graphSlot: "related" })).toBe("related");
    expect(graphSlotFromUelMeta(null)).toBeNull();
  });
});
