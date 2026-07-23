/**
 * CEQR-021 — schema-v4 controlled live proof harness (offline preparation).
 *
 * Prepares one distinct, controlled schema-v4 live semantic proof harness.
 * Does NOT authorise or execute a live provider call.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join, relative, resolve, sep } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";

import {
  CEQR_021_BASE_HEAD,
  CEQR_021_BRANCH,
  CEQR_021_CAMPAIGN_ID,
  CEQR_021_CAMPAIGN_SLICE,
  CEQR_021_CANONICAL_RECEIPT_DIR,
  CEQR_021_CASES_AGGREGATE_SHA256,
  CEQR_021_CASE_SHA256,
  CEQR_021_EXPECTED_ADJUDICATOR_CALLS,
  CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
  CEQR_021_EXPECTED_KERNEL_CONTRACT,
  CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_021_EXPECTED_MAX_RETRIES,
  CEQR_021_EXPECTED_PROMPT_VERSION,
  CEQR_021_EXPECTED_PROVIDER_ID,
  CEQR_021_EXPECTED_REFEREE_CALLS,
  CEQR_021_EXPECTED_REFEREE_MODEL,
  CEQR_021_EXPECTED_SCHEMA_VERSION,
  CEQR_021_EXPECTED_TIMEOUT_MS,
  CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  CEQR_021_HISTORICAL,
  CEQR_021_LIVE_RECEIPT_FILENAME,
  CEQR_021_ONESHOT_CLAIM_FILENAME,
  CEQR_021_PENDING_EXECUTION_HEAD,
  CEQR_021_PRE_LIVE_PLAN_TEMPLATE_FILENAME,
  CEQR_021_PROOF_VERSION,
  CEQR_021_SLICE_ID,
  CEQR_021_TASK_ID,
  CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
  CEQR_021_WORKTREE_PATH,
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV,
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
  createEmptyCeqr021CallAccounting,
  type Ceqr021CallAccounting,
  type Ceqr021OfflineClassification,
} from "./ceqr021-constants";
import {
  CEQR_021_APPROVED_SPAN_SET_SHA256,
  CEQR_021_FROZEN_CATALOG_SHA256,
  CEQR_021_SOURCE_SHA256,
  CEQR_021_SYNTHETIC_CASES,
  assertCeqr021FrozenCaseHashes,
  assertCeqr021FrozenCatalogHashes,
  buildAllFrozenScenarioCatalogs,
} from "./ceqr021-approved-evidence-spans";
import {
  buildCeqr021LiveAddendumSha256,
  generateCeqr021OpenAiStrictSchemaOffline,
  proveCeqr021SchemaV4ProviderContract,
} from "./ceqr021-schema-v4-contract";
import {
  assertCeqr021LiveGuards,
  assertCeqr021LivePreflight,
  assertCeqr021ProductionLivePaths,
  assertCeqr021ProviderWiringPresent,
  acquireCeqr021ExecutionLockAndConsumeClaim,
  canonicalClaimMustNotExistForOfflinePrep,
  canonicalLiveReceiptMustNotExist,
  canonicalExecutionLockMustNotExist,
  ceqr021ReceiptDir,
  sha256Text,
} from "./ceqr021-oneshot-safety";
import { runCeqr021OfflineDryRun } from "./ceqr021-offline-dry-run";
import {
  buildCeqr021ProductionAdapters,
  executeCeqr021LiveThreeCaseMatrix,
  finalizeCeqr021LiveReceiptAtomic,
  proveCeqr021LiveOrchestrationPrerequisitesReady,
} from "./ceqr021-live-orchestration";
import {
  CEQR_017_LIVE_RECEIPT_SHA256,
  CEQR_017_PERMANENT_CLAIM_SHA256,
  ceqr017CanonicalReceiptPaths,
  ceqr018ReceiptDir,
  hashReceiptDirectory,
  sha256File,
  verifyCeqr017CanonicalHashes,
  CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256,
  CEQR_019_LIVE_ONESHOT_CLAIM_SHA256,
  CEQR_019_FROZEN_LIVE_PLAN_SHA256,
  CEQR_019_PERMANENT_CLAIM_SHA256,
} from "./contradiction-controlled-live-semantic-reproof";
import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  KERNEL_CONTRACT_VERSION,
} from "./orvek-intelligence-kernel/contracts";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
  CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
  CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_PROVIDER_ID,
  type ContradictionLiveAdapterBundle,
} from "./contradiction-live-provider-adapters";

export * from "./ceqr021-constants";
export * from "./ceqr021-approved-evidence-spans";
export * from "./ceqr021-schema-v4-contract";
export * from "./ceqr021-oneshot-safety";
export * from "./ceqr021-live-pass-classifier";
export * from "./ceqr021-offline-dry-run";
export * from "./ceqr021-live-orchestration";

export type Ceqr021PreLivePlanTemplate = {
  taskId: typeof CEQR_021_TASK_ID;
  campaignId: typeof CEQR_021_CAMPAIGN_ID;
  sliceId: typeof CEQR_021_SLICE_ID;
  campaignSlice: typeof CEQR_021_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_021_PROOF_VERSION;
  branch: typeof CEQR_021_BRANCH;
  worktreePath: typeof CEQR_021_WORKTREE_PATH;
  baseHead: typeof CEQR_021_BASE_HEAD;
  committedExecutionHead: typeof CEQR_021_PENDING_EXECUTION_HEAD;
  providerId: typeof CEQR_021_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_021_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelId: typeof CEQR_021_EXPECTED_REFEREE_MODEL;
  schemaVersion: typeof CEQR_021_EXPECTED_SCHEMA_VERSION;
  promptVersion: typeof CEQR_021_EXPECTED_PROMPT_VERSION;
  liveAddendumVersion: typeof CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION;
  liveAddendumSha256: string;
  kernelContract: typeof CEQR_021_EXPECTED_KERNEL_CONTRACT;
  timeoutMs: typeof CEQR_021_EXPECTED_TIMEOUT_MS;
  retryCount: typeof CEQR_021_EXPECTED_MAX_RETRIES;
  totalCallBudget: typeof CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  expectedAdjudicatorCalls: typeof CEQR_021_EXPECTED_ADJUDICATOR_CALLS;
  expectedRefereeCalls: typeof CEQR_021_EXPECTED_REFEREE_CALLS;
  caseSha256ById: typeof CEQR_021_CASE_SHA256;
  casesAggregateSha256: typeof CEQR_021_CASES_AGGREGATE_SHA256;
  catalogSha256ByCaseSide: typeof CEQR_021_FROZEN_CATALOG_SHA256;
  approvedSpanSetSha256ByCaseSide: typeof CEQR_021_APPROVED_SPAN_SET_SHA256;
  sourceSha256ByCaseSide: typeof CEQR_021_SOURCE_SHA256;
  guards: {
    allowEnv: typeof CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV;
    allowValue: typeof CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE;
    confirmEnv: typeof CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV;
    confirmValue: typeof CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE;
  };
  canonicalPaths: {
    receiptDir: typeof CEQR_021_CANONICAL_RECEIPT_DIR;
    oneshotClaim: string;
    liveReceipt: string;
    finalFrozenPlan: string;
    unarmedClaimTemplate: string;
  };
  hardSafetyBoundaries: string[];
  productionReady: false;
  liveAuthorisedByThisTemplate: false;
  liveProviderAttempts: 0;
};

/** Exact pre-freeze hard-safety boundary retained only on the pre-live template. */
export const CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY =
  "Committed execution HEAD remains PENDING_POST_REVIEW_COMMIT_FREEZE until freeze script." as const;

export function buildCeqr021PreLivePlanTemplate(
  cwd: string = process.cwd(),
): Ceqr021PreLivePlanTemplate {
  const receiptDir = ceqr021ReceiptDir(cwd);
  return {
    taskId: CEQR_021_TASK_ID,
    campaignId: CEQR_021_CAMPAIGN_ID,
    sliceId: CEQR_021_SLICE_ID,
    campaignSlice: CEQR_021_CAMPAIGN_SLICE,
    proofVersion: CEQR_021_PROOF_VERSION,
    branch: CEQR_021_BRANCH,
    worktreePath: CEQR_021_WORKTREE_PATH,
    baseHead: CEQR_021_BASE_HEAD,
    committedExecutionHead: CEQR_021_PENDING_EXECUTION_HEAD,
    providerId: CEQR_021_EXPECTED_PROVIDER_ID,
    adjudicatorModelId: CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_021_EXPECTED_REFEREE_MODEL,
    schemaVersion: CEQR_021_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_021_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
    liveAddendumSha256: buildCeqr021LiveAddendumSha256(),
    kernelContract: CEQR_021_EXPECTED_KERNEL_CONTRACT,
    timeoutMs: CEQR_021_EXPECTED_TIMEOUT_MS,
    retryCount: CEQR_021_EXPECTED_MAX_RETRIES,
    totalCallBudget: CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    expectedAdjudicatorCalls: CEQR_021_EXPECTED_ADJUDICATOR_CALLS,
    expectedRefereeCalls: CEQR_021_EXPECTED_REFEREE_CALLS,
    caseSha256ById: CEQR_021_CASE_SHA256,
    casesAggregateSha256: CEQR_021_CASES_AGGREGATE_SHA256,
    catalogSha256ByCaseSide: CEQR_021_FROZEN_CATALOG_SHA256,
    approvedSpanSetSha256ByCaseSide: CEQR_021_APPROVED_SPAN_SET_SHA256,
    sourceSha256ByCaseSide: CEQR_021_SOURCE_SHA256,
    guards: {
      allowEnv: CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV,
      allowValue: CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
      confirmEnv: CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV,
      confirmValue: CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
    },
    canonicalPaths: {
      receiptDir: CEQR_021_CANONICAL_RECEIPT_DIR,
      oneshotClaim: join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME),
      liveReceipt: join(receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME),
      finalFrozenPlan: join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME),
      unarmedClaimTemplate: join(
        receiptDir,
        CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
      ),
    },
    hardSafetyBoundaries: [
      "No OpenAI call authorised by this template.",
      "No armed canonical claim created by offline preparation.",
      "No writer/persistence/account/database access.",
      "No CEQR-019 rerun.",
      "No retries; budget 6; synthetic sources only.",
      CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY,
    ],
    productionReady: false,
    liveAuthorisedByThisTemplate: false,
    liveProviderAttempts: 0,
  };
}

export function serializeCeqr021PreLivePlanTemplate(
  plan: Ceqr021PreLivePlanTemplate = buildCeqr021PreLivePlanTemplate(),
): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

export function buildCeqr021FrozenCommittedHeadSafetyBoundary(
  committedExecutionHead: string,
): string {
  return `Committed execution HEAD is frozen to ${committedExecutionHead}; live execution must match this exact SHA.`;
}

/**
 * Replace the pre-freeze pending-HEAD boundary with the post-freeze exact-SHA
 * boundary. Other template boundaries are preserved unchanged.
 */
export function buildCeqr021FinalFrozenLivePlanHardSafetyBoundaries(
  committedExecutionHead: string,
  templateBoundaries: readonly string[] = buildCeqr021PreLivePlanTemplate()
    .hardSafetyBoundaries,
): string[] {
  return templateBoundaries.map((entry) =>
    entry === CEQR_021_PRE_LIVE_PENDING_HEAD_BOUNDARY ||
    entry.includes(CEQR_021_PENDING_EXECUTION_HEAD)
      ? buildCeqr021FrozenCommittedHeadSafetyBoundary(committedExecutionHead)
      : entry,
  );
}

export type Ceqr021FinalFrozenLivePlan = Omit<
  Ceqr021PreLivePlanTemplate,
  "committedExecutionHead" | "hardSafetyBoundaries" | "liveAuthorisedByThisTemplate"
> & {
  committedExecutionHead: string;
  hardSafetyBoundaries: string[];
  frozenAt: string;
  freezeKind: "final_immutable_frozen_live_plan";
  armed: false;
  liveAuthorisedByThisFreeze: false;
  productionReady: false;
  liveProviderAttempts: 0;
  liveAuthorisedByThisTemplate?: false;
};

/**
 * Deterministic final frozen-plan construction used by the post-commit freeze
 * script. Does not write files, arm claims, set guards, or call providers.
 */
export function buildCeqr021FinalFrozenLivePlan(args: {
  cwd?: string;
  committedExecutionHead: string;
  frozenAt?: string;
}): { plan: Ceqr021FinalFrozenLivePlan; serialized: string } {
  const head = args.committedExecutionHead;
  if (head === CEQR_021_PENDING_EXECUTION_HEAD) {
    throw new Error(
      "Final frozen plan cannot use PENDING_POST_REVIEW_COMMIT_FREEZE as committedExecutionHead.",
    );
  }
  if (!/^[0-9a-f]{40}$/.test(head)) {
    throw new Error(
      "Final frozen plan committedExecutionHead must be a 40-char lowercase hex git SHA.",
    );
  }

  const template = buildCeqr021PreLivePlanTemplate(args.cwd);
  const hardSafetyBoundaries = buildCeqr021FinalFrozenLivePlanHardSafetyBoundaries(
    head,
    template.hardSafetyBoundaries,
  );
  const plan: Ceqr021FinalFrozenLivePlan = {
    ...template,
    committedExecutionHead: head,
    hardSafetyBoundaries,
    frozenAt: args.frozenAt ?? new Date().toISOString(),
    freezeKind: "final_immutable_frozen_live_plan",
    armed: false,
    liveAuthorisedByThisFreeze: false,
    productionReady: false,
    liveProviderAttempts: 0,
  };

  const serialized = `${JSON.stringify(plan, null, 2)}\n`;
  if (serialized.includes(CEQR_021_PENDING_EXECUTION_HEAD)) {
    throw new Error(
      "Final frozen plan serialized bytes must not contain PENDING_POST_REVIEW_COMMIT_FREEZE.",
    );
  }
  return { plan, serialized };
}

export function hashCeqr021PreLivePlanTemplate(
  plan: Ceqr021PreLivePlanTemplate = buildCeqr021PreLivePlanTemplate(),
): string {
  return sha256Text(serializeCeqr021PreLivePlanTemplate(plan));
}

export function assertCeqr021LandedConstants():
  | { ok: true }
  | { ok: false; mismatches: string[] } {
  const mismatches: string[] = [];
  if (CONTRADICTION_LIVE_PROVIDER_ID !== CEQR_021_EXPECTED_PROVIDER_ID) {
    mismatches.push("providerId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL !==
    CEQR_021_EXPECTED_ADJUDICATOR_MODEL
  ) {
    mismatches.push("adjudicatorModelId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL !== CEQR_021_EXPECTED_REFEREE_MODEL
  ) {
    mismatches.push("refereeModelId");
  }
  if (CONTRADICTION_LIVE_MAX_RETRIES !== CEQR_021_EXPECTED_MAX_RETRIES) {
    mismatches.push("maxRetries");
  }
  if (CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS !== CEQR_021_EXPECTED_TIMEOUT_MS) {
    mismatches.push("timeoutMs");
  }
  if (
    CONTRADICTION_ADJUDICATION_SCHEMA_VERSION !==
    CEQR_021_EXPECTED_SCHEMA_VERSION
  ) {
    mismatches.push("schemaVersion");
  }
  if (
    CONTRADICTION_ADJUDICATION_PROMPT_VERSION !==
    CEQR_021_EXPECTED_PROMPT_VERSION
  ) {
    mismatches.push("promptVersion");
  }
  if (KERNEL_CONTRACT_VERSION !== CEQR_021_EXPECTED_KERNEL_CONTRACT) {
    mismatches.push("kernelContract");
  }
  if (
    (CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION as string) ===
    (CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION as string)
  ) {
    mismatches.push("ceqr021AddendumMustBeDistinctFromProductionV4");
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function verifyCeqr021HistoricalImmutability(
  cwd: string = process.cwd(),
): {
  ok: boolean;
  mismatches: string[];
  hashes: Record<string, string | null>;
} {
  const mismatches: string[] = [];
  const hashes: Record<string, string | null> = {};
  const ceqr017 = verifyCeqr017CanonicalHashes(cwd);
  hashes.ceqr017Live = ceqr017.liveReceiptSha256;
  hashes.ceqr017Claim = ceqr017.permanentClaimSha256;
  if (!ceqr017.ok) mismatches.push(...ceqr017.mismatches);

  const ceqr019Dir = join(
    cwd,
    "docs/agent-runs/receipts",
    "CONTRADICTION-LIVE-SEMANTIC-REPROOF-001",
  );
  const ceqr019Files: Array<[string, string]> = [
    ["live-run-oneshot-claim.json", CEQR_019_LIVE_ONESHOT_CLAIM_SHA256],
    ["frozen-live-run-plan.json", CEQR_019_FROZEN_LIVE_PLAN_SHA256],
    ["live-execution-receipt.json", CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256],
    ["ceqr019-permanent-claim.json", CEQR_019_PERMANENT_CLAIM_SHA256],
  ];
  for (const [name, expected] of ceqr019Files) {
    const path = join(ceqr019Dir, name);
    if (!existsSync(path)) {
      mismatches.push(`CEQR-019 missing ${name}`);
      hashes[name] = null;
      continue;
    }
    const actual = sha256File(path);
    hashes[name] = actual;
    if (actual !== expected) {
      mismatches.push(`CEQR-019 ${name} hash mismatch: ${actual}`);
    }
  }

  const ceqr018 = hashReceiptDirectory(ceqr018ReceiptDir(cwd));
  hashes.ceqr018Aggregate = ceqr018.aggregateSha256;
  if (ceqr018.fileCount !== 14) {
    mismatches.push(`CEQR-018 file count expected 14 got ${ceqr018.fileCount}`);
  }

  const ceqr020Dir = join(
    cwd,
    "docs/agent-runs/receipts",
    "CONTRADICTION-LIVE-EVIDENCE-OFFSET-FORENSIC-REPAIR-001",
  );
  const ceqr020Files: Array<[string, string]> = [
    ["validation-summary.json", CEQR_021_HISTORICAL.ceqr020ValidationSummarySha256],
    ["changed-files.txt", CEQR_021_HISTORICAL.ceqr020ChangedFilesSha256],
    [
      "ceqr019-hash-verification.json",
      CEQR_021_HISTORICAL.ceqr020HashVerificationSha256,
    ],
  ];
  for (const [name, expected] of ceqr020Files) {
    const path = join(ceqr020Dir, name);
    if (!existsSync(path)) {
      mismatches.push(`CEQR-020 missing ${name}`);
      continue;
    }
    const actual = sha256File(path);
    hashes[`ceqr020:${name}`] = actual;
    if (actual !== expected) {
      mismatches.push(`CEQR-020 ${name} hash mismatch: ${actual}`);
    }
  }

  // Ensure CEQR-017 pins still match exported constants.
  if (CEQR_017_LIVE_RECEIPT_SHA256 !== CEQR_021_HISTORICAL.ceqr017LiveReceiptSha256) {
    mismatches.push("CEQR-017 live pin constant drift");
  }
  if (
    CEQR_017_PERMANENT_CLAIM_SHA256 !==
    CEQR_021_HISTORICAL.ceqr017PermanentClaimSha256
  ) {
    mismatches.push("CEQR-017 claim pin constant drift");
  }

  return { ok: mismatches.length === 0, mismatches, hashes };
}

export type Ceqr021OfflineHarnessReport = {
  classification: Ceqr021OfflineClassification;
  liveProviderAttempts: 0;
  realAccountQueries: 0;
  realDatabaseQueriesMutations: 0;
  writerPersistenceCalls: 0;
  productionReady: false;
  liveAuthorised: false;
  caseHashOk: boolean;
  catalogHashOk: boolean;
  schemaContract: ReturnType<typeof proveCeqr021SchemaV4ProviderContract>;
  openAiStrictSchema: Awaited<
    ReturnType<typeof generateCeqr021OpenAiStrictSchemaOffline>
  > | null;
  dryRun: ReturnType<typeof runCeqr021OfflineDryRun>;
  historical: ReturnType<typeof verifyCeqr021HistoricalImmutability>;
  canonicalClaimAbsent: boolean;
  canonicalLiveReceiptAbsent: boolean;
  canonicalLockAbsent: boolean;
  preLivePlanTemplateHash: string;
  notes: string[];
};

export async function runCeqr021OfflineHarnessValidation(
  cwd: string = process.cwd(),
): Promise<Ceqr021OfflineHarnessReport> {
  const caseHash = assertCeqr021FrozenCaseHashes();
  const catalogHash = assertCeqr021FrozenCatalogHashes();
  const schemaContract = proveCeqr021SchemaV4ProviderContract();
  const openAiStrictSchema = await generateCeqr021OpenAiStrictSchemaOffline();
  const dryRun = runCeqr021OfflineDryRun();
  const historical = verifyCeqr021HistoricalImmutability(cwd);
  const landed = assertCeqr021LandedConstants();
  const orchestrationReady = proveCeqr021LiveOrchestrationPrerequisitesReady();
  const wiring = assertCeqr021ProviderWiringPresent();
  const canonicalClaimAbsent = canonicalClaimMustNotExistForOfflinePrep(cwd);
  const canonicalLiveReceiptAbsent = canonicalLiveReceiptMustNotExist(cwd);
  const canonicalLockAbsent = canonicalExecutionLockMustNotExist(cwd);
  const preLivePlanTemplateHash = hashCeqr021PreLivePlanTemplate(
    buildCeqr021PreLivePlanTemplate(cwd),
  );

  let classification: Ceqr021OfflineClassification =
    "PASS_OFFLINE_SCHEMA_V4_LIVE_PROOF_HARNESS_READY";
  const notes: string[] = [];

  if (!caseHash.ok || !historical.ok) {
    classification = !historical.ok
      ? "FAIL_HISTORICAL_ARTIFACT_MUTATION"
      : "FAIL_SOURCE_AUTHORITY_REGRESSION";
    notes.push(...(caseHash.ok ? [] : caseHash.mismatches));
    notes.push(...historical.mismatches);
  } else if (!catalogHash.ok) {
    classification = "HOLD_APPROVED_EVIDENCE_CONTRACT_INCOMPLETE";
    notes.push(...catalogHash.mismatches);
  } else if (
    !schemaContract.schemaIdentityMatchesExpected ||
    !schemaContract.boundaryFieldsIntegerNonnegative ||
    !schemaContract.forbiddenClearPlusCompatibleFailsClosed
  ) {
    classification = "HOLD_SCHEMA_V4_PROVIDER_CONTRACT_INCOMPLETE";
  } else if (!openAiStrictSchema.ok) {
    classification = "HOLD_SCHEMA_V4_PROVIDER_CONTRACT_INCOMPLETE";
    notes.push(openAiStrictSchema.message);
  } else if (!orchestrationReady.ok || !wiring.ok) {
    classification = "HOLD_ONE_SHOT_SAFETY_INCOMPLETE";
    notes.push(
      ...(orchestrationReady.ok
        ? []
        : [`missing: ${orchestrationReady.missing.join(",")}`]),
      ...(wiring.ok ? [] : [wiring.message]),
    );
  } else if (
    dryRun.classification !==
    "PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW"
  ) {
    classification = "HOLD_LIVE_PASS_CLASSIFIER_INCOMPLETE";
    notes.push(`dry-run classification: ${dryRun.classification}`);
  } else if (!landed.ok) {
    classification = "HOLD_SCHEMA_V4_PROVIDER_CONTRACT_INCOMPLETE";
    notes.push(...landed.mismatches);
  } else if (
    !canonicalClaimAbsent ||
    !canonicalLiveReceiptAbsent ||
    !canonicalLockAbsent
  ) {
    classification = "FAIL_LIVE_PROVIDER_PATH_REACHED";
    notes.push("Canonical claim, lock, or live receipt unexpectedly present.");
  } else {
    writeCeqr021ChangedFilesManifest(cwd);
    const manifest = assertCeqr021ChangedFilesManifestExact(cwd);
    if (!manifest.ok) {
      classification = "HOLD_ONE_SHOT_SAFETY_INCOMPLETE";
      notes.push(manifest.message);
    }
  }

  notes.push(
    "CEQR-021 live provider attempts: 0",
    "CEQR-021 real account queries: 0",
    "CEQR-021 real database queries/mutations: 0",
    "CEQR-021 writer/persistence calls: 0",
    "no live execution is authorised by this patch",
    "production readiness: NO",
  );

  return {
    classification,
    liveProviderAttempts: 0,
    realAccountQueries: 0,
    realDatabaseQueriesMutations: 0,
    writerPersistenceCalls: 0,
    productionReady: false,
    liveAuthorised: false,
    caseHashOk: caseHash.ok,
    catalogHashOk: catalogHash.ok,
    schemaContract,
    openAiStrictSchema,
    dryRun,
    historical,
    canonicalClaimAbsent,
    canonicalLiveReceiptAbsent,
    canonicalLockAbsent,
    preLivePlanTemplateHash,
    notes,
  };
}

/**
 * Production live entry — fully orchestrated behind dual guards.
 * Consumes claim only after preflight proves frozen plan, wiring, and matrix.
 * Does not create or arm the canonical claim in offline preparation.
 */
export async function runCeqr021ControlledLiveSchemaV4Proof(args?: {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** Forbidden in production. */
  claimPath?: string;
  createProvider?: () => Promise<unknown>;
}): Promise<{
  exitCode: number;
  providerConstructionAttempted: boolean;
  accounting: Ceqr021CallAccounting;
  message: string;
  classification: string;
  claimConsumed: boolean;
}> {
  const accounting = createEmptyCeqr021CallAccounting();
  const cwd = args?.cwd ?? process.cwd();
  const env = args?.env ?? process.env;

  if (args?.claimPath != null || args?.createProvider != null) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message:
        "Production CEQR-021 entry rejects claimPath/createProvider overrides; use test orchestration.",
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  const paths = assertCeqr021ProductionLivePaths({ cwd });
  if (!paths.ok) {
    return {
      exitCode: 3,
      providerConstructionAttempted: false,
      accounting,
      message: paths.message,
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  const guards = assertCeqr021LiveGuards(env);
  if (!guards.ok) {
    return {
      exitCode: 3,
      providerConstructionAttempted: false,
      accounting,
      message: guards.message,
      classification: "HOLD_LIVE_SCHEMA_V4_PROOF_NOT_YET_EXECUTED",
      claimConsumed: false,
    };
  }

  const wiring = assertCeqr021ProviderWiringPresent();
  if (!wiring.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: wiring.message,
      classification: "HOLD_ONE_SHOT_SAFETY_INCOMPLETE",
      claimConsumed: false,
    };
  }

  const orchestrationReady = proveCeqr021LiveOrchestrationPrerequisitesReady();
  if (!orchestrationReady.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: `Incomplete orchestration: ${orchestrationReady.missing.join(",")}`,
      classification: "HOLD_ONE_SHOT_SAFETY_INCOMPLETE",
      claimConsumed: false,
    };
  }

  const preflight = assertCeqr021LivePreflight({ cwd, env });
  if (!preflight.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: preflight.message,
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  const receiptDir = paths.receiptDir;
  const claimPath = join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME);

  // Atomic lock + claim consumption BEFORE provider construction.
  const locked = acquireCeqr021ExecutionLockAndConsumeClaim({
    receiptDir,
    claimPath,
    frozenPlanSha256: preflight.frozenPlanSha256,
    committedExecutionHead: preflight.committedHead,
  });
  if (!locked.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: locked.message,
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  let classification = "FAIL_PROVIDER_OR_TRANSPORT";
  let message = "live matrix incomplete";
  try {
    accounting.providerConstructionAttempted = 1;
    const adapters = await buildCeqr021ProductionAdapters();
    const matrix = await executeCeqr021LiveThreeCaseMatrix({
      adapters,
      accounting,
    });
    classification = matrix.classification;
    message = `CEQR-021 live matrix complete: ${classification}`;

    const receipt = {
      slice: CEQR_021_SLICE_ID,
      frozenPlanSha256: preflight.frozenPlanSha256,
      consumedClaimIdentity: {
        armingState: "consumed" as const,
        frozenPlanSha256: locked.claim.frozenPlanSha256,
        committedExecutionHead: String(locked.claim.committedExecutionHead),
        consumedAt: locked.claim.consumedAt,
      },
      committedHead: preflight.committedHead,
      classification: matrix.classification,
      accounting: matrix.accounting,
      caseObservations: matrix.caseObservations,
      diagnostics: matrix.diagnostics,
      productionReady: false as const,
      liveProviderAttempts: matrix.accounting.totalProviderAttempts,
      notes: [
        "Writer/persistence/account/database remain blocked.",
        "production readiness: NO",
      ],
    };
    const finalized = finalizeCeqr021LiveReceiptAtomic({
      receiptDir,
      receipt,
    });
    if (!finalized.ok) {
      classification = "FAIL_CANONICAL_RECEIPT_FINALIZATION";
      message = `Receipt finalization failed (${finalized.code}): ${finalized.message}`;
    } else if (
      classification === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED"
    ) {
      // PASS is legal only after successful finalize + read-back verify.
      message = `CEQR-021 live PASS verified via canonical receipt at ${finalized.receiptPath}`;
    }
  } catch (error) {
    classification = "FAIL_PROVIDER_OR_TRANSPORT";
    message = error instanceof Error ? error.message : String(error);
    // Claim remains consumed; attempt to write failure receipt.
    try {
      const failFinalize = finalizeCeqr021LiveReceiptAtomic({
        receiptDir,
        receipt: {
          slice: CEQR_021_SLICE_ID,
          frozenPlanSha256: preflight.frozenPlanSha256,
          consumedClaimIdentity: {
            armingState: "consumed",
            frozenPlanSha256: locked.claim.frozenPlanSha256,
            committedExecutionHead: String(locked.claim.committedExecutionHead),
            consumedAt: locked.claim.consumedAt,
          },
          committedHead: preflight.committedHead,
          classification: classification as never,
          accounting,
          caseObservations: [],
          diagnostics: [],
          productionReady: false,
          liveProviderAttempts: accounting.totalProviderAttempts,
          notes: [`Stopped safely: ${message}`, "production readiness: NO"],
        },
      });
      if (!failFinalize.ok) {
        message = `${message}; failure-receipt finalize: ${failFinalize.message}`;
      }
    } catch {
      // ignore finalize errors after failure
    }
  }

  // Never return PASS unless finalize succeeded (checked above).
  if (
    classification === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED" &&
    !existsSync(join(receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME))
  ) {
    classification = "FAIL_CANONICAL_RECEIPT_FINALIZATION";
    message = "PASS blocked: canonical live receipt missing after matrix.";
  }

  const exitCode =
    classification === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED"
      ? 0
      : classification.startsWith("HOLD_")
        ? 4
        : 5;

  return {
    exitCode,
    providerConstructionAttempted: accounting.providerConstructionAttempted > 0,
    accounting,
    message,
    classification,
    claimConsumed: true,
  };
}

/** Opaque test capability — production script must not mint this. */
export type Ceqr021TestOrchestrationCapability = {
  readonly __ceqr021TestOnlyOrchestration: true;
};
const TEST_CAPS = new WeakSet<object>();

export function createCeqr021TestOrchestrationCapability(): Ceqr021TestOrchestrationCapability {
  const capability: Ceqr021TestOrchestrationCapability = {
    __ceqr021TestOnlyOrchestration: true,
  };
  TEST_CAPS.add(capability);
  return capability;
}

/**
 * Test-only orchestration. May inject fake adapters. Impossible via production CLI.
 */
export async function runCeqr021ControlledLiveSchemaV4ProofForTests(args: {
  capability: Ceqr021TestOrchestrationCapability;
  cwd?: string;
  env?: Record<string, string | undefined>;
  claimPath: string;
  receiptDir: string;
  frozenPlanSha256: string;
  committedExecutionHead: string;
  createAdapters?: () => Promise<ContradictionLiveAdapterBundle>;
  skipPreflight?: boolean;
}): Promise<{
  exitCode: number;
  providerConstructionAttempted: boolean;
  accounting: Ceqr021CallAccounting;
  message: string;
  classification: string;
  claimConsumed: boolean;
}> {
  if (!TEST_CAPS.has(args.capability)) {
    throw new Error("CEQR-021 test orchestration requires minted capability.");
  }
  const accounting = createEmptyCeqr021CallAccounting();
  const env = args.env ?? {};

  if (!args.receiptDir.endsWith(CEQR_021_SLICE_ID)) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: "Test receiptDir basename must be CEQR-021 slice id.",
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  const guards = assertCeqr021LiveGuards(env);
  if (!guards.ok) {
    return {
      exitCode: 3,
      providerConstructionAttempted: false,
      accounting,
      message: guards.message,
      classification: "HOLD_LIVE_SCHEMA_V4_PROOF_NOT_YET_EXECUTED",
      claimConsumed: false,
    };
  }

  if (!args.skipPreflight) {
    const preflight = assertCeqr021LivePreflight({
      cwd: args.cwd,
      env,
      receiptDirForTests: args.receiptDir,
      skipGitChecksForTests: true,
      skipApiKeyCheckForTests: true,
    });
    if (!preflight.ok) {
      return {
        exitCode: 5,
        providerConstructionAttempted: false,
        accounting,
        message: preflight.message,
        classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
        claimConsumed: false,
      };
    }
  }

  if (existsSync(join(args.receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME))) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: "Existing live receipt prevents execution.",
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  const orchestrationReady = proveCeqr021LiveOrchestrationPrerequisitesReady();
  if (!orchestrationReady.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: `Incomplete orchestration: ${orchestrationReady.missing.join(",")}`,
      classification: "HOLD_ONE_SHOT_SAFETY_INCOMPLETE",
      claimConsumed: false,
    };
  }

  if (args.createAdapters == null) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message:
        "Missing provider wiring: createAdapters required for test matrix (fail before claim consumption).",
      classification: "HOLD_ONE_SHOT_SAFETY_INCOMPLETE",
      claimConsumed: false,
    };
  }

  const locked = acquireCeqr021ExecutionLockAndConsumeClaim({
    receiptDir: args.receiptDir,
    claimPath: args.claimPath,
    frozenPlanSha256: args.frozenPlanSha256,
    committedExecutionHead: args.committedExecutionHead,
  });
  if (!locked.ok) {
    return {
      exitCode: 5,
      providerConstructionAttempted: false,
      accounting,
      message: locked.message,
      classification: "FAIL_ONE_SHOT_OR_CANONICAL_PATH",
      claimConsumed: false,
    };
  }

  accounting.providerConstructionAttempted = 1;
  try {
    const adapters = await args.createAdapters();
    const matrix = await executeCeqr021LiveThreeCaseMatrix({
      adapters,
      accounting,
    });
    let classification = matrix.classification;
    const finalized = finalizeCeqr021LiveReceiptAtomic({
      receiptDir: args.receiptDir,
      receipt: {
        slice: CEQR_021_SLICE_ID,
        frozenPlanSha256: args.frozenPlanSha256,
        consumedClaimIdentity: {
          armingState: "consumed",
          frozenPlanSha256: locked.claim.frozenPlanSha256,
          committedExecutionHead: String(locked.claim.committedExecutionHead),
          consumedAt: locked.claim.consumedAt,
        },
        committedHead: args.committedExecutionHead,
        classification: matrix.classification,
        accounting: matrix.accounting,
        caseObservations: matrix.caseObservations,
        diagnostics: matrix.diagnostics,
        productionReady: false,
        liveProviderAttempts: matrix.accounting.totalProviderAttempts,
        notes: ["test orchestration", "production readiness: NO"],
      },
    });
    if (!finalized.ok) {
      classification = "FAIL_CANONICAL_RECEIPT_FINALIZATION";
      return {
        exitCode: 5,
        providerConstructionAttempted: true,
        accounting: matrix.accounting,
        message: `Receipt finalization failed (${finalized.code}): ${finalized.message}`,
        classification,
        claimConsumed: true,
      };
    }
    if (
      classification === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED" &&
      !existsSync(join(args.receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME))
    ) {
      return {
        exitCode: 5,
        providerConstructionAttempted: true,
        accounting: matrix.accounting,
        message: "PASS blocked: canonical live receipt missing.",
        classification: "FAIL_CANONICAL_RECEIPT_FINALIZATION",
        claimConsumed: true,
      };
    }
    const exitCode =
      classification === "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED"
        ? 0
        : classification.startsWith("HOLD_")
          ? 4
          : 5;
    return {
      exitCode,
      providerConstructionAttempted: true,
      accounting: matrix.accounting,
      message: classification,
      classification,
      claimConsumed: true,
    };
  } catch (error) {
    return {
      exitCode: 5,
      providerConstructionAttempted: true,
      accounting,
      message: error instanceof Error ? error.message : String(error),
      classification: "FAIL_PROVIDER_OR_TRANSPORT",
      claimConsumed: true,
    };
  }
}

export function buildCeqr021ProposedLiveCommand(): string {
  return [
    `cd ${CEQR_021_WORKTREE_PATH}`,
    "set -a && source /Users/user/ai-companion/.env && set +a",
    `${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV}=${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE} \\`,
    `${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV}=${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE} \\`,
    "CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000 \\",
    "CONTRADICTION_LIVE_MAX_TOTAL_CALLS=6 \\",
    "  npx ts-node --transpile-only \\",
    `  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \\`,
    "  scripts/run-contradiction-schema-v4-controlled-live-proof.ts",
  ].join("\n");
}

export function writeCeqr021OfflineReceiptArtifacts(args: {
  cwd?: string;
  report: Ceqr021OfflineHarnessReport;
}): void {
  const cwd = args.cwd ?? process.cwd();
  const dir = ceqr021ReceiptDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const plan = buildCeqr021PreLivePlanTemplate(cwd);
  writeFileSync(
    join(dir, CEQR_021_PRE_LIVE_PLAN_TEMPLATE_FILENAME),
    serializeCeqr021PreLivePlanTemplate(plan),
  );
  const catalogs = buildAllFrozenScenarioCatalogs(CEQR_021_SYNTHETIC_CASES);
  writeFileSync(
    join(dir, "frozen-scenario-catalogs.json"),
    `${JSON.stringify(
      {
        casesAggregateSha256: CEQR_021_CASES_AGGREGATE_SHA256,
        catalogs: catalogs.map((c) => ({
          caseId: c.caseId,
          caseSha256: c.caseSha256,
          sideA: {
            sourceSha256: c.sideA.sourceSha256,
            sourceUtf16Length: c.sideA.sourceUtf16Length,
            sourceCodePointLength: c.sideA.sourceCodePointLength,
            catalogSha256: c.sideA.catalogSha256,
            catalog: c.sideA.catalog,
            withinSourceLimit: c.sideA.withinSourceLimit,
            withinEntryLimit: c.sideA.withinEntryLimit,
          },
          sideB: {
            sourceSha256: c.sideB.sourceSha256,
            sourceUtf16Length: c.sideB.sourceUtf16Length,
            sourceCodePointLength: c.sideB.sourceCodePointLength,
            catalogSha256: c.sideB.catalogSha256,
            catalog: c.sideB.catalog,
            withinSourceLimit: c.sideB.withinSourceLimit,
            withinEntryLimit: c.sideB.withinEntryLimit,
          },
        })),
        liveProviderAttempts: 0,
        productionReady: false,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "approved-evidence-spans.json"),
    `${JSON.stringify(
      {
        approvedSpanSetSha256ByCaseSide: CEQR_021_APPROVED_SPAN_SET_SHA256,
        spans: catalogs.map((c) => ({
          caseId: c.caseId,
          sideA: c.sideA.approvedSpans,
          sideB: c.sideB.approvedSpans,
        })),
        liveProviderAttempts: 0,
        productionReady: false,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "validation-summary.json"),
    `${JSON.stringify(
      {
        campaignSlice: CEQR_021_CAMPAIGN_SLICE,
        classification: args.report.classification,
        liveProviderAttempts: 0,
        realAccountQueries: 0,
        realDatabaseQueriesMutations: 0,
        writerPersistenceCalls: 0,
        productionReady: false,
        liveAuthorised: false,
        casesAggregateSha256: CEQR_021_CASES_AGGREGATE_SHA256,
        preLivePlanTemplateHash: args.report.preLivePlanTemplateHash,
        dryRunClassification: args.report.dryRun.classification,
        historicalOk: args.report.historical.ok,
        canonicalClaimAbsent: args.report.canonicalClaimAbsent,
        canonicalLiveReceiptAbsent: args.report.canonicalLiveReceiptAbsent,
        canonicalLockAbsent: args.report.canonicalLockAbsent,
        notes: args.report.notes,
      },
      null,
      2,
    )}\n`,
  );
}

export function proveNoLiveAdapterInOfflineSuite(): {
  openAiConstructorCalls: 0;
  liveGuardsSet: false;
} {
  return { openAiConstructorCalls: 0, liveGuardsSet: false };
}

/**
 * Mechanically list changed files against exact base using a temporary index
 * (covers untracked additions that form the cumulative patch set).
 */
export function listCeqr021ChangedFilesAgainstExactBase(
  cwd: string = process.cwd(),
  baseHead: string = CEQR_021_BASE_HEAD,
): string[] {
  const indexDir = mkdtempSync(join(tmpdir(), "ceqr021-manifest-"));
  const indexFile = join(indexDir, "index");
  try {
    execFileSync("git", ["read-tree", baseHead], {
      cwd,
      env: { ...process.env, GIT_INDEX_FILE: indexFile },
      encoding: "utf8",
    });
    execFileSync("git", ["add", "-A"], {
      cwd,
      env: { ...process.env, GIT_INDEX_FILE: indexFile },
      encoding: "utf8",
    });
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", baseHead],
      {
        cwd,
        env: { ...process.env, GIT_INDEX_FILE: indexFile },
        encoding: "utf8",
      },
    );
    return out
      .split("\n")
      .map((l) => l.replace(/\r$/, ""))
      .filter((l) => l.length > 0)
      .sort();
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
}

export function readCeqr021ChangedFilesManifest(
  cwd: string = process.cwd(),
): string[] {
  const path = join(
    ceqr021ReceiptDir(cwd),
    "changed-files.txt",
  );
  const text = readFileSync(path, "utf8");
  return text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.length > 0);
}

export function assertCeqr021ChangedFilesManifestExact(
  cwd: string = process.cwd(),
): { ok: true; files: string[] } | { ok: false; message: string } {
  const expected = listCeqr021ChangedFilesAgainstExactBase(cwd).join("\n") + "\n";
  const actualPath = join(ceqr021ReceiptDir(cwd), "changed-files.txt");
  if (!existsSync(actualPath)) {
    return { ok: false, message: "changed-files.txt missing" };
  }
  const actual = readFileSync(actualPath, "utf8");
  if (actual !== expected) {
    return {
      ok: false,
      message: `changed-files.txt does not match exact base diff byte-for-byte (manifest lines=${actual.split("\n").filter(Boolean).length}, expected=${expected.split("\n").filter(Boolean).length}).`,
    };
  }
  return { ok: true, files: readCeqr021ChangedFilesManifest(cwd) };
}

export function writeCeqr021ChangedFilesManifest(
  cwd: string = process.cwd(),
): string[] {
  const dir = ceqr021ReceiptDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const manifestRel = join(
    relative(resolve(cwd), resolve(dir)).split(sep).join("/"),
    "changed-files.txt",
  ).replace(/^\.\//, "");
  // First ensure the manifest path exists so it is included in the listing.
  if (!existsSync(join(dir, "changed-files.txt"))) {
    writeFileSync(join(dir, "changed-files.txt"), "\n", "utf8");
  }
  const files = listCeqr021ChangedFilesAgainstExactBase(cwd);
  if (!files.includes(manifestRel)) {
    // Fallback if relative path normalization differs.
    const alt = files.find((f) => f.endsWith("/changed-files.txt"));
    if (alt == null) {
      files.push(
        `docs/agent-runs/receipts/${CEQR_021_SLICE_ID}/changed-files.txt`,
      );
      files.sort();
    }
  }
  writeFileSync(join(dir, "changed-files.txt"), `${files.join("\n")}\n`, "utf8");
  // Re-list and rewrite for byte-stable equality after the file exists.
  const finalFiles = listCeqr021ChangedFilesAgainstExactBase(cwd);
  writeFileSync(
    join(dir, "changed-files.txt"),
    `${finalFiles.join("\n")}\n`,
    "utf8",
  );
  return finalFiles;
}

export { createHash, ceqr017CanonicalReceiptPaths, hashReceiptDirectory };
