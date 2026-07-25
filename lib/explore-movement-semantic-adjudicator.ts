/**
 * Explore movement semantic adjudicator + deterministic gates (DEL-001B).
 *
 * Conversation-specific structured judgment for UserMapConclusion strengthening.
 * Does not persist. Does not mutate current-model objects.
 */

import {
  CandidateLifecycleStatus,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import type { ExploreGroundingSource } from "./explore-grounding-contract";
import {
  EXPLORE_MOVEMENT_ADJUDICATOR_PROMPT_VERSION,
  type ExploreMovementCallBudget,
} from "./explore-movement-live-provider-adapters";
import {
  matchesUnsafeFixedExploreMovementSignature,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_AFTER_SUMMARY_PATTERN,
} from "./explore-movement-fixed-semantics-containment";
import {
  EXPLORE_MOVEMENT_MIN_CONFIDENCE,
  EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES,
  EXPLORE_MOVEMENT_SEMANTIC_CONTRACT_VERSION,
  EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE,
  exploreMovementSemanticDecisionSchema,
  parseExploreMovementSemanticDecision,
  type ExploreMovementProposeConclusionStrengthening,
  type ExploreMovementSemanticDecision,
} from "./explore-movement-semantic-contract";
import { tokenizeForExploreGrounding } from "./explore-grounding-retrieval";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import {
  notRunObjectivityRefereeResult,
  runObjectivityRefereeSafely,
  type ObjectivityReferee,
  type ObjectivityRefereeResult,
} from "./orvek-intelligence-kernel/objectivity-referee";

export type ExploreQualifyingUserMapConclusion = {
  id: string;
  title: string;
  summary: string;
  status: UserMapConclusionStatus;
  visibility: UserMapConclusionVisibility;
  evidenceCount: number;
};

export type ExploreMovementEvidencePacket = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  userMessageContent: string;
  /** Conversational context only — never independent evidence of model truth. */
  assistantReplyContent: string;
  ownedSources: ExploreGroundingSource[];
  qualifyingConclusions: ExploreQualifyingUserMapConclusion[];
};

export type ExploreMovementAdjudicationFailureCode =
  | "model_execution_failed"
  | "model_timeout"
  | "malformed_output"
  | "deterministic_gate_failed"
  | "no_qualifying_target"
  | "abstain"
  | "request_more_evidence"
  | "routed"
  | "referee_blocked"
  | "referee_failed"
  | "referee_not_run";

export type ExploreMovementAdjudicationResult =
  | {
      ok: true;
      decision: ExploreMovementProposeConclusionStrengthening;
      effectiveConfidence: number;
      referee: ObjectivityRefereeResult;
      validationWarnings: string[];
      beforeSummary: string;
      target: ExploreQualifyingUserMapConclusion;
      evidenceSourceIds: string[];
      /** Exact role-call counts for this adjudication (independent of adapter budgets). */
      adjudicatorCalls: number;
      refereeCalls: number;
    }
  | {
      ok: false;
      code: ExploreMovementAdjudicationFailureCode;
      rationale: string | null;
      routedObjectType?: string;
      referee: ObjectivityRefereeResult;
      adjudicatorCalls: number;
      refereeCalls: number;
    };

/** Deterministic provider-facing packet bounds (stored text is not mutated). */
export const EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS = 4_000 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_ASSISTANT_REPLY_CHARS = 4_000 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_COUNT = 4 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_TITLE_CHARS = 160 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_EXTRACT_CHARS = 400 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_COUNT = 6 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_TITLE_CHARS = 160 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_SUMMARY_CHARS = 600 as const;
export const EXPLORE_MOVEMENT_PROVIDER_MAX_EVIDENCE_SUMMARY_CHARS = 2_400 as const;

function truncateProviderText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

/**
 * Bound only the provider-facing packet. Does not mutate stored source rows.
 */
export function boundExploreMovementEvidencePacketForProvider(
  packet: ExploreMovementEvidencePacket
): ExploreMovementEvidencePacket {
  return {
    ...packet,
    userMessageContent: truncateProviderText(
      packet.userMessageContent,
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    ),
    assistantReplyContent: truncateProviderText(
      packet.assistantReplyContent,
      EXPLORE_MOVEMENT_PROVIDER_MAX_ASSISTANT_REPLY_CHARS
    ),
    ownedSources: packet.ownedSources
      .slice(0, EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_COUNT)
      .map((source) => ({
        ...source,
        title: truncateProviderText(
          source.title,
          EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_TITLE_CHARS
        ),
        extract: truncateProviderText(
          source.extract,
          EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_EXTRACT_CHARS
        ),
      })),
    qualifyingConclusions: packet.qualifyingConclusions
      .slice(0, EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_COUNT)
      .map((row) => ({
        ...row,
        title: truncateProviderText(
          row.title,
          EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_TITLE_CHARS
        ),
        summary: truncateProviderText(
          row.summary,
          EXPLORE_MOVEMENT_PROVIDER_MAX_UMC_SUMMARY_CHARS
        ),
      })),
  };
}

export function boundExploreMovementEvidenceSummaryForReferee(
  summary: string
): string {
  return truncateProviderText(
    summary,
    EXPLORE_MOVEMENT_PROVIDER_MAX_EVIDENCE_SUMMARY_CHARS
  );
}

const QUALIFYING_UMC_STATUSES: ReadonlySet<UserMapConclusionStatus> = new Set([
  UserMapConclusionStatus.hypothesis,
  UserMapConclusionStatus.tentative,
  UserMapConclusionStatus.emerging,
  UserMapConclusionStatus.supported,
  UserMapConclusionStatus.disputed,
]);

const DISQUALIFYING_LIFECYCLES: ReadonlySet<CandidateLifecycleStatus> = new Set([
  CandidateLifecycleStatus.rejected,
  CandidateLifecycleStatus.superseded,
  CandidateLifecycleStatus.expired,
]);

const MAX_QUALIFYING_TARGETS = 6;

function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function materialDifference(before: string, after: string): boolean {
  return normalizeComparableText(before) !== normalizeComparableText(after);
}

function sharesSubjectTokens(before: string, after: string): boolean {
  const beforeTokens = new Set(tokenizeForExploreGrounding(before));
  const afterTokens = tokenizeForExploreGrounding(after);
  if (beforeTokens.size === 0 || afterTokens.length === 0) return false;
  let hits = 0;
  for (const token of afterTokens) {
    if (beforeTokens.has(token)) hits += 1;
  }
  // Require at least two shared content tokens, or one if either side is short.
  const minHits = Math.min(2, beforeTokens.size, afterTokens.length);
  return hits >= minHits;
}

function afterSummaryEstablishedByConversationAndEvidence(args: {
  afterSummary: string;
  userMessageContent: string;
  ownedSources: ExploreGroundingSource[];
}): boolean {
  if (!UNSAFE_FIXED_EXPLORE_MOVEMENT_AFTER_SUMMARY_PATTERN.test(args.afterSummary)) {
    return true;
  }
  const corpus = [
    args.userMessageContent,
    ...args.ownedSources.map((source) => `${source.title} ${source.extract}`),
  ]
    .join(" ")
    .toLowerCase();
  const hasMeeting = /\bmeetings?\b/.test(corpus);
  const hasStopPoint = /stop[\s-]?point/.test(corpus);
  return hasMeeting && hasStopPoint;
}

export function isQualifyingExploreUserMapConclusion(row: {
  visibility: UserMapConclusionVisibility;
  status: UserMapConclusionStatus;
  supersededById: string | null;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  summary: string;
}): boolean {
  if (row.visibility !== UserMapConclusionVisibility.user_visible) return false;
  if (row.supersededById) return false;
  if (!QUALIFYING_UMC_STATUSES.has(row.status)) return false;
  if (
    row.candidateLifecycleStatus != null &&
    DISQUALIFYING_LIFECYCLES.has(row.candidateLifecycleStatus)
  ) {
    return false;
  }
  if (!row.summary.trim()) return false;
  return true;
}

export async function resolveQualifyingExploreUserMapConclusions(args: {
  userId: string;
  db: PrismaClient;
  queryText: string;
  ownedSources: ExploreGroundingSource[];
  limit?: number;
}): Promise<ExploreQualifyingUserMapConclusion[]> {
  const limit = args.limit ?? MAX_QUALIFYING_TARGETS;
  const queryTokens = tokenizeForExploreGrounding(args.queryText);

  const sourceLinkedIds = args.ownedSources
    .filter((source) => source.sourceType === "usermap_conclusion")
    .map((source) => source.sourceId);

  const rows = await args.db.userMapConclusion.findMany({
    where: {
      userId: args.userId,
      visibility: UserMapConclusionVisibility.user_visible,
      supersededById: null,
      status: { in: [...QUALIFYING_UMC_STATUSES] },
      OR: [
        { candidateLifecycleStatus: null },
        {
          candidateLifecycleStatus: {
            notIn: [...DISQUALIFYING_LIFECYCLES],
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      visibility: true,
      evidenceCount: true,
      supersededById: true,
      candidateLifecycleStatus: true,
    },
  });

  const scored = rows
    .filter((row) =>
      isQualifyingExploreUserMapConclusion({
        visibility: row.visibility,
        status: row.status,
        supersededById: row.supersededById,
        candidateLifecycleStatus: row.candidateLifecycleStatus,
        summary: row.summary,
      })
    )
    .map((row) => {
      const tokens = tokenizeForExploreGrounding(`${row.title} ${row.summary}`);
      const tokenSet = new Set(tokens);
      let overlap = 0;
      for (const token of queryTokens) {
        if (tokenSet.has(token)) overlap += 1;
      }
      const linkedBoost = sourceLinkedIds.includes(row.id) ? 3 : 0;
      return { row, score: overlap + linkedBoost };
    })
    .filter((entry) => entry.score > 0 || sourceLinkedIds.includes(entry.row.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // If lexical overlap found nothing but owned UMC sources exist, include those.
  if (scored.length === 0 && sourceLinkedIds.length > 0) {
    return rows
      .filter((row) => sourceLinkedIds.includes(row.id))
      .filter((row) =>
        isQualifyingExploreUserMapConclusion({
          visibility: row.visibility,
          status: row.status,
          supersededById: row.supersededById,
          candidateLifecycleStatus: row.candidateLifecycleStatus,
          summary: row.summary,
        })
      )
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        status: row.status,
        visibility: row.visibility,
        evidenceCount: row.evidenceCount,
      }));
  }

  return scored.map(({ row }) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    visibility: row.visibility,
    evidenceCount: row.evidenceCount,
  }));
}

export async function verifyExploreMovementSessionOwnership(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await args.db.session.findFirst({
    where: {
      id: args.conversationId,
      userId: args.userId,
      surfaceType: "explore_chat",
    },
    select: { id: true },
  });
  if (!session) {
    return { ok: false, reason: "session_not_owned_or_not_explore" };
  }

  const userMessage = await args.db.message.findFirst({
    where: {
      id: args.userMessageId,
      userId: args.userId,
      sessionId: args.conversationId,
      role: "user",
    },
    select: { id: true },
  });
  if (!userMessage) {
    return { ok: false, reason: "user_message_not_owned" };
  }

  const assistantMessage = await args.db.message.findFirst({
    where: {
      id: args.assistantMessageId,
      userId: args.userId,
      sessionId: args.conversationId,
      role: "assistant",
    },
    select: { id: true },
  });
  if (!assistantMessage) {
    return { ok: false, reason: "assistant_message_not_owned" };
  }

  return { ok: true };
}

export function buildExploreMovementAdjudicationPrompt(
  packet: ExploreMovementEvidencePacket
): { system: string; prompt: string } {
  const bounded = boundExploreMovementEvidencePacketForProvider(packet);
  const system = [
    "You are the Explore movement semantic adjudicator for MindLab.",
    `Contract version: ${EXPLORE_MOVEMENT_SEMANTIC_CONTRACT_VERSION}`,
    `Prompt version: ${EXPLORE_MOVEMENT_ADJUDICATOR_PROMPT_VERSION}`,
    "You judge whether this conversation supports strengthening an existing owned UserMapConclusion.",
    "You do not persist objects. You do not mutate the current model. You do not invent foreign IDs.",
    "",
    "Authorised outcomes exactly one of:",
    "- PROPOSE_CONCLUSION_STRENGTHENING — only for proposedObjectType UserMapConclusion with a supplied targetObjectId",
    `- ROUTE_TO_DIFFERENT_OBJECT_TYPE — routedObjectType one of: ${EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES.join(", ")}`,
    "- REQUEST_MORE_EVIDENCE",
    "- ABSTAIN",
    "",
    "Hard rules:",
    "- The assistant reply is conversational context only — never independent evidence of model truth.",
    "- evidenceSourceIds must be a non-empty subset of supplied owned evidence source IDs.",
    "- Do not cite the assistant message as evidence.",
    "- afterSummary must strengthen or qualify the same conclusion subject; do not replace the subject.",
    "- beforeSummary is code-owned and must not be authored by you.",
    "- Prefer ABSTAIN or REQUEST_MORE_EVIDENCE over weak proposals.",
    "- Lexical overlap alone does not authorise movement.",
    "Return structured JSON only matching the schema.",
  ].join("\n");

  const prompt = [
    `conversationId: ${bounded.conversationId}`,
    `userMessageId: ${bounded.userMessageId}`,
    `assistantMessageId: ${bounded.assistantMessageId}`,
    "",
    "USER MESSAGE (authoritative):",
    bounded.userMessageContent,
    "",
    "ASSISTANT REPLY (context only — not evidence):",
    bounded.assistantReplyContent,
    "",
    "OWNED EVIDENCE SOURCES:",
    JSON.stringify(
      bounded.ownedSources.map((source) => ({
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        title: source.title,
        extract: source.extract,
        epistemicStatus: source.epistemicStatus,
        claimSupport: source.claimSupport,
      }))
    ),
    "",
    "CANDIDATE USERMAP CONCLUSIONS (only these IDs may be proposed):",
    JSON.stringify(
      bounded.qualifyingConclusions.map((row) => ({
        id: row.id,
        title: row.title,
        currentSummary: row.summary,
        status: row.status,
        evidenceCount: row.evidenceCount,
      }))
    ),
  ].join("\n");

  return { system, prompt };
}

export type ExploreMovementPostProposeGateResult =
  | {
      ok: true;
      target: ExploreQualifyingUserMapConclusion;
      beforeSummary: string;
      evidenceSourceIds: string[];
      warnings: string[];
    }
  | { ok: false; errors: string[] };

/**
 * Deterministic gates after a PROPOSE_CONCLUSION_STRENGTHENING decision.
 * beforeSummary is always derived from the re-fetched canonical target.
 */
export async function validateExploreProposeConclusionGates(args: {
  userId: string;
  db: PrismaClient;
  decision: ExploreMovementProposeConclusionStrengthening;
  packet: ExploreMovementEvidencePacket;
  assistantMessageId: string;
}): Promise<ExploreMovementPostProposeGateResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    args.decision.proposedObjectType !==
    EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE
  ) {
    errors.push("proposedObjectType must be UserMapConclusion.");
  }

  const candidateIds = new Set(
    args.packet.qualifyingConclusions.map((row) => row.id)
  );
  if (!candidateIds.has(args.decision.targetObjectId)) {
    errors.push(
      "targetObjectId must exactly match a candidate ID supplied to the model."
    );
  }

  const ownedSourceIds = new Set(
    args.packet.ownedSources
      .filter((source) => source.userId === args.userId)
      .map((source) => source.sourceId)
  );

  const evidenceIds = [...new Set(args.decision.evidenceSourceIds.map((id) => id.trim()))];
  if (evidenceIds.length === 0) {
    errors.push("evidenceSourceIds must be non-empty.");
  }

  for (const sourceId of evidenceIds) {
    if (!ownedSourceIds.has(sourceId)) {
      errors.push(`fabricated_or_unowned_evidence_source_id: ${sourceId}`);
    }
    if (sourceId === args.assistantMessageId) {
      errors.push("assistant_message_cannot_serve_as_movement_evidence.");
    }
  }

  // Assistant reply alone cannot serve as movement evidence: require at least
  // one owned non-message source, or a message source that is the user message.
  const evidenceSources = args.packet.ownedSources.filter((source) =>
    evidenceIds.includes(source.sourceId)
  );
  const nonAssistantEvidence = evidenceSources.filter(
    (source) =>
      source.sourceId !== args.assistantMessageId &&
      !(source.sourceType === "message" && source.sourceId === args.assistantMessageId)
  );
  if (nonAssistantEvidence.length === 0) {
    errors.push("assistant_reply_alone_cannot_serve_as_movement_evidence.");
  }

  if (args.decision.confidence < EXPLORE_MOVEMENT_MIN_CONFIDENCE) {
    errors.push(
      `confidence ${args.decision.confidence} is below deterministic minimum ${EXPLORE_MOVEMENT_MIN_CONFIDENCE}.`
    );
  }

  const refetched = await args.db.userMapConclusion.findFirst({
    where: {
      id: args.decision.targetObjectId,
      userId: args.userId,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      visibility: true,
      evidenceCount: true,
      supersededById: true,
      candidateLifecycleStatus: true,
    },
  });

  if (!refetched) {
    errors.push("target_usermap_conclusion_not_found_for_user.");
    return { ok: false, errors };
  }

  if (
    !isQualifyingExploreUserMapConclusion({
      visibility: refetched.visibility,
      status: refetched.status,
      supersededById: refetched.supersededById,
      candidateLifecycleStatus: refetched.candidateLifecycleStatus,
      summary: refetched.summary,
    })
  ) {
    errors.push("target_usermap_conclusion_not_qualifying_visible_current.");
  }

  const beforeSummary = refetched.summary.trim();
  if (!beforeSummary) {
    errors.push("beforeSummary_unavailable_from_canonical_target.");
  }

  if (!materialDifference(beforeSummary, args.decision.afterSummary)) {
    errors.push("afterSummary_must_differ_materially_from_beforeSummary.");
  }

  if (!sharesSubjectTokens(beforeSummary, args.decision.afterSummary)) {
    errors.push(
      "afterSummary_appears_to_replace_subject_rather_than_strengthen_same_conclusion."
    );
  }

  if (
    !afterSummaryEstablishedByConversationAndEvidence({
      afterSummary: args.decision.afterSummary,
      userMessageContent: args.packet.userMessageContent,
      ownedSources: args.packet.ownedSources,
    })
  ) {
    errors.push(
      "afterSummary_matches_blocked_fixed_meetings_stop_point_semantics_without_supporting_conversation_evidence."
    );
  }

  if (
    matchesUnsafeFixedExploreMovementSignature({
      afterSummary: args.decision.afterSummary,
      rationale: args.decision.rationale,
      userFacingSummary: args.decision.userFacingSummary,
    })
  ) {
    errors.push("proposal_matches_known_unsafe_fixed_semantics_signature.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    target: {
      id: refetched.id,
      title: refetched.title,
      summary: refetched.summary,
      status: refetched.status,
      visibility: refetched.visibility,
      evidenceCount: refetched.evidenceCount,
    },
    beforeSummary,
    evidenceSourceIds: evidenceIds,
    warnings,
  };
}

export async function adjudicateExploreMovement(args: {
  userId: string;
  db: PrismaClient;
  packet: ExploreMovementEvidencePacket;
  modelRunner: StructuredModelRunner;
  objectivityReferee: ObjectivityReferee;
  callBudget?: ExploreMovementCallBudget;
  abortSignal?: AbortSignal;
}): Promise<ExploreMovementAdjudicationResult> {
  const emptyReferee = notRunObjectivityRefereeResult();
  /** Independent of optional adapter budgets — exact role invocations in this run. */
  let adjudicatorCalls = 0;
  let refereeCalls = 0;

  if (args.packet.qualifyingConclusions.length === 0) {
    return {
      ok: false,
      code: "no_qualifying_target",
      rationale: "No qualifying UserMapConclusion targets for movement.",
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  const { system, prompt } = buildExploreMovementAdjudicationPrompt(args.packet);
  const runnerResult = await args.modelRunner.runStructured({
    schema: exploreMovementSemanticDecisionSchema,
    system,
    prompt,
    schemaName: "ExploreMovementSemanticDecision",
    schemaDescription:
      "Explore movement semantic adjudication for UserMapConclusion strengthening.",
    abortSignal: args.abortSignal,
  });
  adjudicatorCalls = 1;

  if (!runnerResult.ok) {
    return {
      ok: false,
      code:
        runnerResult.errorCode === "model_timeout"
          ? "model_timeout"
          : "model_execution_failed",
      rationale: runnerResult.message,
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  const parsed = parseExploreMovementSemanticDecision(runnerResult.object);
  if (!parsed.ok) {
    return {
      ok: false,
      code: "malformed_output",
      rationale: parsed.errors.join(" | "),
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  const decision: ExploreMovementSemanticDecision = parsed.decision;

  if (decision.outcome === "ABSTAIN") {
    return {
      ok: false,
      code: "abstain",
      rationale: decision.rationale,
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  if (decision.outcome === "REQUEST_MORE_EVIDENCE") {
    return {
      ok: false,
      code: "request_more_evidence",
      rationale: decision.rationale,
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  if (decision.outcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
    return {
      ok: false,
      code: "routed",
      rationale: decision.rationale,
      routedObjectType: decision.routedObjectType,
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  const gate = await validateExploreProposeConclusionGates({
    userId: args.userId,
    db: args.db,
    decision,
    packet: args.packet,
    assistantMessageId: args.packet.assistantMessageId,
  });

  if (!gate.ok) {
    return {
      ok: false,
      code: "deterministic_gate_failed",
      rationale: gate.errors.join(" | "),
      referee: emptyReferee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  const evidenceSummary = boundExploreMovementEvidenceSummaryForReferee(
    gate.evidenceSourceIds
      .map((id) => {
        const source = args.packet.ownedSources.find((row) => row.sourceId === id);
        if (!source) return id;
        return `${source.sourceType}:${source.sourceId} — ${source.extract.slice(0, 160)}`;
      })
      .join("\n")
  );

  const referee = await runObjectivityRefereeSafely({
    referee: args.objectivityReferee,
    input: {
      proposedObjectType: EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE,
      validatedSemanticResult: decision,
      evidenceSummary,
      confidence: decision.confidence,
      alternativeInterpretation: decision.alternativeInterpretation,
      qualificationContext: decision.qualificationContext,
      validationWarnings: gate.warnings,
    },
  });
  refereeCalls = 1;

  if (referee.executionState === "not_run") {
    return {
      ok: false,
      code: "referee_not_run",
      rationale: "Objectivity Referee was not run.",
      referee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  if (referee.executionState === "failed") {
    return {
      ok: false,
      code: "referee_failed",
      rationale: referee.errorMessage,
      referee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  if (referee.executionState === "invalid_evaluation") {
    return {
      ok: false,
      code: "referee_failed",
      rationale: referee.validationErrors.join(" | "),
      referee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  if (!referee.continuationAllowed) {
    return {
      ok: false,
      code: "referee_blocked",
      rationale: referee.rationale,
      routedObjectType: referee.routedObjectType ?? undefined,
      referee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  let effectiveConfidence = decision.confidence;
  if (
    referee.outcome === "PASS_WITH_LOWER_CONFIDENCE" &&
    referee.adjustedConfidence != null
  ) {
    effectiveConfidence = referee.adjustedConfidence;
  }

  if (effectiveConfidence < EXPLORE_MOVEMENT_MIN_CONFIDENCE) {
    return {
      ok: false,
      code: "deterministic_gate_failed",
      rationale: `Effective confidence ${effectiveConfidence} is below deterministic minimum ${EXPLORE_MOVEMENT_MIN_CONFIDENCE} after referee.`,
      referee,
      adjudicatorCalls,
      refereeCalls,
    };
  }

  return {
    ok: true,
    decision,
    effectiveConfidence,
    referee,
    validationWarnings: gate.warnings,
    beforeSummary: gate.beforeSummary,
    target: gate.target,
    evidenceSourceIds: gate.evidenceSourceIds,
    adjudicatorCalls,
    refereeCalls,
  };
}
