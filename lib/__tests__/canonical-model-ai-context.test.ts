/**
 * Phase 5 — canonical AI prompt context.
 */

import { describe, expect, it } from "vitest";
import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
} from "@prisma/client";

import {
  buildCanonicalModelPromptBlock,
  CANONICAL_MODEL_PROMPT_HEADING,
} from "../canonical-model-ai-context";
import {
  CanonicalModelAuthorityError,
  isCanonicalModelAuthorityError,
} from "../canonical-model-authority-errors";
import type { CanonicalModelProjectionV1 } from "../canonical-model-projection";

function sampleProjection(): CanonicalModelProjectionV1 {
  return {
    projectionVersion: "canonical_model_projection:v1",
    userId: "user_1",
    concepts: [
      {
        authorityType: "canonical_concept_revision",
        concept: {
          id: "concept_1",
          registrationKey: "legacy:usermap_conclusion:umc_1",
          domain: "operating_logic",
          lifecycleStatus: "active",
          currentRevisionId: "rev2",
          createdAt: "2026-07-27T12:00:00.000Z",
          updatedAt: "2026-07-28T12:00:00.000Z",
        },
        currentRevision: {
          id: "rev2",
          conceptId: "concept_1",
          version: 2,
          title: "Recovery boundary",
          summary: "REVISION TWO",
          status: "emerging",
          confidenceScore: 0.55,
          confidenceLevel: "medium",
          evidenceCount: 1,
          rationale: "Because of new evidence",
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: "2026-07-28T12:00:00.000Z",
          registrationSnapshotHash: null,
          previousRevisionId: "rev1",
          createdFromProposalId: "prop_1",
          evidence: [
            {
              id: "ev",
              sourceType: UnderstandingLinkSourceType.journal_entry,
              sourceId: "j1",
              role: UnderstandingLinkRole.supports,
              summary: "support",
              snippet: "snippet",
              quote: "quote",
            },
          ],
        },
        revisionHistory: [
          {
            id: "rev1",
            conceptId: "concept_1",
            version: 1,
            title: "Recovery boundary",
            summary: "REVISION ONE",
            status: "emerging",
            confidenceScore: 0.55,
            confidenceLevel: "medium",
            evidenceCount: 0,
            rationale: null,
            operation: CanonicalRevisionOperation.registered,
            decisionSource: CanonicalRevisionDecisionSource.legacy_registration,
            acceptedAt: "2026-07-27T12:00:00.000Z",
            registrationSnapshotHash: "umc_snap_v1:abc",
            previousRevisionId: null,
            createdFromProposalId: null,
            evidence: [],
          },
          {
            id: "rev2",
            conceptId: "concept_1",
            version: 2,
            title: "Recovery boundary",
            summary: "REVISION TWO",
            status: "emerging",
            confidenceScore: 0.55,
            confidenceLevel: "medium",
            evidenceCount: 1,
            rationale: "Because of new evidence",
            operation: CanonicalRevisionOperation.strengthen,
            decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
            acceptedAt: "2026-07-28T12:00:00.000Z",
            registrationSnapshotHash: null,
            previousRevisionId: "rev1",
            createdFromProposalId: "prop_1",
            evidence: [],
          },
        ],
        sourceBindings: [
          {
            id: "b1",
            sourceType: "usermap_conclusion",
            sourceId: "umc_1",
            bindingRole: "legacy_seed",
            createdAt: "2026-07-27T12:00:00.000Z",
          },
        ],
        movementHistory: [
          {
            modelUpdateId: "mu_1",
            exploreProposalId: "prop_1",
            canonicalConceptId: "concept_1",
            previousRevisionId: "rev1",
            resultingRevisionId: "rev2",
            updateType: "conclusion_strengthened",
            beforeSummary: "REVISION ONE",
            afterSummary: "REVISION TWO",
            userFacingSummary: "Strengthened",
            createdAt: "2026-07-28T12:00:00.000Z",
          },
        ],
        capabilities: {
          inspectEvidence: true,
          inspectMovementHistory: true,
          supportedWriteOperations: [],
        },
      },
    ],
  };
}

describe("canonical model AI context", () => {
  it("20-22. includes revision 2 current meaning and excludes rev1-as-current / mutated UMC", () => {
    const block = buildCanonicalModelPromptBlock({
      projection: sampleProjection(),
    });
    expect(block).toContain(CANONICAL_MODEL_PROMPT_HEADING);
    expect(block).toContain("concept_id: concept_1");
    expect(block).toContain("current_revision_id: rev2");
    expect(block).toContain("version: 2");
    expect(block).toContain("summary: REVISION TWO");
    expect(block).not.toMatch(/summary: REVISION ONE/);
    expect(block).not.toContain("MUTATED LEGACY");
    expect(block).toContain("latest_model_update_id: mu_1");
  });

  it("23. excludes internal hashes, notes, candidates, and raw quotes", () => {
    const block = buildCanonicalModelPromptBlock({
      projection: sampleProjection(),
    });
    expect(block).not.toContain("registrationSnapshotHash");
    expect(block).not.toContain("internalNotes");
    expect(block).not.toContain("quote: quote");
    expect(block).not.toContain("candidate");
    expect(block).not.toContain("rejected");
  });

  it("24. emits no block when there are zero canonical concepts", () => {
    const block = buildCanonicalModelPromptBlock({
      projection: {
        projectionVersion: "canonical_model_projection:v1",
        userId: "user_1",
        concepts: [],
      },
    });
    expect(block).toBe("");
  });

  it("25. broken projection error remains typed for chat fail-closed", () => {
    const error = new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "broken pointer",
    );
    expect(isCanonicalModelAuthorityError(error)).toBe(true);
    expect(error.code).toBe("BROKEN_CANONICAL_PROJECTION");
  });
});
