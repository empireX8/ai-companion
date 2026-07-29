/**
 * Phase 5 — canonical product projection + current-understanding merge.
 */

import { describe, expect, it } from "vitest";
import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
} from "@prisma/client";

import {
  CANONICAL_PRODUCT_PROJECTION_VERSION,
  extractCanonicalIdentityEnvelope,
  toCanonicalProductConceptV1,
} from "../canonical-model-product-projection";
import type { CanonicalConceptProjectionV1 } from "../canonical-model-projection";
import {
  mergeCurrentUnderstandingProductItems,
  toCurrentUnderstandingSurfaceListItem,
  type LegacyUnregisteredConclusionProductItem,
} from "../current-understanding-product-projection";
import { mergeCanonicalAndLegacyMovementListItems } from "../canonical-movement-list-merge";
import type { WhatChangedListItem } from "../public-intelligence-safe-slice";

function sampleConcept(args?: {
  conceptId?: string;
  summary?: string;
  seedId?: string;
  version?: number;
  acceptedAt?: string;
  domain?: CanonicalConceptProjectionV1["concept"]["domain"];
}): CanonicalConceptProjectionV1 {
  const conceptId = args?.conceptId ?? "concept_1";
  const seedId = args?.seedId ?? "umc_seed_1";
  const version = args?.version ?? 2;
  const rev1Id = `${conceptId}_rev1`;
  const rev2Id = `${conceptId}_rev2`;
  const currentId = version === 1 ? rev1Id : rev2Id;
  const summary = args?.summary ?? "REVISION TWO";
  const acceptedAt = args?.acceptedAt ?? "2026-07-28T12:00:00.000Z";
  const domain = args?.domain ?? "operating_logic";

  const rev1 = {
    id: rev1Id,
    conceptId,
    version: 1,
    title: "Title",
    summary: "REVISION ONE",
    status: "emerging" as const,
    confidenceScore: 0.55,
    confidenceLevel: "medium" as const,
    evidenceCount: 1,
    rationale: null,
    operation: CanonicalRevisionOperation.registered,
    decisionSource: CanonicalRevisionDecisionSource.legacy_registration,
    acceptedAt: "2026-07-27T12:00:00.000Z",
    registrationSnapshotHash: "umc_snap_v1:abc",
    previousRevisionId: null,
    createdFromProposalId: null,
    evidence: [
      {
        id: "ev1",
        sourceType: UnderstandingLinkSourceType.journal_entry,
        sourceId: "j1",
        role: UnderstandingLinkRole.supports,
        summary: "seed support",
        snippet: "s",
        quote: "q",
      },
    ],
  };

  const rev2 = {
    id: rev2Id,
    conceptId,
    version: 2,
    title: "Title",
    summary,
    status: "emerging" as const,
    confidenceScore: 0.55,
    confidenceLevel: "medium" as const,
    evidenceCount: 1,
    rationale: "Because of new evidence",
    operation: CanonicalRevisionOperation.strengthen,
    decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
    acceptedAt,
    registrationSnapshotHash: null,
    previousRevisionId: rev1Id,
    createdFromProposalId: "prop_1",
    evidence: [
      {
        id: "ev2",
        sourceType: UnderstandingLinkSourceType.journal_entry,
        sourceId: "j2",
        role: UnderstandingLinkRole.supports,
        summary: "support",
        snippet: "s2",
        quote: "q2",
      },
    ],
  };

  const history = version === 1 ? [rev1] : [rev1, rev2];
  const current = history[history.length - 1]!;

  return {
    authorityType: "canonical_concept_revision",
    concept: {
      id: conceptId,
      registrationKey: `legacy:usermap_conclusion:${seedId}`,
      domain,
      lifecycleStatus: "active",
      currentRevisionId: currentId,
      createdAt: "2026-07-27T12:00:00.000Z",
      updatedAt: acceptedAt,
    },
    currentRevision: current,
    revisionHistory: history,
    sourceBindings: [
      {
        id: "bind_1",
        sourceType: "usermap_conclusion",
        sourceId: seedId,
        bindingRole: "legacy_seed",
        createdAt: "2026-07-27T12:00:00.000Z",
      },
    ],
    movementHistory:
      version === 1
        ? []
        : [
            {
              modelUpdateId: "mu_1",
              exploreProposalId: "prop_1",
              canonicalConceptId: conceptId,
              previousRevisionId: rev1Id,
              resultingRevisionId: rev2Id,
              updateType: "conclusion_strengthened",
              beforeSummary: "REVISION ONE",
              afterSummary: summary,
              userFacingSummary: "Strengthened",
              createdAt: acceptedAt,
            },
          ],
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: version === 1 ? ["strengthen"] : [],
    },
  };
}

describe("canonical product projection", () => {
  it("1. removes internal fields from the product concept", () => {
    const product = toCanonicalProductConceptV1(sampleConcept());
    const json = JSON.stringify(product);
    expect(json).not.toContain("registrationKey");
    expect(json).not.toContain("registrationSnapshotHash");
    expect(json).not.toContain("internalNotes");
    expect(product.conceptId).toBe("concept_1");
    expect(product.currentRevisionId).toBe("concept_1_rev2");
    expect(product.summary).toBe("REVISION TWO");
    expect(CANONICAL_PRODUCT_PROJECTION_VERSION).toBe(
      "canonical_product_projection:v1",
    );
    expect(product.legacySeed).toEqual({
      objectType: "usermap_conclusion",
      objectId: "umc_seed_1",
    });
  });

  it("repeated conversion is deeply equal", () => {
    const concept = sampleConcept();
    expect(toCanonicalProductConceptV1(concept)).toEqual(
      toCanonicalProductConceptV1(concept),
    );
  });
});

describe("current-understanding merge", () => {
  it("2. preserves unregistered legacy conclusions", () => {
    const canonical = [toCanonicalProductConceptV1(sampleConcept())];
    const legacy: LegacyUnregisteredConclusionProductItem[] = [
      {
        authorityType: "legacy_unregistered_usermap_conclusion",
        id: "umc_unregistered",
        title: "Unregistered",
        summary: "Still visible",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "medium",
        evidenceCount: 0,
        updatedAt: "2026-07-28T11:00:00.000Z",
      },
      {
        authorityType: "legacy_unregistered_usermap_conclusion",
        id: "umc_seed_1",
        title: "MUTATED LEGACY",
        summary: "MUTATED LEGACY",
        area: "operating_logic",
        status: "supported",
        confidenceLevel: "high",
        evidenceCount: 9,
        updatedAt: "2026-07-28T13:00:00.000Z",
      },
    ];

    const merged = mergeCurrentUnderstandingProductItems({
      canonicalConcepts: canonical,
      legacyConclusions: legacy,
    });

    expect(
      merged.some(
        (item) =>
          item.authorityType === "legacy_unregistered_usermap_conclusion" &&
          item.id === "umc_unregistered",
      ),
    ).toBe(true);
    expect(
      merged.some(
        (item) =>
          item.authorityType === "legacy_unregistered_usermap_conclusion" &&
          item.id === "umc_seed_1",
      ),
    ).toBe(false);
  });

  it("3. bound legacy conclusion is replaced exactly once", () => {
    const canonical = [toCanonicalProductConceptV1(sampleConcept())];
    const legacy: LegacyUnregisteredConclusionProductItem[] = [
      {
        authorityType: "legacy_unregistered_usermap_conclusion",
        id: "umc_seed_1",
        title: "MUTATED LEGACY",
        summary: "MUTATED LEGACY",
        area: "operating_logic",
        status: "supported",
        confidenceLevel: "high",
        evidenceCount: 9,
        updatedAt: "2026-07-28T13:00:00.000Z",
      },
    ];
    const merged = mergeCurrentUnderstandingProductItems({
      canonicalConcepts: canonical,
      legacyConclusions: legacy,
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.authorityType).toBe("canonical_concept_revision");
    if (merged[0]?.authorityType === "canonical_concept_revision") {
      expect(merged[0].summary).toBe("REVISION TWO");
      expect(merged[0].conceptId).toBe("concept_1");
      expect(merged[0].currentRevisionId).toBe("concept_1_rev2");
    }
  });

  it("4-5. canonical item uses revision wording and retains IDs after UMC mutation input", () => {
    const product = toCanonicalProductConceptV1(
      sampleConcept({ summary: "REVISION TWO" }),
    );
    const surface = toCurrentUnderstandingSurfaceListItem(product);
    expect(surface.summary).toBe("REVISION TWO");
    expect(surface.summary).not.toBe("MUTATED LEGACY");
    expect(surface.id).toBe("concept_1");
    expect(surface.currentRevisionId).toBe("concept_1_rev2");
    expect(surface.version).toBe(2);
    expect(extractCanonicalIdentityEnvelope(product)).toEqual({
      conceptId: "concept_1",
      currentRevisionId: "concept_1_rev2",
      version: 2,
      domain: "operating_logic",
      title: "Title",
      summary: "REVISION TWO",
      status: "emerging",
      confidenceScore: 0.55,
      confidenceLevel: "medium",
      evidenceCount: 1,
    });
  });

  it("maps every canonical domain onto the matching Map area and fails closed on unknown", () => {
    const domains = [
      "operating_logic",
      "state_ecology",
      "tension_architecture",
      "recovery_architecture",
      "meaning_system",
      "relational_field",
      "developmental_vector",
      "current_frontier",
    ] as const;
    for (const domain of domains) {
      const surface = toCurrentUnderstandingSurfaceListItem(
        toCanonicalProductConceptV1(sampleConcept({ domain })),
      );
      expect(surface.area).toBe(domain);
      expect(surface.domain).toBe(domain);
    }
    const unknown = sampleConcept();
    unknown.concept.domain = "unknown";
    expect(() => toCanonicalProductConceptV1(unknown)).toThrowError(
      /not accepted for V1 product projection/,
    );
  });

  it("defaults evidence to redacted and never invents public disclosure without override", () => {
    const product = toCanonicalProductConceptV1(sampleConcept());
    expect(product.evidence).toHaveLength(1);
    expect(product.evidence[0]).toMatchObject({
      id: "ev2",
      disclosure: "redacted",
      sourceId: null,
      snippet: null,
      quote: null,
    });
    expect(product.evidence[0]?.summary).not.toBe("support");
    const json = JSON.stringify(product.evidence);
    expect(json).not.toContain("j2");
    expect(json).not.toContain('"q2"');
  });

  it("suppresses duplicate ModelUpdate IDs from legacy movement lists", () => {
    const concepts = [toCanonicalProductConceptV1(sampleConcept())];
    const legacy: WhatChangedListItem[] = [
      {
        id: "mu_1",
        updateTypeLabel: "Strengthened",
        affectedObjectType: "canonical_concept_revision",
        affectedObjectTypeLabel: "Canonical revision",
        affectedObjectId: "concept_1_rev2",
        affectedObjectHref: null,
        userFacingSummary: "dup",
        createdAt: "2026-07-28T12:00:00.000Z",
      },
      {
        id: "mu_legacy",
        updateTypeLabel: "Other",
        affectedObjectType: "usermap_conclusion",
        affectedObjectTypeLabel: "Conclusion",
        affectedObjectId: "umc_other",
        affectedObjectHref: "/your-map/umc_other",
        userFacingSummary: "unrelated",
        createdAt: "2026-07-28T11:00:00.000Z",
      },
    ];
    const merged = mergeCanonicalAndLegacyMovementListItems({
      canonicalConcepts: concepts,
      legacyItems: legacy,
      limit: 10,
    });
    expect(merged.filter((item) => item.id === "mu_1")).toHaveLength(1);
    expect(merged.some((item) => item.id === "mu_legacy")).toBe(true);
  });

  it("globally sorts newer legacy before older canonical and applies limit after merge", () => {
    const olderCanonical = toCanonicalProductConceptV1(
      sampleConcept({
        acceptedAt: "2026-07-27T10:00:00.000Z",
        summary: "REVISION TWO",
      }),
    );
    olderCanonical.movementHistory[0]!.createdAt = "2026-07-27T10:00:00.000Z";
    const newerLegacy: WhatChangedListItem = {
      id: "mu_newer_legacy",
      updateTypeLabel: "Other",
      affectedObjectType: "usermap_conclusion",
      affectedObjectTypeLabel: "Conclusion",
      affectedObjectId: "umc_other",
      affectedObjectHref: "/your-map/umc_other",
      userFacingSummary: "newer legacy",
      createdAt: "2026-07-28T12:00:00.000Z",
    };
    const merged = mergeCanonicalAndLegacyMovementListItems({
      canonicalConcepts: [olderCanonical],
      legacyItems: [newerLegacy],
      limit: 10,
    });
    expect(merged.map((item) => item.id)).toEqual(["mu_newer_legacy", "mu_1"]);
  });

  it("fails closed when legacy seed binding is missing", () => {
    const broken = sampleConcept();
    broken.sourceBindings = [];
    expect(() => toCanonicalProductConceptV1(broken)).toThrowError(
      /legacy_seed/,
    );
  });
});
