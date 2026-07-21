/**
 * CONTRADICTION-PERSISTENCE-WIRING-001 — pure persistence-plan authorisation gate.
 *
 * Consumes:
 * - authoritative `SemanticallySelectedContradictionPair` (CEQR-004)
 * - already-validated CEQR-005 dual-side lineage built from that pair
 * - already-validated CEQR-006 confidence-policy result
 *
 * Binds all three before minting an in-memory authorised plan.
 *
 * This module does NOT:
 * - write to the database
 * - accept caller-supplied title / propositions / ContradictionType
 * - invoke materialisation or EvidenceSpan ensure helpers
 * - mutate upstream CEQR-005 / CEQR-006 results
 * - authorise production route / live message or import execution
 *
 * An authorised plan is an internal in-memory capability (WeakSet identity).
 * It is not a serialized transport contract. Version strings are inspectable
 * metadata only and do not grant authority.
 */

import {
  CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
  type DualSideLineageResult,
  type ValidatedDualSideLineage,
  type ValidatedDualSideLineageSide,
} from "./contradiction-dual-side-lineage";
import {
  CONTRADICTION_CONFIDENCE_POLICY_VERSION,
  type ContradictionConfidenceCalibrationResult,
  type EffectiveConfidenceSource,
  type RecommendedStorageConfidence,
} from "./contradiction-confidence-calibration";
import { classificationAllowsContradictionNodeSemantics } from "./contradiction-adjudicator";
import type { SemanticallySelectedContradictionPair } from "./contradiction-same-session-selection";
import type { ExactEvidenceClaim, KernelSourceUnit } from "./orvek-intelligence-kernel/types";

export const CONTRADICTION_PERSISTENCE_PLAN_VERSION =
  "contradiction-persistence-plan-v1" as const;

/** Deterministic display-title length bound (presentation only). */
export const CONTRADICTION_PERSISTENCE_TITLE_MAX_LENGTH = 240 as const;

/**
 * Prisma ContradictionType values as a pure string union — no Prisma import.
 * Only goal_behavior_gap / constraint_conflict are derived by this gate.
 */
export const CONTRADICTION_PERSISTENCE_TYPES = [
  "goal_behavior_gap",
  "value_conflict",
  "constraint_conflict",
  "belief_conflict",
  "pattern_loop",
  "narrative_conflict",
] as const;

export type ContradictionPersistenceType =
  (typeof CONTRADICTION_PERSISTENCE_TYPES)[number];

const STORAGE_CONFIDENCE_VALUES = new Set<RecommendedStorageConfidence>([
  "low",
  "medium",
  "high",
]);

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Module-private registry of plans minted by this gate.
 * Callers cannot import, copy, serialize, or forge membership.
 */
const authorisedPlans = new WeakSet<object>();

export type ContradictionPersistencePlanFailureCode =
  | "lineage_not_successful"
  | "lineage_not_continuation_ready"
  | "lineage_not_ready_for_persistence_gate"
  | "missing_validated_lineage"
  | "unsupported_lineage_contract_version"
  | "confidence_not_successful"
  | "below_candidate_floor"
  | "confidence_not_continuation_ready"
  | "unsupported_confidence_policy_version"
  | "malformed_effective_confidence"
  | "invalid_storage_confidence"
  | "user_mismatch"
  | "session_mismatch"
  | "missing_or_blank_semantic_fields"
  | "classification_not_clear_contradiction"
  | "missing_span_descriptor"
  | "identical_side_descriptors"
  | "missing_or_malformed_content_hash"
  | "noninteger_offsets"
  | "invalid_offset_ordering"
  | "blank_exact_quote"
  | "upstream_contract_contradiction"
  | "malformed_plan_input"
  | "selected_pair_not_selected"
  | "selected_pair_persistable_flag_violation"
  | "selected_pair_adjudication_not_accepted"
  | "selected_pair_validation_invalid"
  | "selected_pair_semantic_missing"
  | "selected_pair_persistence_decision_violation"
  | "selected_pair_create_candidate_violation"
  | "selected_pair_referee_not_ready"
  | "selected_pair_lineage_mismatch_a"
  | "selected_pair_lineage_mismatch_b"
  | "selected_pair_session_mismatch"
  | "selected_pair_referee_mismatch"
  | "selected_pair_confidence_contract_mismatch"
  | "missing_source_type"
  | "unsupported_source_type";

export type ContradictionPersistenceSpanEnsureDescriptor = {
  userId: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
  exactQuote: string;
};

export type ContradictionPersistencePlanInput = {
  selectedPair: SemanticallySelectedContradictionPair;
  lineageResult: DualSideLineageResult;
  confidenceResult: ContradictionConfidenceCalibrationResult;
};

export type ContradictionPersistenceAuthorisedPlan = {
  persistenceContractVersion: typeof CONTRADICTION_PERSISTENCE_PLAN_VERSION;
  supportedLineageContractVersion: typeof CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION;
  supportedConfidencePolicyVersion: typeof CONTRADICTION_CONFIDENCE_POLICY_VERSION;
  /** Plan-level authorisation only — membership in module WeakSet is the credential. */
  persistenceAuthorised: true;
  /** Explicit: no database write has occurred yet. */
  writeExecuted: false;
  userId: string;
  sharedSessionId: string;
  /**
   * Deterministic presentation-only display label derived from propositions.
   * Not an independent semantic fact and not an eligibility signal.
   */
  title: string;
  sideAProposition: string;
  sideBProposition: string;
  contradictionType: "goal_behavior_gap" | "constraint_conflict";
  recommendedStorageConfidence: RecommendedStorageConfidence;
  modelReportedConfidence: number;
  effectiveConfidence: number;
  effectiveConfidenceSource: EffectiveConfidenceSource;
  refereeOutcome: "PASS" | "PASS_WITH_LOWER_CONFIDENCE";
  sideASpanEnsureDescriptor: ContradictionPersistenceSpanEnsureDescriptor;
  sideBSpanEnsureDescriptor: ContradictionPersistenceSpanEnsureDescriptor;
  /** Shared session — truthful for both sides. */
  persistedSourceSessionId: string;
  /**
   * Singular sourceMessageId is null for repaired dual-side candidates.
   * Dual EvidenceSpan FKs are the provenance authority.
   */
  persistedSourceMessageId: null;
  /**
   * Inspectable Side B trigger message metadata only — not written to
   * ContradictionNode.sourceMessageId.
   */
  sideBTriggerMessageId: string;
  sourceMetadata: {
    lineageContractVersion: typeof CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION;
    confidencePolicyVersion: typeof CONTRADICTION_CONFIDENCE_POLICY_VERSION;
    lineageReadyForPersistenceGate: true;
    confidenceContinuationReady: true;
    meetsCandidateFloor: true;
    upstreamLineagePersistable: false;
    upstreamLineagePersistenceAuthorised: false;
    upstreamConfidencePersistable: false;
    upstreamConfidencePersistenceAuthorised: false;
    selectedPairPersistable: false;
    selectedPairPersistenceAuthorised: false;
    sideASourceType: "goal" | "constraint";
    titleIsDeterministicDisplayLabel: true;
  };
};

export type ContradictionPersistencePlanSuccess = {
  ok: true;
  plan: ContradictionPersistenceAuthorisedPlan;
  persistenceAuthorised: true;
  writeExecuted: false;
};

export type ContradictionPersistencePlanFailure = {
  ok: false;
  code: ContradictionPersistencePlanFailureCode;
  message: string;
  persistenceAuthorised: false;
  writeExecuted: false;
  plan: null;
};

export type ContradictionPersistencePlanResult =
  | ContradictionPersistencePlanSuccess
  | ContradictionPersistencePlanFailure;

function fail(
  code: ContradictionPersistencePlanFailureCode,
  message: string,
): ContradictionPersistencePlanFailure {
  return {
    ok: false,
    code,
    message,
    persistenceAuthorised: false,
    writeExecuted: false,
    plan: null,
  };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isFiniteUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function deepFreeze<T extends object>(value: T): T {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
      deepFreeze(nested as object);
    }
  }
  return value;
}

/**
 * Deterministic presentation-only title from validated normalized propositions.
 * Does not affect eligibility and does not classify semantics.
 */
export function buildDeterministicContradictionPersistenceTitle(
  sideAProposition: string,
  sideBProposition: string,
): string {
  const a = sideAProposition.trim();
  const b = sideBProposition.trim();
  const raw = `${a} ↔ ${b}`;
  if (raw.length <= CONTRADICTION_PERSISTENCE_TITLE_MAX_LENGTH) {
    return raw;
  }
  return `${raw.slice(0, CONTRADICTION_PERSISTENCE_TITLE_MAX_LENGTH - 1)}…`;
}

function deriveContradictionTypeFromSideASource(
  sideA: KernelSourceUnit,
):
  | { ok: true; type: "goal_behavior_gap" | "constraint_conflict"; sourceType: "goal" | "constraint" }
  | ContradictionPersistencePlanFailure {
  if (!isNonBlankString(sideA.sourceType)) {
    return fail(
      "missing_source_type",
      "Side A sourceType is missing; ContradictionType cannot be derived.",
    );
  }
  if (sideA.sourceType === "goal") {
    return { ok: true, type: "goal_behavior_gap", sourceType: "goal" };
  }
  if (sideA.sourceType === "constraint") {
    return { ok: true, type: "constraint_conflict", sourceType: "constraint" };
  }
  return fail(
    "unsupported_source_type",
    `Unsupported Side A sourceType for ContradictionType derivation: ${sideA.sourceType}`,
  );
}

function descriptorsIdentical(
  a: ContradictionPersistenceSpanEnsureDescriptor,
  b: ContradictionPersistenceSpanEnsureDescriptor,
): boolean {
  return (
    a.messageId === b.messageId &&
    a.charStart === b.charStart &&
    a.charEnd === b.charEnd &&
    a.contentHash === b.contentHash
  );
}

function validateSpanDescriptor(
  side: "A" | "B",
  lineage: ValidatedDualSideLineage,
):
  | { ok: true; descriptor: ContradictionPersistenceSpanEnsureDescriptor }
  | ContradictionPersistencePlanFailure {
  const sideData = side === "A" ? lineage.sideA : lineage.sideB;
  const raw =
    side === "A"
      ? lineage.spanEnsureDescriptors?.sideA
      : lineage.spanEnsureDescriptors?.sideB;

  if (!raw || typeof raw !== "object") {
    return fail(
      "missing_span_descriptor",
      `Side ${side} span ensure descriptor is missing.`,
    );
  }

  if (
    !isNonBlankString(raw.userId) ||
    !isNonBlankString(raw.messageId) ||
    !isNonBlankString(sideData?.exactQuote) ||
    !isValidSha256Hex(raw.contentHash)
  ) {
    if (!isValidSha256Hex(raw.contentHash)) {
      return fail(
        "missing_or_malformed_content_hash",
        `Side ${side} contentHash must be a SHA-256 hex digest.`,
      );
    }
    if (!isNonBlankString(sideData?.exactQuote)) {
      return fail("blank_exact_quote", `Side ${side} exactQuote is blank.`);
    }
    return fail(
      "missing_span_descriptor",
      `Side ${side} span ensure descriptor is incomplete.`,
    );
  }

  if (raw.userId !== lineage.userId) {
    return fail(
      "user_mismatch",
      `Side ${side} span descriptor userId does not match lineage userId.`,
    );
  }

  if (raw.messageId !== sideData.messageId) {
    return fail(
      "upstream_contract_contradiction",
      `Side ${side} span descriptor messageId does not match validated lineage side.`,
    );
  }

  if (!isInteger(raw.charStart) || !isInteger(raw.charEnd)) {
    return fail(
      "noninteger_offsets",
      `Side ${side} charStart/charEnd must be integers.`,
    );
  }

  if (raw.charStart < 0 || raw.charEnd <= raw.charStart) {
    return fail(
      "invalid_offset_ordering",
      `Side ${side} offsets must satisfy 0 <= charStart < charEnd.`,
    );
  }

  if (
    raw.charStart !== sideData.startOffset ||
    raw.charEnd !== sideData.endOffset ||
    raw.contentHash !== sideData.contentHash
  ) {
    return fail(
      "upstream_contract_contradiction",
      `Side ${side} span descriptor does not match validated lineage side offsets/hash.`,
    );
  }

  return {
    ok: true,
    descriptor: {
      userId: raw.userId,
      messageId: raw.messageId,
      charStart: raw.charStart,
      charEnd: raw.charEnd,
      contentHash: raw.contentHash,
      exactQuote: sideData.exactQuote,
    },
  };
}

function validateSelectedPair(
  selectedPair: SemanticallySelectedContradictionPair,
): ContradictionPersistencePlanFailure | null {
  if (!selectedPair || typeof selectedPair !== "object") {
    return fail("malformed_plan_input", "selectedPair is missing or malformed.");
  }
  if (selectedPair.semanticallySelected !== true) {
    return fail(
      "selected_pair_not_selected",
      "selectedPair.semanticallySelected must be true.",
    );
  }
  if (
    selectedPair.persistable !== false ||
    selectedPair.persistenceAuthorised !== false
  ) {
    return fail(
      "selected_pair_persistable_flag_violation",
      "selectedPair must retain persistable=false and persistenceAuthorised=false.",
    );
  }

  const adjudication = selectedPair.adjudication;
  if (!adjudication || typeof adjudication !== "object") {
    return fail(
      "selected_pair_adjudication_not_accepted",
      "selectedPair adjudication is missing.",
    );
  }
  if (adjudication.outcome !== "semantic_accepted") {
    return fail(
      "selected_pair_adjudication_not_accepted",
      `Adjudication outcome must be semantic_accepted (got ${adjudication.outcome}).`,
    );
  }
  if (adjudication.validation?.status !== "valid") {
    return fail(
      "selected_pair_validation_invalid",
      "Adjudication deterministic validation must be valid.",
    );
  }
  if (!adjudication.semantic) {
    return fail(
      "selected_pair_semantic_missing",
      "Validated semantic payload is missing.",
    );
  }
  if (
    !classificationAllowsContradictionNodeSemantics(
      adjudication.semantic.classification,
    ) ||
    adjudication.semantic.classification !== "clear_contradiction"
  ) {
    return fail(
      "classification_not_clear_contradiction",
      "Semantic classification must be clear_contradiction.",
    );
  }
  if (adjudication.persistenceDecision !== null) {
    return fail(
      "selected_pair_persistence_decision_violation",
      "Adjudication persistenceDecision must remain null.",
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(adjudication, "createCandidate") &&
    adjudication.createCandidate !== undefined
  ) {
    return fail(
      "selected_pair_create_candidate_violation",
      "Adjudication must not contain createCandidate.",
    );
  }

  const referee = adjudication.referee;
  if (
    !referee ||
    referee.executionState !== "completed" ||
    referee.continuationAllowed !== true ||
    !Array.isArray(referee.validationErrors) ||
    referee.validationErrors.length !== 0 ||
    (referee.outcome !== "PASS" &&
      referee.outcome !== "PASS_WITH_LOWER_CONFIDENCE")
  ) {
    return fail(
      "selected_pair_referee_not_ready",
      "Selected-pair referee must be completed, continuation-allowed, error-free, and PASS / PASS_WITH_LOWER_CONFIDENCE.",
    );
  }

  return null;
}

function bindSideToLineage(args: {
  side: "A" | "B";
  source: KernelSourceUnit;
  claim: ExactEvidenceClaim | null | undefined;
  lineageSide: ValidatedDualSideLineageSide;
  descriptor: ContradictionPersistenceSpanEnsureDescriptor;
  sharedSessionId: string;
}): ContradictionPersistencePlanFailure | null {
  const code =
    args.side === "A"
      ? "selected_pair_lineage_mismatch_a"
      : "selected_pair_lineage_mismatch_b";
  const { source, claim, lineageSide, descriptor, sharedSessionId } = args;

  if (!claim) {
    return fail(code, `Side ${args.side} evidence claim is missing.`);
  }
  if (
    source.sourceId !== lineageSide.sourceId ||
    claim.sourceId !== lineageSide.sourceId ||
    claim.sourceId !== source.sourceId
  ) {
    return fail(code, `Side ${args.side} sourceId does not match lineage.`);
  }
  if (
    source.sessionId !== sharedSessionId ||
    source.sessionId !== lineageSide.sessionId
  ) {
    return fail(code, `Side ${args.side} sessionId does not match lineage.`);
  }
  if (
    !isNonBlankString(source.messageId) ||
    source.messageId !== lineageSide.messageId ||
    source.messageId !== descriptor.messageId
  ) {
    return fail(code, `Side ${args.side} messageId does not match lineage.`);
  }
  if (
    claim.exactQuote !== lineageSide.exactQuote ||
    claim.exactQuote !== descriptor.exactQuote ||
    claim.startOffset !== lineageSide.startOffset ||
    claim.endOffset !== lineageSide.endOffset ||
    claim.startOffset !== descriptor.charStart ||
    claim.endOffset !== descriptor.charEnd
  ) {
    return fail(
      code,
      `Side ${args.side} exact quote/offsets do not match lineage/descriptor.`,
    );
  }
  return null;
}

/**
 * Pure deterministic gate: selected pair + lineage + confidence → plan.
 * Does not write. Does not mutate upstream results.
 */
export function buildContradictionPersistencePlan(
  input: ContradictionPersistencePlanInput,
): ContradictionPersistencePlanResult {
  if (!input || typeof input !== "object") {
    return fail("malformed_plan_input", "Persistence plan input is malformed.");
  }

  const { selectedPair, lineageResult, confidenceResult } = input;

  if (!lineageResult || typeof lineageResult !== "object") {
    return fail("malformed_plan_input", "lineageResult is missing or malformed.");
  }
  if (!confidenceResult || typeof confidenceResult !== "object") {
    return fail(
      "malformed_plan_input",
      "confidenceResult is missing or malformed.",
    );
  }

  const selectedPairError = validateSelectedPair(selectedPair);
  if (selectedPairError) return selectedPairError;

  // Upstream non-persistence markers must remain false (not reinterpreted as errors).
  if (
    lineageResult.persistable !== false ||
    lineageResult.persistenceAuthorised !== false
  ) {
    return fail(
      "upstream_contract_contradiction",
      "CEQR-005 lineage result must retain persistable=false and persistenceAuthorised=false.",
    );
  }
  if (
    confidenceResult.persistable !== false ||
    confidenceResult.persistenceAuthorised !== false
  ) {
    return fail(
      "upstream_contract_contradiction",
      "CEQR-006 confidence result must retain persistable=false and persistenceAuthorised=false.",
    );
  }

  if (!lineageResult.ok) {
    return fail(
      "lineage_not_successful",
      `Lineage result is not successful (${lineageResult.code}).`,
    );
  }

  if (lineageResult.lineageReadyForPersistenceGate !== true) {
    return fail(
      "lineage_not_ready_for_persistence_gate",
      "lineageReadyForPersistenceGate is not true.",
    );
  }

  if (lineageResult.continuationReady !== true) {
    return fail(
      "lineage_not_continuation_ready",
      "Lineage continuationReady is not true.",
    );
  }

  const lineage = lineageResult.validatedDualSideLineage;
  if (!lineage || typeof lineage !== "object") {
    return fail(
      "missing_validated_lineage",
      "validatedDualSideLineage is missing.",
    );
  }

  if (lineage.lineageContractVersion !== CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION) {
    return fail(
      "unsupported_lineage_contract_version",
      `Unsupported lineage contract version: ${String(lineage.lineageContractVersion)}`,
    );
  }

  if (!confidenceResult.ok) {
    return fail(
      "confidence_not_successful",
      `Confidence result is not successful (${confidenceResult.code}).`,
    );
  }

  if (
    confidenceResult.confidencePolicyVersion !==
    CONTRADICTION_CONFIDENCE_POLICY_VERSION
  ) {
    return fail(
      "unsupported_confidence_policy_version",
      `Unsupported confidence policy version: ${String(confidenceResult.confidencePolicyVersion)}`,
    );
  }

  if (confidenceResult.meetsCandidateFloor !== true) {
    return fail(
      "below_candidate_floor",
      "Effective confidence does not meet the candidate floor; persistence plan refused.",
    );
  }

  if (confidenceResult.continuationReady !== true) {
    return fail(
      "confidence_not_continuation_ready",
      "Confidence continuationReady is not true.",
    );
  }

  if (!isFiniteUnitInterval(confidenceResult.effectiveConfidence)) {
    return fail(
      "malformed_effective_confidence",
      "effectiveConfidence must be a finite number in [0,1].",
    );
  }

  if (
    !isFiniteUnitInterval(confidenceResult.modelReportedConfidence) ||
    !STORAGE_CONFIDENCE_VALUES.has(confidenceResult.recommendedStorageConfidence)
  ) {
    return fail(
      "invalid_storage_confidence",
      "recommendedStorageConfidence or modelReportedConfidence is invalid.",
    );
  }

  if (
    !isNonBlankString(lineage.userId) ||
    !isNonBlankString(lineage.sessionId) ||
    !isNonBlankString(lineage.sideA?.sessionId) ||
    !isNonBlankString(lineage.sideB?.sessionId)
  ) {
    return fail(
      "session_mismatch",
      "Lineage user/session identity is incomplete.",
    );
  }

  if (
    lineage.sideA.sessionId !== lineage.sessionId ||
    lineage.sideB.sessionId !== lineage.sessionId
  ) {
    return fail(
      "session_mismatch",
      "Side A and Side B session IDs must match the shared lineage session.",
    );
  }

  if (
    selectedPair.sideA.sessionId !== lineage.sessionId ||
    selectedPair.sideB.sessionId !== lineage.sessionId
  ) {
    return fail(
      "selected_pair_session_mismatch",
      "Selected-pair Side A/B session must match lineage shared session.",
    );
  }

  if (
    lineage.spanEnsureDescriptors.sideA.userId !== lineage.userId ||
    lineage.spanEnsureDescriptors.sideB.userId !== lineage.userId
  ) {
    return fail("user_mismatch", "Span descriptor userId does not match lineage.");
  }

  const refereeOutcome = selectedPair.adjudication.referee.outcome;
  if (
    refereeOutcome !== lineage.refereeOutcome ||
    (refereeOutcome !== "PASS" &&
      refereeOutcome !== "PASS_WITH_LOWER_CONFIDENCE")
  ) {
    return fail(
      "selected_pair_referee_mismatch",
      "Selected-pair referee outcome does not match lineage referee outcome.",
    );
  }

  if (confidenceResult.refereeOutcome !== refereeOutcome) {
    return fail(
      "selected_pair_confidence_contract_mismatch",
      "CEQR-006 referee outcome does not match the selected-pair referee outcome.",
    );
  }

  const semantic = selectedPair.adjudication.semantic!;
  const sideAProposition = semantic.propositionA?.normalizedProposition;
  const sideBProposition = semantic.propositionB?.normalizedProposition;
  if (!isNonBlankString(sideAProposition) || !isNonBlankString(sideBProposition)) {
    return fail(
      "missing_or_blank_semantic_fields",
      "Validated normalized propositions must be non-blank.",
    );
  }

  const typeDerivation = deriveContradictionTypeFromSideASource(selectedPair.sideA);
  if (!("type" in typeDerivation)) return typeDerivation;

  const sideA = validateSpanDescriptor("A", lineage);
  if (!("descriptor" in sideA)) return sideA;
  const sideB = validateSpanDescriptor("B", lineage);
  if (!("descriptor" in sideB)) return sideB;

  if (descriptorsIdentical(sideA.descriptor, sideB.descriptor)) {
    return fail(
      "identical_side_descriptors",
      "Side A and Side B span ensure descriptors must be distinct.",
    );
  }

  const bindA = bindSideToLineage({
    side: "A",
    source: selectedPair.sideA,
    claim: semantic.evidenceClaimA,
    lineageSide: lineage.sideA,
    descriptor: sideA.descriptor,
    sharedSessionId: lineage.sessionId,
  });
  if (bindA) return bindA;

  const bindB = bindSideToLineage({
    side: "B",
    source: selectedPair.sideB,
    claim: semantic.evidenceClaimB,
    lineageSide: lineage.sideB,
    descriptor: sideB.descriptor,
    sharedSessionId: lineage.sessionId,
  });
  if (bindB) return bindB;

  const title = buildDeterministicContradictionPersistenceTitle(
    sideAProposition,
    sideBProposition,
  );
  if (!isNonBlankString(title)) {
    return fail(
      "missing_or_blank_semantic_fields",
      "Derived persistence title must be non-blank.",
    );
  }

  const plan = deepFreeze({
    persistenceContractVersion: CONTRADICTION_PERSISTENCE_PLAN_VERSION,
    supportedLineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    supportedConfidencePolicyVersion: CONTRADICTION_CONFIDENCE_POLICY_VERSION,
    persistenceAuthorised: true as const,
    writeExecuted: false as const,
    userId: lineage.userId,
    sharedSessionId: lineage.sessionId,
    title,
    sideAProposition: sideAProposition.trim(),
    sideBProposition: sideBProposition.trim(),
    contradictionType: typeDerivation.type,
    recommendedStorageConfidence: confidenceResult.recommendedStorageConfidence,
    modelReportedConfidence: confidenceResult.modelReportedConfidence,
    effectiveConfidence: confidenceResult.effectiveConfidence,
    effectiveConfidenceSource: confidenceResult.effectiveConfidenceSource,
    refereeOutcome: lineage.refereeOutcome,
    sideASpanEnsureDescriptor: sideA.descriptor,
    sideBSpanEnsureDescriptor: sideB.descriptor,
    persistedSourceSessionId: lineage.sessionId,
    persistedSourceMessageId: null,
    sideBTriggerMessageId: lineage.sideB.messageId,
    sourceMetadata: {
      lineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
      confidencePolicyVersion: CONTRADICTION_CONFIDENCE_POLICY_VERSION,
      lineageReadyForPersistenceGate: true as const,
      confidenceContinuationReady: true as const,
      meetsCandidateFloor: true as const,
      upstreamLineagePersistable: false as const,
      upstreamLineagePersistenceAuthorised: false as const,
      upstreamConfidencePersistable: false as const,
      upstreamConfidencePersistenceAuthorised: false as const,
      selectedPairPersistable: false as const,
      selectedPairPersistenceAuthorised: false as const,
      sideASourceType: typeDerivation.sourceType,
      titleIsDeterministicDisplayLabel: true as const,
    },
  }) satisfies ContradictionPersistenceAuthorisedPlan;

  authorisedPlans.add(plan);

  return {
    ok: true,
    plan,
    persistenceAuthorised: true,
    writeExecuted: false,
  };
}

/**
 * Runtime guard: only deep-frozen plans minted by this gate and registered in
 * the module-private WeakSet are accepted. Version strings / flag fields alone
 * never grant authority.
 */
export function assertAuthorisedContradictionPersistencePlan(
  value: unknown,
):
  | { ok: true; plan: ContradictionPersistenceAuthorisedPlan }
  | { ok: false; code: "plan_not_authorised" | "malformed_plan_object"; message: string } {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      code: "malformed_plan_object",
      message: "Persistence plan object is malformed.",
    };
  }

  if (!authorisedPlans.has(value)) {
    return {
      ok: false,
      code: "plan_not_authorised",
      message:
        "Plan is not an authorised in-memory contradiction persistence plan (WeakSet identity missing).",
    };
  }

  if (!Object.isFrozen(value)) {
    return {
      ok: false,
      code: "plan_not_authorised",
      message: "Authorised plan must remain frozen after minting.",
    };
  }

  const plan = value as ContradictionPersistenceAuthorisedPlan;

  if (
    plan.persistenceContractVersion !== CONTRADICTION_PERSISTENCE_PLAN_VERSION ||
    plan.persistenceAuthorised !== true ||
    plan.writeExecuted !== false ||
    plan.persistedSourceMessageId !== null ||
    !isNonBlankString(plan.userId) ||
    !isNonBlankString(plan.sharedSessionId) ||
    !isNonBlankString(plan.title) ||
    !isNonBlankString(plan.sideAProposition) ||
    !isNonBlankString(plan.sideBProposition) ||
    (plan.contradictionType !== "goal_behavior_gap" &&
      plan.contradictionType !== "constraint_conflict") ||
    !plan.sideASpanEnsureDescriptor ||
    !plan.sideBSpanEnsureDescriptor ||
    !Object.isFrozen(plan.sideASpanEnsureDescriptor) ||
    !Object.isFrozen(plan.sideBSpanEnsureDescriptor)
  ) {
    return {
      ok: false,
      code: "malformed_plan_object",
      message: "Authorised plan failed runtime shape reassertion.",
    };
  }

  return { ok: true, plan };
}
