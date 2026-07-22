/**
 * CEQR-004 — same-session zero-or-one semantic selection.
 *
 * Assembles exact same-session Side A / Side B source units, runs model-assisted
 * pair adjudication via the landed adjudicator, and returns zero or one
 * semantically selected pair.
 *
 * Explicitly non-persistable in this slice:
 * - persistenceDecision remains null
 * - persistenceAuthorised remains false
 * - persistable remains false
 * - createCandidate remains undefined
 * - never cast selection into the persistable detection type
 * - never call the materialisation writer
 *
 * Markers / token overlap may order a bounded pool; they never establish
 * semantic eligibility or force a winner.
 */

import type { ReferenceStatus, ReferenceType } from "@prisma/client";

import {
  adjudicateContradiction,
  classificationAllowsContradictionNodeSemantics,
  type ContradictionAdjudicationResult,
} from "./contradiction-adjudicator";
import {
  buildSanitizedAdjudicationDiagnostics,
  type SanitizedAdjudicationDiagnostics,
} from "./contradiction-live-sanitized-diagnostics";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import type { ObjectivityReferee } from "./orvek-intelligence-kernel/objectivity-referee";
import { defaultRefereeStatus } from "./orvek-intelligence-kernel/objectivity-referee";
import type {
  KernelSourceUnit,
  RefereeStatus,
} from "./orvek-intelligence-kernel/types";

export type ContradictionSelectionOutcome =
  | "selected"
  | "no_same_session_sources"
  | "no_semantic_match"
  | "ambiguous_multiple_matches"
  | "source_validation_failed"
  | "adjudication_failed"
  | "model_failed";

export type SourceCompletenessFailureReason =
  | "missing_source_session_id"
  | "missing_source_message_id"
  | "source_message_unresolved"
  | "source_message_user_mismatch"
  | "source_message_session_mismatch"
  | "source_session_disagreement"
  | "cross_session_excluded"
  | "empty_source_text";

export type CurrentMessageSource = {
  sourceId: string;
  sessionId: string;
  messageId: string;
  role: string;
  sourceText: string;
  label?: string;
  sourceType?: string;
};

export type SameSessionReferenceRow = {
  id: string;
  type: ReferenceType | string;
  statement: string;
  status?: string | null;
  confidence?: string | number | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  sourceMessage?: {
    id: string;
    sessionId: string;
    userId: string;
    content: string;
  } | null;
};

export type SideACandidate = {
  sideA: KernelSourceUnit;
  referenceId?: string | null;
};

export type SemanticallySelectedContradictionPair = {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  referenceId: string | null;
  adjudication: ContradictionAdjudicationResult;
  /** Semantic Class A selection only — not persistence eligibility. */
  semanticallySelected: true;
  persistenceAuthorised: false;
  persistable: false;
};

export type SelectionRejectionSummary = {
  referenceId: string | null;
  reason: string;
  classification?: string | null;
  adjudicationOutcome?: ContradictionAdjudicationResult["outcome"];
  /**
   * CEQR-012 — sanitized validation diagnostics for live-proof observability.
   * Never includes raw provider output, quotes, or proposition text.
   */
  sanitizedDiagnostics?: SanitizedAdjudicationDiagnostics | null;
};

export type ContradictionSameSessionSelectionResult = {
  outcome: ContradictionSelectionOutcome;
  selectedPair: SemanticallySelectedContradictionPair | null;
  consideredCount: number;
  sameSessionCount: number;
  sourceCompleteCount: number;
  /** Count of validated clear_contradiction (Class A) passes. */
  eligibleCount: number;
  rejectionSummaries: SelectionRejectionSummary[];
  /** Aggregate referee status for the selected pair, else not_run. */
  refereeStatus: RefereeStatus;
  /**
   * Referee continuationAllowed from the selected pair only.
   * Never means persistence authorisation.
   */
  refereeContinuationAllowed: boolean;
  persistenceDecision: null;
  persistable: false;
  persistenceAuthorised: false;
  createCandidate: undefined;
  modelCallCount: number;
};

export type ContradictionSameSessionSelectionDb = {
  referenceItem: {
    findMany: (args: unknown) => Promise<SameSessionReferenceRow[]>;
  };
};

const SAME_SESSION_REFERENCE_TYPES = ["goal", "constraint"] as const;
const SAME_SESSION_REFERENCE_TAKE = 50;

/**
 * Bounded same-session ReferenceItem query contract (CEQR-004).
 * Cross-session refs must not enter this query.
 */
export function buildSameSessionReferenceQuery(args: {
  userId: string;
  sessionId: string;
  referenceStatuses?: ReferenceStatus[];
}): {
  where: {
    userId: string;
    status: { in: ReferenceStatus[] };
    type: { in: readonly ["goal", "constraint"] };
    sourceSessionId: string;
  };
  orderBy: Array<{ confidence: "desc" } | { updatedAt: "desc" }>;
  take: number;
  select: {
    id: true;
    type: true;
    statement: true;
    status: true;
    confidence: true;
    sourceSessionId: true;
    sourceMessageId: true;
    sourceMessage: {
      select: {
        id: true;
        sessionId: true;
        userId: true;
        content: true;
      };
    };
  };
} {
  return {
    where: {
      userId: args.userId,
      status: { in: args.referenceStatuses ?? ["active"] },
      type: { in: SAME_SESSION_REFERENCE_TYPES },
      sourceSessionId: args.sessionId,
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: SAME_SESSION_REFERENCE_TAKE,
    select: {
      id: true,
      type: true,
      statement: true,
      status: true,
      confidence: true,
      sourceSessionId: true,
      sourceMessageId: true,
      sourceMessage: {
        select: {
          id: true,
          sessionId: true,
          userId: true,
          content: true,
        },
      },
    },
  };
}

export function assembleCurrentMessageSourceUnit(
  source: CurrentMessageSource,
): KernelSourceUnit {
  return {
    sourceId: source.sourceId,
    sessionId: source.sessionId,
    messageId: source.messageId,
    sourceText: source.sourceText,
    sourceRole: source.role,
    sourceType: source.sourceType,
    label: source.label ?? "side_b_current_message",
  };
}

/**
 * Fail-closed Side A source completeness against the current Side B session.
 */
export function assessReferenceSourceCompleteness(args: {
  reference: SameSessionReferenceRow;
  currentSessionId: string;
  userId: string;
}):
  | { ok: true; sideA: KernelSourceUnit }
  | { ok: false; reason: SourceCompletenessFailureReason } {
  const { reference, currentSessionId, userId } = args;

  if (
    reference.sourceSessionId == null ||
    reference.sourceSessionId.trim() === ""
  ) {
    return { ok: false, reason: "missing_source_session_id" };
  }

  if (
    reference.sourceMessageId == null ||
    reference.sourceMessageId.trim() === ""
  ) {
    return { ok: false, reason: "missing_source_message_id" };
  }

  const message = reference.sourceMessage;
  if (!message) {
    return { ok: false, reason: "source_message_unresolved" };
  }

  if (message.userId !== userId) {
    return { ok: false, reason: "source_message_user_mismatch" };
  }

  // Ref vs message disagreement is checked before current-session exclusion so
  // inconsistent provenance fails closed with an explicit reason.
  if (message.sessionId !== reference.sourceSessionId) {
    return { ok: false, reason: "source_session_disagreement" };
  }

  if (reference.sourceSessionId !== currentSessionId) {
    return { ok: false, reason: "cross_session_excluded" };
  }

  if (message.sessionId !== currentSessionId) {
    return { ok: false, reason: "source_message_session_mismatch" };
  }

  if (typeof message.content !== "string" || message.content.length === 0) {
    return { ok: false, reason: "empty_source_text" };
  }

  return {
    ok: true,
    sideA: {
      sourceId: `reference:${reference.id}:message:${message.id}`,
      sessionId: message.sessionId,
      messageId: message.id,
      sourceText: message.content,
      sourceRole: "user",
      sourceType: String(reference.type),
      existingObjectId: reference.id,
      label: `side_a_reference:${reference.id}`,
    },
  };
}

function emptyResult(
  outcome: ContradictionSelectionOutcome,
  partial: Partial<ContradictionSameSessionSelectionResult> = {},
): ContradictionSameSessionSelectionResult {
  return {
    outcome,
    selectedPair: null,
    consideredCount: 0,
    sameSessionCount: 0,
    sourceCompleteCount: 0,
    eligibleCount: 0,
    rejectionSummaries: [],
    refereeStatus: defaultRefereeStatus(),
    refereeContinuationAllowed: false,
    persistenceDecision: null,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    modelCallCount: 0,
    ...partial,
  };
}

function isSemanticClassA(
  result: ContradictionAdjudicationResult,
): boolean {
  return (
    result.outcome === "semantic_accepted" &&
    result.semantic != null &&
    classificationAllowsContradictionNodeSemantics(result.semantic.classification) &&
    result.validation.status === "valid"
  );
}

/**
 * Zero-or-one semantic selection over already-assembled same-session pairs.
 *
 * Markers are not required. Multiple Class A passes → ambiguity abstention.
 * Never forces a first/best/highest-overlap winner.
 */
export async function selectSameSessionContradictionPair(input: {
  sideB: KernelSourceUnit;
  sideACandidates: SideACandidate[];
  modelRunner: StructuredModelRunner;
  objectivityReferee?: ObjectivityReferee;
  now?: () => Date;
  abortSignal?: AbortSignal;
}): Promise<ContradictionSameSessionSelectionResult> {
  const sideB = input.sideB;
  const consideredCount = input.sideACandidates.length;

  if (consideredCount === 0) {
    return emptyResult("no_same_session_sources", {
      consideredCount: 0,
      sameSessionCount: 0,
      sourceCompleteCount: 0,
    });
  }

  const sameSessionCandidates = input.sideACandidates.filter(
    (candidate) => candidate.sideA.sessionId === sideB.sessionId,
  );
  const sameSessionCount = sameSessionCandidates.length;
  const rejectionSummaries: SelectionRejectionSummary[] = [];

  for (const candidate of input.sideACandidates) {
    if (candidate.sideA.sessionId !== sideB.sessionId) {
      rejectionSummaries.push({
        referenceId: candidate.referenceId ?? null,
        reason: "cross_session_excluded",
      });
    }
  }

  if (sameSessionCount === 0) {
    return emptyResult("no_same_session_sources", {
      consideredCount,
      sameSessionCount: 0,
      sourceCompleteCount: 0,
      rejectionSummaries,
    });
  }

  const eligible: Array<{
    candidate: SideACandidate;
    adjudication: ContradictionAdjudicationResult;
  }> = [];

  let modelCallCount = 0;
  let modelFailureCount = 0;
  let validationFailureCount = 0;

  for (const candidate of sameSessionCandidates) {
    modelCallCount += 1;
    const adjudication = await adjudicateContradiction({
      sideA: candidate.sideA,
      sideB,
      modelRunner: input.modelRunner,
      objectivityReferee: input.objectivityReferee,
      now: input.now,
      abortSignal: input.abortSignal,
    });

    if (isSemanticClassA(adjudication)) {
      eligible.push({ candidate, adjudication });
      continue;
    }

    if (adjudication.outcome === "model_failed") {
      modelFailureCount += 1;
    } else if (adjudication.outcome === "validation_failed") {
      validationFailureCount += 1;
    }

    rejectionSummaries.push({
      referenceId: candidate.referenceId ?? null,
      reason:
        adjudication.errorCode ??
        adjudication.abstentionReason ??
        adjudication.outcome,
      classification: adjudication.semantic?.classification ?? null,
      adjudicationOutcome: adjudication.outcome,
      sanitizedDiagnostics: buildSanitizedAdjudicationDiagnostics({
        adjudication,
        sideA: candidate.sideA,
        sideB,
      }),
    });
  }

  const eligibleCount = eligible.length;

  if (eligibleCount === 0) {
    let outcome: ContradictionSelectionOutcome = "no_semantic_match";
    if (modelFailureCount === sameSessionCount) {
      outcome = "model_failed";
    } else if (validationFailureCount === sameSessionCount) {
      outcome = "adjudication_failed";
    }

    return emptyResult(outcome, {
      consideredCount,
      sameSessionCount,
      sourceCompleteCount: sameSessionCount,
      eligibleCount: 0,
      rejectionSummaries,
      modelCallCount,
    });
  }

  if (eligibleCount > 1) {
    for (const item of eligible) {
      rejectionSummaries.push({
        referenceId: item.candidate.referenceId ?? null,
        reason: "ambiguous_multiple_class_a",
        classification: item.adjudication.semantic?.classification ?? null,
        adjudicationOutcome: item.adjudication.outcome,
      });
    }

    return emptyResult("ambiguous_multiple_matches", {
      consideredCount,
      sameSessionCount,
      sourceCompleteCount: sameSessionCount,
      eligibleCount,
      rejectionSummaries,
      modelCallCount,
      // Ambiguity abstention: never pick first / highest confidence.
      refereeStatus: defaultRefereeStatus(),
    });
  }

  const only = eligible[0]!;
  const selectedPair: SemanticallySelectedContradictionPair = {
    sideA: only.candidate.sideA,
    sideB,
    referenceId: only.candidate.referenceId ?? null,
    adjudication: only.adjudication,
    semanticallySelected: true,
    persistenceAuthorised: false,
    persistable: false,
  };

  return {
    outcome: "selected",
    selectedPair,
    consideredCount,
    sameSessionCount,
    sourceCompleteCount: sameSessionCount,
    eligibleCount: 1,
    rejectionSummaries,
    refereeStatus: only.adjudication.refereeStatus,
    refereeContinuationAllowed:
      only.adjudication.referee.continuationAllowed === true,
    persistenceDecision: null,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    modelCallCount,
  };
}

/**
 * Load same-session references, enforce source completeness, then select.
 * Cross-session references never reach adjudication (modelCallCount stays 0 for them).
 */
export async function selectSameSessionContradictionFromReferences(input: {
  userId: string;
  sideB: CurrentMessageSource | KernelSourceUnit;
  references: SameSessionReferenceRow[];
  modelRunner: StructuredModelRunner;
  objectivityReferee?: ObjectivityReferee;
  now?: () => Date;
  abortSignal?: AbortSignal;
}): Promise<ContradictionSameSessionSelectionResult> {
  const sideBUnit: KernelSourceUnit =
    "sourceText" in input.sideB && "sourceRole" in input.sideB
      ? (input.sideB as KernelSourceUnit)
      : assembleCurrentMessageSourceUnit(input.sideB as CurrentMessageSource);

  const consideredCount = input.references.length;
  const rejectionSummaries: SelectionRejectionSummary[] = [];
  const sideACandidates: SideACandidate[] = [];

  let sameSessionCount = 0;

  for (const reference of input.references) {
    const assessment = assessReferenceSourceCompleteness({
      reference,
      currentSessionId: sideBUnit.sessionId,
      userId: input.userId,
    });

    if (!assessment.ok) {
      rejectionSummaries.push({
        referenceId: reference.id,
        reason: assessment.reason,
      });
      continue;
    }

    sameSessionCount += 1;
    sideACandidates.push({
      sideA: assessment.sideA,
      referenceId: reference.id,
    });
  }

  if (sideACandidates.length === 0) {
    const allMissingSession = input.references.every(
      (ref) =>
        ref.sourceSessionId == null || ref.sourceSessionId.trim() === "",
    );
    const allCrossSession =
      consideredCount > 0 &&
      input.references.every(
        (ref) =>
          ref.sourceSessionId != null &&
          ref.sourceSessionId !== sideBUnit.sessionId,
      );
    const anySourceFailure = rejectionSummaries.some((summary) =>
      [
        "missing_source_session_id",
        "missing_source_message_id",
        "source_message_unresolved",
        "source_message_user_mismatch",
        "source_message_session_mismatch",
        "source_session_disagreement",
        "empty_source_text",
      ].includes(summary.reason),
    );

    let outcome: ContradictionSelectionOutcome = "no_same_session_sources";
    if (consideredCount === 0 || allMissingSession || allCrossSession) {
      outcome = "no_same_session_sources";
    } else if (anySourceFailure) {
      outcome = "source_validation_failed";
    }

    return emptyResult(outcome, {
      consideredCount,
      sameSessionCount,
      sourceCompleteCount: 0,
      rejectionSummaries,
      modelCallCount: 0,
    });
  }

  const selection = await selectSameSessionContradictionPair({
    sideB: sideBUnit,
    sideACandidates,
    modelRunner: input.modelRunner,
    objectivityReferee: input.objectivityReferee,
    now: input.now,
    abortSignal: input.abortSignal,
  });

  return {
    ...selection,
    consideredCount,
    sameSessionCount: Math.max(selection.sameSessionCount, sameSessionCount),
    rejectionSummaries: [
      ...rejectionSummaries,
      ...selection.rejectionSummaries,
    ],
  };
}

/**
 * Database-backed same-session selection entry.
 * Production callers must not treat the result as persistable in CEQR-004.
 */
export async function selectSameSessionContradictionForMessage(input: {
  userId: string;
  sessionId: string;
  messageId: string;
  messageContent: string;
  messageRole?: string;
  referenceStatuses?: ReferenceStatus[];
  modelRunner: StructuredModelRunner;
  objectivityReferee?: ObjectivityReferee;
  db: ContradictionSameSessionSelectionDb;
  now?: () => Date;
  abortSignal?: AbortSignal;
}): Promise<ContradictionSameSessionSelectionResult> {
  const query = buildSameSessionReferenceQuery({
    userId: input.userId,
    sessionId: input.sessionId,
    referenceStatuses: input.referenceStatuses,
  });

  const references = await input.db.referenceItem.findMany(query);

  return selectSameSessionContradictionFromReferences({
    userId: input.userId,
    sideB: {
      sourceId: `message:${input.messageId}`,
      sessionId: input.sessionId,
      messageId: input.messageId,
      role: input.messageRole ?? "user",
      sourceText: input.messageContent,
      label: "side_b_current_message",
    },
    references,
    modelRunner: input.modelRunner,
    objectivityReferee: input.objectivityReferee,
    now: input.now,
    abortSignal: input.abortSignal,
  });
}
