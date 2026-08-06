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
const findManyMessages = vi.fn();
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
    patternClaim: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    patternClaimEvidence: { findFirst: vi.fn(async () => null) },
    contradictionNode: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    contradictionEvidence: { findFirst: vi.fn(async () => null) },
    profileArtifact: { findFirst: vi.fn(async () => null) },
    evidenceSpan: { findFirst: vi.fn(async () => null) },
    referenceItem: { findFirst: vi.fn(async () => null) },
    surfacedAction: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    journalEntry: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    message: {
      findFirst: async (args: unknown) => {
        const rows = await findManyMessages(args);
        return Array.isArray(rows) ? (rows[0] ?? null) : null;
      },
      findMany: (...args: unknown[]) => findManyMessages(...args),
    },
    quickCheckIn: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    session: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    importUploadSession: { findFirst: vi.fn(async () => null) },
    importUploadChunk: { findFirst: vi.fn(async () => null) },
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
    findManyMessages.mockReset();
    readConceptMock.mockReset();
    findManyMu.mockResolvedValue([]);
    findManyEvidenceLinks.mockResolvedValue([]);
    findManyMessages.mockResolvedValue([]);
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
    // Direct movement evidence: independent source → model_update relationship.
    findManyEvidenceLinks.mockResolvedValueOnce([
      {
        id: "uel-direct-1",
        sourceType: "message",
        sourceId: "msg-1",
        role: "supports",
        summary: "UEL DIRECT SUMMARY MUST NOT BECOME INSPECTOR TEXT",
        snippet: "UEL DIRECT SNIPPET MUST NOT BECOME INSPECTOR TEXT",
        quote: "RAW PRIVATE MESSAGE TEXT MUST NOT LEAK",
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:01:00.000Z"),
      },
    ]);
    // Resulting-revision evidence: independent source → canonical_concept_revision.
    findManyEvidenceLinks.mockResolvedValueOnce([
      {
        id: "uel-revision-1",
        sourceType: "message",
        sourceId: "msg-2",
        role: "supports",
        summary: "UEL REVISION SUMMARY MUST NOT BECOME INSPECTOR TEXT",
        snippet: "UEL REVISION SNIPPET MUST NOT BECOME INSPECTOR TEXT",
        quote: "RAW REVISION QUOTE MUST NOT LEAK",
        weight: null,
        confidenceContribution: null,
        createdAt: new Date("2026-07-28T12:02:00.000Z"),
      },
    ]);
    findManyMessages.mockImplementation(async (args: unknown) => {
      const where = (
        args as {
          where?: { id?: string | { in?: string[] }; userId?: string };
        }
      )?.where;
      if (where?.userId && where.userId !== "u1") return [];
      const ids =
        typeof where?.id === "string" ? [where.id] : (where?.id?.in ?? []);
      const owned = [
        {
          id: "msg-1",
          role: "user",
          content: "The user said they like tea again now.",
          createdAt: new Date("2026-07-28T12:01:00.000Z"),
          sessionId: "session-1",
        },
        {
          id: "msg-2",
          role: "user",
          content: "Independent resulting-revision source body.",
          createdAt: new Date("2026-07-28T12:02:00.000Z"),
          sessionId: "session-2",
        },
      ];
      return owned.filter((row) => ids.length === 0 || ids.includes(row.id));
    });
    readConceptMock.mockResolvedValueOnce({
      authorityType: "canonical_concept_revision",
      conceptId: "concept_1",
      currentRevisionId: "rev2",
      version: 2,
      title: "I like tea again now",
      summary: "I like tea again now",
      rationale: "The current revision reflects the accepted correction.",
      acceptedAt: "2026-07-28T12:00:00.000Z",
      // Public continuity labels must not become Inspector evidence authority.
      evidence: [
        {
          id: "uel-public-continuity-shell",
          sourceType: "message",
          role: "supports",
          summary: "Linked evidence",
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
    const directEvidence =
      detail?.canonicalInspectorProjection?.directMovementEvidence[0];
    expect(directEvidence?.sourceId).toBeUndefined();
    expect(directEvidence?.sourceObjectHref).toBeNull();
    expect(
      directEvidence?.canonicalEvidenceDrilldown?.selectionId,
    ).toMatch(/^canonical-evidence-[a-f0-9]{64}$/);
    expect(
      directEvidence?.canonicalEvidenceDrilldown?.selectionId,
    ).not.toContain(MODEL_UPDATE_ID);
    expect(directEvidence?.canonicalEvidenceDrilldown).toMatchObject({
      evidenceClass: "direct_movement_evidence",
      evidenceClassLabel: "Movement evidence",
      sourceType: "message",
      sourceTypeLabel: "Conversation message",
      role: "supports",
      roleLabel: "Supporting",
      title: "Conversation message · 28 Jul 2026, 13:01",
      summary: null,
      snippet: "The user said they like tea again now.",
      recordedAt: "2026-07-28T12:01:00.000Z",
      recordedLabel: "28 Jul 2026, 13:01",
      provenanceLabel: "Movement evidence",
      sourceDisclosure: "available",
      returnSelectionId: MODEL_UPDATE_ID,
    });
    expect(
      detail?.canonicalInspectorProjection?.resultingRevisionEvidence[0]
        ?.evidenceTarget,
    ).toBe("resulting_revision");
    const revisionEvidence =
      detail?.canonicalInspectorProjection?.resultingRevisionEvidence[0];
    expect(revisionEvidence?.sourceId).toBeUndefined();
    expect(revisionEvidence?.sourceObjectHref).toBeNull();
    expect(
      revisionEvidence?.canonicalEvidenceDrilldown?.selectionId,
    ).toMatch(/^canonical-evidence-[a-f0-9]{64}$/);
    expect(
      revisionEvidence?.canonicalEvidenceDrilldown?.selectionId,
    ).not.toContain(MODEL_UPDATE_ID);
    expect(
      revisionEvidence?.canonicalEvidenceDrilldown?.selectionId,
    ).not.toBe(directEvidence?.canonicalEvidenceDrilldown?.selectionId);
    expect(revisionEvidence?.canonicalEvidenceDrilldown).toMatchObject({
      evidenceClass: "resulting_revision_evidence",
      evidenceClassLabel: "Resulting revision evidence",
      sourceType: "message",
      sourceTypeLabel: "Conversation message",
      role: "supports",
      roleLabel: "Supporting",
      title: "Conversation message · 28 Jul 2026, 13:02",
      summary: null,
      snippet: "Independent resulting-revision source body.",
      recordedAt: "2026-07-28T12:02:00.000Z",
      recordedLabel: "28 Jul 2026, 13:02",
      provenanceLabel: "Resulting revision evidence",
      sourceDisclosure: "available",
      returnSelectionId: MODEL_UPDATE_ID,
    });
    // Resulting-revision Inspector evidence is loaded from its own UEL query.
    expect(
      findManyEvidenceLinks.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes("canonical_concept_revision"),
      ),
    ).toBe(true);
    expect(
      findManyEvidenceLinks.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes('"model_update"'),
      ),
    ).toBe(true);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("canonicalConceptId");
    expect(serialized).not.toContain("previousRevisionId");
    expect(serialized).not.toContain("resultingRevisionId");
    expect(serialized).not.toContain("exploreProposalId");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("movementRationale");
    expect(serialized).not.toContain("msg-1");
    expect(serialized).not.toContain("msg-2");
    expect(serialized).not.toContain("session-1");
    expect(serialized).not.toContain("session-2");
    expect(serialized).not.toContain("uel-direct-1");
    expect(serialized).not.toContain("uel-revision-1");
    expect(serialized).not.toContain("UEL DIRECT SUMMARY MUST NOT BECOME INSPECTOR TEXT");
    expect(serialized).not.toContain("UEL REVISION SUMMARY MUST NOT BECOME INSPECTOR TEXT");
    expect(serialized).not.toContain("RAW PRIVATE MESSAGE TEXT MUST NOT LEAK");
    expect(serialized).not.toContain("RAW REVISION QUOTE MUST NOT LEAK");
    // Public continuity label must not become Inspector evidence meaning.
    expect(
      directEvidence?.canonicalEvidenceDrilldown?.title,
    ).not.toBe("Linked evidence");
    expect(
      revisionEvidence?.canonicalEvidenceDrilldown?.title,
    ).not.toBe("Linked evidence");
    expect(serialized).toContain("The user said they like tea again now.");
    expect(serialized).toContain("Independent resulting-revision source body.");
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
