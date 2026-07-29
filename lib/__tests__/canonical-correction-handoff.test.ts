/**
 * Phase 6 — canonical correction handoff honesty (no authority mutation).
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildCanonicalCorrectionHandoffFromProductConcept,
  buildCanonicalCorrectionExploreHref,
  CANONICAL_CORRECTION_HANDOFF_VERSION,
  CANONICAL_CORRECTION_INTENT,
  parseCanonicalCorrectionHandoff,
  tryBuildCanonicalCorrectionHandoffFromOrvekObject,
} from "../canonical-correction-handoff";
import { resolveCorrectionWriteTarget } from "../durable-user-actions-contract";
import type { CanonicalProductConceptV1 } from "../canonical-model-product-projection";
import type { OrvekObject } from "../orvek-v0/orvek-types";

function sampleProductConcept(): CanonicalProductConceptV1 {
  return {
    conceptId: "concept_abc",
    currentRevisionId: "rev_2",
    version: 2,
    title: "Recovery boundary",
    summary: "REVISION TWO",
  } as CanonicalProductConceptV1;
}

describe("canonical correction handoff", () => {
  it("1-2. uses stable conceptId and exact currentRevisionId", () => {
    const handoff = buildCanonicalCorrectionHandoffFromProductConcept(
      sampleProductConcept(),
    );
    expect(handoff.handoffVersion).toBe(CANONICAL_CORRECTION_HANDOFF_VERSION);
    expect(handoff.intent).toBe(CANONICAL_CORRECTION_INTENT);
    expect(handoff.conceptId).toBe("concept_abc");
    expect(handoff.currentRevisionId).toBe("rev_2");
    expect(handoff.version).toBe(2);
    expect(handoff.currentSummary).toBe("REVISION TWO");
  });

  it("3. handoff construction performs no write (pure function)", () => {
    const spy = vi.fn();
    const handoff = buildCanonicalCorrectionHandoffFromProductConcept(
      sampleProductConcept(),
    );
    expect(handoff.conceptId).toBe("concept_abc");
    expect(spy).not.toHaveBeenCalled();
  });

  it("Explore href exposes conceptId only — no summary in query", () => {
    const href = buildCanonicalCorrectionExploreHref("concept_abc");
    expect(href).toBe("/explore?canonicalCorrection=concept_abc");
    expect(href).not.toContain("REVISION");
    expect(href).not.toContain("rev_2");
  });

  it("4. canonical correction never resolves legacy UMC write target", () => {
    const object: OrvekObject = {
      id: "concept_abc",
      type: "map-object",
      title: "Recovery boundary",
      summary: "REVISION TWO",
      inspectorObjectType: "canonical_concept",
      inspectorObjectId: "concept_abc",
      currentRevisionId: "rev_2",
      canonicalVersion: 2,
    };
    expect(resolveCorrectionWriteTarget(object)).toBeNull();
  });

  it("OrvekObject handoff builder retains revision identity", () => {
    const handoff = tryBuildCanonicalCorrectionHandoffFromOrvekObject({
      id: "concept_abc",
      title: "Recovery boundary",
      summary: "REVISION TWO",
      inspectorObjectType: "canonical_concept",
      inspectorObjectId: "concept_abc",
      currentRevisionId: "rev_2",
      canonicalVersion: 2,
    });
    expect(handoff).toEqual({
      handoffVersion: CANONICAL_CORRECTION_HANDOFF_VERSION,
      intent: CANONICAL_CORRECTION_INTENT,
      conceptId: "concept_abc",
      currentRevisionId: "rev_2",
      version: 2,
      title: "Recovery boundary",
      currentSummary: "REVISION TWO",
    });
  });

  it("rejects incomplete handoff payloads", () => {
    expect(
      parseCanonicalCorrectionHandoff({
        handoffVersion: CANONICAL_CORRECTION_HANDOFF_VERSION,
        intent: CANONICAL_CORRECTION_INTENT,
        conceptId: "x",
      }),
    ).toBeNull();
  });

  it("5. no in-memory success path for canonical via UMC write resolver", () => {
    const object: OrvekObject = {
      id: "map-concept",
      type: "map-object",
      title: "T",
      summary: "S",
      inspectorObjectType: "canonical_concept",
      inspectorObjectId: "concept_abc",
    };
    expect(resolveCorrectionWriteTarget(object)).toBeNull();
  });

  it("handoff module itself contains no browser-storage implementation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "../canonical-correction-handoff.ts"),
      "utf8",
    );
    expect(src).not.toContain("window");
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("storeCanonicalCorrectionHandoff");
    expect(src).not.toContain("readCanonicalCorrectionHandoff");
    expect(src).not.toContain("clearCanonicalCorrectionHandoff");
    expect(src).not.toContain("CANONICAL_CORRECTION_HANDOFF_STORAGE_KEY");
    expect(src).not.toContain("CANONICAL_CORRECTION_HANDOFF_EVENT");
  });
});
