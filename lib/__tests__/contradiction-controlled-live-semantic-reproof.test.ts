/**
 * CEQR-019 — offline contract + adversarial classification tests.
 * Injected runners / synthetic harness only. No live provider. No real DB.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { runControlledContradictionNaturalEntryProof } from "../contradiction-controlled-natural-entry-proof";
import {
  CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV,
  CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE,
  CEQR_017_LIVE_RECEIPT_SHA256,
  CEQR_017_PERMANENT_CLAIM_SHA256,
  CEQR_019_CAMPAIGN_SLICE,
  CEQR_019_CANONICAL_RECEIPT_DIR,
  CEQR_019_CASES_AGGREGATE_SHA256,
  CEQR_019_CASE_SHA256,
  CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_019_EXPECTED_MAX_RETRIES,
  CEQR_019_EXPECTED_SCHEMA_VERSION,
  CEQR_019_FROZEN_LIVE_PLAN_BYTES,
  CEQR_019_FROZEN_LIVE_PLAN_SHA256,
  CEQR_019_FROZEN_PLAN_FILENAME,
  CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES,
  CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256,
  CEQR_019_LIVE_ONESHOT_CLAIM_BYTES,
  CEQR_019_LIVE_ONESHOT_CLAIM_SHA256,
  CEQR_019_LIVE_PROVIDER_ATTEMPTS,
  CEQR_019_LIVE_RECEIPT_FILENAME,
  CEQR_019_LIVE_RESULT_CLASSIFICATION,
  CEQR_019_LIVE_RUN_CLAIM_FILENAME,
  CEQR_019_PERMANENT_CLAIM_BYTES,
  CEQR_019_PERMANENT_CLAIM_FILENAME,
  CEQR_019_PERMANENT_CLAIM_SHA256,
  CEQR_019_SLICE_ID,
  CEQR_019_SYNTHETIC_CASES,
  CEQR_019_WORKTREE_PATH,
  assertCeqr019FrozenCaseHashes,
  assertCeqr019LandedConstants,
  assertCeqr019LiveGuards,
  assertCeqr019ProductionLivePaths,
  buildCeqr019FrozenLivePlan,
  buildCeqr019PermanentClaim,
  buildCeqr019PreLiveReceipt,
  buildCeqr019ProposedLiveCommand,
  ceqr017CanonicalReceiptPaths,
  ceqr018ReceiptDir,
  ceqr019ReceiptDir,
  classifyCeqr019LiveResult,
  createCeqr019TestOrchestrationCapability,
  createEmptyCeqr019BoundaryCounters,
  hashCeqr019SyntheticCases,
  hashReceiptDirectory,
  isCeqr019LiveAuthorized,
  proveCeqr019MissingGuardZeroProviderCalls,
  runCeqr019ControlledLiveSemanticReproof,
  runCeqr019ControlledLiveSemanticReproofForTests,
  serializeCeqr019FrozenLivePlan,
  sha256File,
  verifyCeqr017CanonicalHashes,
  type Ceqr019CaseObservation,
} from "../contradiction-controlled-live-semantic-reproof";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  createLiveCallBudget,
  type ContradictionLiveAdapterBundle,
} from "../contradiction-live-provider-adapters";
import type { ContradictionRepairedPersistenceDb } from "../contradiction-repaired-persistence";
import {
  createLiveProofInMemoryHarness,
  LIVE_PROOF_USER_ID,
  LIVE_SYNTHETIC_CASES,
  type LiveProofResult,
} from "../contradiction-live-provider-referee-proof";
import {
  validateLexicalBoundaryIntegrity,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import { CONTRADICTION_ADJUDICATION_SCHEMA_VERSION } from "../orvek-intelligence-kernel/contracts";

import {
  transportSelectionForFullSource,
} from "./helpers/ceqr020-transport-selection";

const FIXED_NOW = () => new Date("2026-07-23T10:00:00.000Z");

const CEQR018_EXPECTED_FILE_HASHES: Record<string, string> = {
  "00-intake-and-boundaries.md":
    "508d8bb643aef70d39209535aa18c0804ca4c9e1c4ced2d284caf944d1fdb6c5",
  "01-ceqr017-failure-baseline.md":
    "008d3225cf32feacbc92cb86a3930bf0c67b6f6319c2fa742484c2a404f68ac9",
  "02-transport-schema-audit.md":
    "079526e30ac2fdabb8c98505beb55b1526f8df2f87cb7c98c64d2d54d18f86d3",
  "03-selected-repair-architecture.md":
    "815636f022494b2b394fbff2ec2721e17a8dfaf9b6693c41a8a7bec23d238616",
  "04-semantic-consistency-contract.md":
    "ae5a0a54b01d0f0f8bcf900fb0c0d227b660bc24f5681df4a388dfce5269dc32",
  "05-evidence-span-boundary-contract.md":
    "8fa880f59f8b799078a99e148432e1baf8bc84d8629a15598497ad39bdd62225",
  "06-source-authority-preservation.md":
    "c35f9948c72349f0f22edfc97f83837051b3979e77abd578cf32bb84b0610755",
  "07-adversarial-test-matrix.md":
    "3b97852827ff941c9882dcb24e3cc9bc0a0897f271f8797c65b0ec8ba6ddcaaf",
  "08-tests-and-validation.md":
    "b2ceddc5da1f6744434aea217dfe35c1e058475c91710a57a99b790d8d1a391c",
  "09-changed-files-list.md":
    "97f6cc5e221f1d88dcee8b2e1e1a946efe94ad203480c084d4ad3c248d5c7b13",
  "10-result-and-limitations.md":
    "32b7767a015e3a4155912d2489b4c2d486494e11bc78f174d6aa47b6616fa8cc",
  "11-next-live-proof-boundary.md":
    "1c0b78c4ca9a4616d161cfa65a8e6371c16f0f476b434c89de81db448c54e518",
  "changed-files.txt":
    "1e6609be05e2b1a0bfcba0ceff4042bb13a5150f0b86d9cda82b865ad5c7d6b5",
  "validation-summary.json":
    "3ea81458caf1e35eba6f88168493a6f5850967013882fe2f0ac41c4da4c869e6",
};

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function fakeClearTransport(sideAText: string, sideBText: string) {
  return {
    propositionA: {
      normalizedProposition: "A",
      actor: "speaker",
      subject: "topic",
      timeframe: "general",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "B",
      actor: "speaker",
      subject: "topic",
      timeframe: "general",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.92,
    evidenceClaimA: transportSelectionForFullSource(sideAText),
    evidenceClaimB: transportSelectionForFullSource(sideBText),
    rationale: "Opposed under matching scope.",
    alternativeInterpretation: "none",
    whatWouldChangeClassification: "qualifier change",
    abstentionReason: null,
    proposedObjectType: null,
  };
}

function fakeRunner(object: unknown): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: true as const,
        object,
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
}

function evidenceOk(
  text: string,
  sourceId: string,
): NonNullable<Ceqr019CaseObservation["evidenceA"]> {
  return {
    sourceId,
    startOffset: 0,
    endOffset: text.length,
    exactQuote: text,
    authoritativeSlice: text,
    exactQuoteMatchesAuthoritativeSlice: true,
    lexicalBoundaryOk: true,
    sourceIdCodeOwned: true,
  };
}

function baseObs(
  caseId: Ceqr019CaseObservation["caseId"],
  overrides: Partial<Ceqr019CaseObservation> = {},
): Ceqr019CaseObservation {
  const synthetic = CEQR_019_SYNTHETIC_CASES.find((c) => c.id === caseId)!;
  return {
    caseId,
    caseStatus: "no_write",
    proofOutcome: "no_candidate",
    attemptedAdjudicationCount: 1,
    adjudicationOutcome: "semantic_accepted",
    deterministicValidationStatus: "valid",
    validationErrors: [],
    semanticClassification:
      caseId === "clear_contradiction_candidate"
        ? "clear_contradiction"
        : caseId === "compatible_contextual"
          ? "compatible_states"
          : "insufficient_or_misaligned_context",
    bothCanSimultaneouslyBeTrue:
      caseId === "clear_contradiction_candidate" ? false : true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    evidenceA: evidenceOk(synthetic.sideAText, `reference:live-ref-${caseId}`),
    evidenceB: evidenceOk(synthetic.sideBText, `message:live-msg-b-${caseId}`),
    refereeCallCount: caseId === "clear_contradiction_candidate" ? 1 : 0,
    writerInvoked: false,
    writeExecuted: false,
    contradictionNodeId: null,
    clearContradictionWriteProven:
      caseId === "clear_contradiction_candidate" ? false : null,
    ...overrides,
  };
}

function passingClearObs(): Ceqr019CaseObservation {
  return baseObs("clear_contradiction_candidate", {
    caseStatus: "created",
    proofOutcome: "created",
    writerInvoked: true,
    writeExecuted: true,
    contradictionNodeId: "node-clear-1",
    clearContradictionWriteProven: true,
    bothCanSimultaneouslyBeTrue: false,
  });
}

function passingCompatibleObs(): Ceqr019CaseObservation {
  return baseObs("compatible_contextual", {
    semanticClassification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    refereeCallCount: 0,
  });
}

function passingAmbiguousObs(): Ceqr019CaseObservation {
  return baseObs("ambiguous_insufficient", {
    adjudicationOutcome: "abstained",
    semanticClassification: null,
    abstentionReason: "insufficient context",
    bothCanSimultaneouslyBeTrue: null,
    evidenceA: null,
    evidenceB: null,
    refereeCallCount: 0,
  });
}

function executedProof(
  overrides: Partial<LiveProofResult & { ran: true }> = {},
): LiveProofResult {
  return {
    ran: true,
    proofVersion: "contradiction-live-provider-referee-proof-v1",
    providerId: "openai",
    adjudicatorModelId: "gpt-4o-mini",
    refereeModelId: "gpt-4o-mini",
    independenceLevel: "separate_call_same_provider_same_model",
    maxRetries: 0,
    timeoutMs: 45000,
    providerAttemptCountExact: true,
    adjudicatorPromptAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    adjudicatorCallCount: 3,
    refereeCallCount: 1,
    totalCallCount: 4,
    maxTotalCalls: 6,
    cases: [],
    clearContradictionWriteProven: true,
    compatibleCaseNoWrite: true,
    ambiguousCaseNoWrite: true,
    unsafeMutationDetected: false,
    evidenceOutputMutated: false,
    realAccountMutated: false,
    productionIngestionWired: false,
    isolatedDatabasePersistenceProven: false,
    productionReady: false,
    classificationHint: "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN",
    ...overrides,
  } as LiveProofResult;
}

function pinnedEnv(
  extra: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    [CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]: "YES",
    [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
    CONTRADICTION_LIVE_ADJUDICATOR_MODEL: "gpt-4o-mini",
    CONTRADICTION_LIVE_REFEREE_MODEL: "gpt-4o-mini",
    CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS: "45000",
    CONTRADICTION_LIVE_MAX_TOTAL_CALLS: "6",
    OPENAI_API_KEY: "sk-test-not-real",
    ...extra,
  };
}

function makeTempReceiptDir(): string {
  const parent = mkdtempSync(join(tmpdir(), "ceqr019-"));
  const dir = join(parent, CEQR_019_SLICE_ID);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("CEQR-019 identities and frozen cases", () => {
  it("pins schema-v3 and campaign identity", () => {
    expect(CEQR_019_SLICE_ID).toBe(
      "CONTRADICTION-LIVE-SEMANTIC-REPROOF-001",
    );
    expect(CEQR_019_CAMPAIGN_SLICE).toBe("CEQR-019");
    expect(CEQR_019_EXPECTED_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v3",
    );
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v4",
    );
    expect(CEQR_019_EXPECTED_SCHEMA_VERSION).not.toBe(
      CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
    );
    expect(CEQR_019_EXPECTED_MAX_RETRIES).toBe(0);
    expect(CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS).toBe(6);
    expect(CEQR_019_CANONICAL_RECEIPT_DIR).toContain(CEQR_019_WORKTREE_PATH);
    expect(assertCeqr019LandedConstants()).toEqual({ ok: true });
  });

  it("freezes synthetic case hashes identical to LIVE_SYNTHETIC_CASES", () => {
    expect(CEQR_019_SYNTHETIC_CASES).toEqual(LIVE_SYNTHETIC_CASES);
    const hashed = hashCeqr019SyntheticCases();
    expect(hashed.byId).toEqual(CEQR_019_CASE_SHA256);
    expect(hashed.aggregateSha256).toBe(CEQR_019_CASES_AGGREGATE_SHA256);
    expect(assertCeqr019FrozenCaseHashes()).toEqual({ ok: true });
  });

  it("frozen plan serialises provider budget, guards, and historical paths", () => {
    const plan = buildCeqr019FrozenLivePlan();
    expect(plan.maximumProviderCallBudget).toBe(6);
    expect(plan.retryCount).toBe(0);
    expect(plan.schemaVersion).toBe("contradiction-adjudication-schema-v3");
    expect(serializeCeqr019FrozenLivePlan(plan)).toContain(
      CEQR_019_CASE_SHA256.clear_contradiction_candidate,
    );
  });
});

describe("CEQR-019 authorisation guards", () => {
  it("requires exact YES for CEQR-019 guard", () => {
    expect(isCeqr019LiveAuthorized({})).toBe(false);
    expect(
      isCeqr019LiveAuthorized({
        [CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]: "yes",
      }),
    ).toBe(false);
    expect(
      isCeqr019LiveAuthorized({
        [CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]:
          CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE,
      }),
    ).toBe(true);
  });

  it("dual guard: missing either fails before provider path", () => {
    expect(
      assertCeqr019LiveGuards({
        [CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]: "YES",
      }).ok,
    ).toBe(false);
    expect(
      assertCeqr019LiveGuards({
        [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
      }).ok,
    ).toBe(false);
    expect(
      assertCeqr019LiveGuards({
        [CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]: "YES",
        [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
      }),
    ).toEqual({ ok: true });
  });

  it("missing live authorisation causes zero provider calls", async () => {
    expect(process.env[CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]).toBeFalsy();
    const missingCeqr019 = await proveCeqr019MissingGuardZeroProviderCalls({
      [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
      CONTRADICTION_LIVE_ADJUDICATOR_MODEL: "gpt-4o-mini",
      CONTRADICTION_LIVE_REFEREE_MODEL: "gpt-4o-mini",
      CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS: "45000",
      CONTRADICTION_LIVE_MAX_TOTAL_CALLS: "6",
    });
    expect(missingCeqr019.ok).toBe(true);
    expect(missingCeqr019.providerCalls).toBe(0);
  });
});

describe("CEQR-019 permanent claim and pre-live receipt", () => {
  it("permanent claim states HOLD and historical separation", () => {
    const claim = buildCeqr019PermanentClaim();
    expect(claim.status).toBe("HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED");
    expect(claim.statements.offlinePreparationIsNotLiveProof).toBe(true);
    expect(claim.productionReady).toBe(false);
  });

  it("pre-live receipt records zero live activity", () => {
    const receipt = buildCeqr019PreLiveReceipt();
    expect(receipt.liveProviderAttempts).toBe(0);
    expect(receipt.liveProofObtained).toBe(false);
  });

  it("proposed live command is dual-guard and not CEQR-017", () => {
    const cmd = buildCeqr019ProposedLiveCommand();
    expect(cmd).toContain("CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED=YES");
    expect(cmd).toContain(
      "scripts/run-contradiction-controlled-live-semantic-reproof.ts",
    );
    expect(cmd).not.toContain("run-ceqr017-phase2-orchestrator");
  });
});

describe("CEQR-019 historical integrity", () => {
  it("asserts exact CEQR-017 canonical hashes", () => {
    const verified = verifyCeqr017CanonicalHashes();
    expect(verified.ok).toBe(true);
    expect(verified.liveReceiptSha256).toBe(CEQR_017_LIVE_RECEIPT_SHA256);
    expect(verified.permanentClaimSha256).toBe(CEQR_017_PERMANENT_CLAIM_SHA256);
    const paths = ceqr017CanonicalReceiptPaths();
    expect(sha256File(paths.liveReceipt)).toBe(CEQR_017_LIVE_RECEIPT_SHA256);
  });

  it("proves CEQR-018 receipts are unchanged", () => {
    const dir = ceqr018ReceiptDir();
    for (const [rel, expected] of Object.entries(CEQR018_EXPECTED_FILE_HASHES)) {
      expect(sha256File(join(dir, rel))).toBe(expected);
    }
    expect(hashReceiptDirectory(dir).fileCount).toBe(
      Object.keys(CEQR018_EXPECTED_FILE_HASHES).length,
    );
  });
});

describe("CEQR-019 source authority and write isolation", () => {
  it("synthetic harness uses isolated user id", () => {
    const harness = createLiveProofInMemoryHarness();
    expect(harness.userId).toBe(LIVE_PROOF_USER_ID);
    expect(createEmptyCeqr019BoundaryCounters().realDatabaseCalls).toBe(0);
  });

  it("rejects observed morni truncation at lexical boundary", () => {
    const text = "I drink coffee in the morning.";
    expect(text.slice(0, 27)).toBe("I drink coffee in the morni");
    expect(validateLexicalBoundaryIntegrity(text, 0, 27).ok).toBe(false);
  });

  it("invalid truncated clear output cannot reach referee/writer/persistence", async () => {
    const clearCase = CEQR_019_SYNTHETIC_CASES[0]!;
    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(clearCase);
    const mutationCounters = {
      transactionCalls: 0,
      evidenceSpanCreateCalls: 0,
      contradictionNodeCreateCalls: 0,
    };
    const countingDb: ContradictionRepairedPersistenceDb = {
      message: {
        findUnique: async (args) => harness.db.message.findUnique(args),
      },
      evidenceSpan: {
        findUnique: async (args) => harness.db.evidenceSpan.findUnique(args),
        create: async (args) => {
          mutationCounters.evidenceSpanCreateCalls += 1;
          return harness.db.evidenceSpan.create(args);
        },
      },
      contradictionNode: {
        findFirst: async (args) => harness.db.contradictionNode.findFirst(args),
        create: async (args) => {
          mutationCounters.contradictionNodeCreateCalls += 1;
          return harness.db.contradictionNode.create(args);
        },
      },
      $transaction: async (fn) => {
        mutationCounters.transactionCalls += 1;
        return harness.db.$transaction(fn);
      },
    };
    let refereeCalls = 0;
    const incompatibleClear = fakeClearTransport(
      clearCase.sideAText,
      clearCase.sideBText,
    );
    Object.assign(incompatibleClear, {
      evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 999 },
    });
    const result = await runControlledContradictionNaturalEntryProof({
      userId: harness.userId,
      sessionId: harness.sessionId,
      currentMessage: seeded.currentMessage,
      references: seeded.references,
      modelRunner: fakeRunner(incompatibleClear),
      objectivityReferee: {
        async evaluate() {
          refereeCalls += 1;
          return { outcome: "PASS", rationale: "must not run" };
        },
      },
      messageResolver: harness.messageResolver,
      persistenceDb: countingDb,
      now: FIXED_NOW,
    });
    expect(result.writerInvoked).toBe(false);
    expect(result.writeExecuted).toBe(false);
    expect(refereeCalls).toBe(0);
    expect(mutationCounters.transactionCalls).toBe(0);
  });

  it("clear_contradiction with changedBeliefOverTime cannot cause a write", async () => {
    const clearCase = CEQR_019_SYNTHETIC_CASES[0]!;
    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(clearCase);
    let writerReached = false;
    const countingDb: ContradictionRepairedPersistenceDb = {
      message: {
        findUnique: async (args) => harness.db.message.findUnique(args),
      },
      evidenceSpan: {
        findUnique: async (args) => harness.db.evidenceSpan.findUnique(args),
        create: async (args) => {
          writerReached = true;
          return harness.db.evidenceSpan.create(args);
        },
      },
      contradictionNode: {
        findFirst: async (args) => harness.db.contradictionNode.findFirst(args),
        create: async (args) => {
          writerReached = true;
          return harness.db.contradictionNode.create(args);
        },
      },
      $transaction: async (fn) => harness.db.$transaction(fn),
    };
    const bad = fakeClearTransport(clearCase.sideAText, clearCase.sideBText);
    Object.assign(bad, { changedBeliefOverTime: true });
    const result = await runControlledContradictionNaturalEntryProof({
      userId: harness.userId,
      sessionId: harness.sessionId,
      currentMessage: seeded.currentMessage,
      references: seeded.references,
      modelRunner: fakeRunner(bad),
      objectivityReferee: {
        async evaluate() {
          return { outcome: "PASS", rationale: "must not run" };
        },
      },
      messageResolver: harness.messageResolver,
      persistenceDb: countingDb,
      now: FIXED_NOW,
    });
    expect(result.writerInvoked).toBe(false);
    expect(writerReached).toBe(false);
  });
});

describe("CEQR-019 strict PASS classification (Blocker 1)", () => {
  it("1. clear no_write + clearContradictionWriteProven false ⇒ HOLD, never PASS", () => {
    const classification = classifyCeqr019LiveResult({
      result: executedProof({
        clearContradictionWriteProven: false,
        classificationHint: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      }),
      caseObservations: [
        baseObs("clear_contradiction_candidate", {
          caseStatus: "no_write",
          proofOutcome: "no_candidate",
          clearContradictionWriteProven: false,
          writeExecuted: false,
          writerInvoked: false,
          contradictionNodeId: null,
        }),
        passingCompatibleObs(),
        passingAmbiguousObs(),
      ],
    });
    expect(classification).toBe("HOLD_PROVIDER_RESULT_INCONCLUSIVE");
    expect(classification).not.toBe("PASS_LIVE_SEMANTIC_REPROOF");
  });

  it("2. clear case missing attempted adjudication ⇒ HOLD", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({ clearContradictionWriteProven: false }),
        caseObservations: [
          baseObs("clear_contradiction_candidate", {
            attemptedAdjudicationCount: 0,
            adjudicationOutcome: null,
            deterministicValidationStatus: "not_reached",
            semanticClassification: null,
            evidenceA: null,
            evidenceB: null,
            clearContradictionWriteProven: false,
          }),
          passingCompatibleObs(),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("HOLD_PROVIDER_RESULT_INCONCLUSIVE");
  });

  it("3. clear case validation failed ⇒ HOLD_PROVIDER_OUTPUT_INVALID", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({ clearContradictionWriteProven: false }),
        caseObservations: [
          baseObs("clear_contradiction_candidate", {
            adjudicationOutcome: "validation_failed",
            deterministicValidationStatus: "invalid",
            validationErrors: ["internal_inconsistency"],
            clearContradictionWriteProven: false,
            writeExecuted: false,
            contradictionNodeId: null,
          }),
          passingCompatibleObs(),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("HOLD_PROVIDER_OUTPUT_INVALID");
  });

  it("4. clear case invalid/truncated span ⇒ FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN", () => {
    const clear = passingClearObs();
    clear.evidenceB = {
      ...clear.evidenceB!,
      endOffset: 27,
      exactQuote: "I drink coffee in the morni",
      authoritativeSlice: "I drink coffee in the morni",
      exactQuoteMatchesAuthoritativeSlice: true,
      lexicalBoundaryOk: false,
    };
    // Use clear text that isn't morning — force lexical fail via errors too
    clear.validationErrors = ["lexical_boundary_integrity: mid-word truncation"];
    clear.deterministicValidationStatus = "invalid";
    clear.clearContradictionWriteProven = false;
    clear.writeExecuted = false;
    clear.contradictionNodeId = null;
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({ clearContradictionWriteProven: false }),
        caseObservations: [
          clear,
          passingCompatibleObs(),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN");
  });

  it("5. compatible classified clear but no write ⇒ FAIL_FALSE_CLEAR_CONTRADICTION", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({
          clearContradictionWriteProven: true,
          compatibleCaseNoWrite: true,
        }),
        caseObservations: [
          passingClearObs(),
          baseObs("compatible_contextual", {
            semanticClassification: "clear_contradiction",
            bothCanSimultaneouslyBeTrue: false,
            writeExecuted: false,
            writerInvoked: false,
            contradictionNodeId: null,
            refereeCallCount: 1,
          }),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("FAIL_FALSE_CLEAR_CONTRADICTION");
  });

  it("6. ambiguous classified clear but no write ⇒ FAIL_FALSE_CLEAR_CONTRADICTION", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({ clearContradictionWriteProven: true }),
        caseObservations: [
          passingClearObs(),
          passingCompatibleObs(),
          baseObs("ambiguous_insufficient", {
            semanticClassification: "clear_contradiction",
            bothCanSimultaneouslyBeTrue: false,
            writeExecuted: false,
            writerInvoked: false,
            contradictionNodeId: null,
          }),
        ],
      }),
    ).toBe("FAIL_FALSE_CLEAR_CONTRADICTION");
  });

  it("7. compatible invalid lexical span ⇒ FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN", () => {
    const compatible = passingCompatibleObs();
    compatible.evidenceB = {
      ...compatible.evidenceB!,
      lexicalBoundaryOk: false,
      exactQuote: "I drink coffee in the morni",
      exactQuoteMatchesAuthoritativeSlice: false,
    };
    expect(
      classifyCeqr019LiveResult({
        result: executedProof(),
        caseObservations: [
          passingClearObs(),
          compatible,
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN");
  });

  it("8. exact three-case successful semantic matrix ⇒ PASS_LIVE_SEMANTIC_REPROOF", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({
          clearContradictionWriteProven: true,
          compatibleCaseNoWrite: true,
          ambiguousCaseNoWrite: true,
        }),
        caseObservations: [
          passingClearObs(),
          passingCompatibleObs(),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("PASS_LIVE_SEMANTIC_REPROOF");
  });

  it("9. underlying HOLD classification cannot upgrade to PASS without complete observations", () => {
    expect(
      classifyCeqr019LiveResult({
        result: executedProof({
          clearContradictionWriteProven: false,
          classificationHint: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
        }),
        caseObservations: [
          baseObs("clear_contradiction_candidate", {
            caseStatus: "no_write",
            clearContradictionWriteProven: false,
            writeExecuted: false,
            contradictionNodeId: null,
          }),
          passingCompatibleObs(),
          passingAmbiguousObs(),
        ],
      }),
    ).toBe("HOLD_PROVIDER_RESULT_INCONCLUSIVE");
  });
});

describe("CEQR-019 canonical receipt lock (Blocker 2)", () => {
  it("production path rejects alternate cwd before provider construction", () => {
    const gate = assertCeqr019ProductionLivePaths({
      cwd: "/tmp/not-the-ceqr019-worktree",
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("cwd_mismatch");
  });

  it("production live entry does not accept receiptDir and locks canonical dir", async () => {
    const script = readFileSync(
      join(process.cwd(), "scripts/run-contradiction-controlled-live-semantic-reproof.ts"),
      "utf8",
    );
    expect(script).toContain("runCeqr019ControlledLiveSemanticReproof");
    expect(script).not.toContain("runCeqr019ControlledLiveSemanticReproofForTests");
    expect(script).toContain("assertCeqr019ProductionLivePaths");

    // When cwd matches worktree, path gate succeeds with canonical dir.
    if (process.cwd() === CEQR_019_WORKTREE_PATH) {
      const gate = assertCeqr019ProductionLivePaths();
      expect(gate.ok).toBe(true);
      if (gate.ok) expect(gate.receiptDir).toBe(CEQR_019_CANONICAL_RECEIPT_DIR);
    }
  });

  it("alternate receipt directory via test helper wrong basename is rejected with zero calls", async () => {
    const parent = mkdtempSync(join(tmpdir(), "ceqr019-bad-"));
    const badDir = join(parent, "NOT-CEQR-019");
    mkdirSync(badDir, { recursive: true });
    let liveCalls = 0;
    try {
      const result = await runCeqr019ControlledLiveSemanticReproofForTests({
        capability: createCeqr019TestOrchestrationCapability(),
        env: pinnedEnv(),
        receiptDir: badDir,
        writeReceipts: false,
        runLiveProof: async () => {
          liveCalls += 1;
          throw new Error("must not run");
        },
      });
      expect(liveCalls).toBe(0);
      expect(result.providerCalls).toBe(0);
      expect(result.providerConstructionAttempted).toBe(false);
      if ("classification" in result.receipt) {
        expect(result.receipt.classification).toBe(
          "FAIL_UNSAFE_LIVE_EXECUTION_PATH",
        );
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("canonical existing claim blocks execution; changing receiptDir cannot bypass", async () => {
    const dir = makeTempReceiptDir();
    const parent = join(dir, "..");
    try {
      writeFileSync(join(dir, CEQR_019_LIVE_RUN_CLAIM_FILENAME), "{}\n");
      let liveCalls = 0;
      const blocked = await runCeqr019ControlledLiveSemanticReproofForTests({
        capability: createCeqr019TestOrchestrationCapability(),
        env: pinnedEnv(),
        receiptDir: dir,
        writeReceipts: false,
        runLiveProof: async () => {
          liveCalls += 1;
          throw new Error("must not run");
        },
      });
      expect(liveCalls).toBe(0);
      expect(blocked.providerCalls).toBe(0);
      expect(blocked.liveRunnerInvoked).toBe(false);

      // Alternate directory does not bypass the canonical production claim path:
      // production entry ignores receiptDir and still checks canonical claim.
      const canonicalClaim = join(
        CEQR_019_CANONICAL_RECEIPT_DIR,
        CEQR_019_LIVE_RUN_CLAIM_FILENAME,
      );
      expect(canonicalClaim).toContain(CEQR_019_SLICE_ID);
      // Alternate test dir with claim does not affect production path lock.
      const prod = await runCeqr019ControlledLiveSemanticReproof({
        env: {},
        writeReceipts: false,
      });
      expect(prod.providerCalls).toBe(0);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("test orchestration requires capability and injected fake runner", async () => {
    const dir = makeTempReceiptDir();
    const parent = join(dir, "..");
    try {
      await expect(
        runCeqr019ControlledLiveSemanticReproofForTests({
          capability: {
            __ceqr019TestOnlyOrchestration: true,
          },
          env: pinnedEnv(),
          receiptDir: dir,
          writeReceipts: false,
          runLiveProof: async () => {
            throw new Error("unused");
          },
        }),
      ).rejects.toThrow(/createCeqr019TestOrchestrationCapability/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("CEQR-019 exception call counts (Blocker 3)", () => {
  it("records exact one adjudicator attempt when runner throws after budget consume", async () => {
    const dir = makeTempReceiptDir();
    const parent = join(dir, "..");
    try {
      const result = await runCeqr019ControlledLiveSemanticReproofForTests({
        capability: createCeqr019TestOrchestrationCapability(),
        env: pinnedEnv(),
        receiptDir: dir,
        writeReceipts: true,
        now: FIXED_NOW,
        createAdapters: async (config) => {
          const budget = createLiveCallBudget(config.maxTotalCalls);
          return {
            adjudicatorRunner: {
              async runStructured() {
                throw new Error("should not be called directly");
              },
            },
            refereeRunner: {
              async runStructured() {
                throw new Error("should not be called");
              },
            },
            objectivityReferee: {
              async evaluate() {
                return { outcome: "PASS", rationale: "n/a" };
              },
            },
            providerId: "openai",
            adjudicatorModelId: config.adjudicatorModelId,
            refereeModelId: config.refereeModelId,
            independenceLevel: "separate_call_same_provider_same_model",
            timeoutMs: config.timeoutMs,
            maxRetries: 0,
            providerAttemptCountExact: true,
            adjudicatorPromptAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
            callBudget: budget,
          } satisfies ContradictionLiveAdapterBundle;
        },
        runLiveProof: async ({ createAdapters }) => {
          const adapters = await createAdapters({
            adjudicatorModelId: "gpt-4o-mini",
            refereeModelId: "gpt-4o-mini",
            timeoutMs: 45000,
            maxTotalCalls: 6,
          });
          adapters.callBudget.recordAdjudicatorCall();
          throw new Error("provider network failure after one adjudicator call");
        },
      });

      expect(result.claimCreated).toBe(true);
      expect(existsSync(join(dir, CEQR_019_LIVE_RUN_CLAIM_FILENAME))).toBe(true);
      expect(result.providerCalls).toBe(1);
      expect(result.boundaryCounters.adjudicatorCalls).toBe(1);
      expect(result.boundaryCounters.refereeCalls).toBe(0);
      if ("liveProviderAttempts" in result.receipt) {
        expect(result.receipt.liveProviderAttempts).toBe(1);
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("factory/schema failure before any provider attempt reports zero attempts", async () => {
    const dir = makeTempReceiptDir();
    const parent = join(dir, "..");
    try {
      const result = await runCeqr019ControlledLiveSemanticReproofForTests({
        capability: createCeqr019TestOrchestrationCapability(),
        env: pinnedEnv(),
        receiptDir: dir,
        writeReceipts: false,
        createAdapters: async () => {
          throw new Error("structured output schema rejected by provider");
        },
        runLiveProof: async ({ createAdapters }) => {
          await createAdapters({
            adjudicatorModelId: "gpt-4o-mini",
            refereeModelId: "gpt-4o-mini",
            timeoutMs: 45000,
            maxTotalCalls: 6,
          });
          throw new Error("unreachable");
        },
      });
      expect(result.providerCalls).toBe(0);
      expect(result.boundaryCounters.adjudicatorCalls).toBe(0);
      if ("classification" in result.receipt) {
        expect(result.receipt.classification).toBe(
          "HOLD_PROVIDER_SCHEMA_REJECTED",
        );
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("CEQR-019 injectable orchestration with observations", () => {
  it("PASS path records observations and counters without real network", async () => {
    const dir = makeTempReceiptDir();
    const parent = join(dir, "..");
    try {
      const result = await runCeqr019ControlledLiveSemanticReproofForTests({
        capability: createCeqr019TestOrchestrationCapability(),
        env: pinnedEnv(),
        receiptDir: dir,
        writeReceipts: true,
        now: FIXED_NOW,
        createAdapters: async (config) => {
          const budget = createLiveCallBudget(config.maxTotalCalls);
          return {
            adjudicatorRunner: fakeRunner({}),
            refereeRunner: fakeRunner({}),
            objectivityReferee: {
              async evaluate() {
                return { outcome: "PASS", rationale: "ok" };
              },
            },
            providerId: "openai",
            adjudicatorModelId: config.adjudicatorModelId,
            refereeModelId: config.refereeModelId,
            independenceLevel: "separate_call_same_provider_same_model",
            timeoutMs: config.timeoutMs,
            maxRetries: 0,
            providerAttemptCountExact: true,
            adjudicatorPromptAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
            callBudget: budget,
          } satisfies ContradictionLiveAdapterBundle;
        },
        runLiveProof: async ({ createAdapters, caseObserver }) => {
          const adapters = await createAdapters({
            adjudicatorModelId: "gpt-4o-mini",
            refereeModelId: "gpt-4o-mini",
            timeoutMs: 45000,
            maxTotalCalls: 6,
          });
          adapters.callBudget.recordAdjudicatorCall();
          adapters.callBudget.recordAdjudicatorCall();
          adapters.callBudget.recordAdjudicatorCall();
          adapters.callBudget.recordRefereeCall();

          const observations = [
            passingClearObs(),
            passingCompatibleObs(),
            passingAmbiguousObs(),
          ];
          for (const obs of observations) {
            const synthetic = CEQR_019_SYNTHETIC_CASES.find(
              (c) => c.id === obs.caseId,
            )!;
            caseObserver.afterCase({
              synthetic,
              currentMessage: null,
              references: null,
              result: null,
              errorMessage: null,
              status: (obs.caseStatus ?? "no_write") as
                | "created"
                | "reused"
                | "no_write"
                | "failed_safely"
                | "skipped_budget"
                | "provider_failed",
              caseReceipt: {
                caseId: obs.caseId,
                status: (obs.caseStatus ?? "no_write") as
                  | "created"
                  | "reused"
                  | "no_write"
                  | "failed_safely"
                  | "skipped_budget"
                  | "provider_failed",
                proofOutcome: (obs.proofOutcome as "created") ?? null,
                writeExecuted: obs.writeExecuted,
                writerInvoked: obs.writerInvoked,
                adjudicatorCallCount: 1,
                refereeCallCount: obs.refereeCallCount,
                contradictionNodeId: obs.contradictionNodeId,
                sideAQuote: obs.evidenceA?.exactQuote ?? null,
                sideBQuote: obs.evidenceB?.exactQuote ?? null,
                presentationStatus: "not_requested",
                failureCode: null,
                failureMessage: null,
                latencyMs: 1,
                harnessNodeCountAfter: obs.writeExecuted ? 1 : 0,
                harnessSpanCountAfter: obs.writeExecuted ? 2 : 0,
                gateStoppedAt: obs.writeExecuted ? null : "selection",
                sanitizedAdjudicationDiagnostics: null,
              },
              harnessNodes: [],
              harnessSpans: [],
            });
          }

          // Re-emit with richer natural-entry results for classification via
          // classifyCeqr019LiveResult using the observations collected by core.
          // The core already recorded observations from afterCase above; those
          // will be incomplete (no adjudication). Force PASS by returning a
          // result that matches the observation-based classifier only when
          // observations are complete — so rebuild observations properly.
          return executedProof({
            adjudicatorCallCount: 3,
            refereeCallCount: 1,
            totalCallCount: 4,
            clearContradictionWriteProven: true,
            compatibleCaseNoWrite: true,
            ambiguousCaseNoWrite: true,
            cases: observations.map((obs) => ({
              caseId: obs.caseId,
              status: (obs.caseStatus ?? "no_write") as
                | "created"
                | "reused"
                | "no_write",
              proofOutcome: (obs.proofOutcome as "created") ?? null,
              writeExecuted: obs.writeExecuted,
              writerInvoked: obs.writerInvoked,
              adjudicatorCallCount: 1,
              refereeCallCount: obs.refereeCallCount,
              contradictionNodeId: obs.contradictionNodeId,
              sideAQuote: null,
              sideBQuote: null,
              presentationStatus: "not_requested" as const,
              failureCode: null,
              failureMessage: null,
              latencyMs: 1,
              harnessNodeCountAfter: 0,
              harnessSpanCountAfter: 0,
              gateStoppedAt: null,
              sanitizedAdjudicationDiagnostics: null,
            })),
          });
        },
      });

      expect(result.boundaryCounters.adjudicatorCalls).toBe(3);
      expect(result.boundaryCounters.refereeCalls).toBe(1);
      // Observations from null natural-entry results are incomplete → HOLD.
      if (
        "classification" in result.receipt &&
        "caseObservations" in result.receipt
      ) {
        expect(result.receipt.classification).not.toBe(
          "PASS_LIVE_SEMANTIC_REPROOF",
        );
        expect(result.receipt.caseObservations).toHaveLength(3);
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("CEQR-019 live script safeguards", () => {
  it("live script contains dual guards and production path only", () => {
    const scriptPath = join(
      process.cwd(),
      "scripts/run-contradiction-controlled-live-semantic-reproof.ts",
    );
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain(CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV);
    expect(script).toContain("assertCeqr019ProductionLivePaths");
    expect(script).not.toContain("ForTests");
  });

  it("ambient process env is not live-authorised during offline suite", () => {
    expect(process.env[CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]).toBeFalsy();
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).toBeFalsy();
  });
});

describe("CEQR-019 receipt corpus presence", () => {
  it("receipt directory includes post-live finalisation artifacts", () => {
    const dir = ceqr019ReceiptDir();
    expect(existsSync(dir)).toBe(true);
    const claimPath = join(dir, CEQR_019_PERMANENT_CLAIM_FILENAME);
    const claim = JSON.parse(readFileSync(claimPath, "utf8"));
    // Pre-live permanent claim document remains HOLD; live authority is the
    // immutable live-execution-receipt.json.
    expect(claim.status).toBe("HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED");

    const required = [
      "00-intake-and-boundaries.md",
      "01-ceqr017-live-failure-baseline.md",
      "02-ceqr018-offline-repair-baseline.md",
      "03-selected-live-reproof-architecture.md",
      "04-frozen-synthetic-case-contract.md",
      "05-provider-call-budget-and-guard.md",
      "06-source-authority-and-write-isolation.md",
      "07-offline-test-matrix.md",
      "08-offline-validation.md",
      "09-live-run-command-not-yet-executed.md",
      "10-result-and-limitations.md",
      "11-live-execution-result.md",
      "12-post-live-forensic-boundary.md",
      "13-next-repair-slice-boundary.md",
      "changed-files.txt",
      "validation-summary.json",
      CEQR_019_PERMANENT_CLAIM_FILENAME,
      CEQR_019_FROZEN_PLAN_FILENAME,
      CEQR_019_LIVE_RUN_CLAIM_FILENAME,
      CEQR_019_LIVE_RECEIPT_FILENAME,
      "pre-live-execution-receipt.json",
    ];
    for (const name of required) {
      expect(existsSync(join(dir, name))).toBe(true);
    }
    for (const file of listFilesRecursive(dir).filter((f) => f.endsWith(".json"))) {
      JSON.parse(readFileSync(file, "utf8"));
    }
  });
});

describe("CEQR-019 post-live finalisation locks", () => {
  it("locks immutable live artifacts by exact hash, bytes, and classification", () => {
    const dir = ceqr019ReceiptDir();
    const oneshotPath = join(dir, CEQR_019_LIVE_RUN_CLAIM_FILENAME);
    const frozenPath = join(dir, CEQR_019_FROZEN_PLAN_FILENAME);
    const livePath = join(dir, CEQR_019_LIVE_RECEIPT_FILENAME);
    const permanentPath = join(dir, CEQR_019_PERMANENT_CLAIM_FILENAME);

    expect(existsSync(oneshotPath)).toBe(true);
    expect(existsSync(frozenPath)).toBe(true);
    expect(existsSync(livePath)).toBe(true);
    expect(existsSync(permanentPath)).toBe(true);

    expect(readFileSync(oneshotPath).byteLength).toBe(
      CEQR_019_LIVE_ONESHOT_CLAIM_BYTES,
    );
    expect(sha256File(oneshotPath)).toBe(CEQR_019_LIVE_ONESHOT_CLAIM_SHA256);

    expect(readFileSync(frozenPath).byteLength).toBe(
      CEQR_019_FROZEN_LIVE_PLAN_BYTES,
    );
    expect(sha256File(frozenPath)).toBe(CEQR_019_FROZEN_LIVE_PLAN_SHA256);

    expect(readFileSync(livePath).byteLength).toBe(
      CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES,
    );
    expect(sha256File(livePath)).toBe(CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256);

    expect(readFileSync(permanentPath).byteLength).toBe(
      CEQR_019_PERMANENT_CLAIM_BYTES,
    );
    expect(sha256File(permanentPath)).toBe(CEQR_019_PERMANENT_CLAIM_SHA256);

    const live = JSON.parse(readFileSync(livePath, "utf8"));
    expect(live.classification).toBe(CEQR_019_LIVE_RESULT_CLASSIFICATION);
    expect(live.classification).toBe("FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN");
    expect(live.liveProviderAttempts).toBe(CEQR_019_LIVE_PROVIDER_ATTEMPTS);
    expect(live.liveProviderAttempts).toBe(3);
    expect(live.boundaryCounters.adjudicatorCalls).toBe(3);
    expect(live.boundaryCounters.refereeCalls).toBe(0);
    expect(live.boundaryCounters.writerCalls).toBe(0);
    expect(live.boundaryCounters.persistenceCalls).toBe(0);
    expect(live.boundaryCounters.accountGateCalls).toBe(0);
    expect(live.boundaryCounters.realDatabaseCalls).toBe(0);
    expect(live.productionReady).toBe(false);
    expect(live.schemaVersion).toBe("contradiction-adjudication-schema-v3");

    expect(live.caseObservations).toHaveLength(3);
    for (const obs of live.caseObservations) {
      expect(obs.attemptedAdjudicationCount).toBe(1);
      expect(obs.adjudicationOutcome).toBe("validation_failed");
      expect(obs.deterministicValidationStatus).toBe("invalid");
      expect(
        obs.validationErrors.some((e: string) =>
          /lexical_boundary_integrity/i.test(e),
        ),
      ).toBe(true);
      expect(obs.refereeCallCount).toBe(0);
      expect(obs.writerInvoked).toBe(false);
      expect(obs.writeExecuted).toBe(false);
      expect(obs.contradictionNodeId).toBeNull();
    }

    const oneshot = JSON.parse(readFileSync(oneshotPath, "utf8"));
    expect(oneshot.neverAutoDelete).toBe(true);
    expect(oneshot.purpose).toBe(
      "exactly_one_controlled_live_semantic_reproof_run",
    );
  });

  it("keeps CEQR-017 and CEQR-018 historical hashes unchanged", () => {
    const verified = verifyCeqr017CanonicalHashes();
    expect(verified.ok).toBe(true);
    expect(verified.liveReceiptSha256).toBe(CEQR_017_LIVE_RECEIPT_SHA256);
    expect(verified.permanentClaimSha256).toBe(CEQR_017_PERMANENT_CLAIM_SHA256);

    const dir = ceqr018ReceiptDir();
    for (const [rel, expected] of Object.entries(CEQR018_EXPECTED_FILE_HASHES)) {
      expect(sha256File(join(dir, rel))).toBe(expected);
    }
  });

  it("does not authorise additional live provider calls during finalisation suite", () => {
    expect(process.env[CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV]).toBeFalsy();
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).toBeFalsy();
  });
});
