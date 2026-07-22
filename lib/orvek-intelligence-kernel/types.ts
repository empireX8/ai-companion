/**
 * Shared Orvek Intelligence Kernel domain types (CEQR-001 foundation).
 *
 * Principle: AI determines what evidence may mean; deterministic code verifies
 * provenance, schema permissions, and what may persist.
 *
 * Domain types must not import a concrete provider or model.
 */

/** Zero-based, start-inclusive, end-exclusive offset into the exact supplied source text. */
export type SourceTextOffsets = {
  startOffset: number;
  endOffset: number;
};

/**
 * Deterministically bound and validated domain exact-evidence claim.
 * Constructed from authoritative KernelSourceUnit.sourceId, authoritative
 * sourceText, and model-selected validated offsets — not proposed as a whole
 * by the model.
 */
export type ExactEvidenceClaim = SourceTextOffsets & {
  sourceId: string;
  exactQuote: string;
};

/** Bounded source unit with lineage for later exact provenance. */
export type KernelSourceUnit = {
  sourceId: string;
  sessionId: string;
  messageId?: string | null;
  /** Complete source text supplied to the model for this unit. */
  sourceText: string;
  sourceRole: string;
  sourceType?: string;
  existingObjectId?: string | null;
  /** Stable human/system label for this side. */
  label: string;
};

/** Assembled evidence/context packet for kernel stages. */
export type KernelEvidenceContext = {
  userId?: string;
  sources: KernelSourceUnit[];
  assembledAt?: string;
};

export type KernelAbstentionCode =
  | "model_abstained"
  | "schema_parse_failed"
  | "validation_failed"
  | "model_execution_failed"
  | "model_timeout"
  | "insufficient_evidence"
  | "unsupported_object_type";

export type DeterministicValidationStatus =
  | "valid"
  | "invalid"
  | "not_run";

export type DeterministicValidationResult = {
  status: DeterministicValidationStatus;
  errors: string[];
  warnings: string[];
};

export type ObjectivityRefereeOutcome =
  | "PASS"
  | "PASS_WITH_LOWER_CONFIDENCE"
  | "ROUTE_TO_DIFFERENT_OBJECT_TYPE"
  | "REQUEST_MORE_EVIDENCE"
  | "ABSTAIN";

/**
 * Summary referee status for audit compatibility.
 *
 * Prefer ObjectivityRefereeResult.executionState + outcome for full fidelity.
 * - not_run: referee was not invoked
 * - ObjectivityRefereeOutcome: completed with a validated outcome
 * - execution_failed: referee threw/rejected
 * - invalid_evaluation: referee returned a malformed/invalid evaluation
 *
 * Do not treat execution_failed or invalid_evaluation as not_run.
 * Do not invent PASS for failures.
 */
export type RefereeStatus =
  | "not_run"
  | ObjectivityRefereeOutcome
  | "execution_failed"
  | "invalid_evaluation";

export type KernelAuditMetadata = {
  processorVersion: string;
  kernelContractVersion: string;
  schemaVersion: string;
  promptVersion: string;
  providerId: string | null;
  modelId: string | null;
  sourceIds: string[];
  executedAt: string;
  parseValidationOutcome: DeterministicValidationStatus | "model_failed";
  semanticClassification: string | null;
  abstentionOrErrorCode: KernelAbstentionCode | null;
  refereeStatus: RefereeStatus;
};

export type KernelAdjudicationOutcomeKind =
  | "semantic_accepted"
  | "abstained"
  | "validation_failed"
  | "model_failed";

/**
 * Shared adjudication envelope. Object-specific payloads live in `semantic`.
 * Persistence decisions are out of scope for CEQR-001 — no createCandidate field.
 */
export type KernelAdjudicationResult<TSemantic> = {
  outcome: KernelAdjudicationOutcomeKind;
  semantic: TSemantic | null;
  validation: DeterministicValidationResult;
  refereeStatus: RefereeStatus;
  audit: KernelAuditMetadata;
  abstentionReason: string | null;
  errorCode: KernelAbstentionCode | null;
  errorMessage: string | null;
};
