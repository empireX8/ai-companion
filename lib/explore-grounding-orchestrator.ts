/**
 * Orchestrate Explore reply grounding + optional movement proposal creation.
 * Does not publish ModelUpdates. Does not mutate the durable user-visible model.
 */

import {
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import {
  emptyExploreGroundingPayload,
  payloadHasVerifiedAndInferred,
  type ExploreGroundingClaim,
  type ExploreGroundingPayload,
  type ExploreGroundingSource,
} from "./explore-grounding-contract";
import {
  collectOwnedExploreGroundingCandidates,
  selectExploreGroundingSources,
} from "./explore-grounding-retrieval";
import { createExploreMovementProposal } from "./explore-movement-proposal";

export type ExploreGroundingOrchestrationResult = {
  payload: ExploreGroundingPayload;
  proposalCreated: boolean;
};

function buildClaimsFromSources(
  replyText: string,
  sources: ExploreGroundingSource[]
): ExploreGroundingClaim[] {
  const claims: ExploreGroundingClaim[] = [];
  const verified = sources.filter((source) => source.epistemicStatus === "VERIFIED");
  const inferred = sources.filter((source) => source.epistemicStatus === "INFERRED");

  if (verified.length > 0) {
    claims.push({
      text: replyText.slice(0, 220) || "Verified claim grounded in owned evidence.",
      epistemicStatus: "VERIFIED",
      sourceIds: verified.map((source) => source.sourceId),
    });
  }

  if (inferred.length > 0) {
    claims.push({
      text: "Related interpretation supported by owned evidence, not directly established.",
      epistemicStatus: "INFERRED",
      sourceIds: inferred.map((source) => source.sourceId),
    });
  }

  if (claims.length === 0) {
    claims.push({
      text: "Conversational response without sufficient owned evidence for model truth.",
      epistemicStatus: "UNVERIFIED",
      sourceIds: [],
    });
  }

  return claims;
}

export async function orchestrateExploreReplyGrounding(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  userMessageContent: string;
  assistantReplyContent: string;
  createProposalWhenSufficient?: boolean;
}): Promise<ExploreGroundingOrchestrationResult> {
  const createProposalWhenSufficient = args.createProposalWhenSufficient !== false;

  const candidates = await collectOwnedExploreGroundingCandidates({
    userId: args.userId,
    db: args.db,
  });

  const sources = selectExploreGroundingSources({
    userId: args.userId,
    queryText: args.userMessageContent,
    replyText: args.assistantReplyContent,
    candidates,
  });

  if (sources.length === 0) {
    const payload = emptyExploreGroundingPayload({
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      userMessageId: args.userMessageId,
      status: candidates.length === 0 ? "ungrounded" : "insufficient_evidence",
    });
    return { payload, proposalCreated: false };
  }

  const claims = buildClaimsFromSources(args.assistantReplyContent, sources);
  const sufficientForMovement = payloadHasVerifiedAndInferred({
    version: "explore-grounding-v1",
    status: "grounded",
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    sources,
    claims,
    movementProposal: {
      status: "none",
      proposalId: null,
      modelUpdateId: null,
      beforeSummary: null,
      afterSummary: null,
      rationale: null,
    },
  });

  let payload: ExploreGroundingPayload = {
    version: "explore-grounding-v1",
    status: "grounded",
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    sources,
    claims,
    movementProposal: {
      status: sufficientForMovement ? "none" : "insufficient_evidence",
      proposalId: null,
      modelUpdateId: null,
      beforeSummary: null,
      afterSummary: null,
      rationale: null,
    },
  };

  if (!createProposalWhenSufficient || !sufficientForMovement) {
    if (!sufficientForMovement) {
      payload = {
        ...payload,
        status: sources.length > 0 ? "grounded" : "insufficient_evidence",
        movementProposal: {
          ...payload.movementProposal,
          status: "insufficient_evidence",
        },
      };
    }
    return { payload, proposalCreated: false };
  }

  const currentModel = await args.db.userMapConclusion.findFirst({
    where: {
      userId: args.userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, summary: true },
  });

  if (!currentModel) {
    payload = {
      ...payload,
      movementProposal: {
        ...payload.movementProposal,
        status: "insufficient_evidence",
      },
    };
    return { payload, proposalCreated: false };
  }

  const beforeSummary = currentModel.summary;
  const afterSummary = `Explore evidence suggests refining: ${currentModel.title} with stop-point sensitivity after meetings.`;
  const rationale =
    "Grounded Explore conversation cites owned verified and inferred evidence for a reviewable model movement.";
  const userFacingSummary =
    "Possible model movement from Explore: evening stop-point signal after meetings.";

  const proposal = await createExploreMovementProposal({
    userId: args.userId,
    db: args.db,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
    affectedObjectId: currentModel.id,
    beforeSummary,
    afterSummary,
    rationale,
    userFacingSummary,
    sources,
  });

  payload = {
    ...payload,
    movementProposal: {
      status: "proposed",
      proposalId: proposal.proposalId,
      modelUpdateId: null,
      beforeSummary: proposal.beforeSummary,
      afterSummary: proposal.afterSummary,
      rationale: proposal.rationale,
    },
  };

  return { payload, proposalCreated: true };
}

export async function persistExploreGroundingPayload(args: {
  db: PrismaClient;
  messageId: string;
  userId: string;
  payload: ExploreGroundingPayload;
}): Promise<void> {
  await args.db.message.updateMany({
    where: {
      id: args.messageId,
      userId: args.userId,
    },
    data: {
      groundingPayload: args.payload,
    },
  });
}
