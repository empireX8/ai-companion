/**
 * Deterministic local runtime fixture for Explore grounding/movement assault.
 * DEV/TEST ONLY — refuses production DATABASE_URL and requires allow flag.
 */

import {
  PatternClaimStatus,
  PatternType,
  Role,
  SessionOrigin,
  StrengthLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  type PrismaClient,
} from "@prisma/client";

import { assessLiveEvidenceDepthFixtureSafety } from "./live-evidence-depth-runtime-fixture";
import { normalizeSummary } from "./pattern-claim-lifecycle";

export const EXPLORE_ASSAULT_FIXTURE_PREFIX = "dev-explore-grounding-movement-assault";
export const EXPLORE_ASSAULT_FIXTURE_MARKER = "devFixture:explore-grounding-movement-assault";

export const FIXTURE_CONCLUSION_ID = `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-conclusion`;
export const FIXTURE_JOURNAL_VERIFIED_ID = `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-journal-verified`;
export const FIXTURE_CLAIM_ID = `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-claim`;
export const FIXTURE_CLAIM_EVIDENCE_ID = `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-claim-evidence`;
/** Deterministic UUIDs — Explore session review/model-update routes require UUID session ids. */
export const FIXTURE_SESSION_ID = "a11ce001-ea01-4000-8000-000000000001";
export const FIXTURE_INSUFFICIENT_SESSION_ID = "a11ce001-ea01-4000-8000-000000000002";
export const FIXTURE_CROSS_USER_JOURNAL_ID = `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-cross-user-journal`;
export const FIXTURE_CROSS_USER_SESSION_ID = "a11ce001-ea01-4000-8000-000000000003";

export const FIXTURE_VERIFIED_EXTRACT =
  "I keep working past the stop point even when I said I would not.";
export const FIXTURE_INFERRED_EXTRACT =
  "Energy drops after meetings without naming a stop point before commitments lock.";

export type ExploreAssaultFixtureSeedResult = {
  conclusionId: string;
  verifiedJournalId: string;
  inferredEvidenceId: string;
  sessionId: string;
  insufficientSessionId: string;
  crossUserJournalId: string;
  crossUserSessionId: string;
};

export function exploreAssaultFixtureAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return assessLiveEvidenceDepthFixtureSafety(env).allowed;
}

export async function seedExploreAssaultRuntimeFixture(args: {
  userId: string;
  crossUserId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<ExploreAssaultFixtureSeedResult> {
  const now = args.now ?? new Date();

  await cleanupExploreAssaultRuntimeFixture({
    userId: args.userId,
    crossUserId: args.crossUserId,
    db: args.db,
  });

  await args.db.userMapConclusion.create({
    data: {
      id: FIXTURE_CONCLUSION_ID,
      userId: args.userId,
      area: UserMapConclusionArea.recovery_architecture,
      status: UserMapConclusionStatus.supported,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Evening stop point matters",
      summary: "Commitments lock before the body signals a stop.",
      confidenceScore: 0.7,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 2,
      sourceDiversity: 2,
      timeSpreadDays: 3,
      notes: EXPLORE_ASSAULT_FIXTURE_MARKER,
      createdAt: now,
      updatedAt: now,
    },
  });

  await args.db.journalEntry.create({
    data: {
      id: FIXTURE_JOURNAL_VERIFIED_ID,
      userId: args.userId,
      title: "Stop point slip",
      body: FIXTURE_VERIFIED_EXTRACT,
      createdAt: now,
      updatedAt: now,
    },
  });

  const claimSummary = FIXTURE_INFERRED_EXTRACT;
  await args.db.patternClaim.create({
    data: {
      id: FIXTURE_CLAIM_ID,
      userId: args.userId,
      patternType: PatternType.repetitive_loop,
      strengthLevel: StrengthLevel.tentative,
      status: PatternClaimStatus.active,
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      journalEvidenceCount: 1,
      journalEntrySpread: 1,
      journalDaySpread: 1,
      supportContainerSpread: 1,
      createdAt: now,
      updatedAt: now,
    },
  });

  await args.db.patternClaimEvidence.create({
    data: {
      id: FIXTURE_CLAIM_EVIDENCE_ID,
      claimId: FIXTURE_CLAIM_ID,
      source: "user_input",
      quote: FIXTURE_INFERRED_EXTRACT,
      createdAt: now,
    },
  });

  await args.db.session.create({
    data: {
      id: FIXTURE_SESSION_ID,
      userId: args.userId,
      origin: SessionOrigin.APP,
      surfaceType: "explore_chat",
      label: "Explore grounding assault positive",
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    },
  });

  await args.db.session.create({
    data: {
      id: FIXTURE_INSUFFICIENT_SESSION_ID,
      userId: args.userId,
      origin: SessionOrigin.APP,
      surfaceType: "explore_chat",
      label: "Explore grounding assault insufficient",
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    },
  });

  await args.db.journalEntry.create({
    data: {
      id: FIXTURE_CROSS_USER_JOURNAL_ID,
      userId: args.crossUserId,
      title: "Cross-user only",
      body: "Cross-user stop point evidence must never ground another user reply.",
      createdAt: now,
      updatedAt: now,
    },
  });

  await args.db.session.create({
    data: {
      id: FIXTURE_CROSS_USER_SESSION_ID,
      userId: args.crossUserId,
      origin: SessionOrigin.APP,
      surfaceType: "explore_chat",
      label: "Cross-user explore session",
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    },
  });

  await args.db.message.create({
    data: {
      userId: args.crossUserId,
      sessionId: FIXTURE_CROSS_USER_SESSION_ID,
      role: Role.user,
      content: "Cross-user seed message",
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    conclusionId: FIXTURE_CONCLUSION_ID,
    verifiedJournalId: FIXTURE_JOURNAL_VERIFIED_ID,
    inferredEvidenceId: FIXTURE_CLAIM_EVIDENCE_ID,
    sessionId: FIXTURE_SESSION_ID,
    insufficientSessionId: FIXTURE_INSUFFICIENT_SESSION_ID,
    crossUserJournalId: FIXTURE_CROSS_USER_JOURNAL_ID,
    crossUserSessionId: FIXTURE_CROSS_USER_SESSION_ID,
  };
}

export type ExploreAssaultCleanupReport = {
  deletedConversations: number;
  deletedMessages: number;
  deletedGroundingPayloadMessages: number;
  deletedProposals: number;
  deletedModelUpdates: number;
  deletedMovementEvidenceLinks: number;
  deletedSeededMapEvidenceObjects: number;
  remainingConversations: number;
  remainingMessages: number;
  remainingProposals: number;
  remainingModelUpdates: number;
  remainingMovementEvidenceLinks: number;
  remainingSeededMapEvidenceObjects: number;
};

export async function cleanupExploreAssaultRuntimeFixture(args: {
  userId: string;
  crossUserId?: string;
  db: PrismaClient;
}): Promise<ExploreAssaultCleanupReport> {
  const userIds = [args.userId, args.crossUserId].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  const sessionIds = [
    FIXTURE_SESSION_ID,
    FIXTURE_INSUFFICIENT_SESSION_ID,
    FIXTURE_CROSS_USER_SESSION_ID,
    // Prior non-UUID fixture ids retained for one-shot cleanup of older local seeds.
    `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-session`,
    `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-session-insufficient`,
    `${EXPLORE_ASSAULT_FIXTURE_PREFIX}-cross-user-session`,
  ];

  const messages = await args.db.message.findMany({
    where: {
      OR: [
        { sessionId: { in: sessionIds } },
        { userId: { in: userIds }, content: { contains: "Explore grounding assault" } },
      ],
    },
    select: { id: true, groundingPayload: true },
  });

  const messageIds = messages.map((message) => message.id);
  const groundedCount = messages.filter((message) => message.groundingPayload != null).length;

  // Delete ExploreMovementProposal rows for fixture sessions / users.
  const exploreProposals = await args.db.exploreMovementProposal.findMany({
    where: {
      OR: [
        { conversationId: { in: sessionIds } },
        { userId: { in: userIds } },
      ],
    },
    select: { id: true, modelUpdateId: true },
  });
  const proposalLinkedModelUpdateIds = exploreProposals
    .map((row) => row.modelUpdateId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  // Delete explore proposals / model updates marked for this fixture user with explore marker.
  const proposalLinks = await args.db.understandingEvidenceLink.findMany({
    where: {
      userId: { in: userIds },
      OR: [
        { sourceType: "session", sourceId: { in: sessionIds } },
        { sourceType: "message", sourceId: { in: messageIds } },
        {
          sourceId: {
            in: [FIXTURE_JOURNAL_VERIFIED_ID, FIXTURE_CLAIM_EVIDENCE_ID, FIXTURE_CLAIM_ID],
          },
        },
        {
          targetType: "model_update",
          targetId: { in: proposalLinkedModelUpdateIds },
        },
      ],
    },
    select: { id: true, targetId: true, targetType: true },
  });

  const modelUpdateIds = [
    ...new Set([
      ...proposalLinkedModelUpdateIds,
      ...proposalLinks
        .filter((link) => link.targetType === "model_update")
        .map((link) => link.targetId),
    ]),
  ];

  const deletedLinks = await args.db.understandingEvidenceLink.deleteMany({
    where: {
      OR: [
        { id: { in: proposalLinks.map((link) => link.id) } },
        { targetId: { in: modelUpdateIds }, targetType: "model_update" },
      ],
    },
  });

  const deletedModelUpdates = await args.db.modelUpdate.deleteMany({
    where: {
      OR: [
        { id: { in: modelUpdateIds } },
        {
          userId: { in: userIds },
          internalNotes: { contains: "exploreMovementProposal" },
        },
      ],
    },
  });

  const deletedProposals = await args.db.exploreMovementProposal.deleteMany({
    where: {
      OR: [
        { id: { in: exploreProposals.map((row) => row.id) } },
        { conversationId: { in: sessionIds } },
        { userId: { in: userIds } },
      ],
    },
  });

  const deletedMessages = await args.db.message.deleteMany({
    where: {
      OR: [
        { id: { in: messageIds } },
        { sessionId: { in: sessionIds } },
      ],
    },
  });

  const deletedSessions = await args.db.session.deleteMany({
    where: { id: { in: sessionIds } },
  });

  await args.db.patternClaimEvidence.deleteMany({
    where: { id: FIXTURE_CLAIM_EVIDENCE_ID },
  });
  await args.db.patternClaim.deleteMany({ where: { id: FIXTURE_CLAIM_ID } });
  await args.db.journalEntry.deleteMany({
    where: {
      id: { in: [FIXTURE_JOURNAL_VERIFIED_ID, FIXTURE_CROSS_USER_JOURNAL_ID] },
    },
  });
  const deletedConclusions = await args.db.userMapConclusion.deleteMany({
    where: { id: FIXTURE_CONCLUSION_ID },
  });

  const remainingSessions = await args.db.session.count({
    where: { id: { in: sessionIds } },
  });
  const remainingMessages = await args.db.message.count({
    where: { sessionId: { in: sessionIds } },
  });
  const remainingModelUpdates = await args.db.modelUpdate.count({
    where: {
      OR: [
        { id: { in: modelUpdateIds } },
        {
          userId: { in: userIds },
          internalNotes: { contains: "exploreMovementProposal" },
        },
      ],
    },
  });
  const remainingProposals = await args.db.exploreMovementProposal.count({
    where: {
      OR: [
        { conversationId: { in: sessionIds } },
        { userId: { in: userIds } },
      ],
    },
  });
  const remainingLinks = await args.db.understandingEvidenceLink.count({
    where: {
      OR: [
        { targetId: { in: modelUpdateIds }, targetType: "model_update" },
        { sourceId: { in: sessionIds } },
      ],
    },
  });
  const remainingSeeded = await args.db.userMapConclusion.count({
    where: { id: FIXTURE_CONCLUSION_ID },
  }) +
    (await args.db.journalEntry.count({
      where: {
        id: { in: [FIXTURE_JOURNAL_VERIFIED_ID, FIXTURE_CROSS_USER_JOURNAL_ID] },
      },
    })) +
    (await args.db.patternClaim.count({ where: { id: FIXTURE_CLAIM_ID } })) +
    (await args.db.patternClaimEvidence.count({
      where: { id: FIXTURE_CLAIM_EVIDENCE_ID },
    }));

  return {
    deletedConversations: deletedSessions.count,
    deletedMessages: deletedMessages.count,
    deletedGroundingPayloadMessages: groundedCount,
    deletedProposals: deletedProposals.count,
    deletedModelUpdates: deletedModelUpdates.count,
    deletedMovementEvidenceLinks: deletedLinks.count,
    deletedSeededMapEvidenceObjects:
      deletedConclusions.count + 2 /* journals */ + 1 /* claim */ + 1 /* evidence */,
    remainingConversations: remainingSessions,
    remainingMessages,
    remainingProposals,
    remainingModelUpdates,
    remainingMovementEvidenceLinks: remainingLinks,
    remainingSeededMapEvidenceObjects: remainingSeeded,
  };
}
