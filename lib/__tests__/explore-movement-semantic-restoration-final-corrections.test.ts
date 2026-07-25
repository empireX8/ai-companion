/**
 * FINAL NARROW DEL-001B code-review corrections A–D.
 * Deterministic fakes only — no live providers, no deployed DB.
 */

import { describe, expect, it } from "vitest";
import {
  ExploreMovementProposalStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  buildExploreMovementProposalProvenance,
  deriveExploreMovementProposalId,
  EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
} from "../explore-movement-proposal-provenance";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../explore-movement-proposal";
import {
  ASSISTANT_MSG_ID,
  SEMANTIC_USER_ID,
  SESSION_ID,
  UMC_ID,
  USER_MSG_ID,
  completedPassReferee,
  makeSemanticTestDb,
  sampleOwnedSources,
  validProposeDecision,
  validProvenance,
} from "./helpers/explore-movement-semantic-test-helpers";

const UMC_SUMMARY =
  "Evening recovery boundary weakens when meetings stack without a hard stop.";
const OTHER_SESSION_ID = "session_semantic_mismatch";

function createArriveBarrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async arrive() {
      arrived += 1;
      if (arrived >= parties) release();
      await gate;
    },
    get arrivedCount() {
      return arrived;
    },
  };
}

function proposedRow(args: {
  id: string;
  status?: ExploreMovementProposalStatus;
  modelUpdateId?: string | null;
  conversationId?: string;
  sourcesJson?: unknown;
}) {
  const decision = validProposeDecision();
  return {
    id: args.id,
    userId: SEMANTIC_USER_ID,
    conversationId: args.conversationId ?? SESSION_ID,
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

describe("DEL-001B final correction A — conversation evidence roles", () => {
  it("assigns supports to user message and context to assistant; never supports on assistant", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_roles" })],
    });

    const result = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId: "p_roles",
      conversationId: SESSION_ID,
      db: harness.db,
    });

    expect(result).toMatchObject({ status: "published" });

    const userLink = harness.evidenceLinks.find(
      (row) =>
        row.sourceType === UnderstandingLinkSourceType.message &&
        row.sourceId === USER_MSG_ID
    );
    const assistantLink = harness.evidenceLinks.find(
      (row) =>
        row.sourceType === UnderstandingLinkSourceType.message &&
        row.sourceId === ASSISTANT_MSG_ID
    );

    expect(userLink?.role).toBe(UnderstandingLinkRole.supports);
    expect(assistantLink?.role).toBe(UnderstandingLinkRole.context);

    const assistantSupports = harness.evidenceLinks.filter(
      (row) =>
        row.sourceType === UnderstandingLinkSourceType.message &&
        row.sourceId === ASSISTANT_MSG_ID &&
        row.role === UnderstandingLinkRole.supports
    );
    expect(assistantSupports).toHaveLength(0);
  });

  it("blocks owned assistant-message provenance sources before any mutation", async () => {
    const decision = validProposeDecision({
      evidenceSourceIds: [ASSISTANT_MSG_ID, "journal-verified-semantic"],
    });
    const assistantAsEvidence = {
      sourceId: ASSISTANT_MSG_ID,
      sourceType: "message" as const,
      sourceFamily: "message" as const,
      userId: SEMANTIC_USER_ID,
      title: "Assistant reply",
      extract: "Assistant prose must not become supporting evidence.",
      retrievalReason: "Forged assistant provenance source.",
      claimSupport: "verifies" as const,
      epistemicStatus: "VERIFIED" as const,
    };
    const provenance = buildExploreMovementProposalProvenance({
      sources: [assistantAsEvidence, sampleOwnedSources()[0]],
      semanticDecision: decision,
      refereeResult: completedPassReferee({
        proposedConfidence: decision.confidence,
      }),
      providerMetadata: {
        providerId: "injected",
        adjudicatorModelId: "fake-adjudicator",
        refereeModelId: "fake-referee",
        adjudicatorCalls: 1,
        refereeCalls: 1,
        totalCalls: 2,
      },
    });

    const harness = makeSemanticTestDb({
      proposals: [
        proposedRow({
          id: "p_assistant_src",
          sourcesJson: provenance,
        }),
      ],
    });

    const result = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId: "p_assistant_src",
      conversationId: SESSION_ID,
      db: harness.db,
    });

    expect(result).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);
    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );
    expect(harness.proposals[0]?.modelUpdateId).toBeNull();
  });
});

describe("DEL-001B final correction B — deterministic proposal P2002 race", () => {
  it("barrier-controlled race: one create, one reuse, single row", async () => {
    const barrier = createArriveBarrier(2);
    let createEntries = 0;
    const harness = makeSemanticTestDb({
      hooks: {
        beforeProposalCreate: async () => {
          createEntries += 1;
          await barrier.arrive();
        },
      },
    });

    const decision = validProposeDecision();
    const provenance = validProvenance();
    const shared = {
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      affectedObjectId: UMC_ID,
      beforeSummary: UMC_SUMMARY,
      afterSummary: decision.afterSummary,
      rationale: decision.rationale,
      userFacingSummary: decision.userFacingSummary,
      provenance,
    };

    const results = await Promise.all([
      createOrReuseSemanticExploreMovementProposal(shared),
      createOrReuseSemanticExploreMovementProposal(shared),
    ]);

    expect(createEntries).toBe(2);
    expect(barrier.arrivedCount).toBe(2);
    expect(harness.proposals).toHaveLength(1);

    const createdCount = results.filter((row) => row.created).length;
    const reuseCount = results.filter((row) => !row.created).length;
    expect(createdCount).toBe(1);
    expect(reuseCount).toBe(1);
    expect(results.every((row) => row.record.proposalId === harness.proposals[0]?.id)).toBe(
      true
    );
  });

  it("invalid raced provenance fails closed", async () => {
    const decision = validProposeDecision();
    const proposalId = deriveExploreMovementProposalId({
      userId: SEMANTIC_USER_ID,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: UMC_ID,
      afterSummary: decision.afterSummary,
    });

    const harness = makeSemanticTestDb({
      proposals: [
        {
          id: proposalId,
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: sampleOwnedSources(),
          modelUpdateId: null,
        },
      ],
    });

    await expect(
      createOrReuseSemanticExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        db: harness.db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        affectedObjectId: UMC_ID,
        beforeSummary: UMC_SUMMARY,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance: validProvenance(),
      })
    ).rejects.toThrow(
      /explore_movement_deterministic_id_occupied_by_invalid_provenance/
    );
  });
});

describe("DEL-001B final correction C — atomic publication", () => {
  it("forced UEL failure rolls back ModelUpdate and leaves proposal proposed", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_uel_fail" })],
      hooks: { failUelUpsert: true },
    });

    await expect(
      publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_uel_fail",
        conversationId: SESSION_ID,
        db: harness.db,
      })
    ).rejects.toThrow(/injected_uel_upsert_failure/);

    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );
    expect(harness.proposals[0]?.modelUpdateId).toBeNull();
  });

  it("forced publish-helper failure leaves zero committed writes", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_pub_fail" })],
      hooks: { failPublishFlip: true },
    });

    await expect(
      publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_pub_fail",
        conversationId: SESSION_ID,
        db: harness.db,
      })
    ).rejects.toThrow(/injected_publish_flip_failure/);

    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );
  });

  it("concurrent publication creates one ModelUpdate; all callers share the ID", async () => {
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_pub_concurrent" })],
    });

    const results = await Promise.all(
      [0, 1, 2].map(() =>
        publishExploreMovementProposal({
          userId: SEMANTIC_USER_ID,
          proposalId: "p_pub_concurrent",
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
    expect(ids.size).toBe(1);
    expect(harness.modelUpdates).toHaveLength(1);
    expect(harness.proposals[0]?.modelUpdateId).toBe(
      harness.modelUpdates[0]?.id
    );
  });

  it("retry after rolled-back failure succeeds safely", async () => {
    let failOnce = true;
    const harness = makeSemanticTestDb({
      proposals: [proposedRow({ id: "p_retry" })],
      hooks: {
        failUelUpsert: () => {
          if (failOnce) {
            failOnce = false;
            return true;
          }
          return false;
        },
      },
    });

    await expect(
      publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_retry",
        conversationId: SESSION_ID,
        db: harness.db,
      })
    ).rejects.toThrow(/injected_uel_upsert_failure/);

    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.proposed
    );

    const retry = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId: "p_retry",
      conversationId: SESSION_ID,
      db: harness.db,
    });

    expect(retry).toMatchObject({ status: "published", idempotent: false });
    expect(harness.modelUpdates).toHaveLength(1);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.published
    );
  });
});

describe("DEL-001B final correction D — route session match before status short-circuits", () => {
  it.each([
    {
      name: "proposed",
      status: ExploreMovementProposalStatus.proposed,
      modelUpdateId: null as string | null,
    },
    {
      name: "rejected",
      status: ExploreMovementProposalStatus.rejected,
      modelUpdateId: null as string | null,
    },
    {
      name: "already-published",
      status: ExploreMovementProposalStatus.published,
      modelUpdateId: "mu_already" as string | null,
    },
  ])(
    "mismatched route session against $name returns controlled block with zero writes",
    async (testCase) => {
      const harness = makeSemanticTestDb({
        proposals: [
          proposedRow({
            id: `p_mismatch_${testCase.name}`,
            status: testCase.status,
            modelUpdateId: testCase.modelUpdateId,
          }),
        ],
      });
      const before = {
        status: harness.proposals[0]?.status,
        modelUpdateId: harness.proposals[0]?.modelUpdateId,
        muCount: harness.modelUpdates.length,
        uelCount: harness.evidenceLinks.length,
      };

      const result = await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: `p_mismatch_${testCase.name}`,
        conversationId: OTHER_SESSION_ID,
        db: harness.db,
      });

      expect(result).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);
      expect(harness.proposals[0]?.status).toBe(before.status);
      expect(harness.proposals[0]?.modelUpdateId).toBe(before.modelUpdateId);
      expect(harness.modelUpdates).toHaveLength(before.muCount);
      expect(harness.evidenceLinks).toHaveLength(before.uelCount);
    }
  );
});
