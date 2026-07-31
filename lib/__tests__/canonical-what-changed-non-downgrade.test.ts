/**
 * Phase 5 correction — What Changed non-downgrade identity (mocked row shapes).
 * Real DB corruption cases live in canonical-model-product-db-integration.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

vi.mock("server-only", () => ({}));

const findFirstMu = vi.fn();
const findManyMu = vi.fn();
const findFirstProposal = vi.fn();
const findManyProposals = vi.fn();
const findManyEvidenceLinks = vi.fn();
const findManyPatternClaims = vi.fn();
const readConceptMock = vi.fn();

vi.mock("../prismadb", () => ({
  default: {
    modelUpdate: {
      findFirst: (...args: unknown[]) => findFirstMu(...args),
      findMany: (...args: unknown[]) => findManyMu(...args),
    },
    exploreMovementProposal: {
      findFirst: (...args: unknown[]) => findFirstProposal(...args),
      findMany: (...args: unknown[]) => findManyProposals(...args),
    },
    understandingEvidenceLink: {
      findMany: (...args: unknown[]) => findManyEvidenceLinks(...args),
    },
    userMapConclusion: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    investigation: { findFirst: vi.fn(async () => null) },
    fieldworkAssignment: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    patternClaim: {
      findFirst: vi.fn(async () => null),
      findMany: (...args: unknown[]) => findManyPatternClaims(...args),
    },
    contradictionNode: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    surfacedAction: { findMany: vi.fn(async () => []) },
    journalEntry: { findMany: vi.fn(async () => []) },
    message: { findMany: vi.fn(async () => []) },
    quickCheckIn: { findMany: vi.fn(async () => []) },
    session: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("../current-understanding-product-projection", () => ({
  readCanonicalProductConceptForUser: (...args: unknown[]) =>
    readConceptMock(...args),
}));

vi.mock("../public-linked-object-continuity", () => ({
  applyVerifiedAffectedObjectHrefs: async ({ items }: { items: unknown[] }) =>
    items,
}));

import { CanonicalModelAuthorityError } from "../canonical-model-authority-errors";
import { deriveExploreMovementModelUpdateId } from "../explore-movement-proposal-provenance";
import { buildWhatChangedInspectorDetail } from "../what-changed-reality-report";

const PROPOSAL_ID = "prop_combined_1";
const MODEL_UPDATE_ID = deriveExploreMovementModelUpdateId(PROPOSAL_ID);

function canonicalProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    userId: "u1",
    status: ExploreMovementProposalStatus.published,
    authorityMode: ExploreMovementAuthorityMode.canonical_v1,
    modelUpdateId: MODEL_UPDATE_ID,
    canonicalConceptId: "concept_1",
    ...overrides,
  };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MODEL_UPDATE_ID,
    updateType: "conclusion_strengthened",
    affectedObjectType: UnderstandingLinkTargetType.canonical_concept_revision,
    affectedObjectId: "rev2",
    userFacingSummary: "Strengthened",
    createdAt: new Date("2026-07-28T12:00:00.000Z"),
    beforeSummary: "REVISION ONE",
    afterSummary: "REVISION TWO",
    confidenceDelta: null,
    internalNotes: null,
    canonicalConceptId: "concept_1",
    previousRevisionId: "rev1",
    resultingRevisionId: "rev2",
    exploreProposalId: PROPOSAL_ID,
    ...overrides,
  };
}

describe("What Changed canonical non-downgrade", () => {
  beforeEach(() => {
    findFirstMu.mockReset();
    findManyMu.mockReset();
    findFirstProposal.mockReset();
    findManyProposals.mockReset();
    findManyEvidenceLinks.mockReset();
    findManyPatternClaims.mockReset();
    readConceptMock.mockReset();
    findManyMu.mockResolvedValue([]);
    findManyEvidenceLinks.mockResolvedValue([]);
    findManyPatternClaims.mockResolvedValue([]);
    findManyProposals.mockResolvedValue([canonicalProposal()]);
  });

  it("fails closed when canonicalConceptId is cleared alone", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({ canonicalConceptId: null }),
    );
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());

    await expect(
      buildWhatChangedInspectorDetail({
        userId: "u1",
        modelUpdateId: MODEL_UPDATE_ID,
      }),
    ).rejects.toMatchObject({ code: "BROKEN_CANONICAL_PROJECTION" });
  });

  it("fails closed when all four lineage fields are cleared together", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({
        canonicalConceptId: null,
        previousRevisionId: null,
        resultingRevisionId: null,
        exploreProposalId: null,
        affectedObjectType: UnderstandingLinkTargetType.canonical_concept_revision,
      }),
    );
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());

    await expect(
      buildWhatChangedInspectorDetail({
        userId: "u1",
        modelUpdateId: MODEL_UPDATE_ID,
      }),
    ).rejects.toMatchObject({ code: "BROKEN_CANONICAL_PROJECTION" });
  });

  it("combined mutable corruption never returns a legacy report", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({
        canonicalConceptId: null,
        previousRevisionId: null,
        resultingRevisionId: null,
        exploreProposalId: null,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc_seed",
      }),
    );
    findManyProposals.mockResolvedValueOnce([
      canonicalProposal({ modelUpdateId: "decoy_mu_pointer" }),
    ]);
    findFirstProposal.mockResolvedValueOnce(null);

    try {
      await buildWhatChangedInspectorDetail({
        userId: "u1",
        modelUpdateId: MODEL_UPDATE_ID,
      });
      expect.fail("expected BROKEN_CANONICAL_PROJECTION");
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalModelAuthorityError);
      expect((error as CanonicalModelAuthorityError).code).toBe(
        "BROKEN_CANONICAL_PROJECTION",
      );
    }
    expect(readConceptMock).not.toHaveBeenCalled();
  });

  it("fails closed when movement receipt is missing from projection", async () => {
    findFirstMu.mockResolvedValueOnce(baseRow());
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());
    readConceptMock.mockResolvedValueOnce({
      authorityType: "canonical_concept_revision",
      conceptId: "concept_1",
      currentRevisionId: "rev2",
      movementHistory: [],
    });

    await expect(
      buildWhatChangedInspectorDetail({
        userId: "u1",
        modelUpdateId: MODEL_UPDATE_ID,
      }),
    ).rejects.toMatchObject({ code: "BROKEN_CANONICAL_PROJECTION" });
  });

  it("returns a browser-safe verified canonical ModelUpdate Inspector projection", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({
        userFacingSummary: "I like tea again now",
        beforeSummary: "I don't like tea anymore",
        afterSummary: "I like tea again now",
        internalNotes:
          '{"movementRationale":"The user explicitly corrected the previous tea preference."}',
      }),
    );
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());
    findManyEvidenceLinks.mockResolvedValueOnce([
      {
        id: "uel-direct-1",
        sourceType: "message",
        sourceId: "msg-1",
        role: "supports",
        summary: "The user said they like tea again now.",
        snippet: null,
        quote: null,
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:01:00.000Z"),
      },
      {
        id: "uel-direct-raw-source",
        sourceType: "message",
        sourceId: "msg-private-source-id",
        role: "context",
        summary: null,
        snippet: null,
        quote: "RAW PRIVATE SOURCE TEXT",
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:00:30.000Z"),
      },
      {
        id: "uel-direct-pattern-raw-id",
        sourceType: "pattern_claim",
        sourceId: "pattern-raw-source-id",
        role: "supports",
        summary: null,
        snippet: null,
        quote: "RAW PATTERN QUOTE TEXT",
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:00:15.000Z"),
      },
    ]);
    findManyPatternClaims.mockResolvedValueOnce([
      {
        id: "pattern-raw-source-id",
        summary: "UNPROJECTED PATTERN DISPLAY LABEL",
        status: "active",
      },
    ]);
    readConceptMock.mockResolvedValueOnce({
      authorityType: "canonical_concept_revision",
      conceptId: "concept_1",
      currentRevisionId: "rev2",
      version: 2,
      title: "I like tea again now",
      summary: "I like tea again now",
      rationale: "The current revision reflects the accepted correction.",
      acceptedAt: "2026-07-28T12:00:00.000Z",
      evidence: [
        {
          id: "uel-revision-1",
          sourceType: "message",
          role: "supports",
          summary: "RAW REDACTED REVISION TEXT",
          disclosure: "redacted",
          sourceId: "raw-revision-source-id",
          snippet: null,
          quote: null,
          sourceObjectHref: "/messages/raw-revision-source-id",
        },
      ],
      revisionHistory: [
        {
          id: "rev1",
          version: 1,
          title: "I don't like tea anymore",
          summary: "I don't like tea anymore",
          rationale: null,
          acceptedAt: "2026-07-27T12:00:00.000Z",
        },
        {
          id: "rev2",
          version: 2,
          title: "I like tea again now",
          summary: "I like tea again now",
          rationale: "The current revision reflects the accepted correction.",
          acceptedAt: "2026-07-28T12:00:00.000Z",
        },
      ],
      movementHistory: [
        {
          modelUpdateId: MODEL_UPDATE_ID,
          exploreProposalId: PROPOSAL_ID,
          previousRevisionId: "rev1",
          resultingRevisionId: "rev2",
          updateType: "conclusion_strengthened",
          beforeSummary: "I don't like tea anymore",
          afterSummary: "I like tea again now",
          userFacingSummary: "I like tea again now",
          createdAt: "2026-07-28T12:00:00.000Z",
        },
      ],
    });

    const detail = await buildWhatChangedInspectorDetail({
      userId: "u1",
      modelUpdateId: MODEL_UPDATE_ID,
    });

    expect(detail?.item.affectedObjectId).toBeNull();
    expect(detail?.item.affectedObjectHref).toBeNull();
    expect(detail?.report.modelMovement.before).toBe("I don't like tea anymore");
    expect(detail?.report.modelMovement.after).toBe("I like tea again now");
    expect(detail?.canonicalInspectorProjection).toMatchObject({
      projectionType: "canonical_model_update_inspector",
      modelUpdateId: MODEL_UPDATE_ID,
      displayedTitle: "I like tea again now",
      distinctSummary: null,
      before: "I don't like tea anymore",
      after: "I like tea again now",
    });
    expect(
      detail?.canonicalInspectorProjection?.directMovementEvidence[0]
        ?.evidenceTarget,
    ).toBe("direct_movement");
    expect(
      detail?.canonicalInspectorProjection?.resultingRevisionEvidence[0]
        ?.evidenceTarget,
    ).toBe("resulting_revision");
    const projection = detail?.canonicalInspectorProjection;
    const direct = projection?.directMovementEvidence[0];
    const unavailableDirect = projection?.directMovementEvidence[1];
    const revision = projection?.resultingRevisionEvidence[0];
    expect(direct?.sourceId).toBeUndefined();
    expect(direct?.sourceObjectHref).toBeNull();
    expect(direct?.canonicalEvidenceDrilldown).toMatchObject({
      selectionId: `canonical-evidence-${MODEL_UPDATE_ID}-direct_movement_evidence-0`,
      evidenceClass: "direct_movement_evidence",
      evidenceClassLabel: "Movement evidence",
      sourceType: "message",
      sourceTypeLabel: "Conversation message",
      role: "supports",
      roleLabel: "Supporting",
      title: "The user said they like tea again now.",
      summary: "The user said they like tea again now.",
      snippet: null,
      recordedAt: "2026-07-28T12:01:00.000Z",
      recordedLabel: "28 Jul 2026, 13:01",
      provenanceLabel: "Movement evidence",
      sourceDisclosure: "available",
    });
    expect(unavailableDirect?.sourceId).toBeUndefined();
    expect(unavailableDirect?.canonicalEvidenceDrilldown).toMatchObject({
      evidenceClass: "direct_movement_evidence",
      role: "context",
      sourceDisclosure: "unavailable",
      summary: null,
      snippet: null,
    });
    expect(revision?.sourceId).toBeUndefined();
    expect(revision?.sourceObjectHref).toBeNull();
    expect(revision?.canonicalEvidenceDrilldown).toMatchObject({
      selectionId: `canonical-evidence-${MODEL_UPDATE_ID}-resulting_revision_evidence-0`,
      evidenceClass: "resulting_revision_evidence",
      evidenceClassLabel: "Resulting revision evidence",
      sourceType: "message",
      sourceTypeLabel: "Conversation message",
      role: "supports",
      roleLabel: "Supporting",
      title: "Resulting revision evidence · Conversation message",
      summary: null,
      snippet: null,
      recordedAt: null,
      recordedLabel: null,
      provenanceLabel: "Resulting revision evidence",
      sourceDisclosure: "redacted",
    });
    expect(
      findManyEvidenceLinks.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes("canonical_concept_revision"),
      ),
    ).toBe(false);

    const projected = JSON.stringify(projection);
    expect(projected).not.toContain("uel-direct-1");
    expect(projected).not.toContain("uel-direct-raw-source");
    expect(projected).not.toContain("uel-direct-pattern-raw-id");
    expect(projected).not.toContain("uel-revision-1");
    expect(projected).not.toContain("msg-1");
    expect(projected).not.toContain("msg-private-source-id");
    expect(projected).not.toContain("pattern-raw-source-id");
    expect(projected).not.toContain("raw-revision-source-id");
    expect(projected).not.toContain("RAW PRIVATE SOURCE TEXT");
    expect(projected).not.toContain("RAW PATTERN QUOTE TEXT");
    expect(projected).not.toContain("UNPROJECTED PATTERN DISPLAY LABEL");
    expect(projected).not.toContain("RAW REDACTED REVISION TEXT");

    const serialized = JSON.stringify(detail);
    expect(serialized).toContain(
      `canonical-evidence-${MODEL_UPDATE_ID}-direct_movement_evidence-0`,
    );
    expect(serialized).toContain(
      `canonical-evidence-${MODEL_UPDATE_ID}-direct_movement_evidence-1`,
    );
    expect(serialized).toContain(
      `canonical-evidence-${MODEL_UPDATE_ID}-resulting_revision_evidence-0`,
    );
    expect(serialized).toContain("Movement evidence");
    expect(serialized).toContain("Resulting revision evidence");
    expect(serialized).toContain("Conversation message");
    expect(serialized).toContain("Supporting");
    expect(serialized).toContain("The user said they like tea again now.");
    expect(serialized).not.toContain("uel-direct-1");
    expect(serialized).not.toContain("uel-direct-raw-source");
    expect(serialized).not.toContain("uel-direct-pattern-raw-id");
    expect(serialized).not.toContain("uel-revision-1");
    expect(serialized).not.toContain("msg-1");
    expect(serialized).not.toContain("msg-private-source-id");
    expect(serialized).not.toContain("pattern-raw-source-id");
    expect(serialized).not.toContain("/patterns/pattern-raw-source-id");
    expect(serialized).not.toContain("raw-revision-source-id");
    expect(serialized).not.toContain("/messages/raw-revision-source-id");
    expect(serialized).not.toContain("RAW PRIVATE SOURCE TEXT");
    expect(serialized).not.toContain("RAW PATTERN QUOTE TEXT");
    expect(serialized).not.toContain("UNPROJECTED PATTERN DISPLAY LABEL");
    expect(serialized).not.toContain("RAW REDACTED REVISION TEXT");
    expect(serialized).not.toContain("canonicalConceptId");
    expect(serialized).not.toContain("previousRevisionId");
    expect(serialized).not.toContain("resultingRevisionId");
    expect(serialized).not.toContain("exploreProposalId");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("movementRationale");
  });

  it("preserves noncanonical report evidence refs in the complete API detail", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({
        id: "mu-noncanonical",
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-1",
        userFacingSummary: "Legacy movement summary",
        beforeSummary: "Earlier legacy read",
        afterSummary: "Later legacy read",
        canonicalConceptId: null,
        previousRevisionId: null,
        resultingRevisionId: null,
        exploreProposalId: null,
      }),
    );
    findManyEvidenceLinks.mockResolvedValueOnce([
      {
        id: "legacy-uel-raw-id",
        sourceType: "message",
        sourceId: "legacy-message-source-id",
        role: "supports",
        summary: "Legacy evidence summary",
        snippet: null,
        quote: null,
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:01:00.000Z"),
      },
    ]);

    const detail = await buildWhatChangedInspectorDetail({
      userId: "u1",
      modelUpdateId: "mu-noncanonical",
    });

    expect(detail?.canonicalInspectorProjection).toBeUndefined();
    const serialized = JSON.stringify(detail);
    expect(serialized).toContain("legacy-uel-raw-id");
    expect(serialized).toContain("legacy-message-source-id");
    expect(
      detail?.report.facts.items.some((item) =>
        item.evidenceRefs.some(
          (ref) =>
            ref.id === "legacy-uel-raw-id" &&
            ref.sourceId === "legacy-message-source-id",
        ),
      ),
    ).toBe(true);
  });

  it("does not relabel current-revision evidence as resulting-revision evidence for older movements", async () => {
    findFirstMu.mockResolvedValueOnce(
      baseRow({
        userFacingSummary: "I like tea again now",
        beforeSummary: "I don't like tea anymore",
        afterSummary: "I like tea again now",
      }),
    );
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());
    readConceptMock.mockResolvedValueOnce({
      authorityType: "canonical_concept_revision",
      conceptId: "concept_1",
      currentRevisionId: "rev3",
      version: 3,
      title: "I like green tea but not black tea",
      summary: "I like green tea but not black tea",
      rationale: "A later correction narrowed the tea preference.",
      acceptedAt: "2026-07-29T12:00:00.000Z",
      evidence: [
        {
          id: "uel-current-revision",
          sourceType: "message",
          role: "supports",
          summary: "Current revision evidence",
          disclosure: "redacted",
          sourceId: null,
          snippet: null,
          quote: null,
          sourceObjectHref: null,
        },
      ],
      revisionHistory: [
        {
          id: "rev1",
          version: 1,
          title: "I don't like tea anymore",
          summary: "I don't like tea anymore",
          rationale: null,
          acceptedAt: "2026-07-27T12:00:00.000Z",
        },
        {
          id: "rev2",
          version: 2,
          title: "I like tea again now",
          summary: "I like tea again now",
          rationale: "The user corrected the previous tea preference.",
          acceptedAt: "2026-07-28T12:00:00.000Z",
        },
        {
          id: "rev3",
          version: 3,
          title: "I like green tea but not black tea",
          summary: "I like green tea but not black tea",
          rationale: "A later correction narrowed the tea preference.",
          acceptedAt: "2026-07-29T12:00:00.000Z",
        },
      ],
      movementHistory: [
        {
          modelUpdateId: MODEL_UPDATE_ID,
          exploreProposalId: PROPOSAL_ID,
          previousRevisionId: "rev1",
          resultingRevisionId: "rev2",
          updateType: "conclusion_strengthened",
          beforeSummary: "I don't like tea anymore",
          afterSummary: "I like tea again now",
          userFacingSummary: "I like tea again now",
          createdAt: "2026-07-28T12:00:00.000Z",
        },
      ],
    });

    const detail = await buildWhatChangedInspectorDetail({
      userId: "u1",
      modelUpdateId: MODEL_UPDATE_ID,
    });

    expect(detail?.canonicalInspectorProjection?.before).toBe(
      "I don't like tea anymore",
    );
    expect(detail?.canonicalInspectorProjection?.after).toBe(
      "I like tea again now",
    );
    expect(
      detail?.canonicalInspectorProjection?.resultingStateAtPublication,
    ).toMatchObject({
      title: "I like tea again now",
      version: 2,
    });
    expect(detail?.canonicalInspectorProjection?.currentUnderstandingNow).toMatchObject({
      title: "I like green tea but not black tea",
      version: 3,
    });
    expect(
      detail?.canonicalInspectorProjection?.resultingRevisionEvidence,
    ).toEqual([]);
    expect(JSON.stringify(detail)).not.toContain("Current revision evidence");
  });

  it("fails closed when canonical movement history disagrees with the row", async () => {
    findFirstMu.mockResolvedValueOnce(baseRow());
    findFirstProposal.mockResolvedValueOnce(canonicalProposal());
    readConceptMock.mockResolvedValueOnce({
      authorityType: "canonical_concept_revision",
      conceptId: "concept_1",
      currentRevisionId: "rev2",
      version: 2,
      title: "REVISION TWO",
      summary: "REVISION TWO",
      acceptedAt: "2026-07-28T12:00:00.000Z",
      evidence: [],
      revisionHistory: [
        {
          id: "rev2",
          version: 2,
          title: "REVISION TWO",
          summary: "REVISION TWO",
          rationale: null,
          acceptedAt: "2026-07-28T12:00:00.000Z",
        },
      ],
      movementHistory: [
        {
          modelUpdateId: MODEL_UPDATE_ID,
          exploreProposalId: PROPOSAL_ID,
          previousRevisionId: "rev1",
          resultingRevisionId: "rev2",
          updateType: "conclusion_strengthened",
          beforeSummary: "REVISION ONE",
          afterSummary: "DIFFERENT REVISION TWO",
          userFacingSummary: "Strengthened",
          createdAt: "2026-07-28T12:00:00.000Z",
        },
      ],
    });

    await expect(
      buildWhatChangedInspectorDetail({
        userId: "u1",
        modelUpdateId: MODEL_UPDATE_ID,
      }),
    ).rejects.toMatchObject({ code: "BROKEN_CANONICAL_PROJECTION" });
  });
});
