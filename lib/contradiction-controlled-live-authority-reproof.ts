/**
 * CEQR-017 — controlled live authority re-proof contract helpers.
 *
 * Phase 1: deterministic preparation only (no live provider, no real DB).
 * Phase 2 (when authorised): one pinned live run via the Phase-2 orchestrator.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  type ContradictionAdjudicationResult,
} from "./contradiction-adjudicator";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
  CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
  CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
  CONTRADICTION_LIVE_PROVIDER_ID,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  isLiveContradictionProviderProofOptedIn,
  redactSecretsForReceipt,
  resolveContradictionLiveProviderConfig,
} from "./contradiction-live-provider-adapters";
import {
  LIVE_SYNTHETIC_CASES,
  liveProofResultToExitCode,
  type LiveCaseReceipt,
  type LiveProofExecuted,
  type LiveProofResult,
  type LiveSyntheticCase,
  type LiveSyntheticCaseId,
} from "./contradiction-live-provider-referee-proof";
import type { ControlledNaturalEntryProofResult } from "./contradiction-controlled-natural-entry-proof";
import { KERNEL_CONTRACT_VERSION } from "./orvek-intelligence-kernel/contracts";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";

export const CEQR_017_SLICE_ID =
  "CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001" as const;
export const CEQR_017_CAMPAIGN_SLICE = "CEQR-017" as const;
export const CEQR_017_PROOF_VERSION =
  "contradiction-controlled-live-authority-reproof-v1" as const;
export const CEQR_017_WORKTREE_PATH =
  "/Users/user/ai-companion-worktrees/desktop-contradiction-controlled-live-authority-reproof-001" as const;
export const CEQR_017_PHASE2_LIVE_RUN_CLAIM_FILENAME =
  "phase2-live-run-claim.json" as const;

export const CEQR_017_EXPECTED_PROVIDER_ID = "openai" as const;
export const CEQR_017_EXPECTED_ADJUDICATOR_MODEL = "gpt-4o-mini" as const;
export const CEQR_017_EXPECTED_REFEREE_MODEL = "gpt-4o-mini" as const;
export const CEQR_017_EXPECTED_MAX_RETRIES = 0 as const;
export const CEQR_017_EXPECTED_TIMEOUT_MS = 45_000 as const;
export const CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS = 8 as const;
export const CEQR_017_EXPECTED_SCHEMA_VERSION =
  "contradiction-adjudication-schema-v2" as const;
export const CEQR_017_EXPECTED_PROMPT_VERSION =
  "contradiction-adjudication-prompt-v3" as const;
export const CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION =
  "contradiction-live-adjudicator-prompt-addendum-v3" as const;
export const CEQR_017_EXPECTED_KERNEL_CONTRACT =
  "orvek-intelligence-kernel-v1" as const;

/** Exact historical fixtures — order and content are part of the contract. */
export const CEQR_015_CONTROLLED_CASE_FIXTURES = [
  {
    id: "clear_contradiction_candidate" as const,
    sideAText: "I do not drink alcohol at all.",
    sideBText: "I drank several beers last night.",
    referenceStatement: "I do not drink alcohol at all.",
    expectedSemanticCategory: "clear_contradiction" as const,
  },
  {
    id: "compatible_contextual" as const,
    sideAText: "I avoid coffee in the evening.",
    sideBText: "I drink coffee in the morning.",
    referenceStatement: "I avoid coffee in the evening.",
    expectedSemanticCategory: "compatible_non_contradiction" as const,
  },
  {
    id: "ambiguous_insufficient" as const,
    sideAText: "I might go running later if I feel up to it.",
    sideBText: "Sometimes I think about exercise.",
    referenceStatement: "I might go running later if I feel up to it.",
    expectedSemanticCategory: "ambiguous_insufficient" as const,
  },
] as const;

export const CEQR_017_CONTROLLED_CASES: readonly LiveSyntheticCase[] =
  LIVE_SYNTHETIC_CASES;

export const CEQR_015_EXPECTED_ACCOUNT_GATE = {
  contradictionNodeTotal: 25,
  candidateTotal: 25,
  evidenceSpans: 5941,
  completeExactDualSideRows: 0,
  invalidPartialRows: 0,
  legacyIncompleteRows: 25,
  completePairDuplicateGroups: 0,
} as const;

export const CEQR_017_FABRICATED_QUOTE_RELEVANT_CASES = [
  "clear_contradiction_candidate",
  "compatible_contextual",
] as const satisfies readonly LiveSyntheticCaseId[];

export const CEQR_017_SOURCE_ID_MISMATCH_RELEVANT_CASES = [
  "ambiguous_insufficient",
] as const satisfies readonly LiveSyntheticCaseId[];

export type Ceqr015FailureCodeClass =
  | "RESOLVED"
  | "PERSISTS"
  | "NOT_REACHED"
  | "INCONCLUSIVE";

export type Ceqr017LiveClassification =
  | "PASS_LIVE_AUTHORITY_REPAIR_REPROVED"
  | "PASS_LIVE_AUTHORITY_REPAIR_WITH_DOWNSTREAM_HOLD"
  | "HOLD_LIVE_AUTHORITY_FAILURE_PERSISTS"
  | "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED"
  | "HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED"
  | "HOLD_PHASE2_PRELIVE_CONTRACT_INCOMPLETE"
  | "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH"
  | "PHASE1_PRE_LIVE_READY"
  | "NOT_RUN";

export type Ceqr017ExpectedRuntimeIdentities = {
  providerId: typeof CEQR_017_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_017_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelId: typeof CEQR_017_EXPECTED_REFEREE_MODEL;
  maxRetries: typeof CEQR_017_EXPECTED_MAX_RETRIES;
  timeoutMs: typeof CEQR_017_EXPECTED_TIMEOUT_MS;
  maxTotalCalls: typeof CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  schemaVersion: typeof CEQR_017_EXPECTED_SCHEMA_VERSION;
  promptVersion: typeof CEQR_017_EXPECTED_PROMPT_VERSION;
  liveAddendumVersion: typeof CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION;
  kernelContract: typeof CEQR_017_EXPECTED_KERNEL_CONTRACT;
};

export type Ceqr017ActualRuntimeIdentities = {
  providerId: string | null;
  adjudicatorModelId: string | null;
  refereeModelId: string | null;
  maxRetries: number | null;
  timeoutMs: number | null;
  maxTotalCalls: number | null;
  schemaVersion: string | null;
  promptVersion: string | null;
  liveAddendumVersion: string | null;
  kernelContract: string | null;
  observedFromLiveResult: boolean;
};

export type Ceqr017CaseDiagnostic = {
  caseId: LiveSyntheticCaseId;
  expectedSemanticCategory: string;
  providerId: string | null;
  adjudicatorModelId: string | null;
  refereeModelId: string | null;
  schemaVersion: string | null;
  promptVersion: string | null;
  liveAddendumVersion: string | null;
  authoritativeSideASourceId: string | null;
  authoritativeSideBSourceId: string | null;
  sideASourceTextLength: number | null;
  sideBSourceTextLength: number | null;
  sanitizedProviderTransportObject: unknown | null;
  selectedSideAOffsets: { startOffset: number; endOffset: number } | null;
  selectedSideBOffsets: { startOffset: number; endOffset: number } | null;
  transportParseResult: "parsed" | "parse_failed" | "not_reached" | "unknown";
  deterministicBindingResult:
    | "bound"
    | "binding_failed"
    | "not_reached"
    | "unknown";
  boundSideASourceId: string | null;
  boundSideBSourceId: string | null;
  derivedSideAExactQuote: string | null;
  derivedSideBExactQuote: string | null;
  rawProviderObjectUnchangedByReferenceAndValue: boolean | null;
  deterministicValidationStatus:
    | "passed"
    | "failed"
    | "not_reached"
    | "unknown";
  validationErrors: string[];
  validationWarnings: string[];
  earliestFailedGate: string | null;
  gateStoppedAt: string | null;
  semanticClassification: string | null;
  modelConfidence: number | null;
  refereeInvoked: boolean;
  refereeExecutionState: string | null;
  refereeOutcome: string | null;
  refereeAdjustedConfidence: number | null;
  refereeError: string | null;
  candidateAuthorisationResult: string | null;
  writerInvoked: boolean;
  writeExecuted: boolean;
  injectedSideASpanResult: unknown | null;
  injectedSideBSpanResult: unknown | null;
  injectedNodeResult: unknown | null;
  caseAdjudicatorAttempts: number;
  caseRefereeAttempts: number;
};

export function ceqr017ReceiptDir(cwd: string = process.cwd()): string {
  return join(cwd, "docs/agent-runs/receipts", CEQR_017_SLICE_ID);
}

export function ceqr017Phase2ClaimPath(receiptDir: string): string {
  return join(receiptDir, CEQR_017_PHASE2_LIVE_RUN_CLAIM_FILENAME);
}

export function expectedCeqr017RuntimeIdentities(): Ceqr017ExpectedRuntimeIdentities {
  // Pin exact expected values (not ambient defaults).
  return {
    providerId: CEQR_017_EXPECTED_PROVIDER_ID,
    adjudicatorModelId: CEQR_017_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_017_EXPECTED_REFEREE_MODEL,
    maxRetries: CEQR_017_EXPECTED_MAX_RETRIES,
    timeoutMs: CEQR_017_EXPECTED_TIMEOUT_MS,
    maxTotalCalls: CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION,
    kernelContract: CEQR_017_EXPECTED_KERNEL_CONTRACT,
  };
}

export function assertLandedConstantsMatchExpected(): {
  ok: true;
} | {
  ok: false;
  mismatches: string[];
} {
  const mismatches: string[] = [];
  if (CONTRADICTION_LIVE_PROVIDER_ID !== CEQR_017_EXPECTED_PROVIDER_ID) {
    mismatches.push("providerId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL !==
    CEQR_017_EXPECTED_ADJUDICATOR_MODEL
  ) {
    mismatches.push("adjudicatorModelId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL !== CEQR_017_EXPECTED_REFEREE_MODEL
  ) {
    mismatches.push("refereeModelId");
  }
  if (CONTRADICTION_LIVE_MAX_RETRIES !== CEQR_017_EXPECTED_MAX_RETRIES) {
    mismatches.push("maxRetries");
  }
  if (CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS !== CEQR_017_EXPECTED_TIMEOUT_MS) {
    mismatches.push("timeoutMs");
  }
  if (
    CONTRADICTION_LIVE_MAX_TOTAL_CALLS !==
    CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS
  ) {
    mismatches.push("maxTotalCalls");
  }
  if (
    CONTRADICTION_ADJUDICATION_SCHEMA_VERSION !==
    CEQR_017_EXPECTED_SCHEMA_VERSION
  ) {
    mismatches.push("schemaVersion");
  }
  if (
    CONTRADICTION_ADJUDICATION_PROMPT_VERSION !==
    CEQR_017_EXPECTED_PROMPT_VERSION
  ) {
    mismatches.push("promptVersion");
  }
  if (
    CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION !==
    CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION
  ) {
    mismatches.push("liveAddendumVersion");
  }
  if (KERNEL_CONTRACT_VERSION !== CEQR_017_EXPECTED_KERNEL_CONTRACT) {
    mismatches.push("kernelContract");
  }
  return mismatches.length === 0
    ? { ok: true }
    : { ok: false, mismatches };
}

/**
 * Ambient env must explicitly pin the exact CEQR-017 runtime.
 * Defaults alone are not accepted for Phase-2 production entry.
 */
export function assertCeqr017PinnedLiveEnv(
  env: Record<string, string | undefined>,
): { ok: true } | { ok: false; code: string; message: string } {
  const required: Array<[string, string]> = [
    ["CONTRADICTION_LIVE_ADJUDICATOR_MODEL", CEQR_017_EXPECTED_ADJUDICATOR_MODEL],
    ["CONTRADICTION_LIVE_REFEREE_MODEL", CEQR_017_EXPECTED_REFEREE_MODEL],
    [
      "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS",
      String(CEQR_017_EXPECTED_TIMEOUT_MS),
    ],
    [
      "CONTRADICTION_LIVE_MAX_TOTAL_CALLS",
      String(CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS),
    ],
  ];
  for (const [key, expected] of required) {
    const raw = env[key];
    if (typeof raw !== "string" || raw.trim() !== expected) {
      return {
        ok: false,
        code: "runtime_pin_mismatch",
        message: `${key} must be explicitly set to ${expected} for CEQR-017 (got ${JSON.stringify(raw)}).`,
      };
    }
  }

  const resolved = resolveContradictionLiveProviderConfig(env);
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.errorCode,
      message: resolved.message,
    };
  }
  const cfg = resolved.config;
  if (
    cfg.providerId !== CEQR_017_EXPECTED_PROVIDER_ID ||
    cfg.adjudicatorModelId !== CEQR_017_EXPECTED_ADJUDICATOR_MODEL ||
    cfg.refereeModelId !== CEQR_017_EXPECTED_REFEREE_MODEL ||
    cfg.maxRetries !== CEQR_017_EXPECTED_MAX_RETRIES ||
    cfg.timeoutMs !== CEQR_017_EXPECTED_TIMEOUT_MS ||
    cfg.maxTotalCalls !== CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS
  ) {
    return {
      ok: false,
      code: "resolved_runtime_mismatch",
      message: "Resolved live provider config does not match CEQR-017 pins.",
    };
  }
  return { ok: true };
}

export function assertCeqr015FixturesExact(
  cases: readonly LiveSyntheticCase[] = CEQR_017_CONTROLLED_CASES,
): {
  ok: true;
  identical: true;
  differences: [];
} | {
  ok: false;
  identical: false;
  differences: Array<{
    caseId: string;
    field: string;
    oldValue: string;
    newValue: string;
  }>;
} {
  const differences: Array<{
    caseId: string;
    field: string;
    oldValue: string;
    newValue: string;
  }> = [];

  if (cases.length !== CEQR_015_CONTROLLED_CASE_FIXTURES.length) {
    differences.push({
      caseId: "*",
      field: "length",
      oldValue: String(CEQR_015_CONTROLLED_CASE_FIXTURES.length),
      newValue: String(cases.length),
    });
  }

  const expectedIds = CEQR_015_CONTROLLED_CASE_FIXTURES.map((c) => c.id);
  const actualIds = cases.map((c) => c.id);
  for (const id of actualIds) {
    if (!expectedIds.includes(id as (typeof expectedIds)[number])) {
      differences.push({
        caseId: id,
        field: "extra_case",
        oldValue: "absent",
        newValue: "present",
      });
    }
  }

  for (let i = 0; i < CEQR_015_CONTROLLED_CASE_FIXTURES.length; i++) {
    const expected = CEQR_015_CONTROLLED_CASE_FIXTURES[i]!;
    const actual = cases[i];
    if (!actual) {
      differences.push({
        caseId: expected.id,
        field: "presence",
        oldValue: "present",
        newValue: "missing",
      });
      continue;
    }
    if (actual.id !== expected.id) {
      differences.push({
        caseId: expected.id,
        field: "order_or_id",
        oldValue: expected.id,
        newValue: actual.id,
      });
    }
    for (const field of [
      "sideAText",
      "sideBText",
      "referenceStatement",
    ] as const) {
      if (actual[field] !== expected[field]) {
        differences.push({
          caseId: expected.id,
          field,
          oldValue: expected[field],
          newValue: actual[field],
        });
      }
    }
  }

  if (differences.length > 0) {
    return { ok: false, identical: false, differences };
  }
  return { ok: true, identical: true, differences: [] };
}

/** @deprecated Prefer assertCeqr015FixturesExact */
export function assertCeqr015FixturesByteIdentical(
  cases: readonly LiveSyntheticCase[] = CEQR_017_CONTROLLED_CASES,
) {
  return assertCeqr015FixturesExact(cases);
}

export function actualRuntimeIdentitiesFromLiveResult(
  result: LiveProofResult | null,
): Ceqr017ActualRuntimeIdentities {
  if (result == null || !result.ran) {
    return {
      providerId: null,
      adjudicatorModelId: null,
      refereeModelId: null,
      maxRetries: null,
      timeoutMs: null,
      maxTotalCalls: null,
      schemaVersion: null,
      promptVersion: null,
      liveAddendumVersion: null,
      kernelContract: null,
      observedFromLiveResult: false,
    };
  }
  return {
    providerId: result.providerId,
    adjudicatorModelId: result.adjudicatorModelId,
    refereeModelId: result.refereeModelId,
    maxRetries: result.maxRetries,
    timeoutMs: result.timeoutMs,
    maxTotalCalls: result.maxTotalCalls,
    schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: result.adjudicatorPromptAddendumVersion,
    kernelContract: KERNEL_CONTRACT_VERSION,
    observedFromLiveResult: true,
  };
}

export function runtimeIdentitiesMatch(
  expected: Ceqr017ExpectedRuntimeIdentities,
  actual: Ceqr017ActualRuntimeIdentities,
): boolean {
  if (!actual.observedFromLiveResult) return false;
  return (
    actual.providerId === expected.providerId &&
    actual.adjudicatorModelId === expected.adjudicatorModelId &&
    actual.refereeModelId === expected.refereeModelId &&
    actual.maxRetries === expected.maxRetries &&
    actual.timeoutMs === expected.timeoutMs &&
    actual.maxTotalCalls === expected.maxTotalCalls &&
    actual.schemaVersion === expected.schemaVersion &&
    actual.promptVersion === expected.promptVersion &&
    actual.liveAddendumVersion === expected.liveAddendumVersion &&
    actual.kernelContract === expected.kernelContract
  );
}

export type Ceqr017TransportCapture = {
  caseId: LiveSyntheticCaseId;
  originalObject: object;
  snapshot: unknown;
};

function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function wrapAdjudicatorRunnerForImmutableCapture(
  runner: StructuredModelRunner,
  sink: Map<string, Ceqr017TransportCapture>,
  caseKeyProvider: () => string,
): StructuredModelRunner {
  return {
    async runStructured(request) {
      const result = await runner.runStructured(request);
      if (result.ok && result.object != null && typeof result.object === "object") {
        const originalObject = result.object as object;
        const snapshot = structuredClone(originalObject);
        const caseId = caseKeyProvider() as LiveSyntheticCaseId;
        sink.set(caseId, {
          caseId,
          originalObject,
          snapshot,
        });
        // Return the exact same result object reference to the adjudicator.
        return result;
      }
      return result;
    },
  };
}

export function proveRawProviderObjectImmutability(
  capture: Ceqr017TransportCapture | undefined,
): boolean | null {
  if (capture == null) return null;
  // Compare retained original reference against the pre-processing snapshot.
  // Never compare an object to itself as the immutability proof.
  return deepEqualJson(capture.originalObject, capture.snapshot);
}

function offsetsFromUnknown(
  value: unknown,
): { startOffset: number; endOffset: number } | null {
  if (value == null || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.startOffset === "number" &&
    typeof rec.endOffset === "number"
  ) {
    return { startOffset: rec.startOffset, endOffset: rec.endOffset };
  }
  return null;
}

function resolveCaseAdjudication(
  naturalEntryResult: ControlledNaturalEntryProofResult | null,
): ContradictionAdjudicationResult | null {
  if (naturalEntryResult == null) return null;
  const selected =
    naturalEntryResult.selection.selectedPair?.adjudication ?? null;
  if (selected != null) return selected;
  const attempted = naturalEntryResult.selection.attemptedAdjudications;
  if (attempted.length === 1) return attempted[0]!.adjudication;
  // Prefer the last attempted adjudication when multiple (ordered attempts).
  if (attempted.length > 1) {
    return attempted[attempted.length - 1]!.adjudication;
  }
  return null;
}

export function buildEmptyCaseDiagnostic(
  caseId: LiveSyntheticCaseId,
): Ceqr017CaseDiagnostic {
  const fixture = CEQR_015_CONTROLLED_CASE_FIXTURES.find((c) => c.id === caseId)!;
  return {
    caseId,
    expectedSemanticCategory: fixture.expectedSemanticCategory,
    providerId: null,
    adjudicatorModelId: null,
    refereeModelId: null,
    schemaVersion: null,
    promptVersion: null,
    liveAddendumVersion: null,
    authoritativeSideASourceId: null,
    authoritativeSideBSourceId: null,
    sideASourceTextLength: fixture.sideAText.length,
    sideBSourceTextLength: fixture.sideBText.length,
    sanitizedProviderTransportObject: null,
    selectedSideAOffsets: null,
    selectedSideBOffsets: null,
    transportParseResult: "not_reached",
    deterministicBindingResult: "not_reached",
    boundSideASourceId: null,
    boundSideBSourceId: null,
    derivedSideAExactQuote: null,
    derivedSideBExactQuote: null,
    rawProviderObjectUnchangedByReferenceAndValue: null,
    deterministicValidationStatus: "not_reached",
    validationErrors: [],
    validationWarnings: [],
    earliestFailedGate: null,
    gateStoppedAt: null,
    semanticClassification: null,
    modelConfidence: null,
    refereeInvoked: false,
    refereeExecutionState: null,
    refereeOutcome: null,
    refereeAdjustedConfidence: null,
    refereeError: null,
    candidateAuthorisationResult: null,
    writerInvoked: false,
    writeExecuted: false,
    injectedSideASpanResult: null,
    injectedSideBSpanResult: null,
    injectedNodeResult: null,
    caseAdjudicatorAttempts: 0,
    caseRefereeAttempts: 0,
  };
}

export function buildCeqr017CaseDiagnosticFromObserver(args: {
  caseId: LiveSyntheticCaseId;
  liveResult: LiveProofExecuted | null;
  caseReceipt: LiveCaseReceipt;
  authoritativeSideASourceId: string | null;
  authoritativeSideBSourceId: string | null;
  sideASourceTextLength: number | null;
  sideBSourceTextLength: number | null;
  capturedTransport: unknown | null;
  rawUnchanged: boolean | null;
  injectedSideASpan: unknown | null;
  injectedSideBSpan: unknown | null;
  injectedNode: unknown | null;
  naturalEntryResult: ControlledNaturalEntryProofResult | null;
}): Ceqr017CaseDiagnostic {
  const base = buildEmptyCaseDiagnostic(args.caseId);
  const d = args.caseReceipt.sanitizedAdjudicationDiagnostics;
  const adjudication = resolveCaseAdjudication(args.naturalEntryResult);
  const semantic = adjudication?.semantic ?? null;
  const validation = adjudication?.validation ?? null;
  const referee = adjudication?.referee ?? null;
  const transport = args.capturedTransport;
  const transportRec =
    transport != null && typeof transport === "object"
      ? (transport as Record<string, unknown>)
      : null;

  let transportParseResult: Ceqr017CaseDiagnostic["transportParseResult"] =
    "not_reached";
  let bindingResult: Ceqr017CaseDiagnostic["deterministicBindingResult"] =
    "not_reached";
  let validationStatus: Ceqr017CaseDiagnostic["deterministicValidationStatus"] =
    "not_reached";

  if (adjudication?.outcome === "model_failed") {
    transportParseResult = "not_reached";
  } else if (d?.earliestGate === "schema_parse") {
    transportParseResult = "parse_failed";
  } else if (
    adjudication?.outcome === "semantic_accepted" ||
    adjudication?.outcome === "abstained" ||
    adjudication?.outcome === "validation_failed" ||
    semantic != null ||
    args.caseReceipt.status === "created" ||
    args.caseReceipt.status === "reused" ||
    args.caseReceipt.status === "no_write"
  ) {
    transportParseResult = "parsed";
  } else if (args.caseReceipt.adjudicatorCallCount > 0) {
    transportParseResult = "unknown";
  }

  if (semantic?.evidenceClaimA?.sourceId && semantic?.evidenceClaimB?.sourceId) {
    bindingResult = "bound";
  } else if (
    validation?.status === "invalid" ||
    d?.earliestGate === "deterministic_validation"
  ) {
    const codes = [
      ...(validation?.errors ?? []),
      ...(d?.validationErrorCodes ?? []),
    ];
    const bindingFailure = codes.some(
      (c) =>
        c.includes("invalid_offsets") ||
        c.includes("empty_quote") ||
        c.includes("source_id") ||
        c.includes("binding"),
    );
    bindingResult = bindingFailure ? "binding_failed" : "unknown";
  } else if (d?.earliestGate === "schema_parse") {
    bindingResult = "not_reached";
  }

  if (validation?.status === "valid") {
    validationStatus = "passed";
  } else if (validation?.status === "invalid") {
    validationStatus = "failed";
  } else if (validation?.status === "not_run") {
    validationStatus = "not_reached";
  } else if (d?.earliestGate === "deterministic_validation") {
    validationStatus = "failed";
  }

  const selectedSideAOffsets =
    semantic != null
      ? {
          startOffset: semantic.evidenceClaimA.startOffset,
          endOffset: semantic.evidenceClaimA.endOffset,
        }
      : offsetsFromUnknown(transportRec?.evidenceClaimA);
  const selectedSideBOffsets =
    semantic != null
      ? {
          startOffset: semantic.evidenceClaimB.startOffset,
          endOffset: semantic.evidenceClaimB.endOffset,
        }
      : offsetsFromUnknown(transportRec?.evidenceClaimB);

  const controlled = args.naturalEntryResult;

  return {
    ...base,
    providerId: args.liveResult?.providerId ?? d?.providerId ?? null,
    adjudicatorModelId: args.liveResult?.adjudicatorModelId ?? d?.modelId ?? null,
    refereeModelId: args.liveResult?.refereeModelId ?? null,
    schemaVersion: d?.schemaVersion ?? CEQR_017_EXPECTED_SCHEMA_VERSION,
    promptVersion: d?.promptVersion ?? CEQR_017_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion:
      args.liveResult?.adjudicatorPromptAddendumVersion ??
      CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION,
    authoritativeSideASourceId: args.authoritativeSideASourceId,
    authoritativeSideBSourceId: args.authoritativeSideBSourceId,
    sideASourceTextLength: args.sideASourceTextLength,
    sideBSourceTextLength: args.sideBSourceTextLength,
    sanitizedProviderTransportObject: transportRec
      ? redactSecretsForReceipt({
          evidenceClaimA: transportRec.evidenceClaimA ?? null,
          evidenceClaimB: transportRec.evidenceClaimB ?? null,
          classification: transportRec.classification ?? null,
          confidence: transportRec.confidence ?? null,
        })
      : null,
    selectedSideAOffsets,
    selectedSideBOffsets,
    transportParseResult,
    deterministicBindingResult: bindingResult,
    boundSideASourceId: semantic?.evidenceClaimA?.sourceId ?? null,
    boundSideBSourceId: semantic?.evidenceClaimB?.sourceId ?? null,
    derivedSideAExactQuote:
      semantic?.evidenceClaimA?.exactQuote ?? args.caseReceipt.sideAQuote,
    derivedSideBExactQuote:
      semantic?.evidenceClaimB?.exactQuote ?? args.caseReceipt.sideBQuote,
    rawProviderObjectUnchangedByReferenceAndValue: args.rawUnchanged,
    deterministicValidationStatus: validationStatus,
    validationErrors: [
      ...(validation?.errors ?? []),
      ...(d?.validationErrorCodes ?? []),
    ],
    validationWarnings: validation?.warnings ?? [],
    earliestFailedGate: d?.earliestGate ?? null,
    gateStoppedAt: controlled?.gateStoppedAt ?? args.caseReceipt.gateStoppedAt,
    semanticClassification: semantic?.classification ?? null,
    modelConfidence:
      typeof semantic?.confidence === "number" ? semantic.confidence : null,
    refereeInvoked:
      referee != null && referee.executionState !== "not_run"
        ? true
        : args.caseReceipt.refereeCallCount > 0,
    refereeExecutionState: referee?.executionState ?? null,
    refereeOutcome: referee?.outcome ?? null,
    refereeAdjustedConfidence: referee?.adjustedConfidence ?? null,
    refereeError:
      referee?.errorMessage ??
      (referee?.validationErrors?.length
        ? referee.validationErrors.join(" | ")
        : null),
    candidateAuthorisationResult:
      controlled?.outcome ?? args.caseReceipt.proofOutcome,
    writerInvoked: controlled?.writerInvoked ?? args.caseReceipt.writerInvoked,
    writeExecuted: controlled?.writeExecuted ?? args.caseReceipt.writeExecuted,
    injectedSideASpanResult: args.injectedSideASpan,
    injectedSideBSpanResult: args.injectedSideBSpan,
    injectedNodeResult: args.injectedNode,
    caseAdjudicatorAttempts: args.caseReceipt.adjudicatorCallCount,
    caseRefereeAttempts: args.caseReceipt.refereeCallCount,
  };
}

function quotesMatchAuthoritativeSlices(diag: Ceqr017CaseDiagnostic): boolean {
  const fixture = CEQR_015_CONTROLLED_CASE_FIXTURES.find(
    (c) => c.id === diag.caseId,
  );
  if (!fixture) return false;
  if (
    diag.selectedSideAOffsets == null ||
    diag.selectedSideBOffsets == null ||
    diag.derivedSideAExactQuote == null ||
    diag.derivedSideBExactQuote == null
  ) {
    return false;
  }
  const a = fixture.sideAText.slice(
    diag.selectedSideAOffsets.startOffset,
    diag.selectedSideAOffsets.endOffset,
  );
  const b = fixture.sideBText.slice(
    diag.selectedSideBOffsets.startOffset,
    diag.selectedSideBOffsets.endOffset,
  );
  return (
    diag.derivedSideAExactQuote === a && diag.derivedSideBExactQuote === b
  );
}

function offsetsValidForFixture(diag: Ceqr017CaseDiagnostic): boolean {
  const fixture = CEQR_015_CONTROLLED_CASE_FIXTURES.find(
    (c) => c.id === diag.caseId,
  );
  if (!fixture || !diag.selectedSideAOffsets || !diag.selectedSideBOffsets) {
    return false;
  }
  const a = diag.selectedSideAOffsets;
  const b = diag.selectedSideBOffsets;
  return (
    Number.isInteger(a.startOffset) &&
    Number.isInteger(a.endOffset) &&
    a.startOffset >= 0 &&
    a.endOffset > a.startOffset &&
    a.endOffset <= fixture.sideAText.length &&
    Number.isInteger(b.startOffset) &&
    Number.isInteger(b.endOffset) &&
    b.startOffset >= 0 &&
    b.endOffset > b.startOffset &&
    b.endOffset <= fixture.sideBText.length
  );
}

function authorityFullyProven(diag: Ceqr017CaseDiagnostic): boolean {
  return (
    diag.transportParseResult === "parsed" &&
    diag.deterministicBindingResult === "bound" &&
    diag.rawProviderObjectUnchangedByReferenceAndValue === true &&
    diag.authoritativeSideASourceId != null &&
    diag.authoritativeSideBSourceId != null &&
    diag.boundSideASourceId === diag.authoritativeSideASourceId &&
    diag.boundSideBSourceId === diag.authoritativeSideBSourceId &&
    offsetsValidForFixture(diag) &&
    quotesMatchAuthoritativeSlices(diag)
  );
}

export function classifyAuthorityFailureCode(args: {
  previousCode: "fabricated_quote" | "source_id_mismatch";
  liveRan: boolean;
  caseReceipt: LiveCaseReceipt | undefined;
  diagnostic?: Ceqr017CaseDiagnostic | null;
}): Ceqr015FailureCodeClass {
  if (!args.liveRan || args.caseReceipt == null) {
    return "NOT_REACHED";
  }
  if (
    args.caseReceipt.status === "skipped_budget" ||
    args.caseReceipt.status === "provider_failed"
  ) {
    return "INCONCLUSIVE";
  }

  const receiptCodes =
    args.caseReceipt.sanitizedAdjudicationDiagnostics?.validationErrorCodes ??
    [];
  const diagCodes = args.diagnostic?.validationErrors ?? [];
  const codes = [...receiptCodes, ...diagCodes];

  if (codes.includes(args.previousCode)) {
    return "PERSISTS";
  }

  if (args.diagnostic == null) {
    return "INCONCLUSIVE";
  }

  const diag = args.diagnostic;
  if (
    diag.rawProviderObjectUnchangedByReferenceAndValue !== true ||
    diag.transportParseResult === "parse_failed" ||
    diag.transportParseResult === "not_reached" ||
    diag.transportParseResult === "unknown" ||
    diag.deterministicBindingResult === "binding_failed" ||
    diag.deterministicBindingResult === "not_reached" ||
    diag.deterministicBindingResult === "unknown"
  ) {
    return "INCONCLUSIVE";
  }

  if (
    codes.some(
      (c) =>
        c.includes("invalid_offsets") ||
        c.includes("empty_quote") ||
        c === "invalid_offsets" ||
        c === "empty_quote",
    )
  ) {
    return "INCONCLUSIVE";
  }

  // Generic deterministic_validation alone does not establish RESOLVED.
  if (!authorityFullyProven(diag)) {
    if (args.caseReceipt.adjudicatorCallCount <= 0) {
      return "NOT_REACHED";
    }
    return "INCONCLUSIVE";
  }

  return "RESOLVED";
}

function relevantAuthorityClasses(
  result: LiveProofExecuted,
  diagnostics: Ceqr017CaseDiagnostic[] | null | undefined,
): {
  fabricated: Ceqr015FailureCodeClass[];
  sourceId: Ceqr015FailureCodeClass[];
} {
  const byId = new Map((diagnostics ?? []).map((d) => [d.caseId, d]));
  const fabricated = CEQR_017_FABRICATED_QUOTE_RELEVANT_CASES.map((caseId) =>
    classifyAuthorityFailureCode({
      previousCode: "fabricated_quote",
      liveRan: true,
      caseReceipt: result.cases.find((c) => c.caseId === caseId),
      diagnostic: byId.get(caseId) ?? null,
    }),
  );
  const sourceId = CEQR_017_SOURCE_ID_MISMATCH_RELEVANT_CASES.map((caseId) =>
    classifyAuthorityFailureCode({
      previousCode: "source_id_mismatch",
      liveRan: true,
      caseReceipt: result.cases.find((c) => c.caseId === caseId),
      diagnostic: byId.get(caseId) ?? null,
    }),
  );
  return { fabricated, sourceId };
}

export type Ceqr017DiagnosticCompletenessResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export function validateCeqr017DiagnosticCompleteness(args: {
  result: LiveProofExecuted;
  diagnostics: Ceqr017CaseDiagnostic[] | null | undefined;
}): Ceqr017DiagnosticCompletenessResult {
  const reasons: string[] = [];
  const expectedIds = CEQR_015_CONTROLLED_CASE_FIXTURES.map((c) => c.id);
  const diagnostics = args.diagnostics ?? [];

  if (diagnostics.length !== 3) {
    reasons.push(`expected_exactly_3_diagnostics_got_${diagnostics.length}`);
  }

  const ids = diagnostics.map((d) => d.caseId);
  if (new Set(ids).size !== ids.length) {
    reasons.push("diagnostic_case_ids_not_unique");
  }
  for (let i = 0; i < expectedIds.length; i++) {
    if (diagnostics[i]?.caseId !== expectedIds[i]) {
      reasons.push(`diagnostic_order_mismatch_at_${i}`);
    }
  }

  for (const expectedId of expectedIds) {
    const diag = diagnostics.find((d) => d.caseId === expectedId);
    const receipt = args.result.cases.find((c) => c.caseId === expectedId);
    if (diag == null) {
      reasons.push(`missing_diagnostic_${expectedId}`);
      continue;
    }
    if (receipt == null) {
      reasons.push(`missing_receipt_${expectedId}`);
      continue;
    }
    if (diag.caseId !== receipt.caseId) {
      reasons.push(`diagnostic_receipt_id_mismatch_${expectedId}`);
    }
    if (diag.providerId !== args.result.providerId) {
      reasons.push(`provider_mismatch_${expectedId}`);
    }
    if (diag.adjudicatorModelId !== args.result.adjudicatorModelId) {
      reasons.push(`adjudicator_model_mismatch_${expectedId}`);
    }
    if (diag.refereeModelId !== args.result.refereeModelId) {
      reasons.push(`referee_model_mismatch_${expectedId}`);
    }
    if (diag.schemaVersion !== CEQR_017_EXPECTED_SCHEMA_VERSION) {
      reasons.push(`schema_mismatch_${expectedId}`);
    }
    if (diag.promptVersion !== CEQR_017_EXPECTED_PROMPT_VERSION) {
      reasons.push(`prompt_mismatch_${expectedId}`);
    }
    if (
      diag.liveAddendumVersion !== args.result.adjudicatorPromptAddendumVersion
    ) {
      reasons.push(`addendum_mismatch_${expectedId}`);
    }
    if (receipt.adjudicatorCallCount > 0) {
      if (diag.sanitizedProviderTransportObject == null) {
        reasons.push(`missing_transport_capture_${expectedId}`);
      }
      if (diag.rawProviderObjectUnchangedByReferenceAndValue !== true) {
        reasons.push(`raw_immutability_not_proven_${expectedId}`);
      }
      if (diag.transportParseResult !== "parsed") {
        reasons.push(`transport_not_parsed_${expectedId}`);
      }
      const transport = diag.sanitizedProviderTransportObject;
      if (transport != null && typeof transport === "object") {
        const rec = transport as Record<string, unknown>;
        const transportA = offsetsFromUnknown(rec.evidenceClaimA);
        const transportB = offsetsFromUnknown(rec.evidenceClaimB);
        if (
          transportA != null &&
          diag.selectedSideAOffsets != null &&
          (transportA.startOffset !== diag.selectedSideAOffsets.startOffset ||
            transportA.endOffset !== diag.selectedSideAOffsets.endOffset)
        ) {
          reasons.push(`transport_selected_offset_mismatch_a_${expectedId}`);
        }
        if (
          transportB != null &&
          diag.selectedSideBOffsets != null &&
          (transportB.startOffset !== diag.selectedSideBOffsets.startOffset ||
            transportB.endOffset !== diag.selectedSideBOffsets.endOffset)
        ) {
          reasons.push(`transport_selected_offset_mismatch_b_${expectedId}`);
        }
      }
    }
    if (diag.caseAdjudicatorAttempts !== receipt.adjudicatorCallCount) {
      reasons.push(`adjudicator_attempt_mismatch_${expectedId}`);
    }
    if (diag.caseRefereeAttempts !== receipt.refereeCallCount) {
      reasons.push(`referee_attempt_mismatch_${expectedId}`);
    }
    if (diag.writerInvoked !== receipt.writerInvoked) {
      reasons.push(`writer_invoked_mismatch_${expectedId}`);
    }
    if (diag.writeExecuted !== receipt.writeExecuted) {
      reasons.push(`write_executed_mismatch_${expectedId}`);
    }
  }

  const clearDiag = diagnostics.find(
    (d) => d.caseId === "clear_contradiction_candidate",
  );
  const clearReceipt = args.result.cases.find(
    (c) => c.caseId === "clear_contradiction_candidate",
  );
  if (clearDiag != null && clearReceipt != null) {
    if (
      args.result.clearContradictionWriteProven ||
      clearReceipt.status === "created" ||
      clearReceipt.status === "reused"
    ) {
      if (
        clearDiag.refereeExecutionState == null ||
        clearDiag.refereeExecutionState === "not_run"
      ) {
        reasons.push("clear_referee_execution_state_missing");
      }
      if (clearDiag.refereeOutcome == null) {
        reasons.push("clear_referee_outcome_missing");
      }
      if (clearDiag.candidateAuthorisationResult == null) {
        reasons.push("clear_candidate_authorisation_missing");
      }
      if (clearDiag.candidateAuthorisationResult !== clearReceipt.proofOutcome) {
        reasons.push("clear_candidate_authorisation_receipt_mismatch");
      }
      if (clearDiag.injectedSideASpanResult == null) {
        reasons.push("clear_injected_side_a_span_missing");
      }
      if (clearDiag.injectedSideBSpanResult == null) {
        reasons.push("clear_injected_side_b_span_missing");
      }
      if (clearDiag.injectedNodeResult == null) {
        reasons.push("clear_injected_node_missing");
      }
      const spanA = clearDiag.injectedSideASpanResult as
        | { id?: string; messageId?: string; charStart?: number; charEnd?: number }
        | null;
      const spanB = clearDiag.injectedSideBSpanResult as
        | { id?: string; messageId?: string; charStart?: number; charEnd?: number }
        | null;
      const node = clearDiag.injectedNodeResult as
        | {
            id?: string;
            sideASourceSpanId?: string | null;
            sideBSourceSpanId?: string | null;
            status?: string;
          }
        | null;
      if (
        spanA != null &&
        clearDiag.selectedSideAOffsets != null &&
        (spanA.charStart !== clearDiag.selectedSideAOffsets.startOffset ||
          spanA.charEnd !== clearDiag.selectedSideAOffsets.endOffset)
      ) {
        reasons.push("clear_span_a_offsets_mismatch");
      }
      if (
        spanB != null &&
        clearDiag.selectedSideBOffsets != null &&
        (spanB.charStart !== clearDiag.selectedSideBOffsets.startOffset ||
          spanB.charEnd !== clearDiag.selectedSideBOffsets.endOffset)
      ) {
        reasons.push("clear_span_b_offsets_mismatch");
      }
      if (
        node != null &&
        spanA?.id != null &&
        node.sideASourceSpanId !== spanA.id
      ) {
        reasons.push("clear_node_side_a_span_id_mismatch");
      }
      if (
        node != null &&
        spanB?.id != null &&
        node.sideBSourceSpanId !== spanB.id
      ) {
        reasons.push("clear_node_side_b_span_id_mismatch");
      }
      if (
        node?.id != null &&
        clearReceipt.contradictionNodeId != null &&
        node.id !== clearReceipt.contradictionNodeId
      ) {
        reasons.push("clear_node_id_receipt_mismatch");
      }
      if (
        clearDiag.writerInvoked !== clearReceipt.writerInvoked ||
        clearDiag.writeExecuted !== clearReceipt.writeExecuted
      ) {
        reasons.push("clear_writer_receipt_mismatch");
      }
    }
  }

  const sumAdj = diagnostics.reduce((n, d) => n + d.caseAdjudicatorAttempts, 0);
  const sumRef = diagnostics.reduce((n, d) => n + d.caseRefereeAttempts, 0);
  if (sumAdj !== args.result.adjudicatorCallCount) {
    reasons.push("total_adjudicator_attempts_mismatch");
  }
  if (sumRef !== args.result.refereeCallCount) {
    reasons.push("total_referee_attempts_mismatch");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function classifyCeqr017LiveResult(
  result: LiveProofResult | null,
  opts?: {
    runtimeIdentitiesMatched?: boolean;
    diagnostics?: Ceqr017CaseDiagnostic[] | null;
  },
): Ceqr017LiveClassification {
  if (result == null) return "NOT_RUN";
  if (!result.ran) return "NOT_RUN";

  const runtimeOk = opts?.runtimeIdentitiesMatched ?? false;
  if (!runtimeOk) {
    return "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH";
  }

  if (
    result.unsafeMutationDetected ||
    result.totalCallCount > result.maxTotalCalls ||
    result.maxTotalCalls !== CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS
  ) {
    return "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH";
  }

  const requiredIds = CEQR_015_CONTROLLED_CASE_FIXTURES.map((c) => c.id);
  for (const id of requiredIds) {
    const c = result.cases.find((x) => x.caseId === id);
    if (c == null) {
      return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
    }
    if (c.status === "skipped_budget" || c.status === "provider_failed") {
      return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
    }
  }

  const completeness = validateCeqr017DiagnosticCompleteness({
    result,
    diagnostics: opts?.diagnostics,
  });

  const { fabricated, sourceId } = relevantAuthorityClasses(
    result,
    opts?.diagnostics,
  );
  if ([...fabricated, ...sourceId].some((c) => c === "PERSISTS")) {
    return "HOLD_LIVE_AUTHORITY_FAILURE_PERSISTS";
  }

  if (!completeness.ok) {
    return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
  }

  if (
    [...fabricated, ...sourceId].some(
      (c) => c === "NOT_REACHED" || c === "INCONCLUSIVE",
    )
  ) {
    return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
  }

  const authorityResolved =
    fabricated.every((c) => c === "RESOLVED") &&
    sourceId.every((c) => c === "RESOLVED");

  const clearDiag = (opts?.diagnostics ?? []).find(
    (d) => d.caseId === "clear_contradiction_candidate",
  );
  const refereeState = clearDiag?.refereeExecutionState ?? null;
  const refereeFailed =
    refereeState === "failed" || refereeState === "invalid_evaluation";
  const refereeCompleted = refereeState === "completed";
  const refereeReached =
    refereeCompleted ||
    refereeFailed ||
    (clearDiag?.refereeInvoked === true && refereeState !== "not_run");

  if (authorityResolved && refereeFailed) {
    return "HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED";
  }

  if (
    authorityResolved &&
    result.clearContradictionWriteProven &&
    result.compatibleCaseNoWrite &&
    result.totalCallCount <= 8 &&
    result.maxTotalCalls === 8 &&
    !result.unsafeMutationDetected &&
    completeness.ok
  ) {
    return "PASS_LIVE_AUTHORITY_REPAIR_REPROVED";
  }

  if (authorityResolved && !refereeReached) {
    return "HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED";
  }

  if (
    authorityResolved &&
    refereeCompleted &&
    !result.clearContradictionWriteProven
  ) {
    return "PASS_LIVE_AUTHORITY_REPAIR_WITH_DOWNSTREAM_HOLD";
  }

  if (authorityResolved && refereeReached && !refereeCompleted) {
    return "HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED";
  }

  return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
}

export function buildCeqr017ProposedPhase2OrchestratorCommand(
  worktreePath: string = CEQR_017_WORKTREE_PATH,
): string {
  return [
    `cd ${worktreePath}`,
    "set -a && source /Users/user/ai-companion/.env && set +a",
    'CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID" \\',
    "CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000 \\",
    "CONTRADICTION_LIVE_MAX_TOTAL_CALLS=8 \\",
    "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \\",
    "  npx ts-node --transpile-only \\",
    `  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \\`,
    "  scripts/run-ceqr017-phase2-orchestrator.ts",
  ].join("\n");
}

/** @deprecated Prefer buildCeqr017ProposedPhase2OrchestratorCommand */
export function buildCeqr017ProposedLiveCommand(): string {
  return buildCeqr017ProposedPhase2OrchestratorCommand();
}

export type Ceqr017LiveRunClaim = {
  slice: typeof CEQR_017_SLICE_ID;
  campaignSlice: typeof CEQR_017_CAMPAIGN_SLICE;
  claimedAt: string;
  purpose: "exactly_one_phase2_live_provider_run";
  providerId: typeof CEQR_017_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_017_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelId: typeof CEQR_017_EXPECTED_REFEREE_MODEL;
  timeoutMs: typeof CEQR_017_EXPECTED_TIMEOUT_MS;
  maxTotalCalls: typeof CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  maxRetries: typeof CEQR_017_EXPECTED_MAX_RETRIES;
  neverAutoDelete: true;
};

export type Ceqr017LiveExecutionReceipt = {
  slice: typeof CEQR_017_SLICE_ID;
  campaignSlice: typeof CEQR_017_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_017_PROOF_VERSION;
  phase: "phase1_pre_live" | "phase2_live";
  liveAuthorised: boolean;
  liveExecuted: boolean;
  liveProviderAttempts: number;
  classification: Ceqr017LiveClassification;
  expectedRuntimeIdentities: Ceqr017ExpectedRuntimeIdentities;
  actualRuntimeIdentities: Ceqr017ActualRuntimeIdentities;
  runtimeIdentitiesMatched: boolean | null;
  ceqr015FailureCodeDelta: {
    fabricated_quote: Partial<
      Record<LiveSyntheticCaseId, Ceqr015FailureCodeClass>
    > & {
      clear_contradiction_candidate: Ceqr015FailureCodeClass;
      compatible_contextual: Ceqr015FailureCodeClass;
    };
    source_id_mismatch: Partial<
      Record<LiveSyntheticCaseId, Ceqr015FailureCodeClass>
    > & {
      ambiguous_insufficient: Ceqr015FailureCodeClass;
    };
  };
  caseDiagnostics: Ceqr017CaseDiagnostic[] | null;
  underlyingLiveProof: LiveProofResult | null;
  proposedLiveCommand: string;
  phase2Authorised: false | true;
  productionReady: false;
  notes: string[];
  beforeAccountGateExecuted?: boolean;
  beforeAccountGateMatched?: boolean | null;
  afterAccountGateExecuted?: boolean;
  afterAccountGateMatched?: boolean | null;
  accountAggregatesUnchanged?: boolean | null;
  accountGateError?: string | null;
  claimCreated?: boolean;
  claimPath?: string | null;
  liveRunnerInvoked?: boolean;
  liveRunnerInvocationCount?: number;
};

export function buildCeqr017Phase1LiveExecutionReceipt(): Ceqr017LiveExecutionReceipt {
  const expected = expectedCeqr017RuntimeIdentities();
  return {
    slice: CEQR_017_SLICE_ID,
    campaignSlice: CEQR_017_CAMPAIGN_SLICE,
    proofVersion: CEQR_017_PROOF_VERSION,
    phase: "phase1_pre_live",
    liveAuthorised: false,
    liveExecuted: false,
    liveProviderAttempts: 0,
    classification: "PHASE1_PRE_LIVE_READY",
    expectedRuntimeIdentities: expected,
    actualRuntimeIdentities: actualRuntimeIdentitiesFromLiveResult(null),
    runtimeIdentitiesMatched: null,
    ceqr015FailureCodeDelta: {
      fabricated_quote: {
        clear_contradiction_candidate: "NOT_REACHED",
        compatible_contextual: "NOT_REACHED",
      },
      source_id_mismatch: {
        ambiguous_insufficient: "NOT_REACHED",
      },
    },
    caseDiagnostics: null,
    underlyingLiveProof: null,
    proposedLiveCommand: buildCeqr017ProposedPhase2OrchestratorCommand(),
    phase2Authorised: false,
    productionReady: false,
    notes: [
      "Phase 1 corrected pre-live contract — live provider execution remains unauthorised.",
      "Actual live runtime identities were not observed.",
      "Full live case diagnostics were not captured.",
      "Account gates remain NOT_RUN.",
      "Orchestrator failure-path proof and historical CEQR-011–016 integrity remain Phase-1 test concerns until validated.",
    ],
  };
}

export function buildCeqr017LiveExecutionReceiptFromResult(args: {
  result: LiveProofResult;
  caseDiagnostics?: Ceqr017CaseDiagnostic[] | null;
}): Ceqr017LiveExecutionReceipt {
  const expected = expectedCeqr017RuntimeIdentities();
  const actual = actualRuntimeIdentitiesFromLiveResult(args.result);
  const matched = runtimeIdentitiesMatch(expected, actual);
  const classification = classifyCeqr017LiveResult(args.result, {
    runtimeIdentitiesMatched: matched,
    diagnostics: args.caseDiagnostics,
  });
  const cases = args.result.ran ? args.result.cases : [];
  const byId = new Map((args.caseDiagnostics ?? []).map((d) => [d.caseId, d]));

  return {
    slice: CEQR_017_SLICE_ID,
    campaignSlice: CEQR_017_CAMPAIGN_SLICE,
    proofVersion: CEQR_017_PROOF_VERSION,
    phase: "phase2_live",
    liveAuthorised: true,
    liveExecuted: args.result.ran,
    liveProviderAttempts: args.result.ran ? args.result.totalCallCount : 0,
    classification,
    expectedRuntimeIdentities: expected,
    actualRuntimeIdentities: actual,
    runtimeIdentitiesMatched: args.result.ran ? matched : null,
    ceqr015FailureCodeDelta: {
      fabricated_quote: {
        clear_contradiction_candidate: classifyAuthorityFailureCode({
          previousCode: "fabricated_quote",
          liveRan: args.result.ran,
          caseReceipt: cases.find(
            (c) => c.caseId === "clear_contradiction_candidate",
          ),
          diagnostic: byId.get("clear_contradiction_candidate") ?? null,
        }),
        compatible_contextual: classifyAuthorityFailureCode({
          previousCode: "fabricated_quote",
          liveRan: args.result.ran,
          caseReceipt: cases.find((c) => c.caseId === "compatible_contextual"),
          diagnostic: byId.get("compatible_contextual") ?? null,
        }),
      },
      source_id_mismatch: {
        ambiguous_insufficient: classifyAuthorityFailureCode({
          previousCode: "source_id_mismatch",
          liveRan: args.result.ran,
          caseReceipt: cases.find(
            (c) => c.caseId === "ambiguous_insufficient",
          ),
          diagnostic: byId.get("ambiguous_insufficient") ?? null,
        }),
      },
    },
    caseDiagnostics: args.caseDiagnostics ?? null,
    underlyingLiveProof: args.result,
    proposedLiveCommand: buildCeqr017ProposedPhase2OrchestratorCommand(),
    phase2Authorised: true,
    productionReady: false,
    notes: [
      "Injected nonmutation harness only — real account must remain unchanged.",
      matched
        ? "Runtime identities matched expected pins."
        : "Runtime identities did not match expected pins — PASS blocked.",
    ],
  };
}

export function ceqr017LiveResultToExitCode(
  receipt: Ceqr017LiveExecutionReceipt,
): number {
  if (receipt.classification === "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH") {
    return 5;
  }
  if (receipt.underlyingLiveProof == null) return 3;
  if (receipt.classification === "PASS_LIVE_AUTHORITY_REPAIR_REPROVED") {
    return 0;
  }
  return liveProofResultToExitCode(receipt.underlyingLiveProof);
}

export function isCeqr017LiveOptedIn(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isLiveContradictionProviderProofOptedIn(env);
}

/** Historical CEQR-011…016 receipt directory basenames (tracked corpus). */
export const CEQR_011_TO_016_RECEIPT_DIR_NAMES = [
  "CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001",
  "CONTRADICTION-LIVE-SEMANTIC-OUTPUT-COMPATIBILITY-001",
  "CONTRADICTION-LIVE-DIAGNOSTIC-RERUN-001",
  "CONTRADICTION-LIVE-EVIDENCE-PROMPT-REPAIR-001",
  "CONTRADICTION-LIVE-EVIDENCE-PROMPT-RERUN-001",
  "CONTRADICTION-EVIDENCE-AUTHORITY-REPAIR-AUDIT-001",
] as const;

export type Ceqr011To016ReceiptCorpusHash = {
  fileCount: number;
  sortedManifest: string[];
  aggregateSha256: string;
};

export function hashCeqr011To016ReceiptCorpus(
  cwd: string = process.cwd(),
): Ceqr011To016ReceiptCorpusHash {
  const root = join(cwd, "docs/agent-runs/receipts");
  const files: string[] = [];
  for (const dirName of CEQR_011_TO_016_RECEIPT_DIR_NAMES) {
    const dir = join(root, dirName);
    if (!existsSync(dir)) continue;
    const walk = (current: string, prefix: string) => {
      for (const entry of readdirSync(current).sort()) {
        const full = join(current, entry);
        const rel = `${prefix}/${entry}`;
        if (statSync(full).isDirectory()) {
          walk(full, rel);
        } else {
          files.push(rel);
        }
      }
    };
    walk(dir, dirName);
  }
  const sortedManifest = [...files].sort();
  const hash = createHash("sha256");
  for (const rel of sortedManifest) {
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(join(root, rel)));
    hash.update("\0");
  }
  return {
    fileCount: sortedManifest.length,
    sortedManifest,
    aggregateSha256: hash.digest("hex"),
  };
}

export {
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  LIVE_SYNTHETIC_CASES,
  liveProofResultToExitCode,
};
