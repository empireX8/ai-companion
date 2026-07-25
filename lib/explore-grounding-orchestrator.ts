/**
 * Orchestrate Explore reply grounding + optional semantic movement proposal.
 * Does not publish ModelUpdates. Does not mutate the durable user-visible model.
 *
 * Phase 0 containment remains the default: when the semantic feature gate is off,
 * owned-evidence grounding may succeed but model movement fails closed.
 *
 * DEL-001B restores one gated writable lane: conversation-specific strengthening
 * of an existing owned qualifying UserMapConclusion via adjudicator + independent
 * Objectivity Referee + deterministic gates.
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
import {
  createExploreMovementLiveAdapters,
  isExploreMovementSemanticEnabled,
  resolveExploreMovementProviderConfig,
  type ExploreMovementCallBudget,
} from "./explore-movement-live-provider-adapters";
import {
  adjudicateExploreMovement,
  resolveQualifyingExploreUserMapConclusions,
  verifyExploreMovementSessionOwnership,
  type ExploreMovementEvidencePacket,
} from "./explore-movement-semantic-adjudicator";
import {
  createOrReuseSemanticExploreMovementProposal,
} from "./explore-movement-proposal";
import {
  buildExploreMovementProposalProvenance,
  EXPLORE_MOVEMENT_SUCCESS_ADJUDICATOR_CALLS,
  EXPLORE_MOVEMENT_SUCCESS_REFEREE_CALLS,
  EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS,
  selectCitedExploreMovementSources,
} from "./explore-movement-proposal-provenance";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import type { ObjectivityReferee } from "./orvek-intelligence-kernel/objectivity-referee";

export type ExploreGroundingOrchestrationResult = {
  payload: ExploreGroundingPayload;
  proposalCreated: boolean;
};

/**
 * Injected semantic dependencies for tests.
 * Production resolves adapters only when the feature gate is on and credentials exist.
 */
export type ExploreMovementSemanticDependencies = {
  /** Override feature gate (tests). When omitted, reads production env. */
  semanticEnabled?: boolean;
  adjudicatorRunner?: StructuredModelRunner;
  objectivityReferee?: ObjectivityReferee;
  callBudget?: ExploreMovementCallBudget;
  providerId?: string;
  adjudicatorModelId?: string;
  refereeModelId?: string;
  /**
   * When true, skip constructing live OpenAI adapters even if the gate is on.
   * Used when runners are injected.
   */
  useInjectedProvidersOnly?: boolean;
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

function groundedPayload(args: {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  sources: ExploreGroundingSource[];
  claims: ExploreGroundingClaim[];
  movementProposal: ExploreGroundingPayload["movementProposal"];
}): ExploreGroundingPayload {
  return {
    version: "explore-grounding-v1",
    status: "grounded",
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    sources: args.sources,
    claims: args.claims,
    movementProposal: args.movementProposal,
  };
}

function insufficientMovement(
  extras?: Partial<ExploreGroundingPayload["movementProposal"]>
): ExploreGroundingPayload["movementProposal"] {
  return {
    status: "insufficient_evidence",
    proposalId: null,
    modelUpdateId: null,
    beforeSummary: null,
    afterSummary: null,
    rationale: null,
    ...extras,
  };
}

async function trySemanticMovementProposal(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  userMessageContent: string;
  assistantReplyContent: string;
  sources: ExploreGroundingSource[];
  semantic?: ExploreMovementSemanticDependencies;
}): Promise<{
  movementProposal: ExploreGroundingPayload["movementProposal"];
  proposalCreated: boolean;
}> {
  const enabled =
    args.semantic?.semanticEnabled ?? isExploreMovementSemanticEnabled();

  if (!enabled) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  const ownership = await verifyExploreMovementSessionOwnership({
    userId: args.userId,
    db: args.db,
    conversationId: args.conversationId,
    userMessageId: args.userMessageId,
    assistantMessageId: args.assistantMessageId,
  });
  if (!ownership.ok) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  const qualifyingConclusions = await resolveQualifyingExploreUserMapConclusions({
    userId: args.userId,
    db: args.db,
    queryText: args.userMessageContent,
    ownedSources: args.sources,
  });

  if (qualifyingConclusions.length === 0) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  let adjudicatorRunner = args.semantic?.adjudicatorRunner;
  let objectivityReferee = args.semantic?.objectivityReferee;
  let callBudget = args.semantic?.callBudget;
  let providerId = args.semantic?.providerId ?? "injected";
  let adjudicatorModelId = args.semantic?.adjudicatorModelId ?? "injected-adjudicator";
  let refereeModelId = args.semantic?.refereeModelId ?? "injected-referee";

  if (!adjudicatorRunner || !objectivityReferee) {
    if (args.semantic?.useInjectedProvidersOnly) {
      return {
        movementProposal: insufficientMovement(),
        proposalCreated: false,
      };
    }

    const config = resolveExploreMovementProviderConfig();
    if (!config.ok) {
      // Chat and grounding still succeed; movement fails closed.
      return {
        movementProposal: insufficientMovement(),
        proposalCreated: false,
      };
    }

    try {
      const adapters = await createExploreMovementLiveAdapters({
        adjudicatorModelId: config.config.adjudicatorModelId,
        refereeModelId: config.config.refereeModelId,
        timeoutMs: config.config.timeoutMs,
        maxTotalCalls: config.config.maxTotalCalls,
      });
      adjudicatorRunner = adapters.adjudicatorRunner;
      objectivityReferee = adapters.objectivityReferee;
      callBudget = adapters.callBudget;
      providerId = adapters.providerId;
      adjudicatorModelId = adapters.adjudicatorModelId;
      refereeModelId = adapters.refereeModelId;
    } catch {
      return {
        movementProposal: insufficientMovement(),
        proposalCreated: false,
      };
    }
  }

  if (!adjudicatorRunner || !objectivityReferee) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  const packet: ExploreMovementEvidencePacket = {
    conversationId: args.conversationId,
    userMessageId: args.userMessageId,
    assistantMessageId: args.assistantMessageId,
    userMessageContent: args.userMessageContent,
    assistantReplyContent: args.assistantReplyContent,
    ownedSources: args.sources,
    qualifyingConclusions,
  };

  const adjudication = await adjudicateExploreMovement({
    userId: args.userId,
    db: args.db,
    packet,
    modelRunner: adjudicatorRunner,
    objectivityReferee,
    callBudget,
  });

  if (!adjudication.ok) {
    return {
      movementProposal: insufficientMovement({
        rationale:
          adjudication.code === "request_more_evidence"
            ? "More evidence is needed before proposing model movement"
            : null,
      }),
      proposalCreated: false,
    };
  }

  if (
    adjudication.adjudicatorCalls !== EXPLORE_MOVEMENT_SUCCESS_ADJUDICATOR_CALLS ||
    adjudication.refereeCalls !== EXPLORE_MOVEMENT_SUCCESS_REFEREE_CALLS
  ) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  const cited = selectCitedExploreMovementSources({
    ownedSources: args.sources,
    evidenceSourceIds: adjudication.evidenceSourceIds,
  });
  if (!cited.ok) {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  let provenance;
  try {
    provenance = buildExploreMovementProposalProvenance({
      sources: cited.sources,
      semanticDecision: adjudication.decision,
      refereeResult: adjudication.referee,
      providerMetadata: {
        providerId,
        adjudicatorModelId,
        refereeModelId,
        adjudicatorCalls: EXPLORE_MOVEMENT_SUCCESS_ADJUDICATOR_CALLS,
        refereeCalls: EXPLORE_MOVEMENT_SUCCESS_REFEREE_CALLS,
        totalCalls: EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS,
      },
    });
  } catch {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  let reuse;
  try {
    reuse = await createOrReuseSemanticExploreMovementProposal({
      userId: args.userId,
      db: args.db,
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      userMessageId: args.userMessageId,
      affectedObjectId: adjudication.target.id,
      beforeSummary: adjudication.beforeSummary,
      afterSummary: adjudication.decision.afterSummary,
      rationale: adjudication.decision.rationale,
      userFacingSummary: adjudication.decision.userFacingSummary,
      provenance,
    });
  } catch {
    return {
      movementProposal: insufficientMovement(),
      proposalCreated: false,
    };
  }

  if (reuse.reusedStatus === "rejected") {
    return {
      movementProposal: {
        status: "rejected",
        proposalId: reuse.record.proposalId,
        modelUpdateId: null,
        beforeSummary: reuse.record.beforeSummary,
        afterSummary: reuse.record.afterSummary,
        rationale: reuse.record.rationale,
      },
      proposalCreated: false,
    };
  }

  if (reuse.reusedStatus === "published") {
    return {
      movementProposal: {
        status: "published",
        proposalId: reuse.record.proposalId,
        modelUpdateId: reuse.record.modelUpdateId,
        beforeSummary: reuse.record.beforeSummary,
        afterSummary: reuse.record.afterSummary,
        rationale: reuse.record.rationale,
      },
      proposalCreated: false,
    };
  }

  return {
    movementProposal: {
      status: "proposed",
      proposalId: reuse.record.proposalId,
      modelUpdateId: null,
      beforeSummary: reuse.record.beforeSummary,
      afterSummary: reuse.record.afterSummary,
      rationale: reuse.record.rationale,
    },
    proposalCreated: reuse.created,
  };
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
   * Retained for caller compatibility. Semantic proposal creation is gated by
   * ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED (default off) plus injected deps.
   */
  createProposalWhenSufficient?: boolean;
  /** Injected semantic adjudicator/referee for tests. */
  semantic?: ExploreMovementSemanticDependencies;
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

  // Default: preserve safe grounding; fail closed on model movement unless
  // the gated semantic pathway succeeds.
  let movementProposal = insufficientMovement();
  let proposalCreated = false;

  if (args.createProposalWhenSufficient !== false) {
    try {
      const semanticResult = await trySemanticMovementProposal({
        userId: args.userId,
        db: args.db,
        conversationId: args.conversationId,
        assistantMessageId: args.assistantMessageId,
        userMessageId: args.userMessageId,
        userMessageContent: args.userMessageContent,
        assistantReplyContent: args.assistantReplyContent,
        sources,
        semantic: args.semantic,
      });
      movementProposal = semanticResult.movementProposal;
      proposalCreated = semanticResult.proposalCreated;
    } catch {
      movementProposal = insufficientMovement();
      proposalCreated = false;
    }
  }

  return {
    payload: groundedPayload({
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      userMessageId: args.userMessageId,
      sources,
      claims,
      movementProposal,
    }),
    proposalCreated,
  };
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
