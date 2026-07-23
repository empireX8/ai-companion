/**
 * CEQR-021 — complete controlled live three-case orchestration (writer-blocked).
 *
 * Production wires real OpenAI adapters via createOpenAiContradictionLiveAdapters.
 * Offline preparation never executes this path against a live provider.
 * Tests inject fake adapters behind an opaque test capability.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { performance } from "perf_hooks";

import {
  CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
  CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_021_EXPECTED_REFEREE_MODEL,
  CEQR_021_EXPECTED_TIMEOUT_MS,
  CEQR_021_FROZEN_SOURCE_IDS,
  CEQR_021_LIVE_RECEIPT_FILENAME,
  CEQR_021_SLICE_ID,
  createEmptyCeqr021CallAccounting,
  syncCeqr021TotalProviderAttempts,
  type Ceqr021CallAccounting,
  type Ceqr021LiveClassification,
} from "./ceqr021-constants";
import {
  CEQR_021_SYNTHETIC_CASES,
  buildAllFrozenScenarioCatalogs,
  selectionIsApproved,
  type Ceqr021FrozenCaseCatalogs,
} from "./ceqr021-approved-evidence-spans";
import { CEQR_021_LIVE_ADDENDUM_TEXT } from "./ceqr021-schema-v4-contract";
import {
  assertSanitizedCanonicalReceiptJson,
  buildCeqr021CaseDiagnostics,
  classifyCeqr021LiveResult,
  sanitizeCeqr021CaseObservationForReceipt,
  type Ceqr021BoundEvidence,
  type Ceqr021CaseObservation,
} from "./ceqr021-live-pass-classifier";
import {
  createOpenAiContradictionLiveAdapters,
  type ContradictionLiveAdapterBundle,
} from "./contradiction-live-provider-adapters";
import {
  adjudicateContradiction,
  type ContradictionAdjudicationResult,
} from "./contradiction-adjudicator";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import type { EvidenceSpanSelection } from "./orvek-intelligence-kernel";
import type { LiveSyntheticCaseId } from "./contradiction-live-provider-referee-proof";

function wrapRunnerWithCeqr021Addendum(
  runner: StructuredModelRunner,
): StructuredModelRunner {
  return {
    async runStructured(request) {
      const system = [request.system ?? "", CEQR_021_LIVE_ADDENDUM_TEXT]
        .filter((part) => part.length > 0)
        .join("\n");
      return runner.runStructured({ ...request, system });
    },
  };
}

function fsyncDirectoryBestEffort(dirPath: string): void {
  try {
    const fd = openSync(dirPath, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // best-effort
  }
}

export function proveCeqr021LiveOrchestrationPrerequisitesReady():
  | { ok: true }
  | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (typeof createOpenAiContradictionLiveAdapters !== "function") {
    missing.push("createOpenAiContradictionLiveAdapters");
  }
  if (typeof executeCeqr021LiveThreeCaseMatrix !== "function") {
    missing.push("executeCeqr021LiveThreeCaseMatrix");
  }
  if (typeof finalizeCeqr021LiveReceiptAtomic !== "function") {
    missing.push("finalizeCeqr021LiveReceiptAtomic");
  }
  if (typeof classifyCeqr021LiveResult !== "function") {
    missing.push("classifyCeqr021LiveResult");
  }
  if (typeof buildCeqr021ProductionAdapters !== "function") {
    missing.push("buildCeqr021ProductionAdapters");
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

export async function buildCeqr021ProductionAdapters(): Promise<ContradictionLiveAdapterBundle> {
  const adapters = await createOpenAiContradictionLiveAdapters({
    adjudicatorModelId: CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_021_EXPECTED_REFEREE_MODEL,
    timeoutMs: CEQR_021_EXPECTED_TIMEOUT_MS,
    maxTotalCalls: CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  });
  return {
    ...adapters,
    adjudicatorRunner: wrapRunnerWithCeqr021Addendum(adapters.adjudicatorRunner),
    adjudicatorPromptAddendumVersion:
      CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION as typeof adapters.adjudicatorPromptAddendumVersion,
  };
}

function boundFromSemanticClaim(
  side: Ceqr021FrozenCaseCatalogs["sideA"],
  claim: {
    sourceId: string;
    exactQuote: string;
    startOffset: number;
    endOffset: number;
  },
):
  | { ok: true; evidence: Ceqr021BoundEvidence; selection: EvidenceSpanSelection }
  | { ok: false; code: string } {
  const startIdx = side.catalog.findIndex((e) => e.offset === claim.startOffset);
  const endIdx = side.catalog.findIndex((e) => e.offset === claim.endOffset);
  if (startIdx < 0 || endIdx < 0) {
    return { ok: false, code: "invalid_boundary_index" };
  }
  const selection = {
    startBoundaryIndex: startIdx,
    endBoundaryIndex: endIdx,
  };
  return {
    ok: true,
    selection,
    evidence: {
      sourceId: claim.sourceId,
      exactQuote: claim.exactQuote,
      startOffset: claim.startOffset,
      endOffset: claim.endOffset,
      startBoundaryIndex: startIdx,
      endBoundaryIndex: endIdx,
      approved: selectionIsApproved(side, selection) != null,
    },
  };
}

function evidenceFromBindDiagnostic(
  side: Ceqr021FrozenCaseCatalogs["sideA"],
  diag: NonNullable<
    ContradictionAdjudicationResult["evidenceBindDiagnostics"]
  >[number],
  sourceId: string,
): Ceqr021BoundEvidence | null {
  if (
    diag.startOffset == null ||
    diag.endOffset == null ||
    diag.startBoundaryIndex == null ||
    diag.endBoundaryIndex == null
  ) {
    return null;
  }
  const exactQuote = side.sourceText.slice(diag.startOffset, diag.endOffset);
  return {
    sourceId,
    exactQuote,
    startOffset: diag.startOffset,
    endOffset: diag.endOffset,
    startBoundaryIndex: diag.startBoundaryIndex,
    endBoundaryIndex: diag.endBoundaryIndex,
    approved:
      selectionIsApproved(side, {
        startBoundaryIndex: diag.startBoundaryIndex,
        endBoundaryIndex: diag.endBoundaryIndex,
      }) != null,
  };
}

function mapLandedAdjudicationToObservation(args: {
  caseId: LiveSyntheticCaseId;
  expectedOutcome: Ceqr021CaseObservation["expectedOutcome"];
  frozen: Ceqr021FrozenCaseCatalogs;
  sourceIds: { A: string; B: string };
  adjudication: ContradictionAdjudicationResult;
  adjDelta: number;
  refDelta: number;
  latencyMs: number;
}): Ceqr021CaseObservation {
  const { adjudication, frozen, sourceIds } = args;
  const rawSel = adjudication.rawEvidenceTransportSelections;
  const selA = rawSel?.evidenceClaimA ?? null;
  const selB = rawSel?.evidenceClaimB ?? null;
  const bindDiags = adjudication.evidenceBindDiagnostics ?? null;
  const diagA = bindDiags?.find((d) => d.side === "A") ?? null;
  const diagB = bindDiags?.find((d) => d.side === "B") ?? null;

  let evidenceA: Ceqr021BoundEvidence | null = null;
  let evidenceB: Ceqr021BoundEvidence | null = null;
  let validationCode: string | null = null;
  let failingSide: Ceqr021CaseObservation["failingSide"] = null;

  // Prefer landed bind diagnostics for failure side and preserved offsets.
  if (diagA && !diagA.validationOk) {
    validationCode = diagA.validationCode;
    failingSide = "A";
    evidenceA = evidenceFromBindDiagnostic(frozen.sideA, diagA, sourceIds.A);
  }
  if (diagB && !diagB.validationOk) {
    validationCode = validationCode ?? diagB.validationCode;
    failingSide = failingSide === "A" ? "both" : "B";
    evidenceB = evidenceFromBindDiagnostic(frozen.sideB, diagB, sourceIds.B);
  }

  const semantic = adjudication.semantic;
  if (diagA?.validationOk && semantic?.evidenceClaimA) {
    const bound = boundFromSemanticClaim(frozen.sideA, semantic.evidenceClaimA);
    if (bound.ok) {
      evidenceA = bound.evidence;
      if (!bound.evidence.approved) {
        validationCode = validationCode ?? "unapproved_evidence_span";
        failingSide =
          failingSide === "B" || failingSide === "both" ? "both" : "A";
      }
    }
  } else if (diagA?.validationOk) {
    evidenceA = evidenceFromBindDiagnostic(frozen.sideA, diagA, sourceIds.A);
  }

  if (diagB?.validationOk && semantic?.evidenceClaimB) {
    const bound = boundFromSemanticClaim(frozen.sideB, semantic.evidenceClaimB);
    if (bound.ok) {
      evidenceB = bound.evidence;
      if (!bound.evidence.approved) {
        validationCode = validationCode ?? "unapproved_evidence_span";
        failingSide =
          failingSide === "A" || failingSide === "both" ? "both" : "B";
      }
    }
  } else if (diagB?.validationOk) {
    evidenceB = evidenceFromBindDiagnostic(frozen.sideB, diagB, sourceIds.B);
  }

  // Map exact landed error codes — do not infer schema parse from outcome alone.
  if (adjudication.errorCode === "schema_parse_failed") {
    validationCode = "schema_parse_failed";
  } else if (
    validationCode == null &&
    adjudication.validation?.errors?.some((e) =>
      String(e).includes("schema_parse_failed"),
    )
  ) {
    validationCode = "schema_parse_failed";
  } else if (
    validationCode == null &&
    adjudication.errorCode === "validation_failed"
  ) {
    const firstFail = bindDiags?.find((d) => !d.validationOk);
    validationCode = firstFail?.validationCode ?? "validation_failed";
  }

  const transportParsedAsSchemaV4 =
    adjudication.errorCode !== "schema_parse_failed" &&
    adjudication.outcome !== "model_failed" &&
    adjudication.errorCode !== "model_execution_failed" &&
    adjudication.errorCode !== "model_timeout";

  const refereeStatus = adjudication.referee?.executionState ?? "not_run";
  const refereeReached = refereeStatus !== "not_run";
  const refereeCompleted = refereeStatus === "completed";
  const refereeFailed =
    refereeStatus === "failed" || refereeStatus === "invalid_evaluation";

  const adjudicationOutcome: Ceqr021CaseObservation["adjudicationOutcome"] =
    adjudication.errorCode === "schema_parse_failed"
      ? "validation_failed"
      : adjudication.outcome === "semantic_accepted"
        ? "semantic_accepted"
        : adjudication.outcome === "abstained"
          ? "abstained"
          : adjudication.outcome === "validation_failed"
            ? "validation_failed"
            : adjudication.outcome === "model_failed"
              ? "provider_failed"
              : "not_run";

  return sanitizeCeqr021CaseObservationForReceipt({
    caseId: args.caseId,
    expectedOutcome: args.expectedOutcome,
    transportParsedAsSchemaV4,
    observedClassification: semantic?.classification ?? null,
    adjudicationOutcome,
    compatibilityFlags: {
      bothCanSimultaneouslyBeTrue:
        semantic?.bothCanSimultaneouslyBeTrue ?? null,
      changedBeliefOverTime: semantic?.changedBeliefOverTime ?? null,
      intentionVersusOutcome: semantic?.intentionVersusOutcome ?? null,
      goalVersusObstacle: semantic?.goalVersusObstacle ?? null,
      emotionalOrPhysiologicalVersusReasoningStandard:
        semantic?.emotionalOrPhysiologicalVersusReasoningStandard ?? null,
    },
    abstentionReason:
      adjudication.abstentionReason ?? semantic?.abstentionReason ?? null,
    evidenceA,
    evidenceB,
    // Never invent selections from bound evidence — raw transport only.
    transportSelectionA: selA,
    transportSelectionB: selB,
    rawProviderObjectSha256: adjudication.rawProviderObjectSha256,
    immutableRawTransportFingerprint: adjudication.rawProviderObjectSha256,
    refereeReached,
    refereeCompleted,
    refereeFailed,
    adjudicatorCallCount: Math.max(1, args.adjDelta),
    refereeCallCount: Math.max(args.refDelta, refereeReached ? 1 : 0),
    writerInvoked: false,
    persistenceInvoked: false,
    nodeCreated: false,
    semanticConsistencyOk:
      adjudication.outcome === "semantic_accepted" ||
      adjudication.outcome === "abstained"
        ? validationCode == null
        : false,
    validationCode,
    failingSide,
    earliestFailedGate:
      validationCode ??
      adjudication.errorCode ??
      (adjudication.validation?.errors?.[0]
        ? String(adjudication.validation.errors[0])
        : null),
    latencyMs: args.latencyMs,
    adjudicatorErrorCode: adjudication.errorCode,
    adjudicatorErrorMessage: adjudication.errorMessage,
    validationErrors: adjudication.validation?.errors?.map(String) ?? null,
    evidenceBindDiagnostics: bindDiags,
  });
}

export type Ceqr021LiveMatrixResult = {
  accounting: Ceqr021CallAccounting;
  caseObservations: Ceqr021CaseObservation[];
  catalogs: Ceqr021FrozenCaseCatalogs[];
  classification: Ceqr021LiveClassification;
  diagnostics: ReturnType<typeof buildCeqr021CaseDiagnostics>[];
};

/**
 * Execute three frozen scenarios. Writer/persistence are never invoked.
 * Referee is reached only through adjudicateContradiction's validated clear path.
 */
export async function executeCeqr021LiveThreeCaseMatrix(args: {
  adapters: ContradictionLiveAdapterBundle;
  accounting: Ceqr021CallAccounting;
}): Promise<Ceqr021LiveMatrixResult> {
  const accounting = args.accounting;
  accounting.liveRunnerInvoked = 1;
  const catalogs = buildAllFrozenScenarioCatalogs(CEQR_021_SYNTHETIC_CASES);
  const catalogsById = new Map(catalogs.map((c) => [c.caseId, c] as const));
  const observations: Ceqr021CaseObservation[] = [];

  for (const synthetic of CEQR_021_SYNTHETIC_CASES) {
    const frozen = catalogsById.get(synthetic.id)!;
    const sourceIds = CEQR_021_FROZEN_SOURCE_IDS[synthetic.id];
    const expectedOutcome =
      synthetic.id === "clear_contradiction_candidate"
        ? "clear_contradiction"
        : synthetic.id === "compatible_contextual"
          ? "compatible_non_clear"
          : "ambiguous_abstention";

    const beforeAdj = args.adapters.callBudget.adjudicatorCalls();
    const beforeRef = args.adapters.callBudget.refereeCalls();

    accounting.adjudicatorAttempts += 1;
    syncCeqr021TotalProviderAttempts(accounting);

    const started = performance.now();
    let adjudication: ContradictionAdjudicationResult;
    try {
      adjudication = await adjudicateContradiction({
        sideA: {
          sourceId: sourceIds.A,
          sessionId: "ceqr021-controlled-live",
          sourceText: synthetic.sideAText,
          sourceRole: "synthetic",
          label: "A",
        },
        sideB: {
          sourceId: sourceIds.B,
          sessionId: "ceqr021-controlled-live",
          sourceText: synthetic.sideBText,
          sourceRole: "synthetic",
          label: "B",
        },
        modelRunner: args.adapters.adjudicatorRunner,
        objectivityReferee: args.adapters.objectivityReferee,
      });
    } catch {
      const latencyMs = Math.max(0, performance.now() - started);
      observations.push(
        sanitizeCeqr021CaseObservationForReceipt({
          caseId: synthetic.id,
          expectedOutcome,
          transportParsedAsSchemaV4: false,
          observedClassification: null,
          adjudicationOutcome: "provider_failed",
          compatibilityFlags: {
            bothCanSimultaneouslyBeTrue: null,
            changedBeliefOverTime: null,
            intentionVersusOutcome: null,
            goalVersusObstacle: null,
            emotionalOrPhysiologicalVersusReasoningStandard: null,
          },
          abstentionReason: null,
          evidenceA: null,
          evidenceB: null,
          transportSelectionA: null,
          transportSelectionB: null,
          rawProviderObjectSha256: null,
          immutableRawTransportFingerprint: null,
          refereeReached: false,
          refereeCompleted: false,
          refereeFailed: false,
          adjudicatorCallCount: 1,
          refereeCallCount: 0,
          writerInvoked: false,
          persistenceInvoked: false,
          nodeCreated: false,
          semanticConsistencyOk: null,
          validationCode: "provider_thrown",
          failingSide: null,
          earliestFailedGate: "provider_or_transport",
          latencyMs,
          adjudicatorErrorCode: "model_execution_failed",
          adjudicatorErrorMessage: "provider_thrown",
          validationErrors: null,
          evidenceBindDiagnostics: null,
        }),
      );
      continue;
    }

    const latencyMs = Math.max(0, performance.now() - started);
    const afterAdj = args.adapters.callBudget.adjudicatorCalls();
    const afterRef = args.adapters.callBudget.refereeCalls();
    const adjDelta = Math.max(1, afterAdj - beforeAdj);
    const refDelta = Math.max(0, afterRef - beforeRef);
    accounting.adjudicatorAttempts = Math.max(
      accounting.adjudicatorAttempts,
      beforeAdj + adjDelta,
    );
    if (refDelta > 0) {
      accounting.refereeAttempts = Math.max(
        accounting.refereeAttempts,
        beforeRef + refDelta,
      );
    }
    syncCeqr021TotalProviderAttempts(accounting);

    const observation = mapLandedAdjudicationToObservation({
      caseId: synthetic.id,
      expectedOutcome,
      frozen,
      sourceIds,
      adjudication,
      adjDelta,
      refDelta,
      latencyMs,
    });

    if (
      observation.refereeReached &&
      refDelta === 0 &&
      (observation.refereeCompleted || observation.refereeFailed)
    ) {
      accounting.refereeAttempts += 1;
      syncCeqr021TotalProviderAttempts(accounting);
    }

    observations.push(observation);
  }

  accounting.writerCalls = 0;
  accounting.persistenceCalls = 0;
  accounting.accountGateCalls = 0;
  accounting.realDatabaseCalls = 0;
  accounting.productionIngestionCalls = 0;
  accounting.nodesCreated = 0;
  accounting.automaticRetries = 0;
  accounting.adjudicatorAttempts = Math.max(
    accounting.adjudicatorAttempts,
    args.adapters.callBudget.adjudicatorCalls(),
  );
  accounting.refereeAttempts = Math.max(
    accounting.refereeAttempts,
    args.adapters.callBudget.refereeCalls(),
  );
  syncCeqr021TotalProviderAttempts(accounting);

  const catalogsByCaseId = Object.fromEntries(
    catalogs.map((c) => [c.caseId, c]),
  ) as Record<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>;

  const classification = classifyCeqr021LiveResult({
    caseObservations: observations,
    catalogsByCaseId,
    accounting,
    frozenPlanHashMatched: true,
    scenarioAggregateHashMatched: true,
    schemaPromptAddendumMatched: true,
    oneShotConsumedExactlyOnce: true,
    canonicalPathOk: true,
    productionReady: false,
  });

  const diagnostics = observations.map((observation) =>
    buildCeqr021CaseDiagnostics({
      observation,
      catalogs: catalogsById.get(observation.caseId)!,
    }),
  );

  return {
    accounting,
    caseObservations: observations,
    catalogs,
    classification,
    diagnostics,
  };
}

export type Ceqr021LiveExecutionReceipt = {
  slice: typeof CEQR_021_SLICE_ID;
  frozenPlanSha256: string;
  consumedClaimIdentity: {
    armingState: "consumed";
    frozenPlanSha256: string | null;
    committedExecutionHead: string;
    consumedAt: string | null;
  };
  committedHead: string;
  classification: Ceqr021LiveClassification;
  accounting: Ceqr021CallAccounting;
  caseObservations: Ceqr021CaseObservation[];
  diagnostics: ReturnType<typeof buildCeqr021CaseDiagnostics>[];
  productionReady: false;
  liveProviderAttempts: number;
  notes: string[];
};

/**
 * Sanitize provider-failure messages before canonical JSON serialization.
 * Never persist raw provider/credential-derived error text in observations.
 * Other fields (e.g. notes) are not silently scrubbed — leak detection fails closed.
 */
export function sanitizeCeqr021LiveReceiptForCanonicalSerialization(
  receipt: Ceqr021LiveExecutionReceipt,
): Ceqr021LiveExecutionReceipt {
  return {
    ...receipt,
    caseObservations: receipt.caseObservations.map(
      sanitizeCeqr021CaseObservationForReceipt,
    ),
  };
}

export function finalizeCeqr021LiveReceiptAtomic(args: {
  receiptDir: string;
  receipt: Ceqr021LiveExecutionReceipt;
}):
  | { ok: true; receiptPath: string; serialized: string; verified: true }
  | {
      ok: false;
      code: "receipt_exists" | "leak" | "io_error" | "verify_failed";
      message: string;
    } {
  const receiptPath = join(args.receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME);
  if (existsSync(receiptPath)) {
    return {
      ok: false,
      code: "receipt_exists",
      message: `Canonical live receipt already exists at ${receiptPath}`,
    };
  }
  const sanitized = sanitizeCeqr021LiveReceiptForCanonicalSerialization(
    args.receipt,
  );
  const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;
  const leak = assertSanitizedCanonicalReceiptJson(serialized);
  if (!leak.ok) {
    return {
      ok: false,
      code: "leak",
      message: `Sanitized receipt leak: ${leak.leaks.join(",")}`,
    };
  }
  try {
    const fd = openSync(receiptPath, "wx");
    try {
      writeFileSync(fd, serialized, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    fsyncDirectoryBestEffort(dirname(receiptPath));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return {
        ok: false,
        code: "receipt_exists",
        message: `Canonical live receipt already exists at ${receiptPath}`,
      };
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "receipt write failed",
    };
  }

  // Read back exact bytes and verify stored classification/accounting/plan hash.
  try {
    const bytes = readFileSync(receiptPath, "utf8");
    if (bytes !== serialized) {
      return {
        ok: false,
        code: "verify_failed",
        message: "Canonical receipt bytes do not match serialized receipt.",
      };
    }
    const parsed = JSON.parse(bytes) as Ceqr021LiveExecutionReceipt;
    if (parsed.classification !== args.receipt.classification) {
      return {
        ok: false,
        code: "verify_failed",
        message: "Canonical receipt classification mismatch on read-back.",
      };
    }
    if (parsed.frozenPlanSha256 !== args.receipt.frozenPlanSha256) {
      return {
        ok: false,
        code: "verify_failed",
        message: "Canonical receipt frozenPlanSha256 mismatch on read-back.",
      };
    }
    if (
      parsed.accounting.totalProviderAttempts !==
      args.receipt.accounting.totalProviderAttempts
    ) {
      return {
        ok: false,
        code: "verify_failed",
        message: "Canonical receipt accounting mismatch on read-back.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "verify_failed",
      message:
        error instanceof Error
          ? error.message
          : "Canonical receipt read-back verification failed.",
    };
  }

  return { ok: true, receiptPath, serialized, verified: true };
}

export { createEmptyCeqr021CallAccounting };
