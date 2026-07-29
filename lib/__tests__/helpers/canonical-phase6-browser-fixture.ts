/**
 * Phase 6 browser fixture helper — disposable DB only.
 */

import {
  ExploreMovementAuthorityMode,
  PrismaClient,
  Role,
  SessionSurfaceType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../../canonical-model-authority-flag";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../../explore-movement-proposal";
import { buildExploreMovementProposalProvenance } from "../../explore-movement-proposal-provenance";
import type { ExploreGroundingPayload } from "../../explore-grounding-contract";
import { EXPLORE_GROUNDING_CONTRACT_VERSION } from "../../explore-grounding-contract";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../../explore-movement-semantic-contract";
import {
  completedPassReferee,
  validProposeDecision,
} from "./explore-movement-semantic-test-helpers";

export const PHASE6_LEGACY_SEED_TITLE = "LEGACY SEED TITLE";
export const PHASE6_LEGACY_SEED_SUMMARY = "LEGACY SEED SUMMARY";
export const PHASE6_REVISION_ONE = "REVISION ONE";
export const PHASE6_REVISION_TWO = "REVISION TWO";
export const PHASE6_MUTATED_LEGACY = "MUTATED LEGACY AFTER PUBLICATION";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function enablePhase6CanonicalGate(userId: string): void {
  process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
  process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = userId;
}

export function disablePhase6CanonicalGate(): void {
  delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
  delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];
}

export async function seedPhase6LegacyOnly(args: {
  userId: string;
  db: PrismaClient;
}) {
  return args.db.userMapConclusion.create({
    data: {
      userId: args.userId,
      area: UserMapConclusionArea.operating_logic,
      status: UserMapConclusionStatus.emerging,
      visibility: UserMapConclusionVisibility.user_visible,
      title: PHASE6_LEGACY_SEED_TITLE,
      summary: PHASE6_LEGACY_SEED_SUMMARY,
      confidenceScore: 0.55,
      confidenceLevel: UserMapConfidenceLevel.medium,
    },
  });
}

export async function seedPhase6CanonicalProposal(args: {
  userId: string;
  db: PrismaClient;
  umcSummary?: string;
  afterSummary?: string;
}) {
  enablePhase6CanonicalGate(args.userId);
  const umc = await args.db.userMapConclusion.create({
    data: {
      userId: args.userId,
      area: UserMapConclusionArea.operating_logic,
      status: UserMapConclusionStatus.emerging,
      visibility: UserMapConclusionVisibility.user_visible,
      title: PHASE6_LEGACY_SEED_TITLE,
      summary: args.umcSummary ?? PHASE6_REVISION_ONE,
      confidenceScore: 0.55,
      confidenceLevel: UserMapConfidenceLevel.medium,
    },
  });

  const conversationId = id("p6_session");
  const userMessageId = id("p6_umsg");
  const assistantMessageId = id("p6_amsg");
  await args.db.session.create({
    data: {
      id: conversationId,
      userId: args.userId,
      surfaceType: SessionSurfaceType.explore_chat,
    },
  });
  await args.db.message.create({
    data: {
      id: userMessageId,
      sessionId: conversationId,
      userId: args.userId,
      role: Role.user,
      content: "I keep skipping the evening stop after dense meetings.",
    },
  });
  await args.db.message.create({
    data: {
      id: assistantMessageId,
      sessionId: conversationId,
      userId: args.userId,
      role: Role.assistant,
      content: "That may strengthen the recovery-boundary conclusion.",
    },
  });

  const journalId = id("p6_journal");
  await args.db.journalEntry.create({
    data: {
      id: journalId,
      userId: args.userId,
      title: "Recovery journal",
      body: "After dense meetings I lose the evening stop point.",
    },
  });

  const afterSummary = args.afterSummary ?? PHASE6_REVISION_TWO;
  const decision = validProposeDecision({
    targetObjectId: umc.id,
    afterSummary,
    evidenceSourceIds: [journalId],
    confidence: Math.max(EXPLORE_MOVEMENT_MIN_CONFIDENCE, 0.72),
  });
  const provenance = buildExploreMovementProposalProvenance({
    sources: [
      {
        sourceId: journalId,
        sourceType: "journal_entry",
        sourceFamily: "journal_entry",
        userId: args.userId,
        title: "Recovery journal",
        extract:
          "After dense meetings I lose the evening stop point and keep working past fatigue.",
        retrievalReason:
          "Stored extract directly supports the conversational claim.",
        claimSupport: "verifies",
        epistemicStatus: "VERIFIED",
      },
    ],
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

  const created = await createOrReuseSemanticExploreMovementProposal({
    userId: args.userId,
    db: args.db,
    conversationId,
    assistantMessageId,
    userMessageId,
    affectedObjectId: umc.id,
    beforeSummary: umc.summary,
    afterSummary: decision.afterSummary,
    rationale: decision.rationale,
    userFacingSummary: decision.userFacingSummary,
    provenance,
  });

  const proposal = await args.db.exploreMovementProposal.findUniqueOrThrow({
    where: { id: created.record.proposalId },
  });
  if (proposal.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
    throw new Error("Expected canonical_v1 proposal for Phase 6 fixture");
  }

  const grounding: ExploreGroundingPayload = {
    version: EXPLORE_GROUNDING_CONTRACT_VERSION,
    status: "grounded",
    conversationId,
    assistantMessageId,
    userMessageId,
    sources: [
      {
        sourceId: journalId,
        sourceType: "journal_entry",
        sourceFamily: "journal_entry",
        userId: args.userId,
        title: "Recovery journal",
        extract:
          "After dense meetings I lose the evening stop point and keep working past fatigue.",
        retrievalReason:
          "Stored extract directly supports the conversational claim.",
        claimSupport: "verifies",
        epistemicStatus: "VERIFIED",
      },
    ],
    claims: [
      {
        text: afterSummary,
        epistemicStatus: "VERIFIED",
        sourceIds: [journalId],
      },
    ],
    movementProposal: {
      status: "proposed",
      proposalId: proposal.id,
      modelUpdateId: null,
      beforeSummary: umc.summary,
      afterSummary,
      rationale: decision.rationale,
    },
  };

  await args.db.message.update({
    where: { id: assistantMessageId },
    data: { groundingPayload: grounding },
  });

  return {
    umc,
    proposal,
    conversationId,
    userMessageId,
    assistantMessageId,
    journalId,
    afterSummary,
  };
}

export async function publishPhase6CanonicalProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
}) {
  return publishExploreMovementProposal({
    userId: args.userId,
    proposalId: args.proposalId,
    db: args.db,
  });
}
