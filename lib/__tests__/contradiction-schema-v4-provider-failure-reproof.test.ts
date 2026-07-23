/**
 * Provider-failure classification + receipt sanitisation regression tests.
 *
 * Fake runners only. No live OpenAI adapter. No API credential required.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  CEQR_021_EXECUTION_LOCK_FILENAME,
  CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME,
  CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  CEQR_021_HISTORICAL,
  CEQR_021_LIVE_RECEIPT_FILENAME,
  CEQR_021_ONESHOT_CLAIM_FILENAME,
  CEQR_021_SLICE_ID,
  createEmptyCeqr021CallAccounting,
} from "../ceqr021-constants";
import {
  assertSanitizedReceiptHasNoLeaks,
  classifyCeqr021LiveResult,
  classifyLandedProviderOrSchemaGate,
  sanitizeCeqr021CaseObservationForReceipt,
  sanitizeCeqrProviderFailureMessage,
  type Ceqr021CaseObservation,
  type Ceqr021CatalogsByCaseId,
  type Ceqr021ClassifierInput,
} from "../ceqr021-live-pass-classifier";
import {
  sanitizeCeqr021LiveReceiptForCanonicalSerialization,
  type Ceqr021LiveExecutionReceipt,
} from "../ceqr021-live-orchestration";
import { buildAllFrozenScenarioCatalogs } from "../ceqr021-approved-evidence-spans";
import { runCeqr021OfflineDryRun } from "../ceqr021-offline-dry-run";
import { verifyCeqr021HistoricalImmutability } from "../contradiction-schema-v4-controlled-live-proof";

const REPO_ROOT = process.cwd();

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function catalogsByCaseId(): Ceqr021CatalogsByCaseId {
  return Object.fromEntries(
    buildAllFrozenScenarioCatalogs().map((c) => [c.caseId, c]),
  ) as Ceqr021CatalogsByCaseId;
}

function providerFailedObservation(
  caseId: Ceqr021CaseObservation["caseId"],
  expectedOutcome: Ceqr021CaseObservation["expectedOutcome"],
  overrides: Partial<Ceqr021CaseObservation> = {},
): Ceqr021CaseObservation {
  return {
    caseId,
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
    semanticConsistencyOk: false,
    validationCode: null,
    failingSide: null,
    earliestFailedGate: "model_execution_failed",
    latencyMs: 1,
    adjudicatorErrorCode: "model_execution_failed",
    adjudicatorErrorMessage:
      "Provider authentication failed; credential details redacted.",
    validationErrors: [],
    evidenceBindDiagnostics: null,
    ...overrides,
  };
}

function providerFailureClassifierInput(
  overrides: Partial<Ceqr021CaseObservation> = {},
): Ceqr021ClassifierInput {
  const accounting = createEmptyCeqr021CallAccounting();
  accounting.providerConstructionAttempted = 1;
  accounting.liveRunnerInvoked = 1;
  accounting.adjudicatorAttempts = 3;
  accounting.refereeAttempts = 0;
  accounting.totalProviderAttempts = 3;
  accounting.automaticRetries = 0;
  return {
    caseObservations: [
      providerFailedObservation(
        "clear_contradiction_candidate",
        "clear_contradiction",
        overrides,
      ),
      providerFailedObservation(
        "compatible_contextual",
        "compatible_non_clear",
        overrides,
      ),
      providerFailedObservation(
        "ambiguous_insufficient",
        "ambiguous_abstention",
        overrides,
      ),
    ],
    catalogsByCaseId: catalogsByCaseId(),
    accounting,
    frozenPlanHashMatched: true,
    scenarioAggregateHashMatched: true,
    schemaPromptAddendumMatched: true,
    oneShotConsumedExactlyOnce: true,
    canonicalPathOk: true,
    productionReady: false,
  };
}

describe("CEQR-021 provider-failure reporting repair", () => {
  it("A: provider_failed + transportParsedAsSchemaV4 false => FAIL_PROVIDER_OR_TRANSPORT", () => {
    const input = providerFailureClassifierInput({
      adjudicationOutcome: "provider_failed",
      transportParsedAsSchemaV4: false,
      adjudicatorErrorCode: null,
    });
    expect(classifyCeqr021LiveResult(input)).toBe("FAIL_PROVIDER_OR_TRANSPORT");
    for (const obs of input.caseObservations) {
      expect(classifyLandedProviderOrSchemaGate(obs)).toBe(
        "FAIL_PROVIDER_OR_TRANSPORT",
      );
    }
  });

  it("B: model_execution_failed + transportParsedAsSchemaV4 false => FAIL_PROVIDER_OR_TRANSPORT", () => {
    const input = providerFailureClassifierInput({
      adjudicationOutcome: "not_run",
      adjudicatorErrorCode: "model_execution_failed",
      transportParsedAsSchemaV4: false,
    });
    expect(classifyCeqr021LiveResult(input)).toBe("FAIL_PROVIDER_OR_TRANSPORT");
  });

  it("C: model_timeout + transportParsedAsSchemaV4 false => FAIL_PROVIDER_OR_TRANSPORT", () => {
    const input = providerFailureClassifierInput({
      adjudicationOutcome: "not_run",
      adjudicatorErrorCode: "model_timeout",
      transportParsedAsSchemaV4: false,
    });
    expect(classifyCeqr021LiveResult(input)).toBe("FAIL_PROVIDER_OR_TRANSPORT");
  });

  it("D: schema_parse_failed => FAIL_SCHEMA_V4_PARSE", () => {
    const dry = runCeqr021OfflineDryRun();
    const input: Ceqr021ClassifierInput = {
      caseObservations: dry.caseObservations.map((o) => ({ ...o })),
      catalogsByCaseId: catalogsByCaseId(),
      accounting: { ...dry.accounting },
      frozenPlanHashMatched: true,
      scenarioAggregateHashMatched: true,
      schemaPromptAddendumMatched: true,
      oneShotConsumedExactlyOnce: true,
      canonicalPathOk: true,
      productionReady: false,
    };
    const clear = input.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    clear.adjudicationOutcome = "validation_failed";
    clear.adjudicatorErrorCode = "schema_parse_failed";
    clear.validationCode = "schema_parse_failed";
    clear.transportParsedAsSchemaV4 = false;
    expect(classifyLandedProviderOrSchemaGate(clear)).toBe(
      "FAIL_SCHEMA_V4_PARSE",
    );
    expect(classifyCeqr021LiveResult(input)).toBe("FAIL_SCHEMA_V4_PARSE");
  });

  it("D2: provider success then schema parse failure => FAIL_SCHEMA_V4_PARSE", () => {
    const dry = runCeqr021OfflineDryRun();
    const clear = dry.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    const obs: Ceqr021CaseObservation = {
      ...clear,
      adjudicationOutcome: "semantic_accepted",
      adjudicatorErrorCode: "schema_parse_failed",
      validationCode: "schema_parse_failed",
      transportParsedAsSchemaV4: false,
      earliestFailedGate: "schema_v4_parse",
    };
    expect(classifyLandedProviderOrSchemaGate(obs)).toBe(
      "FAIL_SCHEMA_V4_PARSE",
    );
    expect(classifyLandedProviderOrSchemaGate(obs)).not.toBe(
      "FAIL_PROVIDER_OR_TRANSPORT",
    );
  });

  it("E: masked project-key fingerprint is rejected by receipt sanitization", () => {
    const masked = JSON.stringify({
      error: "Incorrect API key provided: sk-proj-*****...AB12",
    });
    const result = assertSanitizedReceiptHasNoLeaks(masked);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.leaks).toContain("masked_api_key_fingerprint");
    }
    expect(
      assertSanitizedReceiptHasNoLeaks(
        JSON.stringify({ key: "sk-abcdefghijklmnopqrstuvwxyz012345" }),
      ).ok,
    ).toBe(false);
    expect(
      assertSanitizedReceiptHasNoLeaks(
        JSON.stringify({ key: "sk-proj-abcdefghijklmnopqrstuvwxyz012345" }),
      ).ok,
    ).toBe(false);
    expect(
      assertSanitizedReceiptHasNoLeaks(
        JSON.stringify({ auth: "Bearer abcdefghijklmnop" }),
      ).ok,
    ).toBe(false);
    expect(
      assertSanitizedReceiptHasNoLeaks("OPENAI_API_KEY=secret-value").ok,
    ).toBe(false);
  });

  it("F: sanitized provider failure receipt passes sanitization", () => {
    const obs = sanitizeCeqr021CaseObservationForReceipt(
      providerFailedObservation(
        "clear_contradiction_candidate",
        "clear_contradiction",
        {
          adjudicatorErrorMessage:
            "401 Incorrect API key provided: sk-proj-*****...ZZ99. You can find your API key at https://platform.openai.com/account/api-keys.",
        },
      ),
    );
    expect(obs.adjudicatorErrorMessage).toBe(
      "Provider authentication failed; credential details redacted.",
    );
    expect(
      sanitizeCeqrProviderFailureMessage({
        errorCode: "model_execution_failed",
        rawMessage: "upstream timeout",
      }),
    ).toBe("Provider model execution failed; provider details redacted.");

    const receipt: Ceqr021LiveExecutionReceipt = {
      slice: CEQR_021_SLICE_ID,
      frozenPlanSha256: "a".repeat(64),
      consumedClaimIdentity: {
        armingState: "consumed",
        frozenPlanSha256: "a".repeat(64),
        committedExecutionHead: "b".repeat(40),
        consumedAt: "2026-07-23T00:00:00.000Z",
      },
      committedHead: "b".repeat(40),
      classification: "FAIL_PROVIDER_OR_TRANSPORT",
      accounting: {
        ...createEmptyCeqr021CallAccounting(),
        providerConstructionAttempted: 1,
        liveRunnerInvoked: 1,
        adjudicatorAttempts: 3,
        totalProviderAttempts: 3,
      },
      caseObservations: [
        obs,
        sanitizeCeqr021CaseObservationForReceipt(
          providerFailedObservation(
            "compatible_contextual",
            "compatible_non_clear",
          ),
        ),
        sanitizeCeqr021CaseObservationForReceipt(
          providerFailedObservation(
            "ambiguous_insufficient",
            "ambiguous_abstention",
          ),
        ),
      ],
      diagnostics: [],
      productionReady: false,
      liveProviderAttempts: 3,
      notes: ["Writer/persistence remain blocked.", "production readiness: NO"],
    };
    const sanitized = sanitizeCeqr021LiveReceiptForCanonicalSerialization(
      receipt,
    );
    const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;
    expect(assertSanitizedReceiptHasNoLeaks(serialized).ok).toBe(true);
  });

  it("G: CEQR-021 archived execution artifacts remain byte-identical to staging", () => {
    const dir = join(
      REPO_ROOT,
      "docs/agent-runs/receipts",
      CEQR_021_SLICE_ID,
    );
    const expected: Array<[string, string]> = [
      [
        CEQR_021_LIVE_RECEIPT_FILENAME,
        CEQR_021_HISTORICAL.ceqr021LiveExecutionReceiptSha256,
      ],
      [
        CEQR_021_ONESHOT_CLAIM_FILENAME,
        CEQR_021_HISTORICAL.ceqr021OneshotClaimSha256,
      ],
      [
        CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
        CEQR_021_HISTORICAL.ceqr021FinalFrozenLivePlanSha256,
      ],
      [
        "15-invalid-credential-live-result.md",
        CEQR_021_HISTORICAL.ceqr021InvalidCredentialResultMdSha256,
      ],
      [
        CEQR_021_EXECUTION_LOCK_FILENAME,
        CEQR_021_HISTORICAL.ceqr021ExecutionLockSha256,
      ],
      [
        CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME,
        CEQR_021_HISTORICAL.ceqr021ExecutionLockProgressSha256,
      ],
    ];
    for (const [name, pin] of expected) {
      const path = join(dir, name);
      expect(existsSync(path)).toBe(true);
      expect(sha256File(path)).toBe(pin);
    }
    const historical = verifyCeqr021HistoricalImmutability(REPO_ROOT);
    expect(historical.ok).toBe(true);
  });
});
