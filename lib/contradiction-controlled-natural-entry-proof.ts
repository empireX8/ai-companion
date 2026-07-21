/**
 * CEQR-010 — controlled natural-entry contradiction proof orchestrator.
 *
 * Public entry begins with persisted-message / reference-shaped inputs:
 *   CurrentMessageSource (Side B)
 *   + SameSessionReferenceRow[] (Side A)
 *   → assembleCurrentMessageSourceUnit / assessReferenceSourceCompleteness
 *   → same-session zero-or-one selection (adjudicator + referee)
 *   → exact dual-side lineage
 *   → confidence policy
 *   → authorised persistence plan (WeakSet; never egressed)
 *   → repaired writer
 *   → optional dual-source presentation
 *
 * Deterministic injected StructuredModelRunner / ObjectivityReferee only.
 * Does NOT wire message-send, import, live providers, or the real account DB.
 * Production readiness remains NO.
 */

import { calibrateContradictionConfidence } from "./contradiction-confidence-calibration";
import {
  buildValidatedDualSideLineage,
  type ResolvedMessageForLineage,
} from "./contradiction-dual-side-lineage";
import {
  resolveContradictionDualSourcePresentation,
  type ContradictionDualSourcePresentation,
  type DualSourcePresentationReader,
} from "./contradiction-dual-source-presentation";
import { buildContradictionPersistencePlan } from "./contradiction-persistence-plan";
import {
  persistRepairedContradictionCandidate,
  type ContradictionRepairedPersistenceDb,
  type ContradictionRepairedPersistenceResult,
} from "./contradiction-repaired-persistence";
import {
  selectSameSessionContradictionFromReferences,
  type ContradictionSameSessionSelectionResult,
  type CurrentMessageSource,
  type SameSessionReferenceRow,
} from "./contradiction-same-session-selection";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import type { ObjectivityReferee } from "./orvek-intelligence-kernel/objectivity-referee";

export const CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION =
  "contradiction-controlled-natural-entry-proof-v1" as const;

/**
 * Honest terminal outcomes for the controlled proof.
 * Deterministic fixtures are not live AI judgments.
 */
export type ControlledNaturalEntryProofOutcome =
  | "created"
  | "reused"
  | "no_candidate"
  | "routed_elsewhere"
  | "more_evidence_required"
  | "abstained"
  | "failed_safely";

export type ControlledNaturalEntryProofGateStage =
  | "selection"
  | "lineage"
  | "confidence"
  | "persistence_plan"
  | "writer";

export type ControlledNaturalEntryPresentationStatus =
  | "not_requested"
  | "resolved"
  | "unavailable"
  | "failed";

export type ControlledNaturalEntryMessageResolver = {
  /**
   * Resolve persisted Message rows required for exact lineage.
   * Must return the authoritative stored content for each side.
   */
  resolveMessages(args: {
    userId: string;
    sessionId: string;
    sideAMessageId: string;
    sideBMessageId: string;
  }): Promise<{
    sideA: ResolvedMessageForLineage | null;
    sideB: ResolvedMessageForLineage | null;
  }>;
};

/**
 * Public natural-entry boundary: persisted current Message + same-session
 * ReferenceItem rows with authoritative sourceMessage payloads.
 *
 * Does NOT accept preassembled KernelSourceUnit / SideACandidate arrays.
 */
export type ControlledNaturalEntryProofInput = {
  userId: string;
  sessionId: string;
  /** Persisted current message (Side B) as CurrentMessageSource. */
  currentMessage: CurrentMessageSource;
  /** Same-session ReferenceItem rows carrying authoritative sourceMessage. */
  references: SameSessionReferenceRow[];
  /** First-model structured adjudicator runner (caller-supplied; may be deterministic). */
  modelRunner: StructuredModelRunner;
  /**
   * Second, independent Objectivity Referee runner (caller-supplied).
   * Required for this proof — omission is fail-closed (not_run blocks persistence).
   */
  objectivityReferee: ObjectivityReferee;
  /** Authoritative lineage re-resolution (may diverge from writer view in harness probes). */
  messageResolver: ControlledNaturalEntryMessageResolver;
  persistenceDb: ContradictionRepairedPersistenceDb;
  /** Optional reader for dual-source presentation after a successful write/reuse. */
  presentationReader?: DualSourcePresentationReader;
  now?: () => Date;
  abortSignal?: AbortSignal;
};

export type ControlledNaturalEntryProofResult = {
  proofVersion: typeof CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION;
  outcome: ControlledNaturalEntryProofOutcome;
  /** True only when ContradictionNode.create ran successfully in this invocation. */
  writeExecuted: boolean;
  /** True only when persistRepairedContradictionCandidate was called. */
  writerInvoked: boolean;
  /**
   * Stage at which a failed/blocked run stopped.
   * Null on successful created/reused outcomes.
   */
  gateStoppedAt: ControlledNaturalEntryProofGateStage | null;
  /** Persistence / selection / lineage / confidence failure only — never presentation. */
  failureCode: string | null;
  failureMessage: string | null;
  selection: ContradictionSameSessionSelectionResult;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  contradictionNodeId: string | null;
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
  contradictionNodeOutcome: "created" | "reused" | null;
  recommendedStorageConfidence: "low" | "medium" | "high" | null;
  effectiveConfidence: number | null;
  dualSourcePresentation: ContradictionDualSourcePresentation | null;
  presentationStatus: ControlledNaturalEntryPresentationStatus;
  presentationFailureCode: string | null;
  presentationFailureMessage: string | null;
  persistenceResult: ContradictionRepairedPersistenceResult | null;
};

function baseResult(
  partial: Omit<ControlledNaturalEntryProofResult, "proofVersion">,
): ControlledNaturalEntryProofResult {
  return {
    proofVersion: CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION,
    ...partial,
  };
}

function emptySelectionStub(): ContradictionSameSessionSelectionResult {
  return {
    outcome: "no_same_session_sources",
    selectedPair: null,
    consideredCount: 0,
    sameSessionCount: 0,
    sourceCompleteCount: 0,
    eligibleCount: 0,
    rejectionSummaries: [],
    refereeStatus: "not_run",
    refereeContinuationAllowed: false,
    persistenceDecision: null,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    modelCallCount: 0,
  };
}

function presentationDefaults(status: ControlledNaturalEntryPresentationStatus): {
  dualSourcePresentation: null;
  presentationStatus: ControlledNaturalEntryPresentationStatus;
  presentationFailureCode: null;
  presentationFailureMessage: null;
} {
  return {
    dualSourcePresentation: null,
    presentationStatus: status,
    presentationFailureCode: null,
    presentationFailureMessage: null,
  };
}

function mapSelectionToOutcome(
  selection: ContradictionSameSessionSelectionResult,
): {
  outcome: ControlledNaturalEntryProofOutcome;
  failureCode: string;
  failureMessage: string;
} | null {
  if (selection.outcome === "selected" && selection.selectedPair) {
    return null;
  }

  if (selection.outcome === "ambiguous_multiple_matches") {
    return {
      outcome: "no_candidate",
      failureCode: "ambiguous_multiple_matches",
      failureMessage:
        "More than one same-session Class A pair; zero-or-one gate abstains.",
    };
  }

  const crossSession = selection.rejectionSummaries.some(
    (s) => s.reason === "cross_session_excluded",
  );
  // Only pure cross-session pools (no same-session candidates) map to cross_session.
  if (crossSession && selection.sameSessionCount === 0) {
    return {
      outcome: "failed_safely",
      failureCode: "cross_session",
      failureMessage: "Cross-session Side A candidates are excluded.",
    };
  }

  if (
    selection.outcome === "no_semantic_match" ||
    selection.outcome === "no_same_session_sources" ||
    selection.outcome === "source_validation_failed"
  ) {
    return {
      outcome: "no_candidate",
      failureCode: selection.outcome,
      failureMessage: `Selection produced no persistable candidate (${selection.outcome}).`,
    };
  }

  if (
    selection.outcome === "adjudication_failed" ||
    selection.outcome === "model_failed"
  ) {
    return {
      outcome: "failed_safely",
      failureCode: selection.outcome,
      failureMessage: `Selection failed closed (${selection.outcome}).`,
    };
  }

  return {
    outcome: "no_candidate",
    failureCode: selection.outcome,
    failureMessage: `Selection produced no candidate (${selection.outcome}).`,
  };
}

function mapRefereeBlockedOutcome(
  refereeOutcome: string | null,
): ControlledNaturalEntryProofOutcome {
  if (refereeOutcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
    return "routed_elsewhere";
  }
  if (refereeOutcome === "REQUEST_MORE_EVIDENCE") {
    return "more_evidence_required";
  }
  if (refereeOutcome === "ABSTAIN") {
    return "abstained";
  }
  return "no_candidate";
}

function validateCurrentMessage(
  currentMessage: CurrentMessageSource,
  sessionId: string,
): { ok: true } | { ok: false; message: string } {
  if (
    typeof currentMessage.messageId !== "string" ||
    currentMessage.messageId.trim().length === 0
  ) {
    return { ok: false, message: "currentMessage.messageId is required." };
  }
  if (
    typeof currentMessage.sourceText !== "string" ||
    currentMessage.sourceText.length === 0
  ) {
    return { ok: false, message: "currentMessage.sourceText is required." };
  }
  if (currentMessage.sessionId !== sessionId) {
    return {
      ok: false,
      message: "currentMessage.sessionId does not match the proof sessionId.",
    };
  }
  return { ok: true };
}

/**
 * Execute the controlled natural-entry contradiction proof chain.
 *
 * Adjudicator and referee are separate injected dependencies.
 * The authorised persistence plan is a local WeakSet capability only — it never
 * leaves this function. Persistence occurs only after every gate passes.
 */
export async function runControlledContradictionNaturalEntryProof(
  input: ControlledNaturalEntryProofInput,
): Promise<ControlledNaturalEntryProofResult> {
  let adjudicatorCallCount = 0;
  let refereeCallCount = 0;

  const countingRunner: StructuredModelRunner = {
    async runStructured(request) {
      adjudicatorCallCount += 1;
      return input.modelRunner.runStructured(request);
    },
  };

  const countingReferee: ObjectivityReferee = {
    async evaluate(refereeInput) {
      refereeCallCount += 1;
      return input.objectivityReferee.evaluate(refereeInput);
    },
  };

  const currentOk = validateCurrentMessage(input.currentMessage, input.sessionId);
  if (!currentOk.ok) {
    return baseResult({
      outcome: "failed_safely",
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "selection",
      failureCode: "invalid_current_message",
      failureMessage: currentOk.message,
      selection: emptySelectionStub(),
      adjudicatorCallCount: 0,
      refereeCallCount: 0,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: null,
      effectiveConfidence: null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  const selection = await selectSameSessionContradictionFromReferences({
    userId: input.userId,
    sideB: input.currentMessage,
    references: input.references,
    modelRunner: countingRunner,
    objectivityReferee: countingReferee,
    now: input.now,
    abortSignal: input.abortSignal,
  });

  const selectionMapped = mapSelectionToOutcome(selection);
  if (selectionMapped) {
    return baseResult({
      outcome: selectionMapped.outcome,
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "selection",
      failureCode: selectionMapped.failureCode,
      failureMessage: selectionMapped.failureMessage,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: null,
      effectiveConfidence: null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  const selectedPair = selection.selectedPair!;
  const sideAMessageId = selectedPair.sideA.messageId as string;
  const sideBMessageId = selectedPair.sideB.messageId as string;

  let resolved: {
    sideA: ResolvedMessageForLineage | null;
    sideB: ResolvedMessageForLineage | null;
  };
  try {
    resolved = await input.messageResolver.resolveMessages({
      userId: input.userId,
      sessionId: input.sessionId,
      sideAMessageId,
      sideBMessageId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Authoritative message resolver failed.";
    return baseResult({
      outcome: "failed_safely",
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "lineage",
      failureCode: "message_resolver_failed",
      failureMessage: message,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: null,
      effectiveConfidence: null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  if (!resolved.sideA || !resolved.sideB) {
    return baseResult({
      outcome: "failed_safely",
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "lineage",
      failureCode: "unresolved_source_message",
      failureMessage: "Persisted Side A/B messages could not be resolved.",
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: null,
      effectiveConfidence: null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  const lineageResult = buildValidatedDualSideLineage({
    userId: input.userId,
    selectedPair,
    resolvedMessages: {
      sideA: resolved.sideA,
      sideB: resolved.sideB,
    },
  });

  if (!lineageResult.ok) {
    const refereeOutcome = selectedPair.adjudication.referee.outcome;
    const blockedByReferee =
      lineageResult.code === "referee_continuation_blocked" ||
      lineageResult.code === "referee_not_run" ||
      lineageResult.code === "referee_failed" ||
      lineageResult.code === "referee_invalid_evaluation";

    return baseResult({
      outcome: blockedByReferee
        ? mapRefereeBlockedOutcome(refereeOutcome)
        : "failed_safely",
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "lineage",
      failureCode: lineageResult.code,
      failureMessage: lineageResult.message,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: null,
      effectiveConfidence: null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  const adjudication = selectedPair.adjudication;
  const confidenceResult = calibrateContradictionConfidence({
    modelReportedConfidence: adjudication.semantic?.confidence,
    adjudicationOutcome: adjudication.outcome,
    deterministicValidationStatus: adjudication.validation.status,
    semanticPresent: adjudication.semantic != null,
    semanticClassification: adjudication.semantic?.classification ?? null,
    refereeExecutionState: adjudication.referee.executionState,
    refereeOutcome: adjudication.referee.outcome,
    refereeAdjustedConfidence: adjudication.referee.adjustedConfidence,
    refereeValidationErrors: adjudication.referee.validationErrors,
    refereeContinuationAllowed: adjudication.referee.continuationAllowed,
  });

  if (!confidenceResult.ok || !confidenceResult.continuationReady) {
    const refereeOutcome = adjudication.referee.outcome;
    let outcome: ControlledNaturalEntryProofOutcome = "no_candidate";
    if (!confidenceResult.ok) {
      if (confidenceResult.code === "referee_continuation_blocked") {
        outcome = mapRefereeBlockedOutcome(refereeOutcome);
      } else {
        outcome = "failed_safely";
      }
    } else if (!confidenceResult.meetsCandidateFloor) {
      outcome = "no_candidate";
    }

    return baseResult({
      outcome,
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "confidence",
      failureCode: confidenceResult.ok
        ? "below_candidate_floor"
        : confidenceResult.code,
      failureMessage: confidenceResult.ok
        ? "Effective confidence is below the candidate floor; persistence blocked."
        : confidenceResult.message,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: confidenceResult.ok
        ? confidenceResult.recommendedStorageConfidence
        : null,
      effectiveConfidence: confidenceResult.ok
        ? confidenceResult.effectiveConfidence
        : null,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  const planResult = buildContradictionPersistencePlan({
    selectedPair,
    lineageResult,
    confidenceResult,
  });

  if (!planResult.ok) {
    return baseResult({
      outcome: "failed_safely",
      writeExecuted: false,
      writerInvoked: false,
      gateStoppedAt: "persistence_plan",
      failureCode: planResult.code,
      failureMessage: planResult.message,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: confidenceResult.recommendedStorageConfidence,
      effectiveConfidence: confidenceResult.effectiveConfidence,
      persistenceResult: null,
      ...presentationDefaults("not_requested"),
    });
  }

  // Authorised plan stays local — never assigned onto the returned result.
  const authorisedPlan = planResult.plan;

  const persistenceResult = await persistRepairedContradictionCandidate({
    plan: authorisedPlan,
    db: input.persistenceDb,
    now: input.now ? input.now() : undefined,
  });

  if (!persistenceResult.ok) {
    return baseResult({
      outcome: "failed_safely",
      writeExecuted: false,
      writerInvoked: true,
      gateStoppedAt: "writer",
      failureCode: persistenceResult.code,
      failureMessage: persistenceResult.message,
      selection,
      adjudicatorCallCount,
      refereeCallCount,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      recommendedStorageConfidence: confidenceResult.recommendedStorageConfidence,
      effectiveConfidence: confidenceResult.effectiveConfidence,
      persistenceResult,
      ...presentationDefaults("not_requested"),
    });
  }

  const successOutcome =
    persistenceResult.contradictionNodeOutcome === "created"
      ? ("created" as const)
      : ("reused" as const);

  let dualSourcePresentation: ContradictionDualSourcePresentation | null = null;
  let presentationStatus: ControlledNaturalEntryPresentationStatus =
    "not_requested";
  let presentationFailureCode: string | null = null;
  let presentationFailureMessage: string | null = null;

  if (input.presentationReader) {
    try {
      dualSourcePresentation = await resolveContradictionDualSourcePresentation({
        userId: input.userId,
        node: {
          id: persistenceResult.contradictionNodeId,
          sideASourceSpanId: persistenceResult.sideASourceSpanId,
          sideBSourceSpanId: persistenceResult.sideBSourceSpanId,
        },
        reader: input.presentationReader,
      });
      if (
        dualSourcePresentation.lineageState === "complete_verified" &&
        dualSourcePresentation.sideA.availability === "available" &&
        dualSourcePresentation.sideB.availability === "available"
      ) {
        presentationStatus = "resolved";
      } else {
        presentationStatus = "unavailable";
      }
    } catch (error) {
      dualSourcePresentation = null;
      presentationStatus = "failed";
      presentationFailureCode = "presentation_resolution_failed";
      presentationFailureMessage =
        error instanceof Error
          ? error.message
          : "Dual-source presentation resolution failed.";
    }
  }

  return baseResult({
    outcome: successOutcome,
    writeExecuted: persistenceResult.writeExecuted,
    writerInvoked: true,
    gateStoppedAt: null,
    failureCode: null,
    failureMessage: null,
    selection,
    adjudicatorCallCount,
    refereeCallCount,
    contradictionNodeId: persistenceResult.contradictionNodeId,
    sideASourceSpanId: persistenceResult.sideASourceSpanId,
    sideBSourceSpanId: persistenceResult.sideBSourceSpanId,
    contradictionNodeOutcome: persistenceResult.contradictionNodeOutcome,
    recommendedStorageConfidence:
      persistenceResult.recommendedStorageConfidence,
    effectiveConfidence: confidenceResult.effectiveConfidence,
    dualSourcePresentation,
    presentationStatus,
    presentationFailureCode,
    presentationFailureMessage,
    persistenceResult,
  });
}
