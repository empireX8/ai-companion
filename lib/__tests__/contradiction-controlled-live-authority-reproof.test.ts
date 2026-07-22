/**
 * CEQR-017 Phase-1 correction tests.
 * Injected runners / fake account readers only. Zero live providers. Zero real DB.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertCeqr015FixturesExact,
  assertCeqr017PinnedLiveEnv,
  actualRuntimeIdentitiesFromLiveResult,
  buildCeqr017Phase1LiveExecutionReceipt,
  buildCeqr017ProposedPhase2OrchestratorCommand,
  buildEmptyCaseDiagnostic,
  CEQR_015_CONTROLLED_CASE_FIXTURES,
  CEQR_017_CONTROLLED_CASES,
  CEQR_017_EXPECTED_ADJUDICATOR_MODEL,
  CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_017_EXPECTED_MAX_RETRIES,
  CEQR_017_EXPECTED_PROMPT_VERSION,
  CEQR_017_EXPECTED_SCHEMA_VERSION,
  CEQR_017_EXPECTED_TIMEOUT_MS,
  CEQR_017_SLICE_ID,
  CEQR_017_WORKTREE_PATH,
  ceqr017ReceiptDir,
  classifyAuthorityFailureCode,
  classifyCeqr017LiveResult,
  expectedCeqr017RuntimeIdentities,
  hashCeqr011To016ReceiptCorpus,
  runtimeIdentitiesMatch,
  type Ceqr017CaseDiagnostic,
} from "../contradiction-controlled-live-authority-reproof";
import {
  assertCeqr017AccountGateWriteTarget,
  CEQR_017_PRODUCTION_ACCOUNT_GATE_RECEIPT_DIR,
} from "../ceqr017-account-gate-path";
import {
  buildCeqr017LegacyCliHardStopMessage,
  runCeqr017Phase2Orchestration,
} from "../ceqr017-phase2-orchestration";
import {
  createMatchingFakeCeqr017AccountGateReader,
  runCeqr017ReadonlyAccountGate,
  writeCeqr017AccountGateResult,
  type Ceqr017AccountGateResult,
} from "../ceqr017-readonly-account-gate";
import { scanCeqr017NewFiles } from "../ceqr017-whitespace-scan";
import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  adjudicateContradiction,
} from "../contradiction-adjudicator";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  contradictionModelResultOpenAiStrictSchema,
  createLiveCallBudget,
  type ContradictionLiveAdapterBundle,
} from "../contradiction-live-provider-adapters";
import {
  LIVE_SYNTHETIC_CASES,
  type LiveCaseReceipt,
  type LiveProofExecuted,
  type LiveSyntheticCaseId,
} from "../contradiction-live-provider-referee-proof";
import {
  bindExactEvidenceClaimFromOffsets,
  KERNEL_FIRST_PROOF_OBJECT,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import { evidenceSpanSelectionSchema } from "../orvek-intelligence-kernel/structured-output";

const RECEIPT_DIR = ceqr017ReceiptDir();

function completeDiagnostic(
  caseId: LiveSyntheticCaseId,
  overrides: Partial<Ceqr017CaseDiagnostic> = {},
): Ceqr017CaseDiagnostic {
  const fixture = CEQR_015_CONTROLLED_CASE_FIXTURES.find((c) => c.id === caseId)!;
  const sideASourceId = `reference:live-ref-${caseId}:message:live-msg-a-${caseId}`;
  const sideBSourceId = `message:live-msg-b-${caseId}`;
  return {
    ...buildEmptyCaseDiagnostic(caseId),
    providerId: "openai",
    adjudicatorModelId: "gpt-4o-mini",
    refereeModelId: "gpt-4o-mini",
    schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION,
    authoritativeSideASourceId: sideASourceId,
    authoritativeSideBSourceId: sideBSourceId,
    sideASourceTextLength: fixture.sideAText.length,
    sideBSourceTextLength: fixture.sideBText.length,
    sanitizedProviderTransportObject: {
      evidenceClaimA: {
        startOffset: 0,
        endOffset: fixture.sideAText.length,
      },
      evidenceClaimB: {
        startOffset: 0,
        endOffset: fixture.sideBText.length,
      },
      classification: fixture.expectedSemanticCategory,
      confidence: 0.9,
    },
    selectedSideAOffsets: {
      startOffset: 0,
      endOffset: fixture.sideAText.length,
    },
    selectedSideBOffsets: {
      startOffset: 0,
      endOffset: fixture.sideBText.length,
    },
    transportParseResult: "parsed",
    deterministicBindingResult: "bound",
    boundSideASourceId: sideASourceId,
    boundSideBSourceId: sideBSourceId,
    derivedSideAExactQuote: fixture.sideAText,
    derivedSideBExactQuote: fixture.sideBText,
    rawProviderObjectUnchangedByReferenceAndValue: true,
    deterministicValidationStatus: "passed",
    validationErrors: [],
    validationWarnings: [],
    earliestFailedGate: null,
    gateStoppedAt: null,
    semanticClassification: fixture.expectedSemanticCategory,
    modelConfidence: 0.9,
    refereeInvoked: caseId === "clear_contradiction_candidate",
    refereeExecutionState:
      caseId === "clear_contradiction_candidate" ? "completed" : "not_run",
    refereeOutcome:
      caseId === "clear_contradiction_candidate" ? "PASS" : null,
    refereeAdjustedConfidence: null,
    refereeError: null,
    candidateAuthorisationResult:
      caseId === "clear_contradiction_candidate" ? "created" : "no_candidate",
    writerInvoked: caseId === "clear_contradiction_candidate",
    writeExecuted: caseId === "clear_contradiction_candidate",
    injectedSideASpanResult:
      caseId === "clear_contradiction_candidate"
        ? {
            id: "span-a-clear",
            messageId: `live-msg-a-${caseId}`,
            charStart: 0,
            charEnd: fixture.sideAText.length,
          }
        : null,
    injectedSideBSpanResult:
      caseId === "clear_contradiction_candidate"
        ? {
            id: "span-b-clear",
            messageId: `live-msg-b-${caseId}`,
            charStart: 0,
            charEnd: fixture.sideBText.length,
          }
        : null,
    injectedNodeResult:
      caseId === "clear_contradiction_candidate"
        ? {
            id: "node-clear",
            sideASourceSpanId: "span-a-clear",
            sideBSourceSpanId: "span-b-clear",
            status: "candidate",
          }
        : null,
    caseAdjudicatorAttempts: 1,
    caseRefereeAttempts: caseId === "clear_contradiction_candidate" ? 1 : 0,
    ...overrides,
  };
}

function completeDiagnosticsFor(
  result: LiveProofExecuted,
  overridesById: Partial<
    Record<LiveSyntheticCaseId, Partial<Ceqr017CaseDiagnostic>>
  > = {},
): Ceqr017CaseDiagnostic[] {
  return CEQR_015_CONTROLLED_CASE_FIXTURES.map((fixture) => {
    const receipt = result.cases.find((c) => c.caseId === fixture.id)!;
    return completeDiagnostic(fixture.id, {
      caseAdjudicatorAttempts: receipt.adjudicatorCallCount,
      caseRefereeAttempts: receipt.refereeCallCount,
      writerInvoked: receipt.writerInvoked,
      writeExecuted: receipt.writeExecuted,
      candidateAuthorisationResult: receipt.proofOutcome,
      injectedNodeResult:
        fixture.id === "clear_contradiction_candidate" &&
        receipt.contradictionNodeId
          ? {
              id: receipt.contradictionNodeId,
              sideASourceSpanId: "span-a-clear",
              sideBSourceSpanId: "span-b-clear",
              status: "candidate",
            }
          : fixture.id === "clear_contradiction_candidate"
            ? {
                id: "node-clear",
                sideASourceSpanId: "span-a-clear",
                sideBSourceSpanId: "span-b-clear",
                status: "candidate",
              }
            : null,
      ...(overridesById[fixture.id] ?? {}),
    });
  });
}

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? `session-${partial.sourceId}`,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: "user",
    ...partial,
  };
}

function transportResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    propositionA: {
      normalizedProposition: "a",
      actor: "speaker",
      subject: "x",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "speaker",
      subject: "x",
      timeframe: "now",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "scope",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.9,
    evidenceClaimA: { startOffset: 0, endOffset: sideA.sourceText.length },
    evidenceClaimB: { startOffset: 0, endOffset: sideB.sourceText.length },
    rationale: "r",
    alternativeInterpretation: "alt",
    whatWouldChangeClassification: "w",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...overrides,
  };
}

function caseReceipt(
  partial: Partial<LiveCaseReceipt> & Pick<LiveCaseReceipt, "caseId">,
): LiveCaseReceipt {
  return {
    status: "failed_safely",
    proofOutcome: "failed_safely",
    writeExecuted: false,
    writerInvoked: false,
    adjudicatorCallCount: 1,
    refereeCallCount: 0,
    contradictionNodeId: null,
    sideAQuote: null,
    sideBQuote: null,
    presentationStatus: "not_requested",
    failureCode: "adjudication_failed",
    failureMessage: "x",
    latencyMs: 1,
    harnessNodeCountAfter: 0,
    harnessSpanCountAfter: 0,
    gateStoppedAt: "selection",
    sanitizedAdjudicationDiagnostics: null,
    ...partial,
  };
}

function executedProof(
  partial: Partial<LiveProofExecuted> & { cases: LiveCaseReceipt[] },
): LiveProofExecuted {
  const adjudicatorCallCount =
    partial.adjudicatorCallCount ??
    partial.cases.reduce((n, c) => n + c.adjudicatorCallCount, 0);
  const refereeCallCount =
    partial.refereeCallCount ??
    partial.cases.reduce((n, c) => n + c.refereeCallCount, 0);
  const totalCallCount =
    partial.totalCallCount ?? adjudicatorCallCount + refereeCallCount;
  return {
    ran: true,
    proofVersion: "contradiction-live-provider-referee-proof-v1",
    providerId: "openai",
    adjudicatorModelId: "gpt-4o-mini",
    refereeModelId: "gpt-4o-mini",
    independenceLevel: "separate_call_same_provider_same_model",
    maxRetries: 0,
    timeoutMs: 45_000,
    providerAttemptCountExact: true,
    adjudicatorPromptAddendumVersion:
      "contradiction-live-adjudicator-prompt-addendum-v3",
    maxTotalCalls: 8,
    clearContradictionWriteProven: false,
    compatibleCaseNoWrite: true,
    ambiguousCaseNoWrite: true,
    unsafeMutationDetected: false,
    evidenceOutputMutated: false,
    realAccountMutated: false,
    productionIngestionWired: false,
    isolatedDatabasePersistenceProven: false,
    productionReady: false,
    classificationHint: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
    ...partial,
    adjudicatorCallCount,
    refereeCallCount,
    totalCallCount,
  };
}

function pinnedEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
    CONTRADICTION_LIVE_ADJUDICATOR_MODEL: "gpt-4o-mini",
    CONTRADICTION_LIVE_REFEREE_MODEL: "gpt-4o-mini",
    CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS: "45000",
    CONTRADICTION_LIVE_MAX_TOTAL_CALLS: "8",
    OPENAI_API_KEY: "test-key-not-used",
    ...overrides,
  };
}

function makeAdapters(args?: {
  maxTotalCalls?: number;
  objectFactory?: (prompt: string) => unknown;
}): ContradictionLiveAdapterBundle {
  const callBudget = createLiveCallBudget(
    args?.maxTotalCalls ?? CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
  );
  const adjudicatorRunner: StructuredModelRunner = {
    async runStructured(request) {
      callBudget.recordAdjudicatorCall();
      const sideA = source({
        sourceId: "a",
        sourceText: "I do not drink alcohol at all.",
        label: "A",
      });
      const sideB = source({
        sourceId: "b",
        sourceText: "I drank several beers last night.",
        label: "B",
      });
      return {
        ok: true as const,
        object:
          args?.objectFactory?.(request.prompt) ??
          transportResult(sideA, sideB),
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
  const referee: ObjectivityReferee = {
    async evaluate() {
      callBudget.recordRefereeCall();
      return { outcome: "PASS", rationale: "ok" };
    },
  };
  return {
    adjudicatorRunner,
    refereeRunner: adjudicatorRunner,
    objectivityReferee: referee,
    providerId: "openai",
    adjudicatorModelId: "gpt-4o-mini",
    refereeModelId: "gpt-4o-mini",
    independenceLevel: "separate_call_same_provider_same_model",
    timeoutMs: 45_000,
    maxRetries: 0,
    providerAttemptCountExact: true,
    adjudicatorPromptAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    callBudget,
  };
}

describe("CEQR-017 identities and pins", () => {
  it("uses historical schema-v2 pin, prompt-v3, addendum-v3 and exact runtime pins", () => {
    expect(CEQR_017_EXPECTED_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v2",
    );
    expect(CEQR_017_EXPECTED_SCHEMA_VERSION).not.toBe(
      CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
    );
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v3",
    );
    expect(CEQR_017_EXPECTED_PROMPT_VERSION).toBe(
      CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
    );
    expect(CEQR_017_EXPECTED_LIVE_ADDENDUM_VERSION).toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    );
    expect(CEQR_017_EXPECTED_TIMEOUT_MS).toBe(45_000);
    expect(CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS).toBe(8);
    expect(CEQR_017_EXPECTED_MAX_RETRIES).toBe(0);
    expect(CONTRADICTION_LIVE_MAX_RETRIES).toBe(0);
    expect(CONTRADICTION_LIVE_MAX_TOTAL_CALLS).toBe(8);
  });

  it("rejects ambient model/timeout/budget overrides", () => {
    expect(
      assertCeqr017PinnedLiveEnv(
        pinnedEnv({ CONTRADICTION_LIVE_ADJUDICATOR_MODEL: "gpt-4o" }),
      ).ok,
    ).toBe(false);
    expect(
      assertCeqr017PinnedLiveEnv(
        pinnedEnv({ CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS: "30000" }),
      ).ok,
    ).toBe(false);
    expect(
      assertCeqr017PinnedLiveEnv(
        pinnedEnv({ CONTRADICTION_LIVE_MAX_TOTAL_CALLS: "4" }),
      ).ok,
    ).toBe(false);
    expect(assertCeqr017PinnedLiveEnv(pinnedEnv()).ok).toBe(true);
  });

  it("proposed Phase-2 command pins worktree, models, timeout, budget, orchestrator", () => {
    const cmd = buildCeqr017ProposedPhase2OrchestratorCommand();
    expect(cmd).toContain(CEQR_017_WORKTREE_PATH);
    expect(cmd).toContain('CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID"');
    expect(cmd).toContain("CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini");
    expect(cmd).toContain("CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini");
    expect(cmd).toContain("CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000");
    expect(cmd).toContain("CONTRADICTION_LIVE_MAX_TOTAL_CALLS=8");
    expect(cmd).toContain("RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1");
    expect(cmd).toContain("scripts/run-ceqr017-phase2-orchestrator.ts");
    expect(cmd).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(cmd).not.toContain("user_");
    expect(cmd).not.toContain("acct_");
  });
});

describe("CEQR-017 fixture order/extras", () => {
  it("requires exact length, order, ids, and texts", () => {
    expect(assertCeqr015FixturesExact(CEQR_017_CONTROLLED_CASES).ok).toBe(true);
    expect(CEQR_017_CONTROLLED_CASES).toBe(LIVE_SYNTHETIC_CASES);
    expect(
      assertCeqr015FixturesExact(CEQR_017_CONTROLLED_CASES.slice(0, 2)).ok,
    ).toBe(false);
    expect(
      assertCeqr015FixturesExact([
        CEQR_017_CONTROLLED_CASES[1]!,
        CEQR_017_CONTROLLED_CASES[0]!,
        CEQR_017_CONTROLLED_CASES[2]!,
      ]).ok,
    ).toBe(false);
    expect(
      assertCeqr015FixturesExact([
        ...CEQR_017_CONTROLLED_CASES,
        {
          id: "clear_contradiction_candidate",
          sideAText: "x",
          sideBText: "y",
          referenceStatement: "x",
        },
      ]).ok,
    ).toBe(false);
    expect(
      assertCeqr015FixturesExact([
        {
          ...CEQR_017_CONTROLLED_CASES[0]!,
          sideAText: "CHANGED",
        },
        CEQR_017_CONTROLLED_CASES[1]!,
        CEQR_017_CONTROLLED_CASES[2]!,
      ]).ok,
    ).toBe(false);
  });
});

describe("CEQR-017 transport and binding", () => {
  it("transport owns only offsets; forged sourceId/exactQuote non-authoritative; raw immutable", async () => {
    expect(Object.keys(evidenceSpanSelectionSchema.shape).sort()).toEqual([
      "endOffset",
      "startOffset",
    ]);
    const openAiUnion =
      contradictionModelResultOpenAiStrictSchema.shape.adjudication;
    const options =
      "options" in openAiUnion && Array.isArray(openAiUnion.options)
        ? openAiUnion.options
        : [];
    expect(options.length).toBe(3);
    for (const option of options) {
      expect(Object.keys(option.shape.evidenceClaimA.shape).sort()).toEqual([
        "endOffset",
        "startOffset",
      ]);
      expect(option.shape.evidenceClaimA.shape).not.toHaveProperty("sourceId");
      expect(option.shape.evidenceClaimA.shape).not.toHaveProperty("exactQuote");
    }

    const sideA = source({
      sourceId: "auth-a",
      sourceText: "AA BCD EE",
      label: "A",
    });
    const sideB = source({
      sourceId: "auth-b",
      sourceText: "11 234 56",
      label: "B",
    });
    const providerObject = transportResult(sideA, sideB, {
      evidenceClaimA: {
        startOffset: 3,
        endOffset: 6,
        sourceId: "forged",
        exactQuote: "NOPE",
      },
      evidenceClaimB: {
        startOffset: 3,
        endOffset: 6,
        sourceId: "forged-b",
        exactQuote: "ZZZ",
      },
    });
    const snap = structuredClone(providerObject);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true as const,
            object: providerObject,
            providerId: "t",
            modelId: "t",
            rawText: null,
          };
        },
      },
      now: () => new Date("2026-07-22T12:00:00.000Z"),
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(providerObject).toEqual(snap);
    expect(result.semantic?.evidenceClaimA.sourceId).toBe("auth-a");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe("BCD");
  });

  it("fail-closed offsets and no repair helpers", () => {
    const side = source({ sourceId: "s", sourceText: "01 234 56789", label: "S" });
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: -1,
        endOffset: 2,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 5,
        endOffset: 2,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 2,
        endOffset: 2,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 1.5,
        endOffset: 3,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 0,
        endOffset: 99,
      }).ok,
    ).toBe(false);
    const ok = bindExactEvidenceClaimFromOffsets(side, {
      startOffset: 3,
      endOffset: 6,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.claim.exactQuote).toBe("234");
  });
});

describe("CEQR-017 authority classification matrix", () => {
  it("NOT_REACHED and INCONCLUSIVE never yield PASS", () => {
    expect(
      classifyAuthorityFailureCode({
        previousCode: "fabricated_quote",
        liveRan: false,
        caseReceipt: undefined,
      }),
    ).toBe("NOT_REACHED");
    expect(
      classifyCeqr017LiveResult(null, { runtimeIdentitiesMatched: true }),
    ).toBe("NOT_RUN");

    const missing = executedProof({
      cases: [
        caseReceipt({ caseId: "compatible_contextual" }),
        caseReceipt({ caseId: "ambiguous_insufficient" }),
      ],
    });
    expect(
      classifyCeqr017LiveResult(missing, { runtimeIdentitiesMatched: true }),
    ).not.toMatch(/^PASS_/);

    const skipped = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "skipped_budget",
          adjudicatorCallCount: 0,
        }),
        caseReceipt({ caseId: "compatible_contextual" }),
        caseReceipt({ caseId: "ambiguous_insufficient" }),
      ],
    });
    expect(
      classifyAuthorityFailureCode({
        previousCode: "fabricated_quote",
        liveRan: true,
        caseReceipt: skipped.cases[0],
      }),
    ).toBe("INCONCLUSIVE");
    expect(
      classifyCeqr017LiveResult(skipped, { runtimeIdentitiesMatched: true }),
    ).not.toMatch(/^PASS_/);
  });

  it("fabricated_quote / source_id_mismatch PERSISTS → HOLD_LIVE_AUTHORITY_FAILURE_PERSISTS", () => {
    const fabricated = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          sanitizedAdjudicationDiagnostics: {
            providerId: "openai",
            modelId: "gpt-4o-mini",
            schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
            promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
            parseValidationOutcome: "invalid",
            adjudicationOutcome: "validation_failed",
            adjudicationErrorCode: "validation_failed",
            validationErrorCodes: ["fabricated_quote", "validation_failed"],
            failingFieldPaths: ["evidenceClaim"],
            evidenceFailureSide: "unknown",
            sourceTextLengths: { sideA: 30, sideB: 33 },
            exactQuoteMatched: { sideA: null, sideB: null },
            offsetsMatched: { sideA: null, sideB: null },
            earliestGate: "deterministic_validation",
          },
        }),
        caseReceipt({ caseId: "compatible_contextual" }),
        caseReceipt({ caseId: "ambiguous_insufficient" }),
      ],
    });
    expect(
      classifyCeqr017LiveResult(fabricated, {
        runtimeIdentitiesMatched: true,
      }),
    ).toBe("HOLD_LIVE_AUTHORITY_FAILURE_PERSISTS");

    const sourceMismatch = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "created",
          writeExecuted: true,
          writerInvoked: true,
          refereeCallCount: 1,
          contradictionNodeId: "n1",
          sideAQuote: "I do not drink alcohol at all.",
          sideBQuote: "I drank several beers last night.",
          presentationStatus: "resolved",
          proofOutcome: "created",
          failureCode: null,
          gateStoppedAt: null,
          sanitizedAdjudicationDiagnostics: null,
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          proofOutcome: "no_candidate",
          failureCode: null,
          gateStoppedAt: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          sanitizedAdjudicationDiagnostics: {
            providerId: "openai",
            modelId: "gpt-4o-mini",
            schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
            promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
            parseValidationOutcome: "invalid",
            adjudicationOutcome: "validation_failed",
            adjudicationErrorCode: "validation_failed",
            validationErrorCodes: ["source_id_mismatch", "validation_failed"],
            failingFieldPaths: ["evidenceClaim"],
            evidenceFailureSide: "unknown",
            sourceTextLengths: { sideA: 10, sideB: 10 },
            exactQuoteMatched: { sideA: null, sideB: null },
            offsetsMatched: { sideA: null, sideB: null },
            earliestGate: "deterministic_validation",
          },
        }),
      ],
      clearContradictionWriteProven: true,
      compatibleCaseNoWrite: true,
    });
    expect(
      classifyCeqr017LiveResult(sourceMismatch, {
        runtimeIdentitiesMatched: true,
      }),
    ).toBe("HOLD_LIVE_AUTHORITY_FAILURE_PERSISTS");
  });

  it("schema_parse is INCONCLUSIVE; generic failed_safely without path is not RESOLVED", () => {
    expect(
      classifyAuthorityFailureCode({
        previousCode: "fabricated_quote",
        liveRan: true,
        caseReceipt: caseReceipt({
          caseId: "clear_contradiction_candidate",
          sanitizedAdjudicationDiagnostics: {
            providerId: "openai",
            modelId: "gpt-4o-mini",
            schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
            promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
            parseValidationOutcome: "invalid",
            adjudicationOutcome: "validation_failed",
            adjudicationErrorCode: "schema_parse_failed",
            validationErrorCodes: [],
            failingFieldPaths: [],
            evidenceFailureSide: null,
            sourceTextLengths: { sideA: 1, sideB: 1 },
            exactQuoteMatched: { sideA: null, sideB: null },
            offsetsMatched: { sideA: null, sideB: null },
            earliestGate: "schema_parse",
          },
        }),
      }),
    ).toBe("INCONCLUSIVE");

    expect(
      classifyAuthorityFailureCode({
        previousCode: "fabricated_quote",
        liveRan: true,
        caseReceipt: caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "failed_safely",
          sanitizedAdjudicationDiagnostics: null,
        }),
      }),
    ).toBe("INCONCLUSIVE");
  });

  it("runtime mismatch / unsafe / wrong budget cannot PASS", () => {
    const base = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "created",
          writeExecuted: true,
          writerInvoked: true,
          refereeCallCount: 1,
          contradictionNodeId: "n",
          sideAQuote: "a",
          sideBQuote: "b",
          presentationStatus: "resolved",
          proofOutcome: "created",
          failureCode: null,
          gateStoppedAt: null,
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          proofOutcome: "no_candidate",
          failureCode: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          status: "no_write",
          proofOutcome: "no_candidate",
          failureCode: null,
        }),
      ],
      clearContradictionWriteProven: true,
      compatibleCaseNoWrite: true,
    });
    expect(
      classifyCeqr017LiveResult(base, { runtimeIdentitiesMatched: false }),
    ).toBe("FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH");
    expect(
      classifyCeqr017LiveResult(
        { ...base, unsafeMutationDetected: true },
        { runtimeIdentitiesMatched: true },
      ),
    ).toBe("FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH");
    expect(
      classifyCeqr017LiveResult(
        { ...base, maxTotalCalls: 4 },
        { runtimeIdentitiesMatched: true },
      ),
    ).toBe("FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH");
  });

  it("full PASS only when authority RESOLVED and write proven", () => {
    const pass = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "created",
          writeExecuted: true,
          writerInvoked: true,
          refereeCallCount: 1,
          contradictionNodeId: "n",
          sideAQuote: CEQR_015_CONTROLLED_CASE_FIXTURES[0].sideAText,
          sideBQuote: CEQR_015_CONTROLLED_CASE_FIXTURES[0].sideBText,
          presentationStatus: "resolved",
          proofOutcome: "created",
          failureCode: null,
          gateStoppedAt: null,
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          proofOutcome: "no_candidate",
          failureCode: null,
          gateStoppedAt: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          status: "no_write",
          proofOutcome: "no_candidate",
          failureCode: null,
          gateStoppedAt: null,
        }),
      ],
      clearContradictionWriteProven: true,
      compatibleCaseNoWrite: true,
    });
    expect(
      classifyCeqr017LiveResult(pass, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(pass),
      }),
    ).toBe("PASS_LIVE_AUTHORITY_REPAIR_REPROVED");

    const noReferee = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "failed_safely",
          refereeCallCount: 0,
          sanitizedAdjudicationDiagnostics: {
            providerId: "openai",
            modelId: "gpt-4o-mini",
            schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
            promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
            parseValidationOutcome: "valid",
            adjudicationOutcome: "semantic_accepted",
            adjudicationErrorCode: null,
            validationErrorCodes: [],
            failingFieldPaths: [],
            evidenceFailureSide: null,
            sourceTextLengths: { sideA: 1, sideB: 1 },
            exactQuoteMatched: { sideA: true, sideB: true },
            offsetsMatched: { sideA: true, sideB: true },
            earliestGate: "semantic_accepted_referee_eligible",
          },
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          failureCode: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          status: "no_write",
          failureCode: null,
        }),
      ],
    });
    expect(
      classifyCeqr017LiveResult(noReferee, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(noReferee, {
          clear_contradiction_candidate: {
            refereeInvoked: false,
            refereeExecutionState: "not_run",
            refereeOutcome: null,
            writerInvoked: false,
            writeExecuted: false,
            caseRefereeAttempts: 0,
          },
        }),
      }),
    ).toBe("HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED");

    const downstream = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "failed_safely",
          refereeCallCount: 1,
          writerInvoked: false,
          writeExecuted: false,
          failureCode: null,
          sanitizedAdjudicationDiagnostics: {
            providerId: "openai",
            modelId: "gpt-4o-mini",
            schemaVersion: CEQR_017_EXPECTED_SCHEMA_VERSION,
            promptVersion: CEQR_017_EXPECTED_PROMPT_VERSION,
            parseValidationOutcome: "valid",
            adjudicationOutcome: "semantic_accepted",
            adjudicationErrorCode: null,
            validationErrorCodes: [],
            failingFieldPaths: [],
            evidenceFailureSide: null,
            sourceTextLengths: { sideA: 1, sideB: 1 },
            exactQuoteMatched: { sideA: true, sideB: true },
            offsetsMatched: { sideA: true, sideB: true },
            earliestGate: "semantic_accepted_referee_eligible",
          },
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          failureCode: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          status: "no_write",
          failureCode: null,
        }),
      ],
      clearContradictionWriteProven: false,
      compatibleCaseNoWrite: true,
    });
    expect(
      classifyCeqr017LiveResult(downstream, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(downstream, {
          clear_contradiction_candidate: {
            writerInvoked: false,
            writeExecuted: false,
            caseRefereeAttempts: 1,
            refereeExecutionState: "completed",
            refereeInvoked: true,
          },
        }),
      }),
    ).toBe("PASS_LIVE_AUTHORITY_REPAIR_WITH_DOWNSTREAM_HOLD");
  });
});

describe("CEQR-017 authority resolution blockers", () => {
  it("invalid_offsets / binding failure / missing or shifted diagnostics block PASS", () => {
    const base = executedProof({
      cases: [
        caseReceipt({
          caseId: "clear_contradiction_candidate",
          status: "created",
          writeExecuted: true,
          writerInvoked: true,
          refereeCallCount: 1,
          proofOutcome: "created",
          failureCode: null,
          gateStoppedAt: null,
        }),
        caseReceipt({
          caseId: "compatible_contextual",
          status: "no_write",
          failureCode: null,
        }),
        caseReceipt({
          caseId: "ambiguous_insufficient",
          status: "no_write",
          failureCode: null,
        }),
      ],
      clearContradictionWriteProven: true,
      compatibleCaseNoWrite: true,
    });

    expect(
      classifyAuthorityFailureCode({
        previousCode: "fabricated_quote",
        liveRan: true,
        caseReceipt: base.cases[0],
        diagnostic: completeDiagnostic("clear_contradiction_candidate", {
          validationErrors: ["invalid_offsets"],
          deterministicValidationStatus: "failed",
        }),
      }),
    ).toBe("INCONCLUSIVE");

    expect(
      classifyAuthorityFailureCode({
        previousCode: "source_id_mismatch",
        liveRan: true,
        caseReceipt: base.cases[2],
        diagnostic: completeDiagnostic("ambiguous_insufficient", {
          deterministicBindingResult: "binding_failed",
          boundSideASourceId: null,
          boundSideBSourceId: null,
        }),
      }),
    ).toBe("INCONCLUSIVE");

    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: null,
      }),
    ).not.toMatch(/^PASS_/);

    const shifted = completeDiagnosticsFor(base);
    shifted[0] = completeDiagnostic("compatible_contextual");
    shifted[1] = completeDiagnostic("clear_contradiction_candidate");
    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: shifted,
      }),
    ).not.toMatch(/^PASS_/);

    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(base, {
          clear_contradiction_candidate: {
            boundSideASourceId: "wrong",
          },
        }),
      }),
    ).not.toMatch(/^PASS_/);

    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(base, {
          clear_contradiction_candidate: {
            derivedSideAExactQuote: "not-the-authoritative-slice",
          },
        }),
      }),
    ).not.toMatch(/^PASS_/);

    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(base, {
          clear_contradiction_candidate: {
            sanitizedProviderTransportObject: null,
          },
        }),
      }),
    ).not.toMatch(/^PASS_/);

    expect(
      classifyCeqr017LiveResult(base, {
        runtimeIdentitiesMatched: true,
        diagnostics: completeDiagnosticsFor(base, {
          clear_contradiction_candidate: {
            refereeExecutionState: "failed",
            refereeInvoked: true,
          },
        }),
      }),
    ).toBe("HOLD_LIVE_REFEREE_PROOF_NOT_OBTAINED");
  });
});

describe("CEQR-017 runtime identity comparison", () => {
  it("derives actual identities from live result and requires exact match", () => {
    const expected = expectedCeqr017RuntimeIdentities();
    expect(expected.adjudicatorModelId).toBe(CEQR_017_EXPECTED_ADJUDICATOR_MODEL);
    expect(expected.timeoutMs).toBe(45_000);
    expect(expected.maxTotalCalls).toBe(8);
    const actualMissing = actualRuntimeIdentitiesFromLiveResult(null);
    expect(actualMissing.observedFromLiveResult).toBe(false);
    expect(runtimeIdentitiesMatch(expected, actualMissing)).toBe(false);

    const ok = executedProof({
      cases: [
        caseReceipt({ caseId: "clear_contradiction_candidate" }),
        caseReceipt({ caseId: "compatible_contextual" }),
        caseReceipt({ caseId: "ambiguous_insufficient" }),
      ],
    });
    const actual = actualRuntimeIdentitiesFromLiveResult(ok);
    expect(runtimeIdentitiesMatch(expected, actual)).toBe(true);
    expect(
      runtimeIdentitiesMatch(expected, {
        ...actual,
        adjudicatorModelId: "gpt-4o",
      }),
    ).toBe(false);
  });
});


describe("CEQR-017 atomic one-run claim", () => {
  it("existing claim blocks second orchestration before account/live/writes", async () => {
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-claim-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, "phase2-live-run-claim.json"), "{}\n");
      let liveCalls = 0;
      let gateCalls = 0;
      let writes = 0;
      const blocked = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async () => {
          gateCalls += 1;
          throw new Error("should not query account when claim exists");
        },
        runLiveAfterClaim: async () => {
          liveCalls += 1;
          throw new Error("should not run live when claim exists");
        },
        writeFile: () => {
          writes += 1;
          throw new Error("should not overwrite receipts when claim exists");
        },
      });
      expect(blocked.liveRunnerInvoked).toBe(false);
      expect(liveCalls).toBe(0);
      expect(gateCalls).toBe(0);
      expect(writes).toBe(0);
      expect(blocked.finalReceiptWritten).toBe(false);
      expect(blocked.exitCode).toBe(5);
      expect(existsSync(join(dir, "phase2-live-run-claim.json"))).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("CEQR-017 account gate (fake readers only)", () => {
  it("writes only into CEQR-017 receipt dir and leaves historical receipts untouched", async () => {
    const before = hashCeqr011To016ReceiptCorpus();
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-gate-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });

    try {
      const ok = await runCeqr017ReadonlyAccountGate({
        label: "before",
        reader: createMatchingFakeCeqr017AccountGateReader(),
        env: { CEQR_READONLY_ACCOUNT_USER_ID: "fake-account-for-tests-only" },
        receiptDir: dir,
        allowTestReceiptDir: true,
      });
      expect(ok.matchesExpected).toBe(true);
      expect(existsSync(join(dir, "account-gate-before.json"))).toBe(true);

      await expect(
        runCeqr017ReadonlyAccountGate({
          label: "before",
          reader: createMatchingFakeCeqr017AccountGateReader(),
          env: { CEQR_READONLY_ACCOUNT_USER_ID: "fake" },
          receiptDir: join(parent, "CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001"),
          allowTestReceiptDir: true,
        }),
      ).rejects.toThrow(/refuses to write outside/i);

      const after = hashCeqr011To016ReceiptCorpus();
      expect(after.aggregateSha256).toBe(before.aggregateSha256);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects symlink-named slice directories that escape via realpath", () => {
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-symlink-"));
    const target = mkdtempSync(join(tmpdir(), "ceqr017-symlink-target-"));
    const link = join(parent, CEQR_017_SLICE_ID);
    try {
      symlinkSync(target, link);
      expect(() =>
        assertCeqr017AccountGateWriteTarget({
          receiptDir: link,
          label: "before",
          allowTestReceiptDir: true,
        }),
      ).toThrow(/refuses to write outside/i);
      expect(CEQR_017_PRODUCTION_ACCOUNT_GATE_RECEIPT_DIR).toContain(
        CEQR_017_SLICE_ID,
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });
});

describe("CEQR-017 diagnostics / whitespace / phase1 safety", () => {
  it("empty case diagnostic includes required fields", () => {
    const d = buildEmptyCaseDiagnostic("clear_contradiction_candidate");
    expect(d.caseId).toBe("clear_contradiction_candidate");
    expect(d.caseAdjudicatorAttempts).toBe(0);
  });

  it("whitespace/JSON scan over new CEQR-017 files passes", () => {
    const scan = scanCeqr017NewFiles();
    expect(scan.findings).toEqual([]);
    expect(scan.ok).toBe(true);
  });

  it("Phase-1 receipt is NOT_RUN live with zero attempts; opt-in unset", () => {
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).toBeFalsy();
    const phase1 = buildCeqr017Phase1LiveExecutionReceipt();
    expect(phase1.liveExecuted).toBe(false);
    expect(phase1.liveProviderAttempts).toBe(0);
    expect(phase1.caseDiagnostics).toBeNull();
    expect(phase1.phase2Authorised).toBe(false);
    expect(phase1.productionReady).toBe(false);
  });

  it("budget-limited injected path via orchestrator createAdapters", async () => {
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-budget-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });
    try {
      const receipt = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async ({ label, write }) => {
          const result = {
            ...matchingGateFixture(label),
            matchesExpected: true,
          };
          if (write) {
            writeCeqr017AccountGateResult({
              result,
              receiptDir: dir,
              allowTestReceiptDir: true,
            });
          }
          return result;
        },
        createAdapters: async () => makeAdapters({ maxTotalCalls: 2 }),
        writeFile: (path, contents) => writeFileSync(path, contents),
      });
      expect(receipt.claimCreated).toBe(true);
      expect(receipt.liveRunnerInvoked).toBe(true);
      expect(receipt.receipt.underlyingLiveProof?.ran).toBe(true);
      if (!receipt.receipt.underlyingLiveProof?.ran) return;
      expect(receipt.receipt.underlyingLiveProof.maxRetries).toBe(0);
      expect(
        receipt.receipt.underlyingLiveProof.cases.some(
          (c: { status: string }) => c.status === "skipped_budget",
        ),
      ).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("ordinary routes remain unwired", () => {
    const roots = ["app", "pages", "src"].filter((d) =>
      existsSync(join(process.cwd(), d)),
    );
    for (const root of roots) {
      const walk = (dir: string): string[] => {
        const out: string[] = [];
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const st = statSync(full);
          if (st.isDirectory()) out.push(...walk(full));
          else if (/\.(ts|tsx|js|jsx)$/.test(full)) out.push(full);
        }
        return out;
      };
      for (const file of walk(join(process.cwd(), root))) {
        const text = readFileSync(file, "utf8");
        expect(text).not.toContain("run-ceqr017-phase2-orchestrator");
        expect(text).not.toContain("runCeqr017LiveWithPhase2Capability");
        expect(text).not.toContain("claimCeqr017Phase2LiveRun");
      }
    }
  });

  it("receipt directory has required live artifacts and permanent claim", () => {
    for (const name of [
      "00-intake-and-boundaries.md",
      "08-live-execution-command.md",
      "live-execution-receipt.json",
      "pre-live-validation-summary.json",
      "phase2-live-run-claim.json",
      "readonly-account-gate.mjs",
      "changed-files.txt",
    ]) {
      expect(existsSync(join(RECEIPT_DIR, name))).toBe(true);
    }
    const receipt = JSON.parse(
      readFileSync(join(RECEIPT_DIR, "live-execution-receipt.json"), "utf8"),
    ) as {
      liveExecuted: boolean;
      liveProviderAttempts: number;
      expectedRuntimeIdentities?: { schemaVersion?: string };
    };
    // CEQR-017 Phase 2 permanently recorded one live run under schema-v2.
    expect(receipt.liveExecuted).toBe(true);
    expect(receipt.liveProviderAttempts).toBeGreaterThan(0);
    expect(receipt.expectedRuntimeIdentities?.schemaVersion).toBe(
      "contradiction-adjudication-schema-v2",
    );
  });

  it("capability mint and live runner are not exported from production libraries", () => {
    const main = readFileSync(
      join(process.cwd(), "lib/contradiction-controlled-live-authority-reproof.ts"),
      "utf8",
    );
    expect(main).not.toContain("export function claimCeqr017Phase2LiveRun");
    expect(main).not.toContain("export async function runCeqr017LiveWithPhase2Capability");
    expect(main).not.toContain("runCeqr017ControlledLiveAuthorityReproofForTests");
    const orch = readFileSync(
      join(process.cwd(), "lib/ceqr017-phase2-orchestration.ts"),
      "utf8",
    );
    expect(orch).toContain("export async function runCeqr017Phase2Orchestration");
    expect(orch).not.toContain("export function claimCeqr017Phase2LiveRun");
    expect(orch).not.toContain("export async function runCeqr017LiveWithPhase2Capability");
    expect(orch).not.toContain("export type Ceqr017Phase2LiveRunCapability");
  });
});

function matchingGateFixture(label: "before" | "after"): Ceqr017AccountGateResult {
  return {
    campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001",
    slice: CEQR_017_SLICE_ID,
    campaignSlice: "CEQR-017",
    label,
    userId: "[REDACTED_ACCOUNT_ID]",
    queriedAt: "2026-01-01T00:00:00.000Z",
    mode: "read_only",
    mutationsPerformed: false,
    decisionPostCalled: false,
    writerInvokedAgainstAccount: false,
    confirmDismissCalled: false,
    liveProofWroteToAccount: false,
    expected: {
      contradictionNodeTotal: 25,
      candidateTotal: 25,
      evidenceSpans: 5941,
      completeExactDualSideRows: 0,
      invalidPartialRows: 0,
      legacyIncompleteRows: 25,
      completePairDuplicateGroups: 0,
    },
    observed: {
      contradictionNodeTotal: 25,
      candidateTotal: 25,
      evidenceSpans: 5941,
      contradictionNodesByStatus: { candidate: 25 },
      lineageCounts: {
        complete_exact_dual_side: 0,
        legacy_incomplete: 25,
        invalid_partial: 0,
      },
      completePairDuplicateGroups: 0,
    },
    matchesExpected: true,
  };
}

describe("CEQR-017 real-path adapter construction diagnostics", () => {
  it("captures three cases in order via guarded orchestrator createAdapters", async () => {
    const objectFactory = (prompt: string) => {
      const clearA = "I do not drink alcohol at all.";
      const clearB = "I drank several beers last night.";
      const compatA = "I avoid coffee in the evening.";
      const compatB = "I drink coffee in the morning.";
      const ambA = "I might go running later if I feel up to it.";
      const ambB = "Sometimes I think about exercise.";
      if (prompt.includes(clearA) && prompt.includes(clearB)) {
        return transportResult(
          source({ sourceId: "a", sourceText: clearA, label: "A" }),
          source({ sourceId: "b", sourceText: clearB, label: "B" }),
        );
      }
      if (prompt.includes(compatA) && prompt.includes(compatB)) {
        return transportResult(
          source({ sourceId: "a", sourceText: compatA, label: "A" }),
          source({ sourceId: "b", sourceText: compatB, label: "B" }),
          {
            classification: "compatible_states",
            bothCanSimultaneouslyBeTrue: true,
          },
        );
      }
      return transportResult(
        source({ sourceId: "a", sourceText: ambA, label: "A" }),
        source({ sourceId: "b", sourceText: ambB, label: "B" }),
        {
          classification: "insufficient_or_misaligned_context",
          bothCanSimultaneouslyBeTrue: true,
        },
      );
    };

    const parent = mkdtempSync(join(tmpdir(), "ceqr017-realpath-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });
    let factoryCalls = 0;
    try {
      const result = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async ({ label, write }) => {
          const gate = matchingGateFixture(label);
          if (write) {
            writeCeqr017AccountGateResult({
              result: gate,
              receiptDir: dir,
              allowTestReceiptDir: true,
            });
          }
          return gate;
        },
        createAdapters: async () => {
          factoryCalls += 1;
          return makeAdapters({ objectFactory });
        },
        writeFile: (path, contents) => writeFileSync(path, contents),
      });
      expect(factoryCalls).toBe(1);
      expect(result.claimCreated).toBe(true);
      expect(result.receipt.caseDiagnostics).toHaveLength(3);
      expect(result.receipt.caseDiagnostics?.map((d) => d.caseId)).toEqual([
        "clear_contradiction_candidate",
        "compatible_contextual",
        "ambiguous_insufficient",
      ]);
      for (const diag of result.receipt.caseDiagnostics ?? []) {
        expect(diag.sanitizedProviderTransportObject).not.toBeNull();
        expect(diag.rawProviderObjectUnchangedByReferenceAndValue).toBe(true);
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("CEQR-017 injectable Phase-2 orchestration", () => {
  it("covers before-mismatch single final write, claim race, after-gate, and throw", async () => {
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-orch-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });

    try {
      const writeTimeline: string[] = [];
      const beforeMismatch = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async ({ label }) => ({
          ...matchingGateFixture(label),
          matchesExpected: false,
        }),
        runLiveAfterClaim: async () => {
          throw new Error("live must not run");
        },
        writeFile: (path, contents) => {
          writeTimeline.push(`receipt:${basename(path)}`);
          writeFileSync(path, contents);
        },
      });
      expect(beforeMismatch.liveRunnerInvoked).toBe(false);
      expect(beforeMismatch.exitCode).toBe(5);
      expect(writeTimeline).toEqual(["receipt:live-execution-receipt.json"]);
      expect(beforeMismatch.receipt.afterAccountGateExecuted).toBe(false);
      expect(existsSync(join(dir, "account-gate-before.json"))).toBe(false);

      // Deterministic claim race: both pass claimExists, one wins wx.
      rmSync(join(dir, "live-execution-receipt.json"), { force: true });
      let claimAttempts = 0;
      let liveInvocations = 0;
      let beforeWrites = 0;
      let afterWrites = 0;
      let receiptWrites = 0;
      const claimResults: Array<"win" | "lose"> = ["win", "lose"];

      const runRace = async () =>
        runCeqr017Phase2Orchestration({
          env: pinnedEnv(),
          receiptDir: dir,
          allowTestReceiptDir: true,
          claimExists: () => false,
          claimLiveRun: () => {
            claimAttempts += 1;
            const outcome = claimResults.shift() ?? "lose";
            if (outcome === "win") {
              writeFileSync(join(dir, "phase2-live-run-claim.json"), "{}\n");
              return {
                ok: true as const,
                claim: {
                  slice: CEQR_017_SLICE_ID,
                  campaignSlice: "CEQR-017" as const,
                  claimedAt: "2026-01-01T00:00:00.000Z",
                  purpose: "exactly_one_phase2_live_provider_run" as const,
                  providerId: "openai" as const,
                  adjudicatorModelId: "gpt-4o-mini" as const,
                  refereeModelId: "gpt-4o-mini" as const,
                  timeoutMs: 45000 as const,
                  maxTotalCalls: 8 as const,
                  maxRetries: 0 as const,
                  neverAutoDelete: true as const,
                },
                // Capability is opaque to tests; runLiveAfterClaim is injected.
                capability: { __ceqr017Phase2LiveRunCapability: true as const },
              };
            }
            return {
              ok: false as const,
              code: "claim_exists" as const,
              message: "claim_exists",
            };
          },
          runAccountGate: async ({ label, write }) => {
            const gate = matchingGateFixture(label);
            if (write) {
              if (label === "after") afterWrites += 1;
              writeCeqr017AccountGateResult({
                result: gate,
                receiptDir: dir,
                allowTestReceiptDir: true,
              });
            }
            return gate;
          },
          writeAccountGateResult: ({ result }) => {
            if (result.label === "before") beforeWrites += 1;
            writeCeqr017AccountGateResult({
              result,
              receiptDir: dir,
              allowTestReceiptDir: true,
            });
          },
          runLiveAfterClaim: async () => {
            liveInvocations += 1;
            return {
              ...buildCeqr017Phase1LiveExecutionReceipt(),
              phase: "phase2_live",
              classification: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
              underlyingLiveProof: executedProof({
                cases: [
                  caseReceipt({ caseId: "clear_contradiction_candidate" }),
                  caseReceipt({ caseId: "compatible_contextual" }),
                  caseReceipt({ caseId: "ambiguous_insufficient" }),
                ],
              }),
            };
          },
          writeFile: (path, contents) => {
            receiptWrites += 1;
            writeFileSync(path, contents);
          },
        });

      const [winner, loser] = await Promise.all([runRace(), runRace()]);
      expect(claimAttempts).toBe(2);
      expect(liveInvocations).toBe(1);
      expect(beforeWrites).toBe(1);
      expect(afterWrites).toBe(1);
      expect(receiptWrites).toBe(1);
      expect(winner.claimCreated).toBe(true);
      expect(loser.claimCreated).toBe(false);
      expect(loser.finalReceiptWritten).toBe(false);
      expect(loser.liveRunnerInvoked).toBe(false);

      // after-gate mismatch / throw still write once after finally
      rmSync(join(dir, "phase2-live-run-claim.json"), { force: true });
      const afterMismatch = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async ({ label, write }) => {
          const gate = {
            ...matchingGateFixture(label),
            matchesExpected: label === "before",
          };
          if (write) {
            writeCeqr017AccountGateResult({
              result: gate,
              receiptDir: dir,
              allowTestReceiptDir: true,
            });
          }
          return gate;
        },
        writeAccountGateResult: ({ result }) => {
          writeCeqr017AccountGateResult({
            result,
            receiptDir: dir,
            allowTestReceiptDir: true,
          });
        },
        runLiveAfterClaim: async () => ({
          ...buildCeqr017Phase1LiveExecutionReceipt(),
          phase: "phase2_live",
          classification: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
          underlyingLiveProof: executedProof({
            cases: [
              caseReceipt({ caseId: "clear_contradiction_candidate" }),
              caseReceipt({ caseId: "compatible_contextual" }),
              caseReceipt({ caseId: "ambiguous_insufficient" }),
            ],
          }),
        }),
        writeFile: (path, contents) => writeFileSync(path, contents),
      });
      expect(afterMismatch.exitCode).toBe(5);
      expect(afterMismatch.receipt.classification).toBe(
        "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH",
      );
      expect(afterMismatch.receipt.afterAccountGateExecuted).toBe(true);

      rmSync(join(dir, "phase2-live-run-claim.json"), { force: true });
      const threw = await runCeqr017Phase2Orchestration({
        env: pinnedEnv(),
        receiptDir: dir,
        allowTestReceiptDir: true,
        runAccountGate: async ({ label, write }) => {
          const gate = matchingGateFixture(label);
          if (write) {
            writeCeqr017AccountGateResult({
              result: gate,
              receiptDir: dir,
              allowTestReceiptDir: true,
            });
          }
          return gate;
        },
        writeAccountGateResult: ({ result }) => {
          writeCeqr017AccountGateResult({
            result,
            receiptDir: dir,
            allowTestReceiptDir: true,
          });
        },
        runLiveAfterClaim: async () => {
          throw new Error("live boom");
        },
        writeFile: (path, contents) => writeFileSync(path, contents),
      });
      expect(threw.exitCode).toBe(5);
      expect(threw.receipt.afterAccountGateExecuted).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("legacy CLI hard-stop never constructs a provider", () => {
    const message = buildCeqr017LegacyCliHardStopMessage();
    expect(message).toContain("run-ceqr017-phase2-orchestrator.ts");
    expect(message).toContain('CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID"');
    const legacy = readFileSync(
      join(
        process.cwd(),
        "scripts/run-contradiction-controlled-live-authority-reproof.ts",
      ),
      "utf8",
    );
    expect(legacy).not.toContain("runContradictionLiveProviderRefereeProof");
    expect(legacy).toContain("buildCeqr017LegacyCliHardStopMessage");
  });
});

describe("CEQR-017 historical CEQR-011…016 corpus integrity", () => {
  it("hashes full tracked corpus and proves account-gate writes stay in CEQR-017", async () => {
    const before = hashCeqr011To016ReceiptCorpus();
    expect(before.fileCount).toBeGreaterThan(50);
    const parent = mkdtempSync(join(tmpdir(), "ceqr017-hist-"));
    const dir = join(parent, CEQR_017_SLICE_ID);
    mkdirSync(dir, { recursive: true });
    try {
      await runCeqr017ReadonlyAccountGate({
        label: "before",
        reader: createMatchingFakeCeqr017AccountGateReader(),
        env: { CEQR_READONLY_ACCOUNT_USER_ID: "fake-account-for-tests-only" },
        receiptDir: dir,
        allowTestReceiptDir: true,
      });
      const after = hashCeqr011To016ReceiptCorpus();
      expect(after.aggregateSha256).toBe(before.aggregateSha256);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
