/**
 * FINAL DEL-001B database-concurrency + strict-parser corrections.
 * Deterministic fakes only — no live providers, no deployed DB.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  deriveExploreMovementModelUpdateId,
  EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
} from "../explore-movement-proposal-provenance";
import {
  publishExploreMovementProposal,
  rejectExploreMovementProposal,
} from "../explore-movement-proposal";
import {
  parseExploreMovementSemanticDecision,
} from "../explore-movement-semantic-contract";
import {
  ASSISTANT_MSG_ID,
  SEMANTIC_USER_ID,
  SESSION_ID,
  UMC_ID,
  USER_MSG_ID,
  makeSemanticTestDb,
  validProposeDecision,
  validProvenance,
} from "./helpers/explore-movement-semantic-test-helpers";

const ROOT = join(__dirname, "../..");
const UMC_SUMMARY =
  "Evening recovery boundary weakens when meetings stack without a hard stop.";

function proposedRow(args: {
  id: string;
  status?: ExploreMovementProposalStatus;
  modelUpdateId?: string | null;
  sourcesJson?: unknown;
}) {
  const decision = validProposeDecision();
  return {
    id: args.id,
    userId: SEMANTIC_USER_ID,
    conversationId: SESSION_ID,
    assistantMessageId: ASSISTANT_MSG_ID,
    userMessageId: USER_MSG_ID,
    status: args.status ?? ExploreMovementProposalStatus.proposed,
    affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
    affectedObjectId: UMC_ID,
    beforeSummary: UMC_SUMMARY,
    afterSummary: decision.afterSummary,
    rationale: decision.rationale,
    userFacingSummary: decision.userFacingSummary,
    sourcesJson: args.sourcesJson ?? validProvenance(),
    modelUpdateId: args.modelUpdateId ?? null,
  };
}

describe("DEL-001B strict semantic parser", () => {
  it("rejects unknown fields on direct domain input without stripping", () => {
    const parsed = parseExploreMovementSemanticDecision({
      ...validProposeDecision(),
      unexpectedProviderField: "leak",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects propose + routedObjectType including UserMapConclusion", () => {
    expect(
      parseExploreMovementSemanticDecision({
        ...validProposeDecision(),
        routedObjectType: "UserMapConclusion",
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        decision: {
          outcome: "PROPOSE_CONCLUSION_STRENGTHENING",
          proposedObjectType: "UserMapConclusion",
          targetObjectId: UMC_ID,
          afterSummary: validProposeDecision().afterSummary,
          rationale: validProposeDecision().rationale,
          userFacingSummary: validProposeDecision().userFacingSummary,
          confidence: 0.7,
          alternativeInterpretation: "alt",
          qualificationContext: "qual",
          evidenceSourceIds: ["journal-verified-semantic"],
          routedObjectType: "UserMapConclusion",
        },
      }).ok
    ).toBe(false);
  });

  it("rejects request-more-evidence / abstain with routedObjectType", () => {
    expect(
      parseExploreMovementSemanticDecision({
        outcome: "REQUEST_MORE_EVIDENCE",
        rationale: "Need more.",
        routedObjectType: "PatternClaim",
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "ABSTAIN",
        rationale: "Stop.",
        routedObjectType: "Investigation",
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        decision: {
          outcome: "ABSTAIN",
          proposedObjectType: null,
          targetObjectId: null,
          afterSummary: null,
          rationale: "Stop.",
          userFacingSummary: null,
          confidence: null,
          alternativeInterpretation: null,
          qualificationContext: null,
          evidenceSourceIds: null,
          routedObjectType: "PatternClaim",
        },
      }).ok
    ).toBe(false);
  });

  it("rejects route + populated proposal fields", () => {
    expect(
      parseExploreMovementSemanticDecision({
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
        routedObjectType: "PatternClaim",
        rationale: "Pattern path.",
        targetObjectId: UMC_ID,
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        decision: {
          outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
          proposedObjectType: "UserMapConclusion",
          targetObjectId: UMC_ID,
          afterSummary: "x",
          rationale: "Pattern path.",
          userFacingSummary: "y",
          confidence: 0.7,
          alternativeInterpretation: "a",
          qualificationContext: "b",
          evidenceSourceIds: ["journal-verified-semantic"],
          routedObjectType: "PatternClaim",
        },
      }).ok
    ).toBe(false);
  });

  it("rejects unknown fields in the OpenAI envelope and nested decision", () => {
    expect(
      parseExploreMovementSemanticDecision({
        decision: {
          outcome: "ABSTAIN",
          proposedObjectType: null,
          targetObjectId: null,
          afterSummary: null,
          rationale: "Stop.",
          userFacingSummary: null,
          confidence: null,
          alternativeInterpretation: null,
          qualificationContext: null,
          evidenceSourceIds: null,
          routedObjectType: null,
        },
        extraEnvelopeKey: true,
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        decision: {
          outcome: "ABSTAIN",
          proposedObjectType: null,
          targetObjectId: null,
          afterSummary: null,
          rationale: "Stop.",
          userFacingSummary: null,
          confidence: null,
          alternativeInterpretation: null,
          qualificationContext: null,
          evidenceSourceIds: null,
          routedObjectType: null,
          nestedUnknown: "nope",
        },
      }).ok
    ).toBe(false);
  });
});

describe("DEL-001B publication concurrency and claim semantics", () => {
  it("source: no ModelUpdate P2002 catch then same-tx query recovery", () => {
    const source = readFileSync(
      join(ROOT, "lib/explore-movement-proposal.ts"),
      "utf8"
    );
    expect(source).toContain("createMany");
    expect(source).toContain("skipDuplicates: true");
    expect(source).not.toMatch(
      /modelUpdate\.create\([\s\S]*?catch\s*\([\s\S]*?P2002[\s\S]*?modelUpdate\.findFirst/
    );
    expect(source).not.toMatch(
      /isPrismaUniqueConflict\(error\)[\s\S]{0,200}tx\.modelUpdate\.findFirst/
    );
  });

  it("createMany skipDuplicates is conflict-free and re-reads one ModelUpdate", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_skip_dup" })],
    });
    const modelUpdateId = deriveExploreMovementModelUpdateId("p_skip_dup");

    await harness.db.$transaction(async (tx) => {
      await tx.modelUpdate.createMany({
        data: [
          {
            id: modelUpdateId,
            userId: SEMANTIC_USER_ID,
            updateType: "conclusion_strengthened",
            visibility: "internal_only",
            affectedObjectType: "usermap_conclusion",
            affectedObjectId: UMC_ID,
            userFacingSummary: "u",
            isMeaningful: false,
            beforeSummary: UMC_SUMMARY,
            afterSummary: "a",
            internalNotes: "exploreMovementProposal:v1;proposalId=p_skip_dup",
          },
        ],
        skipDuplicates: true,
      });
      await tx.modelUpdate.createMany({
        data: [
          {
            id: modelUpdateId,
            userId: SEMANTIC_USER_ID,
            updateType: "conclusion_strengthened",
            visibility: "internal_only",
            affectedObjectType: "usermap_conclusion",
            affectedObjectId: UMC_ID,
            userFacingSummary: "u",
            isMeaningful: false,
            beforeSummary: UMC_SUMMARY,
            afterSummary: "a",
            internalNotes: "exploreMovementProposal:v1;proposalId=p_skip_dup",
          },
        ],
        skipDuplicates: true,
      });
      const row = await tx.modelUpdate.findFirst({
        where: { id: modelUpdateId, userId: SEMANTIC_USER_ID },
      });
      expect(row?.id).toBe(modelUpdateId);
    });

    expect(harness.modelUpdates).toHaveLength(1);
  });

  it("concurrent publishers: one CAS winner, losers recover outside with same ModelUpdate ID", async () => {
    const proposalId = "p_cas_concurrent";
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: proposalId })],
    });
    const expectedMu = deriveExploreMovementModelUpdateId(proposalId);

    const results = await Promise.all(
      [0, 1, 2].map(() =>
        publishExploreMovementProposal({
          userId: SEMANTIC_USER_ID,
          proposalId,
          conversationId: SESSION_ID,
          db: harness.db,
        })
      )
    );

    const published = results.filter(
      (row) => typeof row !== "string" && row.status === "published"
    );
    expect(published).toHaveLength(3);
    const ids = new Set(
      published.map((row) =>
        typeof row === "string" ? "" : row.modelUpdateId
      )
    );
    expect(ids).toEqual(new Set([expectedMu]));
    expect(harness.modelUpdates).toHaveLength(1);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.published
    );
    expect(harness.proposals[0]?.modelUpdateId).toBe(expectedMu);

    const idempotentCount = published.filter(
      (row) => typeof row !== "string" && row.idempotent
    ).length;
    expect(idempotentCount).toBeGreaterThanOrEqual(1);
  });

  it("reject-then-publish leaves zero committed ModelUpdates", async () => {
    const proposalId = "p_reject_then_publish";
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: proposalId })],
    });

    await expect(
      rejectExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId,
        db: harness.db,
      })
    ).resolves.toEqual({ proposalId, status: "rejected" });

    const publishResult = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId,
      conversationId: SESSION_ID,
      db: harness.db,
    });

    expect(publishResult).toBe("rejected");
    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.rejected
    );
  });

  it("concurrent rejection is never overwritten by publication", async () => {
    const proposalId = "p_reject_vs_publish";
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: proposalId })],
    });

    const [rejectResult, publishResult] = await Promise.all([
      rejectExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId,
        db: harness.db,
      }),
      publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId,
        conversationId: SESSION_ID,
        db: harness.db,
      }),
    ]);

    if (harness.proposals[0]?.status === ExploreMovementProposalStatus.rejected) {
      expect(rejectResult).toEqual({ proposalId, status: "rejected" });
      expect(publishResult).toBe("rejected");
      expect(harness.modelUpdates).toHaveLength(0);
      expect(harness.evidenceLinks).toHaveLength(0);
      expect(harness.proposals[0]?.modelUpdateId).toBeNull();
    } else {
      expect(harness.proposals[0]?.status).toBe(
        ExploreMovementProposalStatus.published
      );
      expect(rejectResult).toBe("already_published");
      expect(publishResult).toMatchObject({ status: "published" });
      expect(harness.modelUpdates).toHaveLength(1);
      expect(harness.proposals[0]?.modelUpdateId).toBe(
        deriveExploreMovementModelUpdateId(proposalId)
      );
    }
  });

  it("target baseline change inside the transaction boundary causes rollback", async () => {
    const proposalId = "p_target_drift";
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: proposalId })],
    });

    let flipped = false;
    const originalUmcFind = harness.raw.userMapConclusion.findFirst.bind(
      harness.raw.userMapConclusion
    );
    harness.raw.userMapConclusion.findFirst = async (args: {
      where: { id?: string; userId?: string };
    }) => {
      const row = await originalUmcFind(args);
      // First call is pre-txn provenance gate; second is in-txn revalidation.
      if (row && flipped === false) {
        // After pre-check, mutate canonical summary before in-txn re-read.
        flipped = true;
        return row;
      }
      if (flipped) {
        harness.umc.summary = "Canonical summary changed concurrently.";
      }
      return originalUmcFind(args);
    };

    // Pre-txn gate sees original; mutate before publish enters txn revalidation.
    const originalTxn = harness.raw.$transaction.bind(harness.raw);
    harness.raw.$transaction = async <T,>(
      fn: (tx: unknown) => Promise<T>
    ): Promise<T> => {
      harness.umc.summary = "Canonical summary changed concurrently.";
      return originalTxn(fn);
    };

    const result = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId,
      conversationId: SESSION_ID,
      db: harness.db,
    });

    expect(result).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);
    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );
  });

  it("forced UEL failure still rolls back with zero committed writes", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_uel_rollback" })],
      hooks: { failUelUpsert: true },
    });

    await expect(
      publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_uel_rollback",
        conversationId: SESSION_ID,
        db: harness.db,
      })
    ).rejects.toThrow(/injected_uel_upsert_failure/);

    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );
  });
});
