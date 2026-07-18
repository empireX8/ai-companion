import { describe, expect, it } from "vitest";

import { enrichmentFromInspectorInvestigationDetail } from "../../lib/orvek-v0/production/investigations-presentation";

describe("enrichmentFromInspectorInvestigationDetail", () => {
  it("maps detail API fields into typed enrichment without inventing copy", () => {
    const mapped = enrichmentFromInspectorInvestigationDetail({
      competingTheories: ["Theory A", ""],
      evidenceNeeded: ["Need B"],
      linkedEvidence: [
        { evidenceId: "ev-1", excerpt: "  Quoted receipt text  " },
      ],
      linkedFieldwork: [
        { id: "fw-1", prompt: "Watch signal", reason: "Confirm stop point" },
      ],
      resolvedConclusionId: null,
    });

    expect(mapped.enrichment.hypotheses).toEqual(["Theory A"]);
    expect(mapped.enrichment.missingEvidence).toEqual(["Need B"]);
    expect(mapped.enrichment.receiptIds).toEqual(["ev-1"]);
    expect(mapped.enrichment.relatedIds).toEqual(["fw-1"]);
    expect(mapped.enrichment.evidenceCount).toBe(1);
    expect(mapped.linkedObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ev-1", type: "receipt" }),
        expect.objectContaining({ id: "fw-1", type: "fieldwork" }),
      ]),
    );
  });
});
