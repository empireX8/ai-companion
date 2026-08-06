/**
 * SUBSYS-004 Slice B — unit proofs for authenticated Inspector concept drill-down.
 */

import { describe, expect, it, vi } from "vitest";
import {
  CanonicalConceptDomain,
  CanonicalRevisionOperation,
  CanonicalRevisionStatus,
  UserMapConfidenceLevel,
} from "@prisma/client";

vi.mock("server-only", () => ({}));

import { CanonicalModelAuthorityError } from "../canonical-model-authority-errors";
import {
  buildCanonicalConceptSelectionId,
  projectCanonicalInspectorConceptDrilldown,
  projectCanonicalRelatedConceptObjects,
} from "../canonical-inspector-concept-projection";
import type { CanonicalProductConceptV1 } from "../canonical-model-product-projection";

const CONCEPT_A = "concept_stable_alpha";
const CONCEPT_B = "concept_stable_beta";
const MU = "mu_originating_selection";
const STALE_SEED_TITLE = "I don't like tea anymore";
const STALE_SEED_SUMMARY = "I don't like tea anymore";
const CURRENT_TITLE = "I like tea again now";
const CURRENT_SUMMARY = "I like tea again now";
const RAW_SEED_ID = "umc_legacy_seed_raw_id_must_not_leak";

function baseConcept(
  overrides: Partial<CanonicalProductConceptV1> = {},
): CanonicalProductConceptV1 {
  const conceptId = overrides.conceptId ?? CONCEPT_A;
  const title = overrides.title ?? CURRENT_TITLE;
  const summary = overrides.summary ?? CURRENT_SUMMARY;
  const version = overrides.version ?? 2;
  const acceptedAt = overrides.acceptedAt ?? "2026-07-28T12:00:00.000Z";
  const currentRevisionId = overrides.currentRevisionId ?? "rev_current_hidden";
  const rationale =
    overrides.rationale === undefined
      ? "The current revision reflects the accepted correction."
      : overrides.rationale;
  const evidenceCount = overrides.evidenceCount ?? 2;

  const concept: CanonicalProductConceptV1 = {
    authorityType: "canonical_concept_revision",
    conceptId,
    currentRevisionId,
    version,
    domain: CanonicalConceptDomain.meaning_system,
    title,
    summary,
    status: CanonicalRevisionStatus.supported,
    confidenceScore: 0.8,
    confidenceLevel: UserMapConfidenceLevel.medium,
    evidenceCount,
    rationale,
    acceptedAt,
    legacySeed: {
      objectType: "usermap_conclusion",
      objectId: RAW_SEED_ID,
    },
    evidence: [],
    revisionHistory: [
      {
        id: "rev_old_hidden",
        version: 1,
        title: STALE_SEED_TITLE,
        summary: STALE_SEED_SUMMARY,
        status: CanonicalRevisionStatus.supported,
        confidenceScore: 0.5,
        confidenceLevel: UserMapConfidenceLevel.low,
        evidenceCount: 1,
        rationale: null,
        acceptedAt: "2026-07-27T12:00:00.000Z",
        operation: CanonicalRevisionOperation.registered,
      },
      {
        id: currentRevisionId,
        version,
        title,
        summary,
        status: CanonicalRevisionStatus.supported,
        confidenceScore: 0.8,
        confidenceLevel: UserMapConfidenceLevel.medium,
        evidenceCount,
        rationale,
        acceptedAt,
        operation: CanonicalRevisionOperation.strengthen,
      },
    ],
    movementHistory: [],
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: [CanonicalRevisionOperation.strengthen],
    },
  };

  return {
    ...concept,
    ...overrides,
    conceptId,
    title,
    summary,
    version,
    acceptedAt,
    currentRevisionId,
    rationale,
    evidenceCount,
    legacySeed: overrides.legacySeed ?? concept.legacySeed,
  };
}

describe("canonical inspector concept projection", () => {
  it("keeps selectionId stable across revision wording changes", () => {
    const rev2 = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({
        version: 2,
        title: STALE_SEED_TITLE,
        summary: STALE_SEED_SUMMARY,
        acceptedAt: "2026-07-27T12:00:00.000Z",
        currentRevisionId: "rev2",
      }),
      returnSelectionId: MU,
    });
    const rev3 = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({
        version: 3,
        title: CURRENT_TITLE,
        summary: CURRENT_SUMMARY,
        acceptedAt: "2026-07-28T12:00:00.000Z",
        currentRevisionId: "rev3",
        rationale: "Later strengthening.",
      }),
      returnSelectionId: MU,
    });

    expect(rev2.selectionId).toBe(rev3.selectionId);
    expect(rev2.selectionId).toBe(buildCanonicalConceptSelectionId(CONCEPT_A));
    expect(rev3.title).toBe(CURRENT_TITLE);
    expect(rev3.summary).toBe(CURRENT_SUMMARY);
    expect(rev3.currentRevisionVersion).toBe(3);
    expect(rev3.currentRevisionAcceptedAt).toBe("2026-07-28T12:00:00.000Z");
    expect(rev2.title).toBe(STALE_SEED_TITLE);
    expect(rev2.currentRevisionVersion).toBe(2);
  });

  it("issues different selectionIds for different concept ids", () => {
    const a = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({ conceptId: CONCEPT_A }),
      returnSelectionId: MU,
    });
    const b = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({ conceptId: CONCEPT_B }),
      returnSelectionId: MU,
    });
    expect(a.selectionId).not.toBe(b.selectionId);
    expect(a.selectionId).not.toContain(CONCEPT_A);
    expect(b.selectionId).not.toContain(CONCEPT_B);
    expect(JSON.stringify(a)).not.toContain(CONCEPT_A);
    expect(JSON.stringify(a)).not.toContain("rev_current_hidden");
    expect(JSON.stringify(a)).not.toContain(RAW_SEED_ID);
  });

  it("takes title and summary from one current revision projection only", () => {
    const projected = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({
        title: CURRENT_TITLE,
        summary: CURRENT_SUMMARY,
        version: 2,
      }),
      returnSelectionId: MU,
    });
    expect(projected.title).toBe(CURRENT_TITLE);
    expect(projected.summary).toBe(CURRENT_SUMMARY);
    expect(projected.currentRevisionVersion).toBe(2);
  });

  it("never combines stale tea seed title with current tea summary", () => {
    const projected = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({
        title: CURRENT_TITLE,
        summary: CURRENT_SUMMARY,
        version: 2,
      }),
      returnSelectionId: MU,
    });
    expect(projected.title).toBe(CURRENT_TITLE);
    expect(projected.summary).toBe(CURRENT_SUMMARY);
    expect(projected.title).not.toBe(STALE_SEED_TITLE);
    expect(JSON.stringify(projected)).not.toContain(STALE_SEED_TITLE);
  });

  it("labels legacy seed as historical source only without raw id or stale wording", () => {
    const projected = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept(),
      returnSelectionId: MU,
    });
    expect(projected.historicalSources).toEqual([{ label: "Historical source" }]);
    expect(projected.sourceProvenanceLabel).toBe("Historical source");
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain(RAW_SEED_ID);
    expect(serialized).not.toContain(STALE_SEED_TITLE);
    expect(serialized).not.toContain("usermap_conclusion");
  });

  it("fails closed on missing current title without legacy fallback", () => {
    expect(() =>
      projectCanonicalInspectorConceptDrilldown({
        concept: baseConcept({ title: "   " }),
        returnSelectionId: MU,
      }),
    ).toThrow(CanonicalModelAuthorityError);
  });

  it("fails closed on missing concept projection fields", () => {
    expect(() =>
      projectCanonicalInspectorConceptDrilldown({
        concept: null as unknown as CanonicalProductConceptV1,
        returnSelectionId: MU,
      }),
    ).toThrow(CanonicalModelAuthorityError);

    expect(() =>
      projectCanonicalInspectorConceptDrilldown({
        concept: baseConcept({ conceptId: "" }),
        returnSelectionId: MU,
      }),
    ).toThrow(CanonicalModelAuthorityError);
  });

  it("fails closed when legacy seed binding is missing", () => {
    const concept = baseConcept();
    const broken = {
      ...concept,
      legacySeed: undefined,
    } as unknown as CanonicalProductConceptV1;
    expect(() =>
      projectCanonicalInspectorConceptDrilldown({
        concept: broken,
        returnSelectionId: MU,
      }),
    ).toThrow(CanonicalModelAuthorityError);
  });

  it("preserves returnSelectionId for Back without exposing revision authority ids", () => {
    const projected = projectCanonicalInspectorConceptDrilldown({
      concept: baseConcept({ currentRevisionId: "rev_must_not_appear" }),
      returnSelectionId: MU,
    });
    expect(projected.returnSelectionId).toBe(MU);
    expect(JSON.stringify(projected)).not.toContain("rev_must_not_appear");
    expect(projected).not.toHaveProperty("conceptId");
    expect(projected).not.toHaveProperty("currentRevisionId");
  });

  it("returns exactly one related object wrapper for a valid concept", () => {
    const related = projectCanonicalRelatedConceptObjects({
      concept: baseConcept({
        title: CURRENT_TITLE,
        summary: CURRENT_SUMMARY,
        version: 2,
      }),
      returnSelectionId: MU,
    });
    expect(related).toHaveLength(1);
    expect(related[0]?.inspectorObjectType).toBe("canonical_concept");
    expect(related[0]?.selectionId).toBe(
      buildCanonicalConceptSelectionId(CONCEPT_A),
    );
    expect(related[0]?.canonicalConceptDrilldown.selectionId).toBe(
      related[0]?.selectionId,
    );
    expect(related[0]?.title).toBe(CURRENT_TITLE);
    expect(related[0]?.canonicalConceptDrilldown.summary).toBe(CURRENT_SUMMARY);
    expect(JSON.stringify(related)).not.toContain(STALE_SEED_TITLE);
    expect(JSON.stringify(related)).not.toContain(CONCEPT_A);
    expect(JSON.stringify(related)).not.toContain(RAW_SEED_ID);
  });

  it("omits related objects when current concept state is invalid", () => {
    expect(
      projectCanonicalRelatedConceptObjects({
        concept: baseConcept({ title: "  " }),
        returnSelectionId: MU,
      }),
    ).toEqual([]);
  });
});
