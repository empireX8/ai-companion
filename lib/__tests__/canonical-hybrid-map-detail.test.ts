/**
 * Phase 5 presentation — hybrid Map canonical detail path.
 */

import { describe, expect, it, vi } from "vitest";

import {
  loadMapDetailForSelectedConclusion,
  mapCanonicalProductConceptToMapDetail,
} from "../canonical-map-detail";
import type { CanonicalProductConceptV1 } from "../canonical-model-product-projection";
import { CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT } from "../canonical-model-client";
import { INSPECTOR_USER_MAP_DETAIL_ENDPOINT } from "../inspector-object-api";
import { mapMapDataToV0Props } from "../orvek-adapters/map";
import { PUBLIC_EVIDENCE_LINKED_LABEL } from "../public-continuity-registry";

function sampleCanonicalConcept(
  overrides?: Partial<CanonicalProductConceptV1>,
): CanonicalProductConceptV1 {
  return {
    authorityType: "canonical_concept_revision",
    conceptId: "concept_1",
    currentRevisionId: "rev2",
    version: 2,
    domain: "operating_logic",
    title: "Canonical title",
    summary: "REVISION TWO",
    status: "emerging",
    confidenceScore: 0.55,
    confidenceLevel: "medium",
    evidenceCount: 2,
    rationale: null,
    acceptedAt: "2026-07-28T12:00:00.000Z",
    legacySeed: { objectType: "usermap_conclusion", objectId: "umc_seed" },
    evidence: [
      {
        id: "ev_public",
        sourceType: "pattern_claim",
        role: "supports",
        summary: PUBLIC_EVIDENCE_LINKED_LABEL,
        disclosure: "public",
        sourceId: "pc1",
        snippet: null,
        quote: null,
        sourceObjectHref: "/patterns/pc1",
      },
      {
        id: "ev_redacted",
        sourceType: "journal_entry",
        role: "supports",
        summary: PUBLIC_EVIDENCE_LINKED_LABEL,
        disclosure: "redacted",
        sourceId: null,
        snippet: null,
        quote: null,
        sourceObjectHref: null,
      },
    ],
    revisionHistory: [],
    movementHistory: [],
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: [],
    },
    ...overrides,
  };
}

describe("hybrid Map canonical detail path", () => {
  it("uses canonical detail endpoint and never legacy UMC detail for canonical selection", async () => {
    const concept = sampleCanonicalConcept();
    const fetchCanonical = vi.fn(async () => concept);
    const fetchLegacyDetail = vi.fn(async () => {
      throw new Error("legacy detail must not be called");
    });
    const fetchLegacyEvidence = vi.fn(async () => {
      throw new Error("legacy evidence must not be called");
    });

    const loaded = await loadMapDetailForSelectedConclusion({
      selectedId: "concept_1",
      items: [
        {
          id: "concept_1",
          title: "Canonical title",
          summary: "REVISION TWO",
          area: "operating_logic",
          status: "emerging",
          confidenceLevel: "medium",
          evidenceCount: 2,
          updatedAt: "2026-07-28T12:00:00.000Z",
          authorityType: "canonical_concept_revision",
          conceptId: "concept_1",
          currentRevisionId: "rev2",
          version: 2,
          domain: "operating_logic",
        },
      ],
      fetchCanonical,
      fetchLegacyDetail,
      fetchLegacyEvidence,
    });

    expect(fetchCanonical).toHaveBeenCalledWith("concept_1");
    expect(fetchLegacyDetail).not.toHaveBeenCalled();
    expect(fetchLegacyEvidence).not.toHaveBeenCalled();
    expect(loaded.authorityPath).toBe("canonical");
    expect(loaded.canonicalEndpoint).toBe(
      CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT("concept_1"),
    );
    expect(loaded.legacyDetailEndpoint).toBeNull();
    expect(loaded.detail?.summary).toBe("REVISION TWO");
    expect(loaded.detail?.summary).not.toContain("MUTATED");
    expect(loaded.detail?.currentRevisionId).toBe("rev2");
    expect(loaded.detail?.version).toBe(2);
    expect(loaded.detail?.sourceDiversity).toBeNull();
    expect(loaded.detail?.timeSpreadDays).toBeNull();
    expect(JSON.stringify(loaded)).not.toContain("MUTATED LEGACY");
  });

  it("preserves legacy UMC detail path for unregistered conclusions", async () => {
    const fetchCanonical = vi.fn(async () => {
      throw new Error("canonical must not be called");
    });
    const fetchLegacyDetail = vi.fn(async () => ({
      id: "umc_legacy",
      title: "Legacy",
      summary: "Legacy summary",
      area: "operating_logic" as const,
      status: "supported" as const,
      confidenceLevel: "medium" as const,
      evidenceCount: 1,
      sourceDiversity: 2,
      timeSpreadDays: 3,
      updatedAt: "2026-06-24T10:00:00.000Z",
      createdAt: "2026-06-20T10:00:00.000Z",
    }));
    const fetchLegacyEvidence = vi.fn(async () => []);

    const loaded = await loadMapDetailForSelectedConclusion({
      selectedId: "umc_legacy",
      items: [
        {
          id: "umc_legacy",
          title: "Legacy",
          summary: "Legacy summary",
          area: "operating_logic",
          status: "supported",
          confidenceLevel: "medium",
          evidenceCount: 1,
          updatedAt: "2026-06-24T10:00:00.000Z",
          authorityType: "legacy_unregistered_usermap_conclusion",
        },
      ],
      fetchCanonical,
      fetchLegacyDetail,
      fetchLegacyEvidence,
    });

    expect(fetchCanonical).not.toHaveBeenCalled();
    expect(fetchLegacyDetail).toHaveBeenCalledWith("umc_legacy");
    expect(loaded.authorityPath).toBe("legacy");
    expect(loaded.legacyDetailEndpoint).toBe(
      INSPECTOR_USER_MAP_DETAIL_ENDPOINT("umc_legacy"),
    );
    expect(loaded.canonicalEndpoint).toBeNull();
  });

  it("shared mapper and route Map adapter never emit empty evidence hrefs or raw UEL text", () => {
    const mapped = mapCanonicalProductConceptToMapDetail({
      concept: sampleCanonicalConcept(),
    });
    expect(mapped.evidence.every((row) => row.sourceObjectHref !== "")).toBe(true);
    expect(mapped.evidence.some((row) => row.sourceObjectHref === null)).toBe(true);
    expect(mapped.evidence.some((row) => row.sourceObjectHref === "/patterns/pc1")).toBe(
      true,
    );
    expect(JSON.stringify(mapped)).not.toContain("RAW");

    const view = mapMapDataToV0Props({
      items: [
        {
          id: "concept_1",
          title: "Canonical title",
          area: "operating_logic",
          status: "emerging",
          confidenceLevel: "medium",
          evidenceCount: 2,
          summary: "REVISION TWO",
          updatedAt: "2026-07-28T12:00:00.000Z",
          authorityType: "canonical_concept_revision",
          conceptId: "concept_1",
          currentRevisionId: "rev2",
          version: 2,
          domain: "operating_logic",
        },
      ],
      isLoading: false,
      loadError: null,
      selectedId: "concept_1",
      detail: mapped.detail,
      isDetailLoading: false,
      evidence: mapped.evidence,
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [],
        summaryCounts: { memories: 0, patterns: 0 },
      },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    expect(view.evidence.preview.map((row) => row.href)).toEqual([
      "/patterns/pc1",
      null,
    ]);
    expect(view.evidence.preview.every((row) => row.href !== "")).toBe(true);
    expect(JSON.stringify(view.evidence)).not.toContain('href=""');
  });
});
