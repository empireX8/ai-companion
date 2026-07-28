import { describe, expect, it } from "vitest";

import { resolveCanonicalConceptInspectorLoadState } from "../canonical-concept-inspector-load-state";
import type { CanonicalProductConceptV1 } from "../canonical-model-product-projection";

function sampleReadyConcept(): CanonicalProductConceptV1 {
  return {
    authorityType: "canonical_concept_revision",
    conceptId: "c1",
    currentRevisionId: "r2",
    version: 2,
    domain: "operating_logic",
    title: "Title",
    summary: "Summary",
    status: "emerging",
    confidenceScore: 0.5,
    confidenceLevel: "medium",
    evidenceCount: 1,
    rationale: null,
    acceptedAt: "2026-07-28T12:00:00.000Z",
    legacySeed: { objectType: "usermap_conclusion", objectId: "umc1" },
    evidence: [],
    revisionHistory: [],
    movementHistory: [],
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: [],
    },
  };
}

describe("CanonicalConceptInspectorPanel load states", () => {
  it("loading while fetch is pending", () => {
    expect(
      resolveCanonicalConceptInspectorLoadState({
        conceptId: "c1",
        fetchResult: "pending",
      }),
    ).toEqual({ loadState: "loading", concept: null });
  });

  it("ready when a concept payload returns", () => {
    const concept = sampleReadyConcept();
    expect(
      resolveCanonicalConceptInspectorLoadState({
        conceptId: "c1",
        fetchResult: concept,
      }),
    ).toEqual({ loadState: "ready", concept });
  });

  it("missing on 404/null", () => {
    expect(
      resolveCanonicalConceptInspectorLoadState({
        conceptId: "c1",
        fetchResult: null,
      }),
    ).toEqual({ loadState: "missing", concept: null });
  });

  it("unavailable on 500/unavailable before missing", () => {
    expect(
      resolveCanonicalConceptInspectorLoadState({
        conceptId: "c1",
        fetchResult: "unavailable",
      }),
    ).toEqual({ loadState: "unavailable", concept: null });
  });

  it("network rejection resolves to unavailable", () => {
    expect(
      resolveCanonicalConceptInspectorLoadState({
        conceptId: "c1",
        fetchResult: "rejected",
      }),
    ).toEqual({ loadState: "unavailable", concept: null });
  });
});
