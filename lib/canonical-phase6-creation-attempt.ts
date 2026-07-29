/**
 * Phase 6 only: gated eligible creation attempt invoked from /api/message
 * after full context assembly, when local deterministic flags are on.
 */

import {
  ExploreMovementAuthorityMode,
  type PrismaClient,
} from "@prisma/client";

import { createOrReuseSemanticExploreMovementProposal } from "./explore-movement-proposal";
import { buildExploreMovementProposalProvenance } from "./explore-movement-proposal-provenance";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "./explore-movement-semantic-contract";
import { OBJECTIVITY_REFEREE_INTERFACE_VERSION } from "./orvek-intelligence-kernel/objectivity-referee";
import { isPhase6TestSeamActive } from "./canonical-phase6-test-seam-guard";

export const ORVEK_PHASE6_CREATION_ATTEMPT_HEADER =
  "x-orvek-phase6-creation-attempt-umc" as const;

export type Phase6CreationAttemptResult = {
  proposalId: string;
  authorityMode: ExploreMovementAuthorityMode;
  canonicalConceptId: string | null;
};

export async function maybeRunPhase6EligibleCreationAttempt(args: {
  req: Request;
  userId: string;
  db: PrismaClient;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<Phase6CreationAttemptResult | null> {
  if (!isPhase6TestSeamActive(args.env ?? process.env)) {
    return null;
  }
  const umcId = args.req.headers.get(ORVEK_PHASE6_CREATION_ATTEMPT_HEADER)?.trim();
  if (!umcId) return null;

  const umc = await args.db.userMapConclusion.findFirst({
    where: { id: umcId, userId: args.userId },
  });
  if (!umc) return null;

  const journal = await args.db.journalEntry.findFirst({
    where: { userId: args.userId },
    orderBy: { createdAt: "desc" },
  });
  if (!journal) return null;

  const afterSummary = "PHASE6 GATE-OFF CREATION ATTEMPT SUMMARY";
  const confidence = Math.max(EXPLORE_MOVEMENT_MIN_CONFIDENCE, 0.72);
  const decision = {
    outcome: "PROPOSE_CONCLUSION_STRENGTHENING" as const,
    proposedObjectType: "UserMapConclusion" as const,
    targetObjectId: umc.id,
    afterSummary,
    rationale: "Phase 6 gate-off creation attempt.",
    userFacingSummary: afterSummary,
    confidence,
    alternativeInterpretation:
      "Could be a transient slip rather than durable boundary weakening.",
    qualificationContext: "Applies under dense meeting load when the evening stop is skipped.",
    evidenceSourceIds: [journal.id],
  };

  const provenance = buildExploreMovementProposalProvenance({
    sources: [
      {
        sourceId: journal.id,
        sourceType: "journal_entry",
        sourceFamily: "journal_entry",
        userId: args.userId,
        title: journal.title ?? "Journal",
        extract: journal.body.slice(0, 240),
        retrievalReason: "Phase 6 gate-off eligible creation attempt.",
        claimSupport: "verifies",
        epistemicStatus: "VERIFIED",
      },
    ],
    semanticDecision: decision,
    refereeResult: {
      interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
      executionState: "completed",
      outcome: "PASS",
      rationale: "Phase 6 gate-off creation attempt referee pass.",
      proposedObjectType: "UserMapConclusion",
      proposedConfidence: confidence,
      adjustedConfidence: null,
      routedObjectType: null,
      validationErrors: [],
      continuationAllowed: true,
      errorMessage: null,
    },
    providerMetadata: {
      providerId: "phase6-gate-off",
      adjudicatorModelId: "none",
      refereeModelId: "none",
      adjudicatorCalls: 1,
      refereeCalls: 1,
      totalCalls: 2,
    },
  });

  const created = await createOrReuseSemanticExploreMovementProposal({
    userId: args.userId,
    db: args.db,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    affectedObjectId: umc.id,
    beforeSummary: umc.summary,
    afterSummary,
    rationale: decision.rationale,
    userFacingSummary: decision.userFacingSummary,
    provenance,
  });

  const proposal = await args.db.exploreMovementProposal.findUniqueOrThrow({
    where: { id: created.record.proposalId },
    select: {
      id: true,
      authorityMode: true,
      canonicalConceptId: true,
    },
  });

  return {
    proposalId: proposal.id,
    authorityMode: proposal.authorityMode ?? ExploreMovementAuthorityMode.legacy,
    canonicalConceptId: proposal.canonicalConceptId,
  };
}
