/**
 * CEQR-021 — strict live PASS classifier + sanitized diagnostics.
 *
 * PASS requires semantic outcomes + approved evidence spans + correct referee
 * behavior. Completed calls alone are never sufficient. Classifier recomputes
 * approved membership from catalogs and never trusts observation.approved.
 */

import {
  CEQR_021_CASES_AGGREGATE_SHA256,
  CEQR_021_EXPECTED_ADJUDICATOR_CALLS,
  CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
  CEQR_021_EXPECTED_COMPATIBLE_CLASSIFICATION,
  CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_021_EXPECTED_MAX_RETRIES,
  CEQR_021_EXPECTED_PROMPT_VERSION,
  CEQR_021_EXPECTED_PROVIDER_ID,
  CEQR_021_EXPECTED_REFEREE_CALLS,
  CEQR_021_EXPECTED_REFEREE_MODEL,
  CEQR_021_EXPECTED_SCHEMA_VERSION,
  CEQR_021_EXPECTED_TOTAL_PROVIDER_ATTEMPTS_ON_PASS,
  CEQR_021_FROZEN_SOURCE_IDS,
  type Ceqr021CallAccounting,
  type Ceqr021LiveClassification,
} from "./ceqr021-constants";
import {
  selectionIsApproved,
  type Ceqr021FrozenCaseCatalogs,
  type Ceqr021FrozenSideCatalog,
} from "./ceqr021-approved-evidence-spans";
import { fingerprintRawProviderObjectSha256OrNull } from "./contradiction-provider-object-fingerprint";
import type { LiveSyntheticCaseId } from "./contradiction-live-provider-referee-proof";
import type { EvidenceSpanSelection } from "./orvek-intelligence-kernel";
import { inspectLexicalOffsetIndependently } from "./orvek-intelligence-kernel";

const CEQR_021_FROZEN_CASE_IDS = [
  "clear_contradiction_candidate",
  "compatible_contextual",
  "ambiguous_insufficient",
] as const satisfies readonly LiveSyntheticCaseId[];

export type Ceqr021FailingSide = "A" | "B" | "both" | null;

export type Ceqr021SideDiagnostics = {
  rawStartBoundaryIndex: number | null;
  rawEndBoundaryIndex: number | null;
  resolvedStartOffset: number | null;
  resolvedEndOffset: number | null;
  sourceUtf16Length: number;
  sourceCodePointLength: number;
  selectedSpanLength: number | null;
  sourceTextSha256: string;
  catalogSha256: string;
  approvedSpanMembership: boolean | null;
  validationCode: string | null;
  startBoundaryCategory: string | null;
  endBoundaryCategory: string | null;
  splitsSurrogateAtStart: boolean | null;
  splitsSurrogateAtEnd: boolean | null;
  startOffsetInsideAlphanumericWord: boolean | null;
  endOffsetInsideAlphanumericWord: boolean | null;
  combiningMarkFailureAtStart: boolean | null;
  combiningMarkFailureAtEnd: boolean | null;
  exactQuoteEqualsAuthoritativeSlice: boolean | null;
  sourceIdAuthoritative: boolean | null;
};

export type Ceqr021RefereeStatus =
  | "not_reached"
  | "completed"
  | "failed"
  | "incomplete"
  | "not_required";

export type Ceqr021CaseDiagnostics = {
  caseId: LiveSyntheticCaseId;
  expectedClassification: string;
  observedClassification: string | null;
  providerId: typeof CEQR_021_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_021_EXPECTED_REFEREE_MODEL | string;
  refereeModelId: typeof CEQR_021_EXPECTED_REFEREE_MODEL | string;
  schemaVersion: typeof CEQR_021_EXPECTED_SCHEMA_VERSION;
  promptVersion: typeof CEQR_021_EXPECTED_PROMPT_VERSION;
  addendumVersion: typeof CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION;
  rawProviderObjectSha256: string | null;
  sideA: Ceqr021SideDiagnostics;
  sideB: Ceqr021SideDiagnostics;
  failingSide: Ceqr021FailingSide;
  compatibilityFlags: {
    bothCanSimultaneouslyBeTrue: boolean | null;
    changedBeliefOverTime: boolean | null;
    intentionVersusOutcome: boolean | null;
    goalVersusObstacle: boolean | null;
    emotionalOrPhysiologicalVersusReasoningStandard: boolean | null;
  };
  refereeStatus: Ceqr021RefereeStatus;
  earliestFailedGate: string | null;
  latencyMs: number | null;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  /** Code-derived synthetic evidence slices only — never raw provider payload. */
  approvedDerivedExactQuotes: {
    A: string | null;
    B: string | null;
  };
};

export type Ceqr021BoundEvidence = {
  sourceId: string;
  exactQuote: string;
  startOffset: number;
  endOffset: number;
  startBoundaryIndex: number;
  endBoundaryIndex: number;
  /** Observation convenience only — classifier ignores this and recomputes. */
  approved: boolean;
};

export type Ceqr021CaseObservation = {
  caseId: LiveSyntheticCaseId;
  expectedOutcome:
    | "clear_contradiction"
    | "compatible_non_clear"
    | "ambiguous_abstention";
  transportParsedAsSchemaV4: boolean;
  observedClassification: string | null;
  adjudicationOutcome:
    | "semantic_accepted"
    | "abstained"
    | "validation_failed"
    | "provider_failed"
    | "not_run"
    | null;
  compatibilityFlags: Ceqr021CaseDiagnostics["compatibilityFlags"];
  abstentionReason: string | null;
  evidenceA: Ceqr021BoundEvidence | null;
  evidenceB: Ceqr021BoundEvidence | null;
  transportSelectionA: EvidenceSpanSelection | null;
  transportSelectionB: EvidenceSpanSelection | null;
  rawProviderObjectSha256: string | null;
  /** Immutable copy of raw transport selection retained separately from bound evidence. */
  immutableRawTransportFingerprint: string | null;
  refereeReached: boolean;
  refereeCompleted: boolean;
  refereeFailed: boolean;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  writerInvoked: boolean;
  persistenceInvoked: boolean;
  nodeCreated: boolean;
  semanticConsistencyOk: boolean | null;
  validationCode: string | null;
  failingSide: Ceqr021FailingSide;
  earliestFailedGate: string | null;
  latencyMs: number | null;
  /** Landed adjudicator errorCode (authority; do not infer from outcome alone). */
  adjudicatorErrorCode?: string | null;
  adjudicatorErrorMessage?: string | null;
  validationErrors?: string[] | null;
  evidenceBindDiagnostics?: ReadonlyArray<{
    side: "A" | "B";
    startBoundaryIndex: number | null;
    endBoundaryIndex: number | null;
    startOffset: number | null;
    endOffset: number | null;
    validationCode: string | null;
    validationOk: boolean;
  }> | null;
};

export type Ceqr021CatalogsByCaseId =
  | ReadonlyMap<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>
  | Readonly<Record<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>>;

export type Ceqr021ClassifierInput = {
  caseObservations: readonly Ceqr021CaseObservation[];
  catalogsByCaseId: Ceqr021CatalogsByCaseId;
  accounting: Ceqr021CallAccounting;
  frozenPlanHashMatched: boolean;
  scenarioAggregateHashMatched: boolean;
  schemaPromptAddendumMatched: boolean;
  oneShotConsumedExactlyOnce: boolean;
  canonicalPathOk: boolean;
  productionReady: false;
  offlineDryRun?: boolean;
};

function getCatalogForCase(
  catalogsByCaseId: Ceqr021CatalogsByCaseId,
  caseId: LiveSyntheticCaseId,
): Ceqr021FrozenCaseCatalogs | undefined {
  if (catalogsByCaseId instanceof Map) {
    return catalogsByCaseId.get(caseId);
  }
  const record = catalogsByCaseId as Readonly<
    Partial<Record<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>>
  >;
  return record[caseId];
}

function allCompatibilityFlagsFalse(
  flags: Ceqr021CaseDiagnostics["compatibilityFlags"],
): boolean {
  return (
    flags.bothCanSimultaneouslyBeTrue === false &&
    flags.changedBeliefOverTime === false &&
    flags.intentionVersusOutcome === false &&
    flags.goalVersusObstacle === false &&
    flags.emotionalOrPhysiologicalVersusReasoningStandard === false
  );
}

function compatibleFlagsMatchFrozenContract(
  flags: Ceqr021CaseDiagnostics["compatibilityFlags"],
): boolean {
  return (
    flags.bothCanSimultaneouslyBeTrue === true &&
    flags.changedBeliefOverTime === false &&
    flags.intentionVersusOutcome === false &&
    flags.goalVersusObstacle === false &&
    flags.emotionalOrPhysiologicalVersusReasoningStandard === false
  );
}

function catalogOffsetsForSelection(
  side: Ceqr021FrozenSideCatalog,
  selection: EvidenceSpanSelection,
): { startOffset: number; endOffset: number } | null {
  const start = side.catalog[selection.startBoundaryIndex]?.offset;
  const end = side.catalog[selection.endBoundaryIndex]?.offset;
  if (start == null || end == null) return null;
  return { startOffset: start, endOffset: end };
}

function exactQuoteMatchesSlice(
  evidence: Ceqr021BoundEvidence,
  side: Ceqr021FrozenSideCatalog,
): boolean {
  return (
    evidence.exactQuote ===
    side.sourceText.slice(evidence.startOffset, evidence.endOffset)
  );
}

function evidenceHasExactFrozenSourceId(
  evidence: Ceqr021BoundEvidence,
  caseId: LiveSyntheticCaseId,
  side: "A" | "B",
): boolean {
  return evidence.sourceId === CEQR_021_FROZEN_SOURCE_IDS[caseId][side];
}

/**
 * Clear-path evidence: recompute approved membership; do not trust
 * observation.approved. Require frozen source IDs, catalog offsets, quote slice.
 */
function clearSideEvidenceOk(args: {
  caseId: LiveSyntheticCaseId;
  sideKey: "A" | "B";
  side: Ceqr021FrozenSideCatalog;
  selection: EvidenceSpanSelection | null;
  evidence: Ceqr021BoundEvidence | null;
}): Ceqr021LiveClassification | null {
  const { caseId, sideKey, side, selection, evidence } = args;
  if (selection == null || evidence == null) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (selectionIsApproved(side, selection) == null) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (!evidenceHasExactFrozenSourceId(evidence, caseId, sideKey)) {
    return "FAIL_SOURCE_AUTHORITY";
  }
  const resolved = catalogOffsetsForSelection(side, selection);
  if (resolved == null) {
    return "FAIL_INVALID_BOUNDARY_INDEX";
  }
  if (
    evidence.startOffset !== resolved.startOffset ||
    evidence.endOffset !== resolved.endOffset
  ) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (
    evidence.startBoundaryIndex !== selection.startBoundaryIndex ||
    evidence.endBoundaryIndex !== selection.endBoundaryIndex
  ) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (!exactQuoteMatchesSlice(evidence, side)) {
    return "FAIL_SOURCE_AUTHORITY";
  }
  return null;
}

/**
 * Compatible / optional ambiguous bind: exact frozen source IDs + quote
 * authority. Prefer approved selection when present; otherwise require offsets
 * to resolve from catalog selection indices when a selection is supplied.
 */
function boundEvidenceAuthoritativeOk(args: {
  caseId: LiveSyntheticCaseId;
  sideKey: "A" | "B";
  side: Ceqr021FrozenSideCatalog;
  selection: EvidenceSpanSelection | null;
  evidence: Ceqr021BoundEvidence | null;
  requirePresent: boolean;
}): Ceqr021LiveClassification | null {
  const { caseId, sideKey, side, selection, evidence, requirePresent } = args;
  if (evidence == null) {
    return requirePresent ? "FAIL_SOURCE_AUTHORITY" : null;
  }
  // Evidence without raw transport selection cannot PASS.
  if (selection == null) {
    return "FAIL_SOURCE_AUTHORITY";
  }
  if (
    evidence.startBoundaryIndex !== selection.startBoundaryIndex ||
    evidence.endBoundaryIndex !== selection.endBoundaryIndex
  ) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (!evidenceHasExactFrozenSourceId(evidence, caseId, sideKey)) {
    return "FAIL_SOURCE_AUTHORITY";
  }
  if (!exactQuoteMatchesSlice(evidence, side)) {
    return "FAIL_SOURCE_AUTHORITY";
  }
  const approved = selectionIsApproved(side, selection);
  const resolved = catalogOffsetsForSelection(side, selection);
  if (resolved == null) {
    return "FAIL_INVALID_BOUNDARY_INDEX";
  }
  if (
    evidence.startOffset !== resolved.startOffset ||
    evidence.endOffset !== resolved.endOffset
  ) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (approved != null) {
    if (
      evidence.startOffset !== approved.startOffset ||
      evidence.endOffset !== approved.endOffset
    ) {
      return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
    }
  }
  return null;
}

function providerFingerprintOk(
  obs: Ceqr021CaseObservation,
): Ceqr021LiveClassification | null {
  if (
    obs.adjudicationOutcome === "provider_failed" ||
    obs.adjudicationOutcome === "not_run"
  ) {
    return null;
  }
  const fp = obs.rawProviderObjectSha256;
  const imm = obs.immutableRawTransportFingerprint;
  if (fp == null || imm == null) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  if (!/^[a-f0-9]{64}$/.test(fp) || !/^[a-f0-9]{64}$/.test(imm)) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  if (fp !== imm) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  return null;
}

function mutationFlagsClear(obs: Ceqr021CaseObservation): boolean {
  return !obs.writerInvoked && !obs.persistenceInvoked && !obs.nodeCreated;
}

/**
 * Shared earliest-gate ordering for all three case classifiers.
 *
 * A landed provider failure must classify before schema-v4 parse / transport
 * parse flags. Otherwise credential/transport failures are misreported as
 * FAIL_SCHEMA_V4_PARSE when transportParsedAsSchemaV4 is false.
 */
export function classifyLandedProviderOrSchemaGate(
  obs: Ceqr021CaseObservation,
): Ceqr021LiveClassification | null {
  if (
    obs.adjudicationOutcome === "provider_failed" ||
    obs.adjudicatorErrorCode === "model_execution_failed" ||
    obs.adjudicatorErrorCode === "model_timeout"
  ) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  if (
    obs.validationCode === "schema_parse_failed" ||
    obs.adjudicatorErrorCode === "schema_parse_failed"
  ) {
    return "FAIL_SCHEMA_V4_PARSE";
  }
  if (!obs.transportParsedAsSchemaV4) {
    return "FAIL_SCHEMA_V4_PARSE";
  }
  return null;
}

/** Stable sanitized provider-failure message for canonical receipts. */
export function sanitizeCeqrProviderFailureMessage(args: {
  errorCode?: string | null;
  rawMessage?: string | null;
}): string {
  const haystack = `${args.errorCode ?? ""} ${args.rawMessage ?? ""}`;
  if (
    /auth|credential|api[\s_-]?key|unauthorized|401|forbidden|403|invalid.?key|incorrect.?api/i.test(
      haystack,
    )
  ) {
    return "Provider authentication failed; credential details redacted.";
  }
  return "Provider model execution failed; provider details redacted.";
}

export function observationRequiresProviderFailureSanitization(
  obs: Pick<
    Ceqr021CaseObservation,
    "adjudicationOutcome" | "adjudicatorErrorCode"
  >,
): boolean {
  return (
    obs.adjudicationOutcome === "provider_failed" ||
    obs.adjudicatorErrorCode === "model_execution_failed" ||
    obs.adjudicatorErrorCode === "model_timeout"
  );
}

export function sanitizeCeqr021CaseObservationForReceipt(
  obs: Ceqr021CaseObservation,
): Ceqr021CaseObservation {
  if (!observationRequiresProviderFailureSanitization(obs)) {
    return obs;
  }
  return {
    ...obs,
    adjudicatorErrorMessage: sanitizeCeqrProviderFailureMessage({
      errorCode: obs.adjudicatorErrorCode,
      rawMessage: obs.adjudicatorErrorMessage,
    }),
  };
}

function classifyClearCase(
  obs: Ceqr021CaseObservation,
  catalogs: Ceqr021FrozenCaseCatalogs,
): Ceqr021LiveClassification | null {
  const earliest = classifyLandedProviderOrSchemaGate(obs);
  if (earliest) return earliest;
  const fpFail = providerFingerprintOk(obs);
  if (fpFail) return fpFail;
  if (obs.validationCode === "invalid_boundary_index") {
    return "FAIL_INVALID_BOUNDARY_INDEX";
  }
  if (
    obs.validationCode === "unapproved_evidence_span" ||
    obs.validationCode === "invalid_or_unapproved_evidence_span"
  ) {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (obs.adjudicationOutcome === "validation_failed") {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (obs.observedClassification !== "clear_contradiction") {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.adjudicationOutcome !== "semantic_accepted") {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.semanticConsistencyOk !== true) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (!allCompatibilityFlagsFalse(obs.compatibilityFlags)) {
    return "FAIL_COMPATIBILITY_FLAG_CONTRACT";
  }
  if (obs.abstentionReason != null) {
    return "FAIL_ABSTENTION_CONTRACT";
  }

  const sideAFail = clearSideEvidenceOk({
    caseId: obs.caseId,
    sideKey: "A",
    side: catalogs.sideA,
    selection: obs.transportSelectionA,
    evidence: obs.evidenceA,
  });
  if (sideAFail) return sideAFail;
  const sideBFail = clearSideEvidenceOk({
    caseId: obs.caseId,
    sideKey: "B",
    side: catalogs.sideB,
    selection: obs.transportSelectionB,
    evidence: obs.evidenceB,
  });
  if (sideBFail) return sideBFail;

  if (!obs.refereeReached) return "FAIL_REFEREE_NOT_REACHED";
  if (obs.refereeFailed || !obs.refereeCompleted) {
    return "FAIL_REFEREE_OR_TRANSPORT";
  }
  if (obs.refereeCallCount !== 1) return "FAIL_CALL_BUDGET";
  if (!mutationFlagsClear(obs)) return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";
  return null;
}

function classifyCompatibleCase(
  obs: Ceqr021CaseObservation,
  catalogs: Ceqr021FrozenCaseCatalogs,
): Ceqr021LiveClassification | null {
  const earliest = classifyLandedProviderOrSchemaGate(obs);
  if (earliest) return earliest;
  const fpFail = providerFingerprintOk(obs);
  if (fpFail) return fpFail;
  if (obs.validationCode === "invalid_boundary_index") {
    return "FAIL_INVALID_BOUNDARY_INDEX";
  }
  if (obs.adjudicationOutcome === "validation_failed") {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (obs.adjudicationOutcome === "abstained" || obs.observedClassification == null) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.observedClassification !== CEQR_021_EXPECTED_COMPATIBLE_CLASSIFICATION) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.adjudicationOutcome !== "semantic_accepted") {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.semanticConsistencyOk !== true) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (!compatibleFlagsMatchFrozenContract(obs.compatibilityFlags)) {
    return "FAIL_COMPATIBILITY_FLAG_CONTRACT";
  }
  if (obs.abstentionReason != null) {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (obs.refereeReached || obs.refereeCallCount !== 0) {
    return "FAIL_CALL_BUDGET";
  }
  if (!mutationFlagsClear(obs)) return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";

  // Compatible requires both schema-required selections and both bound claims.
  if (
    obs.transportSelectionA == null ||
    obs.transportSelectionB == null ||
    obs.evidenceA == null ||
    obs.evidenceB == null
  ) {
    return "FAIL_SOURCE_AUTHORITY";
  }

  const sideAFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "A",
    side: catalogs.sideA,
    selection: obs.transportSelectionA,
    evidence: obs.evidenceA,
    requirePresent: true,
  });
  if (sideAFail) return sideAFail;
  const sideBFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "B",
    side: catalogs.sideB,
    selection: obs.transportSelectionB,
    evidence: obs.evidenceB,
    requirePresent: true,
  });
  if (sideBFail) return sideBFail;
  return null;
}

function classifyAmbiguousCase(
  obs: Ceqr021CaseObservation,
  catalogs: Ceqr021FrozenCaseCatalogs,
): Ceqr021LiveClassification | null {
  const earliest = classifyLandedProviderOrSchemaGate(obs);
  if (earliest) return earliest;
  const fpFail = providerFingerprintOk(obs);
  if (fpFail) return fpFail;
  if (obs.adjudicationOutcome === "validation_failed") {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (obs.adjudicationOutcome === "semantic_accepted") {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (obs.observedClassification !== null) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.adjudicationOutcome !== "abstained") {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (obs.abstentionReason == null || !/\S/.test(obs.abstentionReason)) {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (obs.refereeReached || obs.refereeCallCount !== 0) {
    return "FAIL_CALL_BUDGET";
  }
  if (!mutationFlagsClear(obs)) return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";

  const sideAFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "A",
    side: catalogs.sideA,
    selection: obs.transportSelectionA,
    evidence: obs.evidenceA,
    requirePresent: false,
  });
  if (sideAFail) return sideAFail;
  const sideBFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "B",
    side: catalogs.sideB,
    selection: obs.transportSelectionB,
    evidence: obs.evidenceB,
    requirePresent: false,
  });
  if (sideBFail) return sideBFail;
  return null;
}

/**
 * CEQR-022 provider-failure reproof only.
 *
 * Historical CEQR-021 required null-classification abstention for
 * ambiguous_insufficient. Schema-v4 permits Class D
 * (insufficient_or_misaligned_context) as a classified non-clear result;
 * the frozen pair is correctly Class D and must PASS under CEQR-022 when
 * schema/evidence/mutation gates succeed and the referee does not run.
 *
 * Does not alter classifyAmbiguousCase / classifyCeqr021LiveResult.
 */
export const CEQR_022_EXPECTED_AMBIGUOUS_CLASSIFICATION =
  "insufficient_or_misaligned_context" as const;

function classifyCeqr022AmbiguousCase(
  obs: Ceqr021CaseObservation,
  catalogs: Ceqr021FrozenCaseCatalogs,
): Ceqr021LiveClassification | null {
  const earliest = classifyLandedProviderOrSchemaGate(obs);
  if (earliest) return earliest;
  const fpFail = providerFingerprintOk(obs);
  if (fpFail) return fpFail;
  if (obs.validationCode === "invalid_boundary_index") {
    return "FAIL_INVALID_BOUNDARY_INDEX";
  }
  if (obs.adjudicationOutcome === "validation_failed") {
    return "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN";
  }
  if (obs.adjudicationOutcome === "abstained" || obs.observedClassification == null) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.observedClassification !== CEQR_022_EXPECTED_AMBIGUOUS_CLASSIFICATION) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.adjudicationOutcome !== "semantic_accepted") {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.semanticConsistencyOk !== true) {
    return "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH";
  }
  if (obs.abstentionReason != null) {
    return "FAIL_ABSTENTION_CONTRACT";
  }
  if (!obs.transportParsedAsSchemaV4) {
    return "FAIL_SCHEMA_V4_PARSE";
  }
  if (obs.refereeReached || obs.refereeCallCount !== 0) {
    return "FAIL_CALL_BUDGET";
  }
  if (!mutationFlagsClear(obs)) return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";

  if (
    obs.transportSelectionA == null ||
    obs.transportSelectionB == null ||
    obs.evidenceA == null ||
    obs.evidenceB == null
  ) {
    return "FAIL_SOURCE_AUTHORITY";
  }

  const sideAFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "A",
    side: catalogs.sideA,
    selection: obs.transportSelectionA,
    evidence: obs.evidenceA,
    requirePresent: true,
  });
  if (sideAFail) return sideAFail;
  const sideBFail = boundEvidenceAuthoritativeOk({
    caseId: obs.caseId,
    sideKey: "B",
    side: catalogs.sideB,
    selection: obs.transportSelectionB,
    evidence: obs.evidenceB,
    requirePresent: true,
  });
  if (sideBFail) return sideBFail;
  return null;
}

function classifyGlobalGates(
  input: Ceqr021ClassifierInput,
): Ceqr021LiveClassification | null {
  if (!input.canonicalPathOk || !input.oneShotConsumedExactlyOnce) {
    return "FAIL_ONE_SHOT_OR_CANONICAL_PATH";
  }
  if (!input.frozenPlanHashMatched || !input.scenarioAggregateHashMatched) {
    return "FAIL_ONE_SHOT_OR_CANONICAL_PATH";
  }
  if (!input.schemaPromptAddendumMatched) {
    return "FAIL_SCHEMA_V4_PARSE";
  }
  if (input.productionReady !== false) {
    return "FAIL_UNSAFE_MUTATION";
  }

  const observations = input.caseObservations;
  if (observations.length !== 3) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  const seen = new Set<LiveSyntheticCaseId>();
  for (const obs of observations) {
    if (
      !(CEQR_021_FROZEN_CASE_IDS as readonly string[]).includes(obs.caseId)
    ) {
      return "FAIL_PROVIDER_OR_TRANSPORT";
    }
    if (seen.has(obs.caseId)) {
      return "FAIL_PROVIDER_OR_TRANSPORT";
    }
    seen.add(obs.caseId);
  }
  for (const caseId of CEQR_021_FROZEN_CASE_IDS) {
    if (!seen.has(caseId)) {
      return "FAIL_PROVIDER_OR_TRANSPORT";
    }
  }

  const a = input.accounting;
  if (a.providerConstructionAttempted !== 1) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  if (a.liveRunnerInvoked !== 1) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }
  if (a.adjudicatorAttempts !== CEQR_021_EXPECTED_ADJUDICATOR_CALLS) {
    return "FAIL_CALL_BUDGET";
  }

  const sumAdj = observations.reduce((n, o) => n + o.adjudicatorCallCount, 0);
  if (sumAdj !== CEQR_021_EXPECTED_ADJUDICATOR_CALLS) {
    return "FAIL_CALL_BUDGET";
  }

  // total must always equal adj + ref (even on failure paths).
  if (a.totalProviderAttempts !== a.adjudicatorAttempts + a.refereeAttempts) {
    return "FAIL_CALL_BUDGET";
  }

  if (a.automaticRetries !== CEQR_021_EXPECTED_MAX_RETRIES) {
    return "FAIL_RETRY_BOUNDARY";
  }
  if (
    a.writerCalls !== 0 ||
    a.persistenceCalls !== 0 ||
    a.nodesCreated !== 0
  ) {
    return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";
  }
  if (a.accountGateCalls !== 0 || a.realDatabaseCalls !== 0) {
    return "FAIL_ACCOUNT_OR_DATABASE_BOUNDARY";
  }
  if (a.productionIngestionCalls !== 0) {
    return "FAIL_UNSAFE_MUTATION";
  }

  return null;
}

/**
 * PASS-only accounting: referee once, total 4, per-case referee sum matches.
 * Evaluated after case-level failures so specific semantic failures win.
 */
function classifyPassAccountingGates(
  input: Ceqr021ClassifierInput,
): Ceqr021LiveClassification | null {
  const a = input.accounting;
  if (a.refereeAttempts !== CEQR_021_EXPECTED_REFEREE_CALLS) {
    return "FAIL_CALL_BUDGET";
  }
  if (
    a.totalProviderAttempts !== CEQR_021_EXPECTED_TOTAL_PROVIDER_ATTEMPTS_ON_PASS
  ) {
    return "FAIL_CALL_BUDGET";
  }
  const sumRef = input.caseObservations.reduce(
    (n, o) => n + o.refereeCallCount,
    0,
  );
  if (sumRef !== CEQR_021_EXPECTED_REFEREE_CALLS) {
    return "FAIL_CALL_BUDGET";
  }
  return null;
}

/**
 * Strict deterministic classifier. Inspects observations + accounting +
 * catalogs — does not trust narrative runner fields or observation.approved.
 */
export function classifyCeqr021LiveResult(
  input: Ceqr021ClassifierInput,
): Ceqr021LiveClassification {
  if (input.offlineDryRun) {
    const liveClass = classifyCeqr021LiveResult({
      ...input,
      offlineDryRun: false,
    });
    if (liveClass === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED") {
      return "PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW";
    }
    return liveClass;
  }

  const globalFail = classifyGlobalGates(input);
  if (globalFail) return globalFail;

  const byId = new Map(input.caseObservations.map((o) => [o.caseId, o]));
  const clear = byId.get("clear_contradiction_candidate")!;
  const compatible = byId.get("compatible_contextual")!;
  const ambiguous = byId.get("ambiguous_insufficient")!;

  const clearCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "clear_contradiction_candidate",
  );
  const compatibleCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "compatible_contextual",
  );
  const ambiguousCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "ambiguous_insufficient",
  );
  if (!clearCatalogs || !compatibleCatalogs || !ambiguousCatalogs) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }

  const clearFail = classifyClearCase(clear, clearCatalogs);
  if (clearFail) return clearFail;
  const compatibleFail = classifyCompatibleCase(compatible, compatibleCatalogs);
  if (compatibleFail) return compatibleFail;
  const ambiguousFail = classifyAmbiguousCase(ambiguous, ambiguousCatalogs);
  if (ambiguousFail) return ambiguousFail;

  const passBudgetFail = classifyPassAccountingGates(input);
  if (passBudgetFail) return passBudgetFail;

  return "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED";
}

/**
 * CEQR-022 provider-failure reproof classifier.
 * Reuses CEQR-021 clear/compatible/global/pass gates; only the ambiguous case
 * contract differs (Class D insufficient_or_misaligned_context PASS).
 * Historical classifyCeqr021LiveResult remains unchanged.
 */
export function classifyCeqr022LiveResult(
  input: Ceqr021ClassifierInput,
): Ceqr021LiveClassification {
  if (input.offlineDryRun) {
    const liveClass = classifyCeqr022LiveResult({
      ...input,
      offlineDryRun: false,
    });
    if (liveClass === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED") {
      return "PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW";
    }
    return liveClass;
  }

  const globalFail = classifyGlobalGates(input);
  if (globalFail) return globalFail;

  const byId = new Map(input.caseObservations.map((o) => [o.caseId, o]));
  const clear = byId.get("clear_contradiction_candidate")!;
  const compatible = byId.get("compatible_contextual")!;
  const ambiguous = byId.get("ambiguous_insufficient")!;

  const clearCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "clear_contradiction_candidate",
  );
  const compatibleCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "compatible_contextual",
  );
  const ambiguousCatalogs = getCatalogForCase(
    input.catalogsByCaseId,
    "ambiguous_insufficient",
  );
  if (!clearCatalogs || !compatibleCatalogs || !ambiguousCatalogs) {
    return "FAIL_PROVIDER_OR_TRANSPORT";
  }

  const clearFail = classifyClearCase(clear, clearCatalogs);
  if (clearFail) return clearFail;
  const compatibleFail = classifyCompatibleCase(compatible, compatibleCatalogs);
  if (compatibleFail) return compatibleFail;
  const ambiguousFail = classifyCeqr022AmbiguousCase(
    ambiguous,
    ambiguousCatalogs,
  );
  if (ambiguousFail) return ambiguousFail;

  const passBudgetFail = classifyPassAccountingGates(input);
  if (passBudgetFail) return passBudgetFail;

  return "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED";
}

function sideDiagnosticsFrom(
  caseId: LiveSyntheticCaseId,
  sideKey: "A" | "B",
  side: Ceqr021FrozenSideCatalog,
  selection: EvidenceSpanSelection | null,
  bound: Ceqr021BoundEvidence | null,
  validationCode: string | null,
): Ceqr021SideDiagnostics {
  const start = selection?.startBoundaryIndex ?? null;
  const end = selection?.endBoundaryIndex ?? null;
  const resolvedFromSelection =
    selection != null ? catalogOffsetsForSelection(side, selection) : null;
  const startOffset =
    bound?.startOffset ?? resolvedFromSelection?.startOffset ?? null;
  const endOffset =
    bound?.endOffset ?? resolvedFromSelection?.endOffset ?? null;
  const approved =
    selection != null ? selectionIsApproved(side, selection) != null : null;

  const startInspection =
    startOffset != null
      ? inspectLexicalOffsetIndependently(side.sourceText, startOffset)
      : null;
  const endInspection =
    endOffset != null
      ? inspectLexicalOffsetIndependently(side.sourceText, endOffset)
      : null;

  return {
    rawStartBoundaryIndex: start,
    rawEndBoundaryIndex: end,
    resolvedStartOffset: startOffset,
    resolvedEndOffset: endOffset,
    sourceUtf16Length: side.sourceUtf16Length,
    sourceCodePointLength: side.sourceCodePointLength,
    selectedSpanLength:
      startOffset != null && endOffset != null ? endOffset - startOffset : null,
    sourceTextSha256: side.sourceSha256,
    catalogSha256: side.catalogSha256,
    approvedSpanMembership: approved,
    validationCode,
    startBoundaryCategory: startInspection?.category ?? null,
    endBoundaryCategory: endInspection?.category ?? null,
    splitsSurrogateAtStart: startInspection?.splitsSurrogate ?? null,
    splitsSurrogateAtEnd: endInspection?.splitsSurrogate ?? null,
    startOffsetInsideAlphanumericWord:
      startInspection?.insideAlphanumericWord ?? null,
    endOffsetInsideAlphanumericWord:
      endInspection?.insideAlphanumericWord ?? null,
    combiningMarkFailureAtStart:
      startInspection?.combiningMarkBoundaryFailure ?? null,
    combiningMarkFailureAtEnd:
      endInspection?.combiningMarkBoundaryFailure ?? null,
    exactQuoteEqualsAuthoritativeSlice:
      bound == null ? null : exactQuoteMatchesSlice(bound, side),
    sourceIdAuthoritative:
      bound == null
        ? null
        : evidenceHasExactFrozenSourceId(bound, caseId, sideKey),
  };
}

export function deriveCeqr021RefereeStatus(
  obs: Ceqr021CaseObservation,
): Ceqr021RefereeStatus {
  if (obs.expectedOutcome !== "clear_contradiction") {
    if (!obs.refereeReached && obs.refereeCallCount === 0 && !obs.refereeFailed) {
      return "not_required";
    }
  }
  if (obs.refereeFailed) return "failed";
  if (obs.refereeReached && obs.refereeCompleted) return "completed";
  if (obs.refereeReached && !obs.refereeCompleted) return "incomplete";
  return "not_reached";
}

export function buildCeqr021CaseDiagnostics(args: {
  observation: Ceqr021CaseObservation;
  catalogs: Ceqr021FrozenCaseCatalogs;
  adjudicatorModelId?: string;
  refereeModelId?: string;
}): Ceqr021CaseDiagnostics {
  const obs = args.observation;
  const expected =
    obs.expectedOutcome === "clear_contradiction"
      ? "clear_contradiction"
      : obs.expectedOutcome === "compatible_non_clear"
        ? "compatible_states_or_non_clear"
        : "abstention_or_ambiguous";
  return {
    caseId: obs.caseId,
    expectedClassification: expected,
    observedClassification: obs.observedClassification,
    providerId: CEQR_021_EXPECTED_PROVIDER_ID,
    adjudicatorModelId:
      args.adjudicatorModelId ?? CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: args.refereeModelId ?? CEQR_021_EXPECTED_REFEREE_MODEL,
    schemaVersion: CEQR_021_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_021_EXPECTED_PROMPT_VERSION,
    addendumVersion: CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
    rawProviderObjectSha256: obs.rawProviderObjectSha256,
    sideA: sideDiagnosticsFrom(
      obs.caseId,
      "A",
      args.catalogs.sideA,
      obs.transportSelectionA,
      obs.evidenceA,
      obs.failingSide === "A" || obs.failingSide === "both"
        ? obs.validationCode
        : null,
    ),
    sideB: sideDiagnosticsFrom(
      obs.caseId,
      "B",
      args.catalogs.sideB,
      obs.transportSelectionB,
      obs.evidenceB,
      obs.failingSide === "B" || obs.failingSide === "both"
        ? obs.validationCode
        : null,
    ),
    failingSide: obs.failingSide,
    compatibilityFlags: obs.compatibilityFlags,
    refereeStatus: deriveCeqr021RefereeStatus(obs),
    earliestFailedGate: obs.earliestFailedGate,
    latencyMs: obs.latencyMs,
    adjudicatorCallCount: obs.adjudicatorCallCount,
    refereeCallCount: obs.refereeCallCount,
    approvedDerivedExactQuotes: {
      A: obs.evidenceA?.exactQuote ?? null,
      B: obs.evidenceB?.exactQuote ?? null,
    },
  };
}

/** Stable SHA-256 of adjudicator-facing provider object, or null on failure. */
export function fingerprintProviderObject(value: unknown): string | null {
  return fingerprintRawProviderObjectSha256OrNull(value);
}

/**
 * Fail closed when a serialized receipt/diagnostics blob appears to embed
 * secrets or a full raw provider adjudication object dump.
 *
 * Detects ordinary OpenAI keys, project-prefixed keys, masked project-key
 * fingerprints (e.g. sk-proj-*****...AB12), Bearer tokens, and env assignments.
 */
export function assertSanitizedReceiptHasNoLeaks(
  serializedReceipt: string,
): { ok: true } | { ok: false; leaks: string[] } {
  const leaks: string[] = [];

  // Contiguous keys (ordinary + project-prefixed) and masked fingerprints.
  const keyMatches =
    serializedReceipt.match(/\bsk-(?:proj-)?[A-Za-z0-9*_.\-]{6,}/g) ?? [];
  for (const match of keyMatches) {
    if (/[*]|\.\.\./.test(match)) {
      if (!leaks.includes("masked_api_key_fingerprint")) {
        leaks.push("masked_api_key_fingerprint");
      }
    } else if (!leaks.includes("api_key_pattern")) {
      leaks.push("api_key_pattern");
    }
  }
  if (/\bBearer\s+[A-Za-z0-9._\-+=/]+/.test(serializedReceipt)) {
    leaks.push("bearer_token");
  }
  if (/Authorization\s*[:=]\s*Bearer\b/i.test(serializedReceipt)) {
    leaks.push("authorization_bearer");
  }
  if (/OPENAI_API_KEY\s*=/.test(serializedReceipt)) {
    leaks.push("env_assignment");
  }
  if (/https?:\/\/(?:[a-z0-9-]+\.)*openai\.com\b/i.test(serializedReceipt)) {
    leaks.push("provider_account_url");
  }
  if (
    /normalizedProposition/.test(serializedReceipt) &&
    /rationale/.test(serializedReceipt) &&
    /confidence/.test(serializedReceipt)
  ) {
    leaks.push("raw_provider_object_fields");
  }
  if (
    /"object"\s*:\s*\{/.test(serializedReceipt) &&
    (/normalizedProposition/.test(serializedReceipt) ||
      /"classification"\s*:/.test(serializedReceipt) ||
      /bothCanSimultaneouslyBeTrue/.test(serializedReceipt) ||
      /abstentionReason/.test(serializedReceipt) ||
      /evidenceClaimA/.test(serializedReceipt) ||
      /rationale/.test(serializedReceipt))
  ) {
    leaks.push("embedded_provider_object");
  }

  return leaks.length === 0 ? { ok: true } : { ok: false, leaks };
}

/** Validate final serialized canonical live-execution receipt JSON string. */
export function assertSanitizedCanonicalReceiptJson(
  serializedReceipt: string,
): { ok: true } | { ok: false; leaks: string[] } {
  return assertSanitizedReceiptHasNoLeaks(serializedReceipt);
}

export function assertSanitizedDiagnosticsHaveNoSecrets(
  diagnostics: Ceqr021CaseDiagnostics | readonly Ceqr021CaseDiagnostics[],
): { ok: true } | { ok: false; leaks: string[] } {
  return assertSanitizedReceiptHasNoLeaks(JSON.stringify(diagnostics));
}

export const CEQR_021_SCENARIO_AGGREGATE_SHA256_PIN =
  CEQR_021_CASES_AGGREGATE_SHA256;
