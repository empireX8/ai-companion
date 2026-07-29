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
const findFirstProposal = vi.fn();
const findManyProposals = vi.fn();
const readConceptMock = vi.fn();

vi.mock("../prismadb", () => ({
  default: {
    modelUpdate: { findFirst: (...args: unknown[]) => findFirstMu(...args) },
    exploreMovementProposal: {
      findFirst: (...args: unknown[]) => findFirstProposal(...args),
      findMany: (...args: unknown[]) => findManyProposals(...args),
    },
    understandingEvidenceLink: { findMany: vi.fn(async () => []) },
    userMapConclusion: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    investigation: { findFirst: vi.fn(async () => null) },
    fieldworkAssignment: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    patternClaim: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
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
    findFirstProposal.mockReset();
    findManyProposals.mockReset();
    readConceptMock.mockReset();
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
});
