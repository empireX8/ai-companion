/**
 * CEQR-005 — dual-side exact span lineage construction contract.
 *
 * Pure deterministic module: constructs and validates exact Side A / Side B
 * EvidenceSpan lineage from a semantically selected, adjudicated, referee-
 * continued proposal.
 *
 * Does NOT:
 * - write to the database
 * - invoke contradiction materialisation or node create/update writers
 * - invent offsets, search messages, or fabricate spans
 * - authorise persistence or candidate creation
 *
 * lineageReadyForPersistenceGate / continuationReady means only that a later
 * persistence-wiring slice may consume the validated dual-side spans.
 */

import { createHash } from "node:crypto";

import type { ContradictionAdjudicationResult } from "./contradiction-adjudicator";
import { classificationAllowsContradictionNodeSemantics } from "./contradiction-adjudicator";
import type { SemanticallySelectedContradictionPair } from "./contradiction-same-session-selection";
import type { ExactEvidenceClaim, KernelSourceUnit } from "./orvek-intelligence-kernel/types";
import type { ObjectivityRefereeResult } from "./orvek-intelligence-kernel/objectivity-referee";

/**
 * Narrow lineage contract version for auditability of the dual-side span shape.
 * Independent of adjudication prompt/schema versions, referee interface version,
 * and KERNEL_CONTRACT_VERSION.
 */
export const CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION =
  "contradiction-dual-side-lineage-v1" as const;

export type StoredContradictionLineageState =
  | "complete_exact_dual_side"
  | "legacy_incomplete"
  | "invalid_partial";

export type ResolvedMessageForLineage = {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
};

export type DualSideLineageSideRole = "A" | "B";

export type ValidatedDualSideLineageSide = {
  role: DualSideLineageSideRole;
  sourceId: string;
  sessionId: string;
  messageId: string;
  exactQuote: string;
  /** Zero-based, start-inclusive offset into the exact message content. */
  startOffset: number;
  /** Zero-based, end-exclusive offset into the exact message content. */
  endOffset: number;
  /** SHA-256 hex digest of the exact quoted slice (not normalized proposition). */
  contentHash: string;
};

export type ValidatedDualSideLineage = {
  lineageContractVersion: typeof CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION;
  userId: string;
  sessionId: string;
  sideA: ValidatedDualSideLineageSide;
  sideB: ValidatedDualSideLineageSide;
  refereeOutcome: "PASS" | "PASS_WITH_LOWER_CONFIDENCE";
  /** Present when referee outcome is PASS_WITH_LOWER_CONFIDENCE. */
  adjustedConfidence: number | null;
  /**
   * Deterministic ensure/upsert descriptors for a later persistence slice.
   * This module does not call ensureEvidenceSpan or write anything.
   */
  spanEnsureDescriptors: {
    sideA: {
      userId: string;
      messageId: string;
      charStart: number;
      charEnd: number;
      contentHash: string;
    };
    sideB: {
      userId: string;
      messageId: string;
      charStart: number;
      charEnd: number;
      contentHash: string;
    };
  };
};

export type DualSideLineageFailureCode =
  | "not_selected_pair"
  | "adjudication_not_semantic_accepted"
  | "classification_not_clear_contradiction"
  | "deterministic_validation_invalid"
  | "missing_evidence_claim_a"
  | "missing_evidence_claim_b"
  | "selected_pair_persistable_flag_violation"
  | "referee_not_run"
  | "referee_failed"
  | "referee_invalid_evaluation"
  | "referee_continuation_blocked"
  | "cross_session"
  | "message_session_mismatch_a"
  | "message_session_mismatch_b"
  | "user_mismatch_a"
  | "user_mismatch_b"
  | "missing_message_id_a"
  | "missing_message_id_b"
  | "message_unresolved_a"
  | "message_unresolved_b"
  | "kernel_message_id_mismatch_a"
  | "kernel_message_id_mismatch_b"
  | "kernel_session_id_mismatch_a"
  | "kernel_session_id_mismatch_b"
  | "claim_source_id_mismatch_a"
  | "claim_source_id_mismatch_b"
  | "invalid_offsets_a"
  | "invalid_offsets_b"
  | "quote_mismatch_a"
  | "quote_mismatch_b"
  | "blank_quote_a"
  | "blank_quote_b"
  | "identical_side_spans"
  | "invalid_partial_stored_lineage";

export type DualSideLineageSuccess = {
  ok: true;
  lineageReadyForPersistenceGate: true;
  continuationReady: true;
  validatedDualSideLineage: ValidatedDualSideLineage;
  /** Explicitly never persistence-authorised in CEQR-005. */
  persistable: false;
  persistenceAuthorised: false;
  createCandidate: undefined;
  persistenceDecision: null;
};

export type DualSideLineageFailure = {
  ok: false;
  lineageReadyForPersistenceGate: false;
  continuationReady: false;
  code: DualSideLineageFailureCode;
  message: string;
  persistable: false;
  persistenceAuthorised: false;
  createCandidate: undefined;
  persistenceDecision: null;
};

export type DualSideLineageResult = DualSideLineageSuccess | DualSideLineageFailure;

export type DualSideLineageBuildInput = {
  userId: string;
  selectedPair: SemanticallySelectedContradictionPair;
  resolvedMessages: {
    sideA: ResolvedMessageForLineage;
    sideB: ResolvedMessageForLineage;
  };
};

function fail(
  code: DualSideLineageFailureCode,
  message: string,
): DualSideLineageFailure {
  return {
    ok: false,
    lineageReadyForPersistenceGate: false,
    continuationReady: false,
    code,
    message,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * SHA-256 of the exact quoted slice. Must not hash normalized proposition,
 * full message, ReferenceItem statement, or any altered/trimmed quote.
 */
export function hashExactQuoteSlice(exactQuote: string): string {
  return createHash("sha256").update(exactQuote, "utf8").digest("hex");
}

/**
 * Pure classification of stored ContradictionNode repaired-lineage FK shape.
 * Does not update rows. Existing both-null rows remain legacy_incomplete.
 */
export function classifyStoredContradictionLineage(args: {
  sideASourceSpanId: string | null | undefined;
  sideBSourceSpanId: string | null | undefined;
}): StoredContradictionLineageState {
  const a = args.sideASourceSpanId;
  const b = args.sideBSourceSpanId;
  const aPresent = typeof a === "string" && a.length > 0;
  const bPresent = typeof b === "string" && b.length > 0;

  if (aPresent && bPresent) {
    return "complete_exact_dual_side";
  }
  if (!aPresent && !bPresent) {
    return "legacy_incomplete";
  }
  return "invalid_partial";
}

/**
 * Reject same span ID on both opposing sides (application-level mirror of CHECK).
 */
export function rejectSameSpanOnBothSides(args: {
  sideASourceSpanId: string | null | undefined;
  sideBSourceSpanId: string | null | undefined;
}): { ok: true } | { ok: false; code: "identical_side_spans"; message: string } {
  const a = args.sideASourceSpanId;
  const b = args.sideBSourceSpanId;
  if (
    typeof a === "string" &&
    a.length > 0 &&
    typeof b === "string" &&
    b.length > 0 &&
    a === b
  ) {
    return {
      ok: false,
      code: "identical_side_spans",
      message:
        "Side A and Side B must use distinct EvidenceSpan IDs; same-span dual use is rejected.",
    };
  }
  return { ok: true };
}

function assertSelectedPairNonPersistable(
  pair: SemanticallySelectedContradictionPair,
): DualSideLineageFailure | null {
  if (pair.semanticallySelected !== true) {
    return fail(
      "not_selected_pair",
      "Input must be an explicitly semantically selected pair.",
    );
  }
  if (pair.persistable !== false || pair.persistenceAuthorised !== false) {
    return fail(
      "selected_pair_persistable_flag_violation",
      "Selected pair must remain explicitly non-persistable in CEQR-005.",
    );
  }
  if (pair.adjudication.persistenceDecision !== null) {
    return fail(
      "selected_pair_persistable_flag_violation",
      "Adjudication persistenceDecision must remain null.",
    );
  }
  if (pair.adjudication.createCandidate !== undefined) {
    return fail(
      "selected_pair_persistable_flag_violation",
      "Adjudication must not author createCandidate.",
    );
  }
  return null;
}

function assertRefereeContinuation(
  referee: ObjectivityRefereeResult,
): DualSideLineageFailure | null {
  if (referee.executionState === "not_run") {
    return fail(
      "referee_not_run",
      "Objectivity Referee must complete before lineage readiness.",
    );
  }
  if (referee.executionState === "failed") {
    return fail(
      "referee_failed",
      "Objectivity Referee failed; lineage readiness blocked.",
    );
  }
  if (referee.executionState === "invalid_evaluation") {
    return fail(
      "referee_invalid_evaluation",
      "Objectivity Referee evaluation invalid; lineage readiness blocked.",
    );
  }
  if (
    referee.executionState !== "completed" ||
    referee.validationErrors.length > 0 ||
    !referee.continuationAllowed
  ) {
    return fail(
      "referee_continuation_blocked",
      `Referee outcome ${String(referee.outcome)} does not allow lineage continuation.`,
    );
  }
  if (
    referee.outcome !== "PASS" &&
    referee.outcome !== "PASS_WITH_LOWER_CONFIDENCE"
  ) {
    return fail(
      "referee_continuation_blocked",
      `Referee outcome ${String(referee.outcome)} does not allow lineage continuation.`,
    );
  }
  return null;
}

function validateExactSide(args: {
  role: DualSideLineageSideRole;
  claim: ExactEvidenceClaim;
  source: KernelSourceUnit;
  message: ResolvedMessageForLineage;
  expectedUserId: string;
  expectedSessionId: string;
}): DualSideLineageFailure | ValidatedDualSideLineageSide {
  const {
    role,
    claim,
    source,
    message,
    expectedUserId,
    expectedSessionId,
  } = args;
  const suffix = role === "A" ? "a" : "b";

  if (!isNonBlankString(source.messageId)) {
    return fail(
      role === "A" ? "missing_message_id_a" : "missing_message_id_b",
      `Side ${role} requires a non-blank message ID.`,
    );
  }

  if (!isNonBlankString(message.id)) {
    return fail(
      role === "A" ? "message_unresolved_a" : "message_unresolved_b",
      `Side ${role} message did not resolve.`,
    );
  }

  if (source.messageId !== message.id) {
    return fail(
      role === "A"
        ? "kernel_message_id_mismatch_a"
        : "kernel_message_id_mismatch_b",
      `Side ${role} KernelSourceUnit.messageId does not match resolved message.`,
    );
  }

  if (source.sessionId !== message.sessionId) {
    return fail(
      role === "A"
        ? "kernel_session_id_mismatch_a"
        : "kernel_session_id_mismatch_b",
      `Side ${role} KernelSourceUnit.sessionId does not match resolved message.sessionId.`,
    );
  }

  if (message.sessionId !== expectedSessionId) {
    return fail(
      role === "A" ? "message_session_mismatch_a" : "message_session_mismatch_b",
      `Side ${role} resolved message does not belong to the shared session.`,
    );
  }

  if (message.userId !== expectedUserId) {
    return fail(
      role === "A" ? "user_mismatch_a" : "user_mismatch_b",
      `Side ${role} message userId does not match requested user.`,
    );
  }

  // Exact lineage must use message content — never ReferenceItem.statement alone.
  if (source.sourceText !== message.content) {
    return fail(
      role === "A" ? "quote_mismatch_a" : "quote_mismatch_b",
      `Side ${role} KernelSourceUnit.sourceText must equal resolved message content; statement/fabricated text is rejected.`,
    );
  }

  if (claim.sourceId !== source.sourceId) {
    return fail(
      role === "A" ? "claim_source_id_mismatch_a" : "claim_source_id_mismatch_b",
      `Side ${role} evidence claim sourceId does not match source unit.`,
    );
  }

  if (!isInteger(claim.startOffset) || !isInteger(claim.endOffset)) {
    return fail(
      role === "A" ? "invalid_offsets_a" : "invalid_offsets_b",
      `Side ${role} offsets must be integers.`,
    );
  }

  if (claim.startOffset < 0) {
    return fail(
      role === "A" ? "invalid_offsets_a" : "invalid_offsets_b",
      `Side ${role} start offset must be >= 0.`,
    );
  }

  if (claim.endOffset <= claim.startOffset) {
    return fail(
      role === "A" ? "invalid_offsets_a" : "invalid_offsets_b",
      `Side ${role} end offset must be > start offset.`,
    );
  }

  if (claim.endOffset > message.content.length) {
    return fail(
      role === "A" ? "invalid_offsets_a" : "invalid_offsets_b",
      `Side ${role} end offset exceeds message content length.`,
    );
  }

  if (typeof claim.exactQuote !== "string" || claim.exactQuote.trim().length === 0) {
    return fail(
      role === "A" ? "blank_quote_a" : "blank_quote_b",
      `Side ${role} exact quote must be nonblank.`,
    );
  }

  // Exact comparison — no trim/normalize of either side; no indexOf fallback.
  const sliced = message.content.slice(claim.startOffset, claim.endOffset);
  if (sliced !== claim.exactQuote) {
    return fail(
      role === "A" ? "quote_mismatch_a" : "quote_mismatch_b",
      `Side ${role} exact quote does not equal message.content.slice(start, end). No offset search or fabrication is permitted.`,
    );
  }

  void suffix;

  const contentHash = hashExactQuoteSlice(claim.exactQuote);

  return {
    role,
    sourceId: source.sourceId,
    sessionId: message.sessionId,
    messageId: message.id,
    exactQuote: claim.exactQuote,
    startOffset: claim.startOffset,
    endOffset: claim.endOffset,
    contentHash,
  };
}

/**
 * Build and validate exact dual-side lineage from a selected/adjudicated/
 * referee-continued proposal. Fail-closed. Never persists.
 */
export function buildValidatedDualSideLineage(
  input: DualSideLineageBuildInput,
): DualSideLineageResult {
  const pair = input.selectedPair;
  const nonPersistable = assertSelectedPairNonPersistable(pair);
  if (nonPersistable) return nonPersistable;

  const adjudication: ContradictionAdjudicationResult = pair.adjudication;

  if (adjudication.outcome !== "semantic_accepted") {
    return fail(
      "adjudication_not_semantic_accepted",
      `Adjudication outcome must be semantic_accepted; got ${adjudication.outcome}.`,
    );
  }

  if (adjudication.validation.status !== "valid") {
    return fail(
      "deterministic_validation_invalid",
      "Deterministic adjudication validation must be valid.",
    );
  }

  const semantic = adjudication.semantic;
  if (!semantic) {
    return fail(
      "adjudication_not_semantic_accepted",
      "Semantic payload missing after semantic_accepted.",
    );
  }

  if (
    !classificationAllowsContradictionNodeSemantics(semantic.classification) ||
    semantic.classification !== "clear_contradiction"
  ) {
    return fail(
      "classification_not_clear_contradiction",
      `Classification ${semantic.classification} is not clear_contradiction; lineage readiness blocked.`,
    );
  }

  if (!semantic.evidenceClaimA) {
    return fail("missing_evidence_claim_a", "Side A evidence claim is missing.");
  }
  if (!semantic.evidenceClaimB) {
    return fail("missing_evidence_claim_b", "Side B evidence claim is missing.");
  }

  const refereeGate = assertRefereeContinuation(adjudication.referee);
  if (refereeGate) return refereeGate;

  const sessionA = pair.sideA.sessionId;
  const sessionB = pair.sideB.sessionId;
  if (!isNonBlankString(sessionA) || sessionA !== sessionB) {
    return fail(
      "cross_session",
      "Side A and Side B must share the same non-blank session ID.",
    );
  }

  const sideA = validateExactSide({
    role: "A",
    claim: semantic.evidenceClaimA,
    source: pair.sideA,
    message: input.resolvedMessages.sideA,
    expectedUserId: input.userId,
    expectedSessionId: sessionA,
  });
  if ("ok" in sideA) return sideA;

  const sideB = validateExactSide({
    role: "B",
    claim: semantic.evidenceClaimB,
    source: pair.sideB,
    message: input.resolvedMessages.sideB,
    expectedUserId: input.userId,
    expectedSessionId: sessionA,
  });
  if ("ok" in sideB) return sideB;

  const validatedA = sideA;
  const validatedB = sideB;

  // Same-message contradictions are valid only with two distinct exact spans.
  if (
    validatedA.messageId === validatedB.messageId &&
    validatedA.startOffset === validatedB.startOffset &&
    validatedA.endOffset === validatedB.endOffset &&
    validatedA.contentHash === validatedB.contentHash
  ) {
    return fail(
      "identical_side_spans",
      "Side A and Side B exact span identities must be distinct (messageId + start + end + contentHash).",
    );
  }

  const refereeOutcome = adjudication.referee.outcome as
    | "PASS"
    | "PASS_WITH_LOWER_CONFIDENCE";

  const lineage: ValidatedDualSideLineage = {
    lineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    userId: input.userId,
    sessionId: sessionA,
    sideA: validatedA,
    sideB: validatedB,
    refereeOutcome,
    adjustedConfidence:
      refereeOutcome === "PASS_WITH_LOWER_CONFIDENCE"
        ? adjudication.referee.adjustedConfidence
        : null,
    spanEnsureDescriptors: {
      sideA: {
        userId: input.userId,
        messageId: validatedA.messageId,
        charStart: validatedA.startOffset,
        charEnd: validatedA.endOffset,
        contentHash: validatedA.contentHash,
      },
      sideB: {
        userId: input.userId,
        messageId: validatedB.messageId,
        charStart: validatedB.startOffset,
        charEnd: validatedB.endOffset,
        contentHash: validatedB.contentHash,
      },
    },
  };

  return {
    ok: true,
    lineageReadyForPersistenceGate: true,
    continuationReady: true,
    validatedDualSideLineage: lineage,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };
}
