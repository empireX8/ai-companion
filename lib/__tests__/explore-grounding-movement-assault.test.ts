import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  PrismaClient,
} from "@prisma/client";

import {
  emptyExploreGroundingPayload,
  groundingSourceIds,
  isExploreGroundingPayload,
  payloadHasVerifiedAndInferred,
  type ExploreGroundingPayload,
  type ExploreGroundingSource,
} from "../explore-grounding-contract";
import {
  cleanupExploreAssaultRuntimeFixture,
  exploreAssaultFixtureAllowed,
  FIXTURE_CLAIM_EVIDENCE_ID,
  FIXTURE_JOURNAL_VERIFIED_ID,
  seedExploreAssaultRuntimeFixture,
} from "../explore-grounding-movement-runtime-fixture";
import {
  createExploreMovementProposal,
  publishExploreMovementProposal,
  rejectExploreMovementProposal,
} from "../explore-movement-proposal";
import { buildExploreMovementProposalProvenance } from "../explore-movement-proposal-provenance";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
} from "../orvek-intelligence-kernel/objectivity-referee";
import {
  EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV,
  exploreAssaultDeterministicReplyAllowed,
} from "../explore-assault-test-provider";
import {
  collectOwnedExploreGroundingCandidates,
  selectExploreGroundingSources,
} from "../explore-grounding-retrieval";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";

const LOCAL_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/companion";
const FIXTURE_USER_ID = "user_explore_grounding_assault_unit";
const FIXTURE_CROSS_USER_ID = "user_explore_grounding_assault_cross_unit";
const shouldAttemptLocalFixtureDb =
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE === "1";

function sampleSource(overrides: Partial<ExploreGroundingSource> = {}): ExploreGroundingSource {
  return {
    sourceId: FIXTURE_JOURNAL_VERIFIED_ID,
    sourceType: "journal_entry",
    sourceFamily: "journal_entry",
    userId: FIXTURE_USER_ID,
    title: "Stop point slip",
    extract: "I keep working past the stop point even when I said I would not.",
    retrievalReason: "Stored extract directly supports the conversational claim.",
    claimSupport: "verifies",
    epistemicStatus: "VERIFIED",
    ...overrides,
  };
}

describe.skipIf(!shouldAttemptLocalFixtureDb)("explore grounding movement assault contract", () => {
  let prisma: PrismaClient;
  const previousCanonicalFlag = process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
  const previousCanonicalAllowlist =
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];

  beforeAll(async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    // Isolate from external canonical gate env — assault exercises legacy path only.
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];

    if (!exploreAssaultFixtureAllowed(process.env)) {
      throw new Error("Explore assault fixture safety gate refused local DB setup");
    }

    prisma = new PrismaClient({
      datasources: { db: { url: LOCAL_DATABASE_URL } },
    });

    await cleanupExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanupExploreAssaultRuntimeFixture({
        userId: FIXTURE_USER_ID,
        crossUserId: FIXTURE_CROSS_USER_ID,
        db: prisma,
      });
      await prisma.$disconnect();
    }

    if (previousCanonicalFlag === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = previousCanonicalFlag;
    }
    if (previousCanonicalAllowlist === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] =
        previousCanonicalAllowlist;
    }
  });

  it("builds empty vs grounded payload helpers correctly", () => {
    const empty = emptyExploreGroundingPayload({
      conversationId: "c1",
      assistantMessageId: "a1",
      userMessageId: "u1",
    });
    expect(isExploreGroundingPayload(empty)).toBe(true);
    expect(empty.status).toBe("ungrounded");
    expect(empty.sources).toEqual([]);
    expect(empty.movementProposal.status).toBe("none");
    expect(groundingSourceIds(empty)).toEqual([]);

    const insufficient = emptyExploreGroundingPayload({
      conversationId: "c1",
      assistantMessageId: "a1",
      userMessageId: "u1",
      status: "insufficient_evidence",
    });
    expect(insufficient.movementProposal.status).toBe("insufficient_evidence");

    const grounded: ExploreGroundingPayload = {
      ...empty,
      status: "grounded",
      sources: [
        sampleSource(),
        sampleSource({
          sourceId: FIXTURE_CLAIM_EVIDENCE_ID,
          sourceType: "pattern_claim_evidence",
          sourceFamily: "pattern_claim_evidence",
          epistemicStatus: "INFERRED",
          claimSupport: "infers",
        }),
      ],
      claims: [
        {
          text: "Verified stop-point claim",
          epistemicStatus: "VERIFIED",
          sourceIds: [FIXTURE_JOURNAL_VERIFIED_ID],
        },
      ],
      movementProposal: {
        status: "proposed",
        proposalId: "proposal-1",
        modelUpdateId: null,
        beforeSummary: "before",
        afterSummary: "after",
        rationale: "reason",
      },
    };

    expect(isExploreGroundingPayload(grounded)).toBe(true);
    expect(payloadHasVerifiedAndInferred(grounded)).toBe(true);
    expect(groundingSourceIds(grounded)).toEqual([
      FIXTURE_JOURNAL_VERIFIED_ID,
      FIXTURE_CLAIM_EVIDENCE_ID,
    ]);
  });

  it("selects verified and inferred sources and excludes reference-sample ids", async () => {
    await seedExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });

    const referenceSampleIdPattern = /^(d\d+|m-claim-\d+|r\d+|rep-)/i;
    expect(referenceSampleIdPattern.test("d1")).toBe(true);
    expect(referenceSampleIdPattern.test("rep-abc")).toBe(true);
    expect(referenceSampleIdPattern.test(FIXTURE_JOURNAL_VERIFIED_ID)).toBe(false);

    const candidates = await collectOwnedExploreGroundingCandidates({
      userId: FIXTURE_USER_ID,
      db: prisma,
    });
    expect(candidates.some((row) => row.sourceId === FIXTURE_JOURNAL_VERIFIED_ID)).toBe(true);
    expect(candidates.some((row) => row.sourceId === FIXTURE_CLAIM_EVIDENCE_ID)).toBe(true);
    expect(candidates.every((row) => !referenceSampleIdPattern.test(row.sourceId))).toBe(true);
    expect(candidates.every((row) => row.userId === FIXTURE_USER_ID)).toBe(true);
    expect(candidates.some((row) => row.userId === FIXTURE_CROSS_USER_ID)).toBe(false);

    const sources = selectExploreGroundingSources({
      userId: FIXTURE_USER_ID,
      queryText: "stop point evenings named boundary",
      replyText: "stop point evenings",
      candidates: [
        {
          sourceId: FIXTURE_JOURNAL_VERIFIED_ID,
          sourceType: "journal_entry" as const,
          sourceFamily: "journal_entry" as const,
          userId: FIXTURE_USER_ID,
          title: "Verified journal",
          extract: "I ignore stop point evenings repeatedly when tired.",
          tokens: ["ignore", "stop", "point", "evenings", "repeatedly", "tired"],
        },
        {
          sourceId: FIXTURE_CLAIM_EVIDENCE_ID,
          sourceType: "pattern_claim_evidence" as const,
          sourceFamily: "pattern_claim_evidence" as const,
          userId: FIXTURE_USER_ID,
          title: "Inferred pattern",
          extract: "Named boundary matters for recovery energy after work.",
          tokens: ["named", "boundary", "matters", "recovery", "energy", "work"],
        },
      ],
    });

    expect(
      payloadHasVerifiedAndInferred({
        version: "explore-grounding-v1",
        status: "grounded",
        conversationId: "c",
        assistantMessageId: "a",
        userMessageId: "u",
        sources,
        claims: [],
        movementProposal: {
          status: "none",
          proposalId: null,
          modelUpdateId: null,
          beforeSummary: null,
          afterSummary: null,
          rationale: null,
        },
      })
    ).toBe(true);
    expect(sources.map((source) => source.sourceId)).toContain(FIXTURE_JOURNAL_VERIFIED_ID);
    expect(sources.map((source) => source.sourceId)).toContain(FIXTURE_CLAIM_EVIDENCE_ID);
    expect(sources.map((source) => source.sourceId)).not.toContain("d1");
    expect(sources.every((source) => source.userId === FIXTURE_USER_ID)).toBe(true);
  });

  it("creates rejects and publishes explore movement proposals idempotently", async () => {
    const seeded = await seedExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });

    const userMessage = await prisma.message.create({
      data: {
        userId: FIXTURE_USER_ID,
        sessionId: seeded.sessionId,
        role: "user",
        content: "Unit assault user message about stop point after meetings",
      },
      select: { id: true },
    });
    const assistantMessage = await prisma.message.create({
      data: {
        userId: FIXTURE_USER_ID,
        sessionId: seeded.sessionId,
        role: "assistant",
        content: "Unit assault assistant reply",
      },
      select: { id: true },
    });

    const sources = [
      sampleSource({ userId: FIXTURE_USER_ID, sourceId: seeded.verifiedJournalId }),
      sampleSource({
        userId: FIXTURE_USER_ID,
        sourceId: seeded.inferredEvidenceId,
        sourceType: "pattern_claim_evidence",
        sourceFamily: "pattern_claim_evidence",
        epistemicStatus: "INFERRED",
        claimSupport: "infers",
      }),
    ];

    const afterSummary = "after summary strengthens evening recovery boundary";
    const rationale = "unit rationale grounded in owned evidence";
    const userFacingSummary = "Possible model movement from Explore unit test";
    const publishableProvenance = buildExploreMovementProposalProvenance({
      sources,
      semanticDecision: {
        outcome: "PROPOSE_CONCLUSION_STRENGTHENING",
        proposedObjectType: "UserMapConclusion",
        targetObjectId: seeded.conclusionId,
        afterSummary,
        rationale,
        userFacingSummary,
        confidence: 0.72,
        alternativeInterpretation: "Could be a one-off fatigue episode.",
        qualificationContext: "Applies under stacked meeting load.",
        evidenceSourceIds: sources.map((source) => source.sourceId),
      },
      refereeResult: {
        interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
        executionState: "completed",
        outcome: "PASS",
        rationale: "Within owned evidence.",
        proposedObjectType: "UserMapConclusion",
        proposedConfidence: 0.72,
        adjustedConfidence: null,
        routedObjectType: null,
        validationErrors: [],
        continuationAllowed: true,
        errorMessage: null,
      },
      providerMetadata: {
        providerId: "injected",
        adjudicatorModelId: "assault-adjudicator",
        refereeModelId: "assault-referee",
        adjudicatorCalls: 1,
        refereeCalls: 1,
        totalCalls: 2,
      },
    });

    const created = await createExploreMovementProposal({
      userId: FIXTURE_USER_ID,
      db: prisma,
      conversationId: seeded.sessionId,
      assistantMessageId: assistantMessage.id,
      userMessageId: userMessage.id,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: seeded.conclusionId,
      beforeSummary: "Commitments lock before the body signals a stop.",
      afterSummary,
      rationale,
      userFacingSummary,
      provenance: publishableProvenance,
    });

    expect(created.proposalId).toBeTruthy();
    expect(created.status).toBe("proposed");
    expect(created.modelUpdateId).toBeNull();

    const prePublishModelUpdateCount = await prisma.modelUpdate.count({
      where: { id: created.proposalId },
    });
    expect(prePublishModelUpdateCount).toBe(0);

    const proposalRow = await prisma.exploreMovementProposal.findUnique({
      where: { id: created.proposalId },
    });
    expect(proposalRow?.status).toBe("proposed");
    expect(proposalRow?.modelUpdateId).toBeNull();

    const rejectedOther = await createExploreMovementProposal({
      userId: FIXTURE_USER_ID,
      db: prisma,
      conversationId: seeded.sessionId,
      assistantMessageId: assistantMessage.id,
      userMessageId: userMessage.id,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: seeded.conclusionId,
      beforeSummary: "before 2",
      afterSummary: "after 2",
      rationale: "reject path",
      userFacingSummary: "Reject path proposal",
      sources,
    });

    const rejectResult = await rejectExploreMovementProposal({
      userId: FIXTURE_USER_ID,
      proposalId: rejectedOther.proposalId,
      db: prisma,
    });
    expect(rejectResult).toEqual({
      proposalId: rejectedOther.proposalId,
      status: "rejected",
    });

    const rejectedRow = await prisma.exploreMovementProposal.findUnique({
      where: { id: rejectedOther.proposalId },
      select: { status: true, modelUpdateId: true },
    });
    expect(rejectedRow?.status).toBe("rejected");
    expect(rejectedRow?.modelUpdateId).toBeNull();
    expect(
      await prisma.modelUpdate.count({ where: { id: rejectedOther.proposalId } })
    ).toBe(0);

    const published = await publishExploreMovementProposal({
      userId: FIXTURE_USER_ID,
      proposalId: created.proposalId,
      db: prisma,
    });
    expect(published).toMatchObject({
      status: "published",
      idempotent: false,
    });
    if (typeof published === "string") {
      throw new Error(`unexpected publish result ${published}`);
    }
    expect(published.modelUpdateId).not.toBe(created.proposalId);
    expect(published.modelUpdateId.length).toBeGreaterThan(8);

    const republished = await publishExploreMovementProposal({
      userId: FIXTURE_USER_ID,
      proposalId: created.proposalId,
      db: prisma,
    });
    expect(republished).toMatchObject({
      modelUpdateId: published.modelUpdateId,
      status: "published",
      idempotent: true,
    });

    const visibleCount = await prisma.modelUpdate.count({
      where: {
        userId: FIXTURE_USER_ID,
        id: published.modelUpdateId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      },
    });
    expect(visibleCount).toBe(1);

    const linkedProposal = await prisma.exploreMovementProposal.findUnique({
      where: { id: created.proposalId },
      select: { status: true, modelUpdateId: true },
    });
    expect(linkedProposal).toEqual({
      status: "published",
      modelUpdateId: published.modelUpdateId,
    });
  });

  it("exploreAssaultDeterministicReplyAllowed refuses production", () => {
    expect(
      exploreAssaultDeterministicReplyAllowed({
        NODE_ENV: "production",
        DATABASE_URL: LOCAL_DATABASE_URL,
        [EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV]: "1",
      })
    ).toBe(false);

    expect(
      exploreAssaultDeterministicReplyAllowed({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://prod.amazonaws.com/db",
        [EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV]: "1",
      })
    ).toBe(false);

    expect(
      exploreAssaultDeterministicReplyAllowed({
        NODE_ENV: "test",
        DATABASE_URL: LOCAL_DATABASE_URL,
        [EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV]: "1",
      })
    ).toBe(true);
  });

  it("fixture cleanup leaves zero when empty", async () => {
    const cleanupEmpty = await cleanupExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });
    expect(cleanupEmpty.remainingConversations).toBe(0);
    expect(cleanupEmpty.remainingMessages).toBe(0);
    expect(cleanupEmpty.remainingProposals).toBe(0);
    expect(cleanupEmpty.remainingModelUpdates).toBe(0);
    expect(cleanupEmpty.remainingMovementEvidenceLinks).toBe(0);
    expect(cleanupEmpty.remainingSeededMapEvidenceObjects).toBe(0);

    await seedExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });

    const cleanup = await cleanupExploreAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      crossUserId: FIXTURE_CROSS_USER_ID,
      db: prisma,
    });
    expect(cleanup.remainingConversations).toBe(0);
    expect(cleanup.remainingMessages).toBe(0);
    expect(cleanup.remainingProposals).toBe(0);
    expect(cleanup.remainingModelUpdates).toBe(0);
    expect(cleanup.remainingMovementEvidenceLinks).toBe(0);
    expect(cleanup.remainingSeededMapEvidenceObjects).toBe(0);
    expect(cleanup.deletedConversations).toBeGreaterThan(0);
  });
});
