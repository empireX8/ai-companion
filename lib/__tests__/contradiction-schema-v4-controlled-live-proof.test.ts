/**
 * CEQR-021 — offline contract + adversarial harness tests.
 *
 * Fake structured runners / fake referees only. No live OpenAI adapter.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createHash } from "crypto";
import { execFileSync } from "child_process";

import {
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV,
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
  CEQR_021_BASE_HEAD,
  CEQR_021_BRANCH,
  CEQR_021_CASES_AGGREGATE_SHA256,
  CEQR_021_CASE_SHA256,
  CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_021_EXPECTED_PROMPT_VERSION,
  CEQR_021_EXPECTED_SCHEMA_VERSION,
  CEQR_021_SLICE_ID,
  CEQR_021_SYNTHETIC_CASES,
  CEQR_021_WORKTREE_PATH,
  CEQR_021_APPROVED_SPAN_SET_SHA256,
  CEQR_021_FROZEN_CATALOG_SHA256,
  assertCeqr021FrozenCaseHashes,
  assertCeqr021FrozenCatalogHashes,
  assertCeqr021LandedConstants,
  assertCeqr021LiveGuards,
  assertCeqr021ProductionLivePaths,
  buildAllFrozenScenarioCatalogs,
  buildApprovedEvidenceSpansForSource,
  buildCeqr021PreLivePlanTemplate,
  buildCeqr021FinalFrozenLivePlan,
  buildCeqr021FrozenCommittedHeadSafetyBoundary,
  CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY,
  CEQR_021_PENDING_EXECUTION_HEAD,
  buildDisapprovedLexicalFragments,
  catalogHasNoMidWordEntries,
  catalogHasNoSurrogateSplits,
  catalogRespectsCombiningMarkPolicy,
  classifyCeqr021LiveResult,
  createCeqr021TestOrchestrationCapability,
  createEmptyCeqr021CallAccounting,
  fingerprintProviderObject,
  generateCeqr021OpenAiStrictSchemaOffline,
  hashLexicalBoundaryCatalog,
  invokeFakeAdjudicatorCounted,
  proveCeqr021SchemaV4ProviderContract,
  runCeqr021ControlledLiveSchemaV4Proof,
  runCeqr021ControlledLiveSchemaV4ProofForTests,
  runCeqr021OfflineDryRun,
  selectionIsApproved,
  syncCeqr021TotalProviderAttempts,
  verifyCeqr021HistoricalImmutability,
  writeCeqr021UnarmedClaimTemplate,
  writeCeqr021TempArmedHarnessForTests,
  assertCeqr021LivePreflight,
  assertCeqr021ExecutionTree,
  assertSanitizedReceiptHasNoLeaks,
  buildCeqr021CaseDiagnostics,
  finalizeCeqr021LiveReceiptAtomic,
  acquireCeqr021ExecutionLockAndConsumeClaim,
  writeCeqr021ChangedFilesManifest,
  assertCeqr021ChangedFilesManifestExact,
  type Ceqr021CatalogsByCaseId,
  CEQR_021_EXECUTION_LOCK_FILENAME,
  CEQR_021_EXPECTED_COMPATIBLE_CLASSIFICATION,
  CEQR_021_FROZEN_SOURCE_IDS,
  CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
  CEQR_021_LIVE_RECEIPT_FILENAME,
  CEQR_021_ONESHOT_CLAIM_FILENAME,
  ceqr021CanonicalOneshotClaimPath,
  ceqr021CanonicalLiveReceiptPath,
  ceqr021ExecutionLockPath,
} from "../contradiction-schema-v4-controlled-live-proof";
import {
  CEQR_019_CASES_AGGREGATE_SHA256,
  CEQR_019_CASE_SHA256,
} from "../contradiction-controlled-live-semantic-reproof";
import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
  LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16,
  boundarySelectionForOffsets,
  contradictionModelTransportResultSchema,
  enumerateValidLexicalBoundaries,
  formatLexicalBoundaryCatalogForPrompt,
} from "../orvek-intelligence-kernel";
import { CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION } from "../contradiction-live-provider-adapters";
import {
  CEQR_021_HARNESS_MODULE_BASENAME,
  CEQR_021_RUNNER_SCRIPT_BASENAME,
  cleanupCeqr021ImportProbeDir,
  proveCeqr021IsolationScannerDetectsInjectedImport,
  scanProductionRootsForCeqr021Needle,
} from "../ceqr021-production-import-isolation";
import { transportSelectionForSubstring } from "./helpers/ceqr020-transport-selection";

const REPO_ROOT = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function bothGuards(): Record<string, string> {
  return {
    [CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV]:
      CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
    [CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV]:
      CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
  };
}

describe("CEQR-021 identities and frozen scenarios", () => {
  it("pins exact branch/base/canonical-path constants", () => {
    expect(CEQR_021_BRANCH).toBe(
      "desktop-contradiction-schema-v4-controlled-live-proof-001",
    );
    expect(CEQR_021_BASE_HEAD).toBe(
      "785d88640fdb284805a958f5a7f25cd0c68b7188",
    );
    expect(CEQR_021_WORKTREE_PATH).toBe(
      "/Users/user/ai-companion-worktrees/desktop-contradiction-schema-v4-controlled-live-proof-001",
    );
    expect(CEQR_021_SLICE_ID).toBe(
      "CONTRADICTION-SCHEMA-V4-CONTROLLED-LIVE-PROOF-001",
    );
  });

  it("reuses exact CEQR-019 scenario source hashes and aggregate", () => {
    expect(CEQR_021_CASE_SHA256).toEqual(CEQR_019_CASE_SHA256);
    expect(CEQR_021_CASES_AGGREGATE_SHA256).toBe(CEQR_019_CASES_AGGREGATE_SHA256);
    expect(assertCeqr021FrozenCaseHashes().ok).toBe(true);
    expect(CEQR_021_SYNTHETIC_CASES).toHaveLength(3);
    expect(CEQR_021_SYNTHETIC_CASES[0]!.sideAText).toBe(
      "I do not drink alcohol at all.",
    );
    expect(CEQR_021_SYNTHETIC_CASES[0]!.sideBText).toBe(
      "I drank several beers last night.",
    );
    expect(CEQR_021_SYNTHETIC_CASES[1]!.sideAText).toBe(
      "I avoid coffee in the evening.",
    );
    expect(CEQR_021_SYNTHETIC_CASES[1]!.sideBText).toBe(
      "I drink coffee in the morning.",
    );
    expect(CEQR_021_SYNTHETIC_CASES[2]!.sideAText).toBe(
      "I might go running later if I feel up to it.",
    );
    expect(CEQR_021_SYNTHETIC_CASES[2]!.sideBText).toBe(
      "Sometimes I think about exercise.",
    );
  });

  it("pins schema-v4 / prompt-v4 / distinct CEQR-021 addendum", () => {
    expect(CEQR_021_EXPECTED_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v4",
    );
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      CEQR_021_EXPECTED_SCHEMA_VERSION,
    );
    expect(CEQR_021_EXPECTED_PROMPT_VERSION).toBe(
      "contradiction-adjudication-prompt-v4",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION).toBe(
      CEQR_021_EXPECTED_PROMPT_VERSION,
    );
    expect(CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-ceqr021-schema-v4",
    );
    expect(CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    );
    expect(assertCeqr021LandedConstants().ok).toBe(true);
  });
});

describe("CEQR-021 schema-v4 provider contract", () => {
  it("emits boundary indices only and excludes raw offsets/sourceId/exactQuote", () => {
    const proof = proveCeqr021SchemaV4ProviderContract();
    expect(proof.transportFields).toEqual([
      "startBoundaryIndex",
      "endBoundaryIndex",
    ]);
    expect(proof.excludedTransportFields).toEqual([
      "startOffset",
      "endOffset",
      "sourceId",
      "exactQuote",
    ]);
    expect(proof.boundaryFieldsIntegerNonnegative).toBe(true);
    expect(proof.forbiddenClearPlusCompatibleFailsClosed).toBe(true);
    expect(proof.clearRequiresAllCompatibilityFlagsFalse).toBe(true);
    expect(proof.abstentionRetainsRequiredShape).toBe(true);
    expect(proof.addendumDistinctFromProductionV4).toBe(true);
  });

  it("rejects forbidden clear-plus-compatible transport", () => {
    const parsed = contradictionModelTransportResultSchema.safeParse({
      classification: "clear_contradiction",
      bothCanSimultaneouslyBeTrue: true,
      changedBeliefOverTime: false,
      intentionVersusOutcome: false,
      goalVersusObstacle: false,
      emotionalOrPhysiologicalVersusReasoningStandard: false,
      abstentionReason: null,
      propositionA: {
        normalizedProposition: "a",
        actor: "a",
        subject: "a",
        timeframe: "a",
        negation: false,
        modality: "a",
        qualifications: "none",
      },
      propositionB: {
        normalizedProposition: "b",
        actor: "b",
        subject: "b",
        timeframe: "b",
        negation: false,
        modality: "b",
        qualifications: "none",
      },
      contextAndScope: "x",
      confidence: 0.5,
      rationale: "x",
      alternativeInterpretation: "x",
      whatWouldChangeClassification: "x",
      evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
      evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    });
    expect(parsed.success).toBe(false);
  });

  it("generates OpenAI strict schema offline without unsupported root anyOf", async () => {
    const generated = await generateCeqr021OpenAiStrictSchemaOffline();
    expect(generated.ok).toBe(true);
    expect(generated.rootAnyOfForbidden).toBe(true);
    expect(generated.nestedAnyOfCount).toBe(3);
  });
});

describe("CEQR-021 frozen catalogs and approved spans", () => {
  it("freezes catalogs within bounds with deterministic hashes", () => {
    const catalogs = buildAllFrozenScenarioCatalogs();
    expect(assertCeqr021FrozenCatalogHashes(catalogs).ok).toBe(true);
    for (const entry of catalogs) {
      expect(entry.sideA.sourceUtf16Length).toBeLessThanOrEqual(
        LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16,
      );
      expect(entry.sideA.catalog.length).toBeLessThanOrEqual(
        LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
      );
      expect(entry.sideA.catalogSha256).toBe(
        CEQR_021_FROZEN_CATALOG_SHA256[entry.caseId].A,
      );
      expect(entry.sideB.catalogSha256).toBe(
        CEQR_021_FROZEN_CATALOG_SHA256[entry.caseId].B,
      );
      expect(entry.sideA.approvedSpanSetSha256).toBe(
        CEQR_021_APPROVED_SPAN_SET_SHA256[entry.caseId].A,
      );
      const promptCatalog = enumerateValidLexicalBoundaries(
        entry.sideA.sourceText,
      );
      expect(hashLexicalBoundaryCatalog(promptCatalog)).toBe(
        entry.sideA.catalogSha256,
      );
      expect(
        formatLexicalBoundaryCatalogForPrompt(
          "A",
          entry.sideA.sourceText,
          promptCatalog,
        ),
      ).toContain(`catalogLength=${promptCatalog.length}`);
      expect(
        catalogHasNoMidWordEntries(entry.sideA.sourceText, entry.sideA.catalog),
      ).toBe(true);
      expect(
        catalogHasNoSurrogateSplits(
          entry.sideA.sourceText,
          entry.sideA.catalog,
        ),
      ).toBe(true);
      expect(
        catalogRespectsCombiningMarkPolicy(
          entry.sideA.sourceText,
          entry.sideA.catalog,
        ),
      ).toBe(true);
    }
  });

  it("approves complete proposition spans and rejects isolated fragments", () => {
    const clear = buildAllFrozenScenarioCatalogs().find(
      (c) => c.caseId === "clear_contradiction_candidate",
    )!;
    const approved = buildApprovedEvidenceSpansForSource(clear.sideA.sourceText);
    expect(approved.length).toBeGreaterThanOrEqual(1);
    expect(approved[0]!.exactQuote).toBe(clear.sideA.sourceText);
    expect(
      selectionIsApproved(clear.sideA, {
        startBoundaryIndex: approved[0]!.startBoundaryIndex,
        endBoundaryIndex: approved[0]!.endBoundaryIndex,
      }),
    ).not.toBeNull();

    for (const frag of buildDisapprovedLexicalFragments(clear.sideA.sourceText)) {
      const selection = boundarySelectionForOffsets(
        clear.sideA.sourceText,
        clear.sideA.sourceText.indexOf(frag.substring),
        clear.sideA.sourceText.indexOf(frag.substring) + frag.substring.length,
      );
      if (selection == null) continue;
      expect(selectionIsApproved(clear.sideA, selection)).toBeNull();
    }

    const alcohol = transportSelectionForSubstring(
      clear.sideA.sourceText,
      "alcohol",
    );
    expect(selectionIsApproved(clear.sideA, alcohol)).toBeNull();
  });
});

describe("CEQR-021 offline dry-run and classifier", () => {
  it("dry-runs three frozen cases with expected referee/write isolation", () => {
    const dry = runCeqr021OfflineDryRun();
    expect(dry.offlineHarnessResult).toBe(true);
    expect(dry.liveProofObtained).toBe(false);
    expect(dry.productionReady).toBe(false);
    expect(dry.accounting.adjudicatorAttempts).toBe(3);
    expect(dry.accounting.refereeAttempts).toBe(1);
    expect(dry.accounting.writerCalls).toBe(0);
    expect(dry.accounting.persistenceCalls).toBe(0);
    expect(dry.accounting.accountGateCalls).toBe(0);
    expect(dry.accounting.realDatabaseCalls).toBe(0);
    expect(dry.accounting.automaticRetries).toBe(0);
    expect(dry.accounting.providerConstructionAttempted).toBe(1);
    expect(dry.accounting.liveRunnerInvoked).toBe(1);
    expect(dry.classification).toBe(
      "PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW",
    );

    const clear = dry.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    expect(clear.refereeReached).toBe(true);
    expect(clear.evidenceA?.approved).toBe(true);
    expect(clear.writerInvoked).toBe(false);
    expect(clear.nodeCreated).toBe(false);

    const compatible = dry.caseObservations.find(
      (o) => o.caseId === "compatible_contextual",
    )!;
    expect(compatible.refereeCallCount).toBe(0);
    expect(compatible.observedClassification).not.toBe("clear_contradiction");

    const ambiguous = dry.caseObservations.find(
      (o) => o.caseId === "ambiguous_insufficient",
    )!;
    expect(ambiguous.adjudicationOutcome).toBe("abstained");
    expect(ambiguous.refereeCallCount).toBe(0);
  });

  it("fails closed on malformed boundary index and unapproved partial span before referee", () => {
    const catalogs = buildAllFrozenScenarioCatalogs();
    const clearCat = catalogs.find(
      (c) => c.caseId === "clear_contradiction_candidate",
    )!;
    const dryBadIndex = runCeqr021OfflineDryRun({
      fakeResults: [
        {
          caseId: "clear_contradiction_candidate",
          classification: "clear_contradiction",
          abstentionReason: null,
          compatibilityFlags: {
            bothCanSimultaneouslyBeTrue: false,
            changedBeliefOverTime: false,
            intentionVersusOutcome: false,
            goalVersusObstacle: false,
            emotionalOrPhysiologicalVersusReasoningStandard: false,
          },
          selectionA: { startBoundaryIndex: 999, endBoundaryIndex: 1000 },
          selectionB: {
            startBoundaryIndex: clearCat.sideB.approvedSpans[0]!.startBoundaryIndex,
            endBoundaryIndex: clearCat.sideB.approvedSpans[0]!.endBoundaryIndex,
          },
          rawObject: { bad: true },
        },
        ...runCeqr021OfflineDryRun().caseObservations
          .filter((o) => o.caseId !== "clear_contradiction_candidate")
          .map((o) => {
            const cat = catalogs.find((c) => c.caseId === o.caseId)!;
            return {
              caseId: o.caseId,
              classification: o.observedClassification,
              abstentionReason: o.abstentionReason,
              compatibilityFlags: {
                bothCanSimultaneouslyBeTrue:
                  o.compatibilityFlags.bothCanSimultaneouslyBeTrue ?? false,
                changedBeliefOverTime:
                  o.compatibilityFlags.changedBeliefOverTime ?? false,
                intentionVersusOutcome:
                  o.compatibilityFlags.intentionVersusOutcome ?? false,
                goalVersusObstacle:
                  o.compatibilityFlags.goalVersusObstacle ?? false,
                emotionalOrPhysiologicalVersusReasoningStandard:
                  o.compatibilityFlags
                    .emotionalOrPhysiologicalVersusReasoningStandard ?? false,
              },
              selectionA: {
                startBoundaryIndex: cat.sideA.approvedSpans[0]!.startBoundaryIndex,
                endBoundaryIndex: cat.sideA.approvedSpans[0]!.endBoundaryIndex,
              },
              selectionB: {
                startBoundaryIndex: cat.sideB.approvedSpans[0]!.startBoundaryIndex,
                endBoundaryIndex: cat.sideB.approvedSpans[0]!.endBoundaryIndex,
              },
              rawObject: { id: o.caseId },
            };
          }),
      ],
    });
    const clearObs = dryBadIndex.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    expect(clearObs.refereeReached).toBe(false);
    expect(clearObs.validationCode).toMatch(/invalid_boundary_index|invalid/);
    expect(dryBadIndex.classification).toBe("FAIL_INVALID_BOUNDARY_INDEX");

    const alcoholSel = transportSelectionForSubstring(
      clearCat.sideA.sourceText,
      "alcohol",
    );
    const dryUnapproved = runCeqr021OfflineDryRun({
      fakeResults: [
        {
          caseId: "clear_contradiction_candidate",
          classification: "clear_contradiction",
          abstentionReason: null,
          compatibilityFlags: {
            bothCanSimultaneouslyBeTrue: false,
            changedBeliefOverTime: false,
            intentionVersusOutcome: false,
            goalVersusObstacle: false,
            emotionalOrPhysiologicalVersusReasoningStandard: false,
          },
          selectionA: alcoholSel,
          selectionB: {
            startBoundaryIndex: clearCat.sideB.approvedSpans[0]!.startBoundaryIndex,
            endBoundaryIndex: clearCat.sideB.approvedSpans[0]!.endBoundaryIndex,
          },
          rawObject: { partial: true },
        },
        ...dryBadIndex.caseObservations
          .filter((o) => o.caseId !== "clear_contradiction_candidate")
          .map((o) => {
            const cat = catalogs.find((c) => c.caseId === o.caseId)!;
            return {
              caseId: o.caseId,
              classification: o.observedClassification,
              abstentionReason: o.abstentionReason,
              compatibilityFlags: {
                bothCanSimultaneouslyBeTrue:
                  o.compatibilityFlags.bothCanSimultaneouslyBeTrue ?? false,
                changedBeliefOverTime:
                  o.compatibilityFlags.changedBeliefOverTime ?? false,
                intentionVersusOutcome:
                  o.compatibilityFlags.intentionVersusOutcome ?? false,
                goalVersusObstacle:
                  o.compatibilityFlags.goalVersusObstacle ?? false,
                emotionalOrPhysiologicalVersusReasoningStandard:
                  o.compatibilityFlags
                    .emotionalOrPhysiologicalVersusReasoningStandard ?? false,
              },
              selectionA: {
                startBoundaryIndex: cat.sideA.approvedSpans[0]!.startBoundaryIndex,
                endBoundaryIndex: cat.sideA.approvedSpans[0]!.endBoundaryIndex,
              },
              selectionB: {
                startBoundaryIndex: cat.sideB.approvedSpans[0]!.startBoundaryIndex,
                endBoundaryIndex: cat.sideB.approvedSpans[0]!.endBoundaryIndex,
              },
              rawObject: { id: o.caseId },
            };
          }),
      ],
    });
    expect(
      dryUnapproved.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!.refereeReached,
    ).toBe(false);
    expect(dryUnapproved.classification).toBe(
      "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN",
    );
  });

  it("strict PASS requires semantic outcomes, approved spans, referee, and zero side effects", () => {
    const dry = runCeqr021OfflineDryRun();
    const accounting = { ...dry.accounting };
    const catalogsByCaseId = Object.fromEntries(
      buildAllFrozenScenarioCatalogs().map((c) => [c.caseId, c]),
    ) as Ceqr021CatalogsByCaseId;
    expect(
      classifyCeqr021LiveResult({
        caseObservations: dry.caseObservations,
        catalogsByCaseId,
        accounting,
        frozenPlanHashMatched: true,
        scenarioAggregateHashMatched: true,
        schemaPromptAddendumMatched: true,
        oneShotConsumedExactlyOnce: true,
        canonicalPathOk: true,
        productionReady: false,
      }),
    ).toBe("PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED");

    expect(
      classifyCeqr021LiveResult({
        caseObservations: dry.caseObservations,
        catalogsByCaseId,
        accounting: { ...accounting, writerCalls: 1 },
        frozenPlanHashMatched: true,
        scenarioAggregateHashMatched: true,
        schemaPromptAddendumMatched: true,
        oneShotConsumedExactlyOnce: true,
        canonicalPathOk: true,
        productionReady: false,
      }),
    ).toBe("FAIL_WRITER_OR_PERSISTENCE_BOUNDARY");

    expect(
      classifyCeqr021LiveResult({
        caseObservations: dry.caseObservations,
        catalogsByCaseId,
        accounting: {
          ...accounting,
          totalProviderAttempts: CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS + 1,
          adjudicatorAttempts: 4,
          refereeAttempts: 3,
        },
        frozenPlanHashMatched: true,
        scenarioAggregateHashMatched: true,
        schemaPromptAddendumMatched: true,
        oneShotConsumedExactlyOnce: true,
        canonicalPathOk: true,
        productionReady: false,
      }),
    ).toBe("FAIL_CALL_BUDGET");
  });

  it("preserves provider attempt counts across thrown calls and keeps retries at zero", async () => {
    const accounting = createEmptyCeqr021CallAccounting();
    await expect(
      invokeFakeAdjudicatorCounted({
        accounting,
        run: async () => {
          throw new Error("provider boom");
        },
      }),
    ).rejects.toThrow("provider boom");
    expect(accounting.adjudicatorAttempts).toBe(1);
    expect(accounting.totalProviderAttempts).toBe(1);
    expect(accounting.automaticRetries).toBe(0);
    syncCeqr021TotalProviderAttempts(accounting);
    expect(accounting.totalProviderAttempts).toBe(1);
  });

  it("retains raw fingerprint and failing side accuracy; no secrets in diagnostics", () => {
    const dry = runCeqr021OfflineDryRun();
    for (const obs of dry.caseObservations) {
      expect(obs.immutableRawTransportFingerprint).toBe(
        obs.rawProviderObjectSha256,
      );
      expect(obs.rawProviderObjectSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    const blob = JSON.stringify(dry.diagnostics);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(blob).not.toContain("OPENAI_API_KEY=");
    expect(fingerprintProviderObject({ a: 1 })).toBe(
      createHash("sha256").update(JSON.stringify({ a: 1 }), "utf8").digest("hex"),
    );
  });
});

describe("CEQR-021 one-shot and canonical path safety", () => {
  it("rejects missing/partial guards and receiptDir/claim overrides", async () => {
    expect(assertCeqr021LiveGuards({}).ok).toBe(false);
    expect(
      assertCeqr021LiveGuards({
        [CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV]:
          CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
      }).ok,
    ).toBe(false);
    expect(assertCeqr021LiveGuards(bothGuards()).ok).toBe(true);

    expect(
      assertCeqr021ProductionLivePaths({
        cwd: "/tmp/not-ceqr021",
      }).ok,
    ).toBe(false);
    expect(
      assertCeqr021ProductionLivePaths({
        receiptDir: "/tmp/NOT-CEQR-021",
      }).ok,
    ).toBe(false);

    const production = await runCeqr021ControlledLiveSchemaV4Proof({
      cwd: "/tmp",
      env: bothGuards(),
      claimPath: "/tmp/custom-claim.json",
    });
    expect(production.providerConstructionAttempted).toBe(false);
    expect(production.claimConsumed).toBe(false);
    expect(production.classification).toBe("FAIL_ONE_SHOT_OR_CANONICAL_PATH");
  });

  it("missing createAdapters fails before claim consumption", async () => {
    const dir = tempDir("ceqr021-missing-adapters-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const before = JSON.parse(readFileSync(harness.claimPath, "utf8")) as {
      armingState: string;
    };
    expect(before.armingState).toBe("armed");

    const result = await runCeqr021ControlledLiveSchemaV4ProofForTests({
      capability: createCeqr021TestOrchestrationCapability(),
      claimPath: harness.claimPath,
      receiptDir,
      frozenPlanSha256: harness.frozenPlanSha256,
      committedExecutionHead: harness.committedExecutionHead,
      env: bothGuards(),
      skipPreflight: true,
    });
    expect(result.claimConsumed).toBe(false);
    expect(result.providerConstructionAttempted).toBe(false);
    expect(result.classification).toBe("HOLD_ONE_SHOT_SAFETY_INCOMPLETE");
    expect(JSON.parse(readFileSync(harness.claimPath, "utf8")).armingState).toBe(
      "armed",
    );
    expect(
      existsSync(join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME)),
    ).toBe(false);
  });

  it("consumes temp armed claims; custom temp claims cannot authorise canonical execution", async () => {
    const dir = tempDir("ceqr021-claim-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });

    let constructed = false;
    const result = await runCeqr021ControlledLiveSchemaV4ProofForTests({
      capability: createCeqr021TestOrchestrationCapability(),
      claimPath: harness.claimPath,
      receiptDir,
      frozenPlanSha256: harness.frozenPlanSha256,
      committedExecutionHead: harness.committedExecutionHead,
      env: bothGuards(),
      skipPreflight: true,
      createAdapters: async () => {
        constructed = true;
        throw new Error("stop after construction for consume proof");
      },
    });
    expect(result.claimConsumed).toBe(true);
    expect(constructed).toBe(true);
    expect(result.providerConstructionAttempted).toBe(true);
    const after = JSON.parse(readFileSync(harness.claimPath, "utf8")) as {
      armingState: string;
    };
    expect(after.armingState).toBe("consumed");
    expect(
      existsSync(join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME)),
    ).toBe(true);

    const again = await runCeqr021ControlledLiveSchemaV4ProofForTests({
      capability: createCeqr021TestOrchestrationCapability(),
      claimPath: harness.claimPath,
      receiptDir,
      frozenPlanSha256: harness.frozenPlanSha256,
      committedExecutionHead: harness.committedExecutionHead,
      env: bothGuards(),
      skipPreflight: true,
      createAdapters: async () => {
        throw new Error("should not construct");
      },
    });
    expect(again.providerConstructionAttempted).toBe(false);
    expect(again.claimConsumed).toBe(false);
    expect(again.message).toMatch(/lock|consumed/i);

    const prod = await runCeqr021ControlledLiveSchemaV4Proof({
      env: bothGuards(),
      claimPath: harness.claimPath,
    });
    expect(prod.providerConstructionAttempted).toBe(false);
    expect(prod.claimConsumed).toBe(false);
  });

  it("does not create final canonical claim during tests; existing receipt blocks", async () => {
    expect(existsSync(ceqr021CanonicalOneshotClaimPath(REPO_ROOT))).toBe(false);
    expect(existsSync(ceqr021CanonicalLiveReceiptPath(REPO_ROOT))).toBe(false);
    expect(existsSync(ceqr021ExecutionLockPath(REPO_ROOT))).toBe(false);

    const dir = tempDir("ceqr021-receipt-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    writeFileSync(
      join(receiptDir, "live-execution-receipt.json"),
      "{}\n",
      "utf8",
    );
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const blocked = await runCeqr021ControlledLiveSchemaV4ProofForTests({
      capability: createCeqr021TestOrchestrationCapability(),
      claimPath: harness.claimPath,
      receiptDir,
      frozenPlanSha256: harness.frozenPlanSha256,
      committedExecutionHead: harness.committedExecutionHead,
      env: bothGuards(),
      skipPreflight: true,
      createAdapters: async () => {
        throw new Error("no");
      },
    });
    expect(blocked.providerConstructionAttempted).toBe(false);
    expect(blocked.message).toMatch(/receipt/i);
  });

  it("claim remains consumed even when provider construction throws", async () => {
    const dir = tempDir("ceqr021-throw-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const result = await runCeqr021ControlledLiveSchemaV4ProofForTests({
      capability: createCeqr021TestOrchestrationCapability(),
      claimPath: harness.claimPath,
      receiptDir,
      frozenPlanSha256: harness.frozenPlanSha256,
      committedExecutionHead: harness.committedExecutionHead,
      env: bothGuards(),
      skipPreflight: true,
      createAdapters: async () => {
        throw new Error("construction failed");
      },
    });
    expect(result.claimConsumed).toBe(true);
    expect(result.providerConstructionAttempted).toBe(true);
    expect(JSON.parse(readFileSync(harness.claimPath, "utf8")).armingState).toBe(
      "consumed",
    );
  });
});

describe("CEQR-021 historical immutability and production isolation", () => {
  it("verifies CEQR-017/018/019/020 hashes unchanged", () => {
    const result = verifyCeqr021HistoricalImmutability(REPO_ROOT);
    expect(result.ok).toBe(true);
  });

  it("production routes do not import the CEQR-021 runner/harness", () => {
    const harness = scanProductionRootsForCeqr021Needle({
      cwd: REPO_ROOT,
      needle: CEQR_021_HARNESS_MODULE_BASENAME,
    });
    expect(harness.status).toBe("clean");
    const runner = scanProductionRootsForCeqr021Needle({
      cwd: REPO_ROOT,
      needle: CEQR_021_RUNNER_SCRIPT_BASENAME,
    });
    expect(runner.status).toBe("clean");
    const probe = proveCeqr021IsolationScannerDetectsInjectedImport({
      cwd: REPO_ROOT,
    });
    expect(probe.status).toBe("matches");
    cleanupCeqr021ImportProbeDir(probe.probeDir);
  });

  it("CEQR-019 cannot be rerun through CEQR-021 runner paths", async () => {
    const result = await runCeqr021ControlledLiveSchemaV4Proof({
      cwd: "/Users/user/ai-companion-worktrees/desktop-contradiction-live-semantic-reproof-001",
      env: bothGuards(),
    });
    expect(result.providerConstructionAttempted).toBe(false);
  });

  it("pre-live plan template marks execution HEAD pending", () => {
    const plan = buildCeqr021PreLivePlanTemplate(REPO_ROOT);
    expect(plan.committedExecutionHead).toBe(
      "PENDING_POST_REVIEW_COMMIT_FREEZE",
    );
    expect(plan.hardSafetyBoundaries).toContain(
      CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY,
    );
    expect(plan.productionReady).toBe(false);
    expect(plan.liveProviderAttempts).toBe(0);
    expect(plan.liveAuthorisedByThisTemplate).toBe(false);
  });

  it("final frozen plan builder replaces pending HEAD boundary with exact SHA", () => {
    const head = "750ffeb7db787b8c60d055381d9bfbe5af0d1fcd";
    const { plan, serialized } = buildCeqr021FinalFrozenLivePlan({
      cwd: REPO_ROOT,
      committedExecutionHead: head,
      frozenAt: "2026-07-23T17:00:00.000Z",
    });
    expect(plan.committedExecutionHead).toBe(head);
    expect(serialized.includes("PENDING_POST_REVIEW_COMMIT_FREEZE")).toBe(
      false,
    );
    expect(serialized.includes(CEQR_021_PENDING_EXECUTION_HEAD)).toBe(false);
    expect(plan.hardSafetyBoundaries).toContain(
      buildCeqr021FrozenCommittedHeadSafetyBoundary(head),
    );
    expect(plan.hardSafetyBoundaries).not.toContain(
      CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY,
    );
    expect(plan.armed).toBe(false);
    expect(plan.liveAuthorisedByThisFreeze).toBe(false);
    expect(plan.productionReady).toBe(false);
    expect(plan.liveProviderAttempts).toBe(0);
    expect(existsSync(ceqr021CanonicalOneshotClaimPath(REPO_ROOT))).toBe(false);
    expect(existsSync(ceqr021ExecutionLockPath(REPO_ROOT))).toBe(false);
    expect(existsSync(ceqr021CanonicalLiveReceiptPath(REPO_ROOT))).toBe(false);
    expect(
      existsSync(
        join(
          REPO_ROOT,
          "docs/agent-runs/receipts",
          CEQR_021_SLICE_ID,
          "final-frozen-live-plan.json",
        ),
      ),
    ).toBe(false);
  });
});

describe("CEQR-021 source authority", () => {
  it("sourceId and exactQuote remain code-owned after bind in dry-run", () => {
    const dry = runCeqr021OfflineDryRun();
    const clear = dry.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    expect(clear.evidenceA!.sourceId).toBe(
      CEQR_021_FROZEN_SOURCE_IDS.clear_contradiction_candidate.A,
    );
    expect(clear.evidenceA!.exactQuote).toBe(
      CEQR_021_SYNTHETIC_CASES[0]!.sideAText,
    );
    expect(clear.evidenceB!.exactQuote).toBe(
      CEQR_021_SYNTHETIC_CASES[0]!.sideBText,
    );
  });
});

describe("CEQR-021 mandatory frozen plan preflight (Blocker 2)", () => {
  function prepReceiptDir(): string {
    const dir = tempDir("ceqr021-preflight-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    return receiptDir;
  }

  it("rejects missing final frozen plan before claim consumption", () => {
    const receiptDir = prepReceiptDir();
    writeCeqr021UnarmedClaimTemplate({
      claimPath: join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME),
    });
    const result = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("frozen_plan_missing");
    }
    expect(
      existsSync(join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME)),
    ).toBe(false);
  });

  it("rejects malformed plan before claim consumption", () => {
    const receiptDir = prepReceiptDir();
    writeFileSync(
      join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME),
      "{not-json\n",
      "utf8",
    );
    const result = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("plan_invalid");
  });

  it("rejects plan hash / HEAD / identity mismatches before consumption", () => {
    const receiptDir = prepReceiptDir();
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });

    // Tamper claim frozenPlanSha256 while keeping plan bytes.
    const claim = JSON.parse(readFileSync(harness.claimPath, "utf8"));
    claim.frozenPlanSha256 =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    writeFileSync(
      harness.claimPath,
      `${JSON.stringify(claim, null, 2)}\n`,
      "utf8",
    );
    const hashMismatch = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(hashMismatch.ok).toBe(false);
    if (!hashMismatch.ok) {
      expect(hashMismatch.message).toMatch(/frozenPlanSha256/i);
    }

    // Restore harness then break HEAD on claim.
    rmSync(receiptDir, { recursive: true, force: true });
    mkdirSync(receiptDir, { recursive: true });
    const harness2 = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const claim2 = JSON.parse(readFileSync(harness2.claimPath, "utf8"));
    claim2.committedExecutionHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    writeFileSync(
      harness2.claimPath,
      `${JSON.stringify(claim2, null, 2)}\n`,
      "utf8",
    );
    const headMismatch = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(headMismatch.ok).toBe(false);
    if (!headMismatch.ok) {
      expect(headMismatch.message).toMatch(/committedExecutionHead/i);
    }

    // Wrong schema on plan.
    rmSync(receiptDir, { recursive: true, force: true });
    mkdirSync(receiptDir, { recursive: true });
    const harness3 = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const plan = JSON.parse(readFileSync(harness3.planPath, "utf8"));
    plan.schemaVersion = "contradiction-adjudication-schema-v3";
    writeFileSync(
      harness3.planPath,
      `${JSON.stringify(plan, null, 2)}\n`,
      "utf8",
    );
    // Re-arm with new plan hash so claim hash matches file but plan fails strict validation.
    const newSha = createHash("sha256")
      .update(readFileSync(harness3.planPath))
      .digest("hex");
    const claim3 = JSON.parse(readFileSync(harness3.claimPath, "utf8"));
    claim3.frozenPlanSha256 = newSha;
    claim3.armingState = "armed";
    writeFileSync(
      harness3.claimPath,
      `${JSON.stringify(claim3, null, 2)}\n`,
      "utf8",
    );
    const schemaMismatch = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(schemaMismatch.ok).toBe(false);
    if (!schemaMismatch.ok) {
      expect(schemaMismatch.message).toMatch(/schemaVersion/i);
    }

    // Null plan hash on armed claim.
    rmSync(receiptDir, { recursive: true, force: true });
    mkdirSync(receiptDir, { recursive: true });
    const harness4 = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const claim4 = JSON.parse(readFileSync(harness4.claimPath, "utf8"));
    claim4.frozenPlanSha256 = null;
    writeFileSync(
      harness4.claimPath,
      `${JSON.stringify(claim4, null, 2)}\n`,
      "utf8",
    );
    const nullHash = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(nullHash.ok).toBe(false);

    expect(
      existsSync(join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME)),
    ).toBe(false);
  });

  it("accepts valid temp plan+claim under skipGit/skipApiKey test hooks", () => {
    const receiptDir = prepReceiptDir();
    writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const ok = assertCeqr021LivePreflight({
      env: bothGuards(),
      receiptDirForTests: receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    expect(ok.ok).toBe(true);
  });
});

describe("CEQR-021 concurrent one-shot race (Blocker 3)", () => {
  it(
    "exactly one concurrent child wins lock; provider construction total is 1",
    async () => {
    const dir = tempDir("ceqr021-race-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    const markerDir = join(dir, "markers");
    mkdirSync(markerDir, { recursive: true });

    const worker = join(
      REPO_ROOT,
      "lib/__tests__/helpers/ceqr021-oneshot-race-worker.ts",
    );
    const baseArgs = [
      "--transpile-only",
      "--compiler-options",
      '{"module":"CommonJS","moduleResolution":"node"}',
      worker,
      `--receiptDir=${receiptDir}`,
      `--claimPath=${harness.claimPath}`,
      `--frozenPlanSha256=${harness.frozenPlanSha256}`,
      `--committedExecutionHead=${harness.committedExecutionHead}`,
      `--markerDir=${markerDir}`,
    ];

    const { spawn: spawnChild } = await import("child_process");
    const runAsync = (workerId: string) =>
      new Promise<{
        stdout: string;
        stderr: string;
        status: number | null;
      }>((resolvePromise) => {
        const child = spawnChild(
          "npx",
          ["ts-node", ...baseArgs, `--workerId=${workerId}`],
          { cwd: REPO_ROOT, env: process.env },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => {
          stdout += String(d);
        });
        child.stderr.on("data", (d) => {
          stderr += String(d);
        });
        child.on("close", (status) => {
          resolvePromise({ stdout, stderr, status });
        });
      });

    const [a, b] = await Promise.all([runAsync("w1"), runAsync("w2")]);
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);

    const parsed = [a, b].map((r) => JSON.parse(r.stdout) as {
      workerId: string;
      consumptionOk: boolean;
      providerConstructed: boolean;
      code?: string;
      message?: string;
    });
    const winners = parsed.filter((p) => p.consumptionOk);
    const losers = parsed.filter((p) => !p.consumptionOk);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.code).toMatch(/execution_locked|already_consumed/);
    expect(winners[0]!.providerConstructed).toBe(true);
    expect(losers[0]!.providerConstructed).toBe(false);

    const constructedMarkers = readdirSync(markerDir).filter((f) =>
      f.endsWith(".provider-constructed"),
    );
    expect(constructedMarkers).toHaveLength(1);

    expect(JSON.parse(readFileSync(harness.claimPath, "utf8")).armingState).toBe(
      "consumed",
    );
    expect(
      existsSync(join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME)),
    ).toBe(true);
  },
  60_000,
  );
});

describe("CEQR-021 strict adversarial classifier (Blocker 4)", () => {
  function catalogsByCaseId(): Ceqr021CatalogsByCaseId {
    return Object.fromEntries(
      buildAllFrozenScenarioCatalogs().map((c) => [c.caseId, c]),
    ) as Ceqr021CatalogsByCaseId;
  }

  function basePassInput() {
    const dry = runCeqr021OfflineDryRun();
    return {
      caseObservations: dry.caseObservations.map((o) => ({ ...o })),
      catalogsByCaseId: catalogsByCaseId(),
      accounting: { ...dry.accounting },
      frozenPlanHashMatched: true,
      scenarioAggregateHashMatched: true,
      schemaPromptAddendumMatched: true,
      oneShotConsumedExactlyOnce: true,
      canonicalPathOk: true,
      productionReady: false as const,
    };
  }

  it("rejects adversarial compatible/ambiguous/source spoofing cases", () => {
    const catalogs = catalogsByCaseId();

    // compatible validation_failed + null classification
    {
      const input = basePassInput();
      const compat = input.caseObservations.find(
        (o) => o.caseId === "compatible_contextual",
      )!;
      compat.adjudicationOutcome = "validation_failed";
      compat.observedClassification = null;
      compat.semanticConsistencyOk = false;
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }

    // compatible abstention
    {
      const input = basePassInput();
      const compat = input.caseObservations.find(
        (o) => o.caseId === "compatible_contextual",
      )!;
      compat.adjudicationOutcome = "abstained";
      compat.observedClassification = null;
      compat.abstentionReason = "unsure";
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }

    // wrong compatible classification
    {
      const input = basePassInput();
      const compat = input.caseObservations.find(
        (o) => o.caseId === "compatible_contextual",
      )!;
      compat.observedClassification = "compatible_contextual_nuance";
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
      expect(CEQR_021_EXPECTED_COMPATIBLE_CLASSIFICATION).toBe(
        "compatible_states",
      );
    }

    // ambiguous validation_failed + null
    {
      const input = basePassInput();
      const amb = input.caseObservations.find(
        (o) => o.caseId === "ambiguous_insufficient",
      )!;
      amb.adjudicationOutcome = "validation_failed";
      amb.observedClassification = null;
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }

    // ambiguous semantic acceptance when abstention required
    {
      const input = basePassInput();
      const amb = input.caseObservations.find(
        (o) => o.caseId === "ambiguous_insufficient",
      )!;
      amb.adjudicationOutcome = "semantic_accepted";
      amb.observedClassification = "compatible_states";
      amb.abstentionReason = null;
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }

    // spoofed message:evil sourceId
    {
      const input = basePassInput();
      const clear = input.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!;
      clear.evidenceA = {
        ...clear.evidenceA!,
        sourceId: "message:evil",
      };
      expect(classifyCeqr021LiveResult(input)).toBe("FAIL_SOURCE_AUTHORITY");
    }

    // wrong exactQuote
    {
      const input = basePassInput();
      const clear = input.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!;
      clear.evidenceA = {
        ...clear.evidenceA!,
        exactQuote: "I do not drink alcohol at all. EXTRA",
      };
      expect(classifyCeqr021LiveResult(input)).toBe("FAIL_SOURCE_AUTHORITY");
    }

    // wrong offsets with approved:true spoof
    {
      const input = basePassInput();
      const clear = input.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!;
      clear.evidenceA = {
        ...clear.evidenceA!,
        startOffset: 1,
        endOffset: 2,
        approved: true,
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }

    // duplicate case replacing missing case
    {
      const input = basePassInput();
      const clear = input.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!;
      input.caseObservations = [
        clear,
        clear,
        input.caseObservations.find(
          (o) => o.caseId === "compatible_contextual",
        )!,
      ];
      expect(classifyCeqr021LiveResult(input)).toBe(
        "FAIL_PROVIDER_OR_TRANSPORT",
      );
    }

    // extra fourth case
    {
      const input = basePassInput();
      input.caseObservations = [
        ...input.caseObservations,
        { ...input.caseObservations[0]! },
      ];
      expect(classifyCeqr021LiveResult(input)).toBe(
        "FAIL_PROVIDER_OR_TRANSPORT",
      );
    }

    // totalProviderAttempts 0 with adj=3/ref=1
    {
      const input = basePassInput();
      input.accounting.totalProviderAttempts = 0;
      expect(classifyCeqr021LiveResult(input)).toBe("FAIL_CALL_BUDGET");
    }

    // totalProviderAttempts 3 with adj=3/ref=1
    {
      const input = basePassInput();
      input.accounting.totalProviderAttempts = 3;
      expect(classifyCeqr021LiveResult(input)).toBe("FAIL_CALL_BUDGET");
    }

    // per-case/global mismatch
    {
      const input = basePassInput();
      const clear = input.caseObservations.find(
        (o) => o.caseId === "clear_contradiction_candidate",
      )!;
      clear.refereeCallCount = 0;
      expect(classifyCeqr021LiveResult(input)).toBe("FAIL_CALL_BUDGET");
    }

    // providerConstructionAttempted 0
    {
      const input = basePassInput();
      input.accounting.providerConstructionAttempted = 0;
      expect(classifyCeqr021LiveResult(input)).toBe(
        "FAIL_PROVIDER_OR_TRANSPORT",
      );
    }

    // liveRunnerInvoked 0
    {
      const input = basePassInput();
      input.accounting.liveRunnerInvoked = 0;
      expect(classifyCeqr021LiveResult(input)).toBe(
        "FAIL_PROVIDER_OR_TRANSPORT",
      );
    }

    void catalogs;
  });
});

describe("CEQR-021 diagnostics and leak validator (Blocker 5)", () => {
  it("inspects both endpoints independently and marks incomplete referee", () => {
    const dry = runCeqr021OfflineDryRun();
    const clear = dry.caseObservations.find(
      (o) => o.caseId === "clear_contradiction_candidate",
    )!;
    const catalogs = buildAllFrozenScenarioCatalogs().find(
      (c) => c.caseId === "clear_contradiction_candidate",
    )!;
    const diagnostics = buildCeqr021CaseDiagnostics({
      observation: clear,
      catalogs,
    });
    expect(diagnostics.sideA.startBoundaryCategory).not.toBeUndefined();
    expect(diagnostics.sideA.endBoundaryCategory).not.toBeUndefined();
    expect(diagnostics.sideA.splitsSurrogateAtStart).not.toBeUndefined();
    expect(diagnostics.sideA.splitsSurrogateAtEnd).not.toBeUndefined();
    expect(diagnostics.sideB.startBoundaryCategory).not.toBeUndefined();
    expect(diagnostics.sideB.endBoundaryCategory).not.toBeUndefined();

    const incomplete = {
      ...clear,
      refereeReached: true,
      refereeCompleted: false,
      refereeFailed: false,
    };
    const diagIncomplete = buildCeqr021CaseDiagnostics({
      observation: incomplete,
      catalogs,
    });
    expect(diagIncomplete.refereeStatus).toBe("incomplete");
  });

  it("leak validator fails on secrets and raw provider dumps", () => {
    expect(
      assertSanitizedReceiptHasNoLeaks(
        JSON.stringify({ note: "sk-abcdefghijklmnopqrstuvwxyz012345" }),
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
    expect(
      assertSanitizedReceiptHasNoLeaks(
        JSON.stringify({
          object: {
            classification: "clear_contradiction",
            rationale: "because",
            normalizedProposition: "x",
            confidence: 0.9,
            bothCanSimultaneouslyBeTrue: false,
            evidenceClaimA: {},
          },
        }),
      ).ok,
    ).toBe(false);

    const dry = runCeqr021OfflineDryRun();
    expect(assertSanitizedReceiptHasNoLeaks(JSON.stringify(dry.diagnostics)).ok).toBe(
      true,
    );
  });
});

describe("CEQR-021 execution-tree verifier (third-review Blocker 1)", () => {
  it("allows freeze+arm artifacts and rejects unrelated dirtiness", () => {
    const repo = tempDir("ceqr021-tree-");
    execGit(repo, ["init"]);
    execGit(repo, ["config", "user.email", "ceqr021@test"]);
    execGit(repo, ["config", "user.name", "ceqr021"]);
    writeFileSync(join(repo, "README.md"), "feature\n", "utf8");
    execGit(repo, ["add", "README.md"]);
    execGit(repo, ["commit", "-m", "feature"]);

    const receiptDir = join(
      repo,
      "docs/agent-runs/receipts",
      CEQR_021_SLICE_ID,
    );
    mkdirSync(receiptDir, { recursive: true });

    expect(
      assertCeqr021ExecutionTree({ cwd: repo, phase: "pre_freeze" }).ok,
    ).toBe(true);

    // Simulate freeze artifacts + armed claim (untracked).
    const harness = writeCeqr021TempArmedHarnessForTests({ receiptDir });
    writeFileSync(
      join(receiptDir, CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME),
      readFileSync(harness.claimPath, "utf8"),
      "utf8",
    );
    // claim is already written as oneshot; unarmed template + plan + claim exist.
    // Re-write unarmed as distinct content if needed — ensure all three names exist.
    expect(existsSync(join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME))).toBe(
      true,
    );
    expect(existsSync(join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME))).toBe(true);

    const ok = assertCeqr021ExecutionTree({
      cwd: repo,
      phase: "pre_live_execution",
      receiptDirForTests: receiptDir,
    });
    expect(ok.ok).toBe(true);

    writeFileSync(join(repo, "UNRELATED.txt"), "nope\n", "utf8");
    expect(
      assertCeqr021ExecutionTree({
        cwd: repo,
        phase: "pre_live_execution",
        receiptDirForTests: receiptDir,
      }).ok,
    ).toBe(false);
    rmSync(join(repo, "UNRELATED.txt"));

    writeFileSync(join(repo, "README.md"), "modified\n", "utf8");
    expect(
      assertCeqr021ExecutionTree({
        cwd: repo,
        phase: "pre_live_execution",
        receiptDirForTests: receiptDir,
      }).ok,
    ).toBe(false);
    execGit(repo, ["checkout", "--", "README.md"]);

    writeFileSync(join(repo, "STAGED.txt"), "staged\n", "utf8");
    execGit(repo, ["add", "STAGED.txt"]);
    expect(
      assertCeqr021ExecutionTree({
        cwd: repo,
        phase: "pre_live_execution",
        receiptDirForTests: receiptDir,
      }).ok,
    ).toBe(false);
    execGit(repo, ["rm", "-f", "--cached", "STAGED.txt"]);
    rmSync(join(repo, "STAGED.txt"), { force: true });

    rmSync(join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME));
    expect(
      assertCeqr021ExecutionTree({
        cwd: repo,
        phase: "pre_live_execution",
        receiptDirForTests: receiptDir,
      }).ok,
    ).toBe(false);

    // Committing freeze artifacts changes HEAD → fail.
    const harness2Dir = tempDir("ceqr021-tree-commit-");
    execGit(harness2Dir, ["init"]);
    execGit(harness2Dir, ["config", "user.email", "ceqr021@test"]);
    execGit(harness2Dir, ["config", "user.name", "ceqr021"]);
    writeFileSync(join(harness2Dir, "README.md"), "feature\n", "utf8");
    execGit(harness2Dir, ["add", "README.md"]);
    execGit(harness2Dir, ["commit", "-m", "feature"]);
    const rd2 = join(
      harness2Dir,
      "docs/agent-runs/receipts",
      CEQR_021_SLICE_ID,
    );
    mkdirSync(rd2, { recursive: true });
    writeCeqr021TempArmedHarnessForTests({ receiptDir: rd2 });
    writeFileSync(
      join(rd2, CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME),
      "{}\n",
      "utf8",
    );
    execGit(harness2Dir, ["add", "-A"]);
    execGit(harness2Dir, ["commit", "-m", "freeze artifacts"]);
    expect(
      assertCeqr021ExecutionTree({
        cwd: harness2Dir,
        phase: "pre_live_execution",
        receiptDirForTests: rd2,
      }).ok,
    ).toBe(false);
  });
});

describe("CEQR-021 receipt finalization gate (third-review Blocker 2)", () => {
  it("finalization leak/exists/io cannot leave PASS", () => {
    const dir = tempDir("ceqr021-finalize-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    const dry = runCeqr021OfflineDryRun();
    const receipt = {
      slice: CEQR_021_SLICE_ID,
      frozenPlanSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      consumedClaimIdentity: {
        armingState: "consumed" as const,
        frozenPlanSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        committedExecutionHead: CEQR_021_BASE_HEAD,
        consumedAt: new Date().toISOString(),
      },
      committedHead: CEQR_021_BASE_HEAD,
      classification: "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED" as const,
      accounting: dry.accounting,
      caseObservations: dry.caseObservations,
      diagnostics: dry.diagnostics,
      productionReady: false as const,
      liveProviderAttempts: dry.accounting.totalProviderAttempts,
      notes: ["OPENAI_API_KEY=leaked-secret", "production readiness: NO"],
    };
    const leak = finalizeCeqr021LiveReceiptAtomic({ receiptDir, receipt });
    expect(leak.ok).toBe(false);
    if (!leak.ok) expect(leak.code).toBe("leak");
    expect(existsSync(join(receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME))).toBe(
      false,
    );

    const clean = {
      ...receipt,
      notes: ["production readiness: NO"],
    };
    const first = finalizeCeqr021LiveReceiptAtomic({
      receiptDir,
      receipt: clean,
    });
    expect(first.ok).toBe(true);
    const second = finalizeCeqr021LiveReceiptAtomic({
      receiptDir,
      receipt: clean,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("receipt_exists");
  });
});

describe("CEQR-021 fingerprint/selection PASS gates (third-review Blocker 4)", () => {
  it("rejects missing selection/fingerprint adversarial cases", () => {
    const catalogsByCaseId = Object.fromEntries(
      buildAllFrozenScenarioCatalogs().map((c) => [c.caseId, c]),
    ) as Ceqr021CatalogsByCaseId;
    const dry = runCeqr021OfflineDryRun();
    const base = {
      caseObservations: dry.caseObservations.map((o) => ({ ...o })),
      catalogsByCaseId,
      accounting: { ...dry.accounting },
      frozenPlanHashMatched: true,
      scenarioAggregateHashMatched: true,
      schemaPromptAddendumMatched: true,
      oneShotConsumedExactlyOnce: true,
      canonicalPathOk: true,
      productionReady: false as const,
    };

    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) =>
          o.caseId === "compatible_contextual"
            ? { ...o, transportSelectionA: null }
            : { ...o },
        ),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) =>
          o.caseId === "ambiguous_insufficient" && o.evidenceA
            ? { ...o, transportSelectionA: null }
            : { ...o },
        ),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) =>
          o.caseId === "compatible_contextual" && o.evidenceA
            ? {
                ...o,
                evidenceA: {
                  ...o.evidenceA,
                  startBoundaryIndex: o.evidenceA.startBoundaryIndex + 1,
                },
              }
            : { ...o },
        ),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) => ({
          ...o,
          rawProviderObjectSha256: null,
        })),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) => ({
          ...o,
          rawProviderObjectSha256: "not-a-sha",
          immutableRawTransportFingerprint: "not-a-sha",
        })),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
    {
      const input = {
        ...base,
        caseObservations: base.caseObservations.map((o) => ({
          ...o,
          immutableRawTransportFingerprint:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        })),
      };
      expect(classifyCeqr021LiveResult(input)).not.toBe(
        "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
      );
    }
  });
});

describe("CEQR-021 crash-durable consume (third-review Blocker 6)", () => {
  it("fault injection after lock leaves inspectable blocked state", () => {
    const dir = tempDir("ceqr021-durable-");
    const receiptDir = join(dir, CEQR_021_SLICE_ID);
    mkdirSync(receiptDir, { recursive: true });
    for (const point of [
      "after_lock_create",
      "after_lock_fsync",
      "after_consumed_temp_write",
      "before_rename",
      "after_rename",
    ] as const) {
      const pointDir = join(dir, point);
      const rd = join(pointDir, CEQR_021_SLICE_ID);
      mkdirSync(rd, { recursive: true });
      const h = writeCeqr021TempArmedHarnessForTests({ receiptDir: rd });
      const result = acquireCeqr021ExecutionLockAndConsumeClaim({
        receiptDir: rd,
        claimPath: h.claimPath,
        frozenPlanSha256: h.frozenPlanSha256,
        committedExecutionHead: h.committedExecutionHead,
        faultInjectForTests: { point },
      });
      if (point === "after_rename") {
        expect(existsSync(join(rd, CEQR_021_EXECUTION_LOCK_FILENAME))).toBe(
          true,
        );
        expect(
          JSON.parse(readFileSync(h.claimPath, "utf8")).armingState,
        ).toBe("consumed");
        expect(result.ok).toBe(false);
      } else if (point === "after_lock_create" || point === "after_lock_fsync") {
        expect(existsSync(join(rd, CEQR_021_EXECUTION_LOCK_FILENAME))).toBe(
          true,
        );
        expect(result.ok).toBe(false);
        const again = acquireCeqr021ExecutionLockAndConsumeClaim({
          receiptDir: rd,
          claimPath: h.claimPath,
          frozenPlanSha256: h.frozenPlanSha256,
          committedExecutionHead: h.committedExecutionHead,
        });
        expect(again.ok).toBe(false);
        if (!again.ok) expect(again.code).toBe("execution_locked");
      } else {
        expect(existsSync(join(rd, CEQR_021_EXECUTION_LOCK_FILENAME))).toBe(
          true,
        );
        expect(result.ok).toBe(false);
      }
    }
  });
});

describe("CEQR-021 changed-files manifest (third-review Blocker 5)", () => {
  it("manifest matches mechanical exact-base listing byte-for-byte", () => {
    const written = writeCeqr021ChangedFilesManifest(REPO_ROOT);
    expect(written.some((f) => f.endsWith("00-intake-and-boundaries.md"))).toBe(
      true,
    );
    expect(
      written.some((f) => f.endsWith("00-opportunity-and-boundaries.md")),
    ).toBe(false);
    const check = assertCeqr021ChangedFilesManifestExact(REPO_ROOT);
    expect(check.ok).toBe(true);
  });
});

function execGit(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}
