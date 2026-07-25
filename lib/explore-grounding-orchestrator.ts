/**
 * Orchestrate Explore reply grounding + optional movement proposal creation.
 * Does not publish ModelUpdates. Does not mutate the durable user-visible model.
 *
 * Phase 0 containment: owned-evidence grounding may succeed, but model movement
 * fails closed until conversation-specific semantic adjudication exists.
 * Lexical VERIFIED+INFERRED overlap alone must not create ExploreMovementProposal.
 */

import { type PrismaClient } from "@prisma/client";

import {
  emptyExploreGroundingPayload,
  type ExploreGroundingClaim,
  type ExploreGroundingPayload,
  type ExploreGroundingSource,
} from "./explore-grounding-contract";
import {
  collectOwnedExploreGroundingCandidates,
  selectExploreGroundingSources,
} from "./explore-grounding-retrieval";

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
  /**
   * Retained for caller compatibility. Phase 0 ignores proposal creation:
   * movement always fails closed without a semantic adjudicator.
   */
  createProposalWhenSufficient?: boolean;
}): Promise<ExploreGroundingOrchestrationResult> {
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

  // Phase 0: preserve safe grounding; fail closed on model movement.
  // Do not create ExploreMovementProposal or ModelUpdate from lexical overlap.
  const payload: ExploreGroundingPayload = {
    version: "explore-grounding-v1",
    status: "grounded",
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    sources,
    claims,
    movementProposal: {
      status: "insufficient_evidence",
      proposalId: null,
      modelUpdateId: null,
      beforeSummary: null,
      afterSummary: null,
      rationale: null,
    },
  };

  return { payload, proposalCreated: false };
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
