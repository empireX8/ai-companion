/**
 * CEQR-019 — controlled live semantic-consistency reproof (post CEQR-018).
 *
 * Offline preparation + guarded live entry. Does not call a live provider
 * unless both CEQR-019 and underlying live-proof authorisation guards are set.
 *
 * CEQR-017 remains historical. CEQR-018 proved only the offline repair.
 * Offline harness readiness is not live proof.
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { basename, join, resolve } from "path";

import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION_V3,
  type ContradictionAdjudicationResult,
} from "./contradiction-adjudicator";
import type { ControlledNaturalEntryProofResult } from "./contradiction-controlled-natural-entry-proof";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V3,
  CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
  CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
  CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_PROVIDER_ID,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  createOpenAiContradictionLiveAdapters,
  isLiveContradictionProviderProofOptedIn,
  resolveContradictionLiveProviderConfig,
  type ContradictionLiveAdapterBundle,
  type LiveCallBudget,
} from "./contradiction-live-provider-adapters";
import {
  LIVE_SYNTHETIC_CASES,
  runContradictionLiveProviderRefereeProof,
  type LiveProofCaseObserverEvent,
  type LiveProofResult,
  type LiveSyntheticCase,
  type LiveSyntheticCaseId,
} from "./contradiction-live-provider-referee-proof";
import {
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V3,
  KERNEL_CONTRACT_VERSION,
} from "./orvek-intelligence-kernel/contracts";

export const CEQR_019_SLICE_ID =
  "CONTRADICTION-LIVE-SEMANTIC-REPROOF-001" as const;
export const CEQR_019_CAMPAIGN_SLICE = "CEQR-019" as const;
export const CEQR_019_PROOF_VERSION =
  "contradiction-controlled-live-semantic-reproof-v1" as const;
export const CEQR_019_WORKTREE_PATH =
  "/Users/user/ai-companion-worktrees/desktop-contradiction-live-semantic-reproof-001" as const;
/** Exact canonical receipt directory for production live execution. */
export const CEQR_019_CANONICAL_RECEIPT_DIR =
  `${CEQR_019_WORKTREE_PATH}/docs/agent-runs/receipts/${CEQR_019_SLICE_ID}` as const;

/** Unique CEQR-019 live authorisation guard (must be exactly YES). */
export const CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV =
  "CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED" as const;
export const CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE = "YES" as const;

export const CEQR_019_PERMANENT_CLAIM_FILENAME =
  "ceqr019-permanent-claim.json" as const;
export const CEQR_019_LIVE_RUN_CLAIM_FILENAME =
  "live-run-oneshot-claim.json" as const;
export const CEQR_019_FROZEN_PLAN_FILENAME =
  "frozen-live-run-plan.json" as const;
export const CEQR_019_PRELIVE_RECEIPT_FILENAME =
  "pre-live-execution-receipt.json" as const;
export const CEQR_019_LIVE_RECEIPT_FILENAME =
  "live-execution-receipt.json" as const;

export const CEQR_019_EXPECTED_PROVIDER_ID = "openai" as const;
export const CEQR_019_EXPECTED_ADJUDICATOR_MODEL = "gpt-4o-mini" as const;
export const CEQR_019_EXPECTED_REFEREE_MODEL = "gpt-4o-mini" as const;
export const CEQR_019_EXPECTED_MAX_RETRIES = 0 as const;
export const CEQR_019_EXPECTED_TIMEOUT_MS = 45_000 as const;
/** Three cases × ≤2 provider roles; retries disabled. */
export const CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS = 6 as const;
export const CEQR_019_EXPECTED_SCHEMA_VERSION =
  "contradiction-adjudication-schema-v3" as const;
export const CEQR_019_EXPECTED_PROMPT_VERSION =
  "contradiction-adjudication-prompt-v3" as const;
export const CEQR_019_EXPECTED_LIVE_ADDENDUM_VERSION =
  "contradiction-live-adjudicator-prompt-addendum-v3" as const;
export const CEQR_019_EXPECTED_KERNEL_CONTRACT =
  "orvek-intelligence-kernel-v1" as const;

export const CEQR_017_LIVE_RECEIPT_SHA256 =
  "b620aa7f718d4ace768a9a518a4d8cb32ca1b54662291280b3f6545fb5514fdd" as const;
export const CEQR_017_PERMANENT_CLAIM_SHA256 =
  "f313cbafb264f84d158a8aee20ca2276520fbf85940be7f910b87bead2c5cef0" as const;

/** Immutable CEQR-019 live artifacts after the single authorised run. */
export const CEQR_019_LIVE_ONESHOT_CLAIM_SHA256 =
  "0973a66f6c1b36fbef77625d435b83c14ee14cbf5530cf9c5d324d7b5504a65c" as const;
export const CEQR_019_LIVE_ONESHOT_CLAIM_BYTES = 539 as const;
export const CEQR_019_FROZEN_LIVE_PLAN_SHA256 =
  "b3f8986b7bf7004fb6d111689cea90371aa82988a2c8f5a93a5354f7bf4d9129" as const;
export const CEQR_019_FROZEN_LIVE_PLAN_BYTES = 3831 as const;
export const CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256 =
  "74c12305a2dc15d166a37c6a054158996016f0bc66c6236d42a16868d1798e58" as const;
export const CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES = 10419 as const;
export const CEQR_019_PERMANENT_CLAIM_SHA256 =
  "13f497f29a31021a023e2f9ce03c7af0f27f005a9025b9792f311d6c25e9c357" as const;
export const CEQR_019_PERMANENT_CLAIM_BYTES = 1046 as const;
export const CEQR_019_LIVE_RESULT_CLASSIFICATION =
  "FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN" as const;
export const CEQR_019_LIVE_PROVIDER_ATTEMPTS = 3 as const;

/** Offline preparation classifications (live classifications defined but unclaimed). */
export type Ceqr019OfflineClassification =
  | "PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY"
  | "HOLD_LIVE_HARNESS_INCOMPLETE"
  | "HOLD_PROVIDER_TRANSPORT_UNSAFE"
  | "FAIL_SOURCE_AUTHORITY_REGRESSION"
  | "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY"
  | "FAIL_HISTORICAL_RECEIPT_MUTATION"
  | "FAIL_UNSAFE_LIVE_EXECUTION_PATH";

export type Ceqr019LiveClassification =
  | "PASS_LIVE_SEMANTIC_REPROOF"
  | "HOLD_PROVIDER_SCHEMA_REJECTED"
  | "HOLD_PROVIDER_OUTPUT_INVALID"
  | "HOLD_PROVIDER_RESULT_INCONCLUSIVE"
  | "HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED"
  | "FAIL_FALSE_CLEAR_CONTRADICTION"
  | "FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN"
  | "FAIL_SOURCE_AUTHORITY_REGRESSION"
  | "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY"
  | "FAIL_LIVE_EXECUTION_BUDGET_EXCEEDED"
  | "FAIL_UNSAFE_LIVE_EXECUTION_PATH";

export type Ceqr019BoundaryCounters = {
  adjudicatorCalls: number;
  refereeCalls: number;
  writerCalls: number;
  persistenceCalls: number;
  accountGateCalls: number;
  realDatabaseCalls: number;
};

export function createEmptyCeqr019BoundaryCounters(): Ceqr019BoundaryCounters {
  return {
    adjudicatorCalls: 0,
    refereeCalls: 0,
    writerCalls: 0,
    persistenceCalls: 0,
    accountGateCalls: 0,
    realDatabaseCalls: 0,
  };
}

/**
 * Frozen synthetic cases — byte-identical to CEQR-015/017 LIVE_SYNTHETIC_CASES
 * for comparability against the CEQR-017 failure baseline.
 */
export const CEQR_019_SYNTHETIC_CASES: readonly LiveSyntheticCase[] =
  LIVE_SYNTHETIC_CASES;

export const CEQR_019_CASE_SHA256 = {
  clear_contradiction_candidate:
    "6218eceeae317f5c31a5ca70b4d1f8f8c8e1276cb816f5d161aec77911a9cec6",
  compatible_contextual:
    "ac9c9dddf6f90528d0d7d28b51833bad8eb593955a541fbfd21a114374113f27",
  ambiguous_insufficient:
    "04baa1844a613c85e97c2642a5f5383112141d25da6c1d517e1ccbcd251fb09e",
} as const satisfies Record<LiveSyntheticCaseId, string>;

export const CEQR_019_CASES_AGGREGATE_SHA256 =
  "0c1b25b93f45013b096948691f24ea93cba4316b4f6d575810bcf35ccf7fa8f0" as const;

export function hashSyntheticCase(synthetic: LiveSyntheticCase): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: synthetic.id,
        sideAText: synthetic.sideAText,
        sideBText: synthetic.sideBText,
        referenceStatement: synthetic.referenceStatement,
      }),
    )
    .digest("hex");
}

export function hashCeqr019SyntheticCases(
  cases: readonly LiveSyntheticCase[] = CEQR_019_SYNTHETIC_CASES,
): {
  byId: Record<LiveSyntheticCaseId, string>;
  aggregateSha256: string;
} {
  const byId = {} as Record<LiveSyntheticCaseId, string>;
  const aggregate = createHash("sha256");
  for (const synthetic of cases) {
    const h = hashSyntheticCase(synthetic);
    byId[synthetic.id] = h;
    aggregate.update(
      JSON.stringify({
        id: synthetic.id,
        sideAText: synthetic.sideAText,
        sideBText: synthetic.sideBText,
        referenceStatement: synthetic.referenceStatement,
      }),
    );
    aggregate.update("\0");
  }
  return { byId, aggregateSha256: aggregate.digest("hex") };
}

export function assertCeqr019FrozenCaseHashes(
  cases: readonly LiveSyntheticCase[] = CEQR_019_SYNTHETIC_CASES,
): { ok: true } | { ok: false; mismatches: string[] } {
  const hashed = hashCeqr019SyntheticCases(cases);
  const mismatches: string[] = [];
  for (const id of Object.keys(CEQR_019_CASE_SHA256) as LiveSyntheticCaseId[]) {
    if (hashed.byId[id] !== CEQR_019_CASE_SHA256[id]) {
      mismatches.push(`${id}: expected ${CEQR_019_CASE_SHA256[id]} got ${hashed.byId[id]}`);
    }
  }
  if (hashed.aggregateSha256 !== CEQR_019_CASES_AGGREGATE_SHA256) {
    mismatches.push(
      `aggregate: expected ${CEQR_019_CASES_AGGREGATE_SHA256} got ${hashed.aggregateSha256}`,
    );
  }
  if (cases.length !== 3) {
    mismatches.push(`length: expected 3 got ${cases.length}`);
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function ceqr019ReceiptDir(cwd: string = process.cwd()): string {
  return join(
    cwd,
    "docs/agent-runs/receipts",
    CEQR_019_SLICE_ID,
  );
}

function realPathOrResolve(dir: string): string {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) return resolved;
  return realpathSync.native
    ? realpathSync.native(resolved)
    : realpathSync(resolved);
}

/**
 * Production live path must run from the exact worktree with the exact
 * canonical receipt directory. Alternate cwd / receiptDir cannot bypass claim.
 */
export function assertCeqr019ProductionLivePaths(args?: {
  cwd?: string;
}):
  | { ok: true; receiptDir: typeof CEQR_019_CANONICAL_RECEIPT_DIR }
  | {
      ok: false;
      code: "cwd_mismatch" | "receipt_dir_mismatch";
      message: string;
    } {
  const cwd = resolve(args?.cwd ?? process.cwd());
  const expectedCwd = resolve(CEQR_019_WORKTREE_PATH);
  if (cwd !== expectedCwd) {
    return {
      ok: false,
      code: "cwd_mismatch",
      message: `CEQR-019 live execution requires cwd ${expectedCwd} (got ${cwd}).`,
    };
  }
  const expectedReceipt = realPathOrResolve(CEQR_019_CANONICAL_RECEIPT_DIR);
  const derived = realPathOrResolve(ceqr019ReceiptDir(cwd));
  if (derived !== expectedReceipt) {
    return {
      ok: false,
      code: "receipt_dir_mismatch",
      message: `CEQR-019 live execution requires receipt dir ${expectedReceipt} (got ${derived}).`,
    };
  }
  return { ok: true, receiptDir: CEQR_019_CANONICAL_RECEIPT_DIR };
}

export function ceqr019PermanentClaimPath(cwd: string = process.cwd()): string {
  return join(ceqr019ReceiptDir(cwd), CEQR_019_PERMANENT_CLAIM_FILENAME);
}

export function ceqr019LiveRunClaimPath(cwd: string = process.cwd()): string {
  return join(ceqr019ReceiptDir(cwd), CEQR_019_LIVE_RUN_CLAIM_FILENAME);
}

export function ceqr017CanonicalReceiptPaths(cwd: string = process.cwd()): {
  liveReceipt: string;
  permanentClaim: string;
} {
  const dir = join(
    cwd,
    "docs/agent-runs/receipts",
    "CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001",
  );
  return {
    liveReceipt: join(dir, "live-execution-receipt.json"),
    permanentClaim: join(dir, "phase2-live-run-claim.json"),
  };
}

export function ceqr018ReceiptDir(cwd: string = process.cwd()): string {
  return join(
    cwd,
    "docs/agent-runs/receipts",
    "CONTRADICTION-LIVE-SEMANTIC-CONSISTENCY-REPAIR-001",
  );
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function verifyCeqr017CanonicalHashes(cwd: string = process.cwd()): {
  ok: boolean;
  liveReceiptSha256: string | null;
  permanentClaimSha256: string | null;
  mismatches: string[];
} {
  const paths = ceqr017CanonicalReceiptPaths(cwd);
  const mismatches: string[] = [];
  let liveReceiptSha256: string | null = null;
  let permanentClaimSha256: string | null = null;
  if (!existsSync(paths.liveReceipt)) {
    mismatches.push("CEQR-017 live receipt missing");
  } else {
    liveReceiptSha256 = sha256File(paths.liveReceipt);
    if (liveReceiptSha256 !== CEQR_017_LIVE_RECEIPT_SHA256) {
      mismatches.push(
        `CEQR-017 live receipt hash mismatch: ${liveReceiptSha256}`,
      );
    }
  }
  if (!existsSync(paths.permanentClaim)) {
    mismatches.push("CEQR-017 permanent claim missing");
  } else {
    permanentClaimSha256 = sha256File(paths.permanentClaim);
    if (permanentClaimSha256 !== CEQR_017_PERMANENT_CLAIM_SHA256) {
      mismatches.push(
        `CEQR-017 permanent claim hash mismatch: ${permanentClaimSha256}`,
      );
    }
  }
  return {
    ok: mismatches.length === 0,
    liveReceiptSha256,
    permanentClaimSha256,
    mismatches,
  };
}

export function hashReceiptDirectory(
  dir: string,
): { fileCount: number; sortedManifest: string[]; aggregateSha256: string } {
  const files: string[] = [];
  if (!existsSync(dir)) {
    return { fileCount: 0, sortedManifest: [], aggregateSha256: createHash("sha256").digest("hex") };
  }
  const walk = (current: string, prefix: string) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) walk(full, rel);
      else files.push(rel);
    }
  };
  walk(dir, "");
  const sortedManifest = [...files].sort();
  const hash = createHash("sha256");
  for (const rel of sortedManifest) {
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(join(dir, rel)));
    hash.update("\0");
  }
  return {
    fileCount: sortedManifest.length,
    sortedManifest,
    aggregateSha256: hash.digest("hex"),
  };
}

export function isCeqr019LiveAuthorized(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env[CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV] ===
    CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE
  );
}

/**
 * Both guards required. Missing either stops before provider construction.
 */
export function assertCeqr019LiveGuards(
  env: Record<string, string | undefined> = process.env,
):
  | { ok: true }
  | {
      ok: false;
      code: "ceqr019_guard_missing" | "underlying_opt_in_missing";
      message: string;
    } {
  if (!isCeqr019LiveAuthorized(env)) {
    return {
      ok: false,
      code: "ceqr019_guard_missing",
      message: `${CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV} must be exactly ${CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE} (got ${JSON.stringify(env[CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV])}).`,
    };
  }
  if (!isLiveContradictionProviderProofOptedIn(env)) {
    return {
      ok: false,
      code: "underlying_opt_in_missing",
      message: `${CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV} must be set to 1 or true for the underlying live proof runner.`,
    };
  }
  return { ok: true };
}

export function assertCeqr019LandedConstants():
  | { ok: true }
  | { ok: false; mismatches: string[] } {
  const mismatches: string[] = [];
  if (CONTRADICTION_LIVE_PROVIDER_ID !== CEQR_019_EXPECTED_PROVIDER_ID) {
    mismatches.push("providerId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL !==
    CEQR_019_EXPECTED_ADJUDICATOR_MODEL
  ) {
    mismatches.push("adjudicatorModelId");
  }
  if (
    CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL !== CEQR_019_EXPECTED_REFEREE_MODEL
  ) {
    mismatches.push("refereeModelId");
  }
  if (CONTRADICTION_LIVE_MAX_RETRIES !== CEQR_019_EXPECTED_MAX_RETRIES) {
    mismatches.push("maxRetries");
  }
  if (CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS !== CEQR_019_EXPECTED_TIMEOUT_MS) {
    mismatches.push("timeoutMs");
  }
  // CEQR-019 froze schema-v3 / prompt-v3 / addendum-v3. Current active
  // identities may advance (CEQR-020+); historical constants must remain.
  if (
    (CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V3 as string) !==
    (CEQR_019_EXPECTED_SCHEMA_VERSION as string)
  ) {
    mismatches.push("schemaVersion");
  }
  if (
    (CONTRADICTION_ADJUDICATION_PROMPT_VERSION_V3 as string) !==
    (CEQR_019_EXPECTED_PROMPT_VERSION as string)
  ) {
    mismatches.push("promptVersion");
  }
  if (
    (CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V3 as string) !==
    (CEQR_019_EXPECTED_LIVE_ADDENDUM_VERSION as string)
  ) {
    mismatches.push("liveAddendumVersion");
  }
  if (KERNEL_CONTRACT_VERSION !== CEQR_019_EXPECTED_KERNEL_CONTRACT) {
    mismatches.push("kernelContract");
  }
  return mismatches.length === 0
    ? { ok: true }
    : { ok: false, mismatches };
}

export function assertCeqr019PinnedLiveEnv(
  env: Record<string, string | undefined>,
): { ok: true } | { ok: false; code: string; message: string } {
  const required: Array<[string, string]> = [
    [
      "CONTRADICTION_LIVE_ADJUDICATOR_MODEL",
      CEQR_019_EXPECTED_ADJUDICATOR_MODEL,
    ],
    ["CONTRADICTION_LIVE_REFEREE_MODEL", CEQR_019_EXPECTED_REFEREE_MODEL],
    [
      "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS",
      String(CEQR_019_EXPECTED_TIMEOUT_MS),
    ],
    [
      "CONTRADICTION_LIVE_MAX_TOTAL_CALLS",
      String(CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS),
    ],
  ];
  for (const [key, expected] of required) {
    const raw = env[key];
    if (typeof raw !== "string" || raw.trim() !== expected) {
      return {
        ok: false,
        code: "runtime_pin_mismatch",
        message: `${key} must be explicitly set to ${expected} for CEQR-019 (got ${JSON.stringify(raw)}).`,
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
    cfg.providerId !== CEQR_019_EXPECTED_PROVIDER_ID ||
    cfg.adjudicatorModelId !== CEQR_019_EXPECTED_ADJUDICATOR_MODEL ||
    cfg.refereeModelId !== CEQR_019_EXPECTED_REFEREE_MODEL ||
    cfg.maxRetries !== CEQR_019_EXPECTED_MAX_RETRIES ||
    cfg.timeoutMs !== CEQR_019_EXPECTED_TIMEOUT_MS ||
    cfg.maxTotalCalls !== CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS
  ) {
    return {
      ok: false,
      code: "resolved_runtime_mismatch",
      message: "Resolved live provider config does not match CEQR-019 pins.",
    };
  }
  return { ok: true };
}

export type Ceqr019FrozenLivePlan = {
  slice: typeof CEQR_019_SLICE_ID;
  campaignSlice: typeof CEQR_019_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_019_PROOF_VERSION;
  providerName: typeof CEQR_019_EXPECTED_PROVIDER_ID;
  adjudicatorModelName: typeof CEQR_019_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelName: typeof CEQR_019_EXPECTED_REFEREE_MODEL;
  schemaVersion: typeof CEQR_019_EXPECTED_SCHEMA_VERSION;
  promptVersion: typeof CEQR_019_EXPECTED_PROMPT_VERSION;
  liveAddendumVersion: typeof CEQR_019_EXPECTED_LIVE_ADDENDUM_VERSION;
  kernelContract: typeof CEQR_019_EXPECTED_KERNEL_CONTRACT;
  timeoutMs: typeof CEQR_019_EXPECTED_TIMEOUT_MS;
  retryCount: typeof CEQR_019_EXPECTED_MAX_RETRIES;
  maximumProviderCallBudget: typeof CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  authorisationGuardEnv: typeof CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV;
  authorisationGuardRequiredValue: typeof CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE;
  underlyingOptInEnv: typeof CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV;
  syntheticCases: readonly LiveSyntheticCase[];
  caseSha256ById: typeof CEQR_019_CASE_SHA256;
  casesAggregateSha256: typeof CEQR_019_CASES_AGGREGATE_SHA256;
  outputPaths: {
    receiptDir: string;
    permanentClaim: string;
    liveRunClaim: string;
    frozenPlan: string;
    preLiveReceipt: string;
    liveReceipt: string;
  };
  historicalClaimPathsMustRemainUnchanged: {
    ceqr017LiveReceipt: string;
    ceqr017PermanentClaim: string;
    ceqr018ReceiptDir: string;
  };
  productionReady: false;
  liveProofObtained: false;
};

export function buildCeqr019FrozenLivePlan(
  cwd: string = process.cwd(),
): Ceqr019FrozenLivePlan {
  const receiptDir = ceqr019ReceiptDir(cwd);
  const ceqr017 = ceqr017CanonicalReceiptPaths(cwd);
  return {
    slice: CEQR_019_SLICE_ID,
    campaignSlice: CEQR_019_CAMPAIGN_SLICE,
    proofVersion: CEQR_019_PROOF_VERSION,
    providerName: CEQR_019_EXPECTED_PROVIDER_ID,
    adjudicatorModelName: CEQR_019_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelName: CEQR_019_EXPECTED_REFEREE_MODEL,
    schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_019_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: CEQR_019_EXPECTED_LIVE_ADDENDUM_VERSION,
    kernelContract: CEQR_019_EXPECTED_KERNEL_CONTRACT,
    timeoutMs: CEQR_019_EXPECTED_TIMEOUT_MS,
    retryCount: CEQR_019_EXPECTED_MAX_RETRIES,
    maximumProviderCallBudget: CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    authorisationGuardEnv: CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV,
    authorisationGuardRequiredValue:
      CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE,
    underlyingOptInEnv: CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
    syntheticCases: CEQR_019_SYNTHETIC_CASES,
    caseSha256ById: CEQR_019_CASE_SHA256,
    casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
    outputPaths: {
      receiptDir,
      permanentClaim: join(receiptDir, CEQR_019_PERMANENT_CLAIM_FILENAME),
      liveRunClaim: join(receiptDir, CEQR_019_LIVE_RUN_CLAIM_FILENAME),
      frozenPlan: join(receiptDir, CEQR_019_FROZEN_PLAN_FILENAME),
      preLiveReceipt: join(receiptDir, CEQR_019_PRELIVE_RECEIPT_FILENAME),
      liveReceipt: join(receiptDir, CEQR_019_LIVE_RECEIPT_FILENAME),
    },
    historicalClaimPathsMustRemainUnchanged: {
      ceqr017LiveReceipt: ceqr017.liveReceipt,
      ceqr017PermanentClaim: ceqr017.permanentClaim,
      ceqr018ReceiptDir: ceqr018ReceiptDir(cwd),
    },
    productionReady: false,
    liveProofObtained: false,
  };
}

export function serializeCeqr019FrozenLivePlan(
  plan: Ceqr019FrozenLivePlan = buildCeqr019FrozenLivePlan(),
): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

export type Ceqr019PermanentClaim = {
  slice: typeof CEQR_019_SLICE_ID;
  campaignSlice: typeof CEQR_019_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_019_PROOF_VERSION;
  purpose: "post_repair_controlled_live_semantic_reproof";
  status: "HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED";
  statements: {
    thisIsNewPostRepairProof: true;
    ceqr017RemainsHistorical: true;
    ceqr018ProvedOnlyOfflineRepair: true;
    ceqr019HasNotPassedUntilRealProviderResultCaptured: true;
    offlinePreparationIsNotLiveProof: true;
    noProductionReadinessClaimFollowsFromSuccess: true;
  };
  neverAutoDelete: true;
  liveProofObtained: false;
  productionReady: false;
  schemaVersion: typeof CEQR_019_EXPECTED_SCHEMA_VERSION;
  casesAggregateSha256: typeof CEQR_019_CASES_AGGREGATE_SHA256;
  historicalCeqr017LiveReceiptSha256: typeof CEQR_017_LIVE_RECEIPT_SHA256;
  historicalCeqr017PermanentClaimSha256: typeof CEQR_017_PERMANENT_CLAIM_SHA256;
};

export function buildCeqr019PermanentClaim(): Ceqr019PermanentClaim {
  return {
    slice: CEQR_019_SLICE_ID,
    campaignSlice: CEQR_019_CAMPAIGN_SLICE,
    proofVersion: CEQR_019_PROOF_VERSION,
    purpose: "post_repair_controlled_live_semantic_reproof",
    status: "HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED",
    statements: {
      thisIsNewPostRepairProof: true,
      ceqr017RemainsHistorical: true,
      ceqr018ProvedOnlyOfflineRepair: true,
      ceqr019HasNotPassedUntilRealProviderResultCaptured: true,
      offlinePreparationIsNotLiveProof: true,
      noProductionReadinessClaimFollowsFromSuccess: true,
    },
    neverAutoDelete: true,
    liveProofObtained: false,
    productionReady: false,
    schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
    casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
    historicalCeqr017LiveReceiptSha256: CEQR_017_LIVE_RECEIPT_SHA256,
    historicalCeqr017PermanentClaimSha256: CEQR_017_PERMANENT_CLAIM_SHA256,
  };
}

export type Ceqr019LiveRunOneshotClaim = {
  slice: typeof CEQR_019_SLICE_ID;
  campaignSlice: typeof CEQR_019_CAMPAIGN_SLICE;
  claimedAt: string;
  purpose: "exactly_one_controlled_live_semantic_reproof_run";
  providerId: typeof CEQR_019_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_019_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelId: typeof CEQR_019_EXPECTED_REFEREE_MODEL;
  timeoutMs: typeof CEQR_019_EXPECTED_TIMEOUT_MS;
  maxTotalCalls: typeof CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  maxRetries: typeof CEQR_019_EXPECTED_MAX_RETRIES;
  schemaVersion: typeof CEQR_019_EXPECTED_SCHEMA_VERSION;
  casesAggregateSha256: typeof CEQR_019_CASES_AGGREGATE_SHA256;
  neverAutoDelete: true;
};

export type Ceqr019PreLiveReceipt = {
  slice: typeof CEQR_019_SLICE_ID;
  campaignSlice: typeof CEQR_019_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_019_PROOF_VERSION;
  phase: "offline_preparation";
  classification: "HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED";
  offlineHarnessClassification: Ceqr019OfflineClassification;
  liveAuthorised: false;
  liveExecuted: false;
  liveProviderAttempts: 0;
  realAccountQueries: 0;
  realDatabaseQueries: 0;
  realDatabaseMutations: 0;
  writerCalls: 0;
  persistenceCalls: 0;
  liveProofObtained: false;
  productionReady: false;
  frozenPlan: Ceqr019FrozenLivePlan;
  proposedLiveCommand: string;
  notes: string[];
};

export function buildCeqr019ProposedLiveCommand(
  worktreePath: string = CEQR_019_WORKTREE_PATH,
): string {
  return [
    `cd ${worktreePath}`,
    "set -a && source /Users/user/ai-companion/.env && set +a",
    "CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED=YES \\",
    "CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini \\",
    "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000 \\",
    "CONTRADICTION_LIVE_MAX_TOTAL_CALLS=6 \\",
    "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \\",
    "  npx ts-node --transpile-only \\",
    `  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \\`,
    "  scripts/run-contradiction-controlled-live-semantic-reproof.ts",
  ].join("\n");
}

export function buildCeqr019PreLiveReceipt(args?: {
  offlineHarnessClassification?: Ceqr019OfflineClassification;
  cwd?: string;
}): Ceqr019PreLiveReceipt {
  const cwd = args?.cwd ?? process.cwd();
  return {
    slice: CEQR_019_SLICE_ID,
    campaignSlice: CEQR_019_CAMPAIGN_SLICE,
    proofVersion: CEQR_019_PROOF_VERSION,
    phase: "offline_preparation",
    classification: "HOLD_LIVE_SEMANTIC_REPROOF_NOT_YET_EXECUTED",
    offlineHarnessClassification:
      args?.offlineHarnessClassification ??
      "PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY",
    liveAuthorised: false,
    liveExecuted: false,
    liveProviderAttempts: 0,
    realAccountQueries: 0,
    realDatabaseQueries: 0,
    realDatabaseMutations: 0,
    writerCalls: 0,
    persistenceCalls: 0,
    liveProofObtained: false,
    productionReady: false,
    frozenPlan: buildCeqr019FrozenLivePlan(cwd),
    proposedLiveCommand: buildCeqr019ProposedLiveCommand(),
    notes: [
      "Offline preparation only — live provider execution is not authorised by this receipt.",
      "CEQR-017 remains historical; CEQR-018 proved only the offline repair.",
      "No fabricated provider results are recorded.",
      "Production readiness remains NO.",
    ],
  };
}

export type Ceqr019LiveExecutionReceipt = {
  slice: typeof CEQR_019_SLICE_ID;
  campaignSlice: typeof CEQR_019_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_019_PROOF_VERSION;
  phase: "live_semantic_reproof";
  liveAuthorised: boolean;
  liveExecuted: boolean;
  liveProviderAttempts: number;
  classification: Ceqr019LiveClassification;
  schemaVersion: typeof CEQR_019_EXPECTED_SCHEMA_VERSION;
  casesAggregateSha256: typeof CEQR_019_CASES_AGGREGATE_SHA256;
  boundaryCounters: Ceqr019BoundaryCounters;
  caseObservations: Ceqr019CaseObservation[];
  underlyingLiveProof: LiveProofResult | null;
  productionReady: false;
  notes: string[];
};

export type Ceqr019EvidenceObservation = {
  sourceId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  exactQuote: string | null;
  authoritativeSlice: string | null;
  exactQuoteMatchesAuthoritativeSlice: boolean | null;
  lexicalBoundaryOk: boolean | null;
  sourceIdCodeOwned: boolean | null;
};

export type Ceqr019CaseObservation = {
  caseId: LiveSyntheticCaseId;
  caseStatus: string | null;
  proofOutcome: string | null;
  attemptedAdjudicationCount: number;
  adjudicationOutcome: ContradictionAdjudicationResult["outcome"] | null;
  deterministicValidationStatus: "valid" | "invalid" | "not_run" | "not_reached";
  validationErrors: string[];
  semanticClassification: string | null;
  bothCanSimultaneouslyBeTrue: boolean | null;
  changedBeliefOverTime: boolean | null;
  intentionVersusOutcome: boolean | null;
  goalVersusObstacle: boolean | null;
  emotionalOrPhysiologicalVersusReasoningStandard: boolean | null;
  abstentionReason: string | null;
  evidenceA: Ceqr019EvidenceObservation | null;
  evidenceB: Ceqr019EvidenceObservation | null;
  refereeCallCount: number;
  writerInvoked: boolean;
  writeExecuted: boolean;
  contradictionNodeId: string | null;
  clearContradictionWriteProven: boolean | null;
};

function resolvePrimaryAdjudication(
  naturalEntryResult: ControlledNaturalEntryProofResult | null,
): ContradictionAdjudicationResult | null {
  if (naturalEntryResult == null) return null;
  const selected =
    naturalEntryResult.selection.selectedPair?.adjudication ?? null;
  if (selected != null) return selected;
  const attempted = naturalEntryResult.selection.attemptedAdjudications;
  if (attempted.length === 0) return null;
  return attempted[attempted.length - 1]!.adjudication;
}

function buildEvidenceObservation(args: {
  claim:
    | {
        sourceId: string;
        startOffset: number;
        endOffset: number;
        exactQuote: string;
      }
    | null
    | undefined;
  authoritativeText: string;
}): Ceqr019EvidenceObservation | null {
  if (args.claim == null) return null;
  const authoritativeSlice = args.authoritativeText.slice(
    args.claim.startOffset,
    args.claim.endOffset,
  );
  const exactQuoteMatchesAuthoritativeSlice =
    args.claim.exactQuote === authoritativeSlice;
  const lexicalBoundaryOk =
    exactQuoteMatchesAuthoritativeSlice &&
    args.claim.startOffset >= 0 &&
    args.claim.endOffset > args.claim.startOffset &&
    args.claim.endOffset <= args.authoritativeText.length;
  const sourceIdCodeOwned =
    typeof args.claim.sourceId === "string" &&
    (args.claim.sourceId.startsWith("message:") ||
      args.claim.sourceId.startsWith("reference:"));
  return {
    sourceId: args.claim.sourceId,
    startOffset: args.claim.startOffset,
    endOffset: args.claim.endOffset,
    exactQuote: args.claim.exactQuote,
    authoritativeSlice,
    exactQuoteMatchesAuthoritativeSlice,
    lexicalBoundaryOk,
    sourceIdCodeOwned,
  };
}

export function buildCeqr019CaseObservationFromEvent(
  event: LiveProofCaseObserverEvent,
): Ceqr019CaseObservation {
  const synthetic = event.synthetic;
  const natural = event.result;
  const attempted = natural?.selection.attemptedAdjudications ?? [];
  const adjudication = resolvePrimaryAdjudication(natural);
  const semantic = adjudication?.semantic ?? null;
  const validation = adjudication?.validation ?? null;
  const evidenceA = buildEvidenceObservation({
    claim: semantic?.evidenceClaimA,
    authoritativeText: synthetic.sideAText,
  });
  const evidenceB = buildEvidenceObservation({
    claim: semantic?.evidenceClaimB,
    authoritativeText: synthetic.sideBText,
  });

  let deterministicValidationStatus: Ceqr019CaseObservation["deterministicValidationStatus"] =
    "not_reached";
  if (validation?.status === "valid") deterministicValidationStatus = "valid";
  else if (validation?.status === "invalid")
    deterministicValidationStatus = "invalid";
  else if (validation?.status === "not_run")
    deterministicValidationStatus = "not_run";

  return {
    caseId: synthetic.id,
    caseStatus: event.caseReceipt.status,
    proofOutcome: event.caseReceipt.proofOutcome,
    attemptedAdjudicationCount: attempted.length,
    adjudicationOutcome: adjudication?.outcome ?? null,
    deterministicValidationStatus,
    validationErrors: validation?.errors ?? [],
    semanticClassification: semantic?.classification ?? null,
    bothCanSimultaneouslyBeTrue: semantic?.bothCanSimultaneouslyBeTrue ?? null,
    changedBeliefOverTime: semantic?.changedBeliefOverTime ?? null,
    intentionVersusOutcome: semantic?.intentionVersusOutcome ?? null,
    goalVersusObstacle: semantic?.goalVersusObstacle ?? null,
    emotionalOrPhysiologicalVersusReasoningStandard:
      semantic?.emotionalOrPhysiologicalVersusReasoningStandard ?? null,
    abstentionReason:
      adjudication?.abstentionReason ?? semantic?.abstentionReason ?? null,
    evidenceA,
    evidenceB,
    refereeCallCount: event.caseReceipt.refereeCallCount,
    writerInvoked: event.caseReceipt.writerInvoked,
    writeExecuted: event.caseReceipt.writeExecuted,
    contradictionNodeId: event.caseReceipt.contradictionNodeId,
    clearContradictionWriteProven:
      synthetic.id === "clear_contradiction_candidate"
        ? Boolean(
            event.caseReceipt.contradictionNodeId != null &&
              (event.caseReceipt.status === "created" ||
                event.caseReceipt.status === "reused") &&
              event.caseReceipt.writeExecuted,
          )
        : null,
  };
}

function observationHasTruncatedOrInvalidSpan(
  obs: Ceqr019CaseObservation,
): boolean {
  if (
    obs.validationErrors.some((e) =>
      /lexical_boundary|mid-word|invalid_offsets|empty_quote/i.test(e),
    )
  ) {
    return true;
  }
  for (const side of [obs.evidenceA, obs.evidenceB]) {
    if (side == null) continue;
    if (side.lexicalBoundaryOk === false) return true;
    if (side.exactQuoteMatchesAuthoritativeSlice === false) return true;
  }
  return false;
}

function observationHasSourceAuthorityRegression(
  obs: Ceqr019CaseObservation,
): boolean {
  for (const side of [obs.evidenceA, obs.evidenceB]) {
    if (side == null) continue;
    if (side.sourceIdCodeOwned === false) return true;
    if (side.exactQuoteMatchesAuthoritativeSlice === false) return true;
  }
  return false;
}

function allCompatibilityFlagsFalse(obs: Ceqr019CaseObservation): boolean {
  return (
    obs.bothCanSimultaneouslyBeTrue === false &&
    obs.changedBeliefOverTime === false &&
    obs.intentionVersusOutcome === false &&
    obs.goalVersusObstacle === false &&
    obs.emotionalOrPhysiologicalVersusReasoningStandard === false
  );
}

function clearCaseMeetsPassContract(obs: Ceqr019CaseObservation): boolean {
  if (obs.attemptedAdjudicationCount !== 1) return false;
  if (obs.adjudicationOutcome !== "semantic_accepted") return false;
  if (obs.deterministicValidationStatus !== "valid") return false;
  if (obs.semanticClassification !== "clear_contradiction") return false;
  if (!allCompatibilityFlagsFalse(obs)) return false;
  if (obs.abstentionReason != null) return false;
  if (obs.evidenceA == null || obs.evidenceB == null) return false;
  if (obs.evidenceA.sourceIdCodeOwned !== true) return false;
  if (obs.evidenceB.sourceIdCodeOwned !== true) return false;
  if (obs.evidenceA.exactQuoteMatchesAuthoritativeSlice !== true) return false;
  if (obs.evidenceB.exactQuoteMatchesAuthoritativeSlice !== true) return false;
  if (obs.evidenceA.lexicalBoundaryOk !== true) return false;
  if (obs.evidenceB.lexicalBoundaryOk !== true) return false;
  if (obs.clearContradictionWriteProven !== true) return false;
  if (!obs.writeExecuted || !obs.writerInvoked) return false;
  if (obs.contradictionNodeId == null) return false;
  return true;
}

function nonClearCaseMeetsPassContract(obs: Ceqr019CaseObservation): boolean {
  if (obs.attemptedAdjudicationCount !== 1) return false;
  if (obs.semanticClassification === "clear_contradiction") return false;
  const abstained = obs.adjudicationOutcome === "abstained";
  const nonClearClassified =
    obs.adjudicationOutcome === "semantic_accepted" &&
    obs.semanticClassification != null &&
    obs.semanticClassification !== "clear_contradiction";
  if (!abstained && !nonClearClassified) return false;
  if (obs.refereeCallCount !== 0) return false;
  if (obs.writerInvoked || obs.writeExecuted) return false;
  if (obs.contradictionNodeId != null) return false;
  if (observationHasTruncatedOrInvalidSpan(obs)) return false;
  if (observationHasSourceAuthorityRegression(obs)) return false;
  return true;
}

/**
 * Classify a live result from inspectable case observations.
 * Optional caller booleans are not accepted as classification authority.
 */
export function classifyCeqr019LiveResult(args: {
  result: LiveProofResult | null;
  caseObservations: readonly Ceqr019CaseObservation[];
  schemaRejected?: boolean;
}): Ceqr019LiveClassification {
  if (args.schemaRejected) {
    return "HOLD_PROVIDER_SCHEMA_REJECTED";
  }
  if (args.result == null || !args.result.ran) {
    return "HOLD_PROVIDER_RESULT_INCONCLUSIVE";
  }
  if (args.result.classificationHint === "FAIL_UNSAFE_TO_PROCEED") {
    return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";
  }
  if (args.result.unsafeMutationDetected) {
    return "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY";
  }
  if (args.result.totalCallCount > CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS) {
    return "FAIL_LIVE_EXECUTION_BUDGET_EXCEEDED";
  }

  const byId = new Map(args.caseObservations.map((o) => [o.caseId, o]));
  const clear = byId.get("clear_contradiction_candidate");
  const compatible = byId.get("compatible_contextual");
  const ambiguous = byId.get("ambiguous_insufficient");

  if (!clear || !compatible || !ambiguous) {
    return "HOLD_PROVIDER_RESULT_INCONCLUSIVE";
  }

  for (const obs of [compatible, ambiguous]) {
    if (obs.semanticClassification === "clear_contradiction") {
      return "FAIL_FALSE_CLEAR_CONTRADICTION";
    }
    if (obs.writeExecuted || obs.writerInvoked || obs.contradictionNodeId != null) {
      return "FAIL_FALSE_CLEAR_CONTRADICTION";
    }
  }

  for (const obs of args.caseObservations) {
    if (observationHasTruncatedOrInvalidSpan(obs)) {
      return "FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN";
    }
  }

  for (const obs of args.caseObservations) {
    if (
      obs.evidenceA != null ||
      obs.evidenceB != null ||
      obs.adjudicationOutcome === "semantic_accepted"
    ) {
      if (observationHasSourceAuthorityRegression(obs)) {
        return "FAIL_SOURCE_AUTHORITY_REGRESSION";
      }
    }
  }

  const anyProviderFailed = args.result.cases.some(
    (c) => c.status === "provider_failed",
  );
  if (anyProviderFailed) {
    const messages = args.result.cases
      .map((c) => c.failureMessage ?? c.failureCode ?? "")
      .join(" ");
    if (/schema|structured.?output|response.?format|invalid.?schema/i.test(messages)) {
      return "HOLD_PROVIDER_SCHEMA_REJECTED";
    }
    return "HOLD_PROVIDER_OUTPUT_INVALID";
  }

  if (clear.deterministicValidationStatus === "invalid") {
    return "HOLD_PROVIDER_OUTPUT_INVALID";
  }

  // Underlying HOLD hint cannot be upgraded without the full PASS matrix.
  if (
    clearCaseMeetsPassContract(clear) &&
    nonClearCaseMeetsPassContract(compatible) &&
    nonClearCaseMeetsPassContract(ambiguous) &&
    args.result.clearContradictionWriteProven === true &&
    args.result.compatibleCaseNoWrite === true &&
    args.result.ambiguousCaseNoWrite === true &&
    !args.result.unsafeMutationDetected &&
    args.result.realAccountMutated === false &&
    args.result.productionIngestionWired === false
  ) {
    return "PASS_LIVE_SEMANTIC_REPROOF";
  }

  return "HOLD_PROVIDER_RESULT_INCONCLUSIVE";
}

type Phase2Capability = { readonly __ceqr019LiveRunCapability: true };
const PHASE2_CAPABILITIES = new WeakSet<object>();

function mintCapability(): Phase2Capability {
  const capability: Phase2Capability = { __ceqr019LiveRunCapability: true };
  PHASE2_CAPABILITIES.add(capability);
  return capability;
}

function consumeCapability(capability: Phase2Capability): boolean {
  if (!PHASE2_CAPABILITIES.has(capability)) return false;
  PHASE2_CAPABILITIES.delete(capability);
  return true;
}

/** Opaque test-only capability — not usable by the production live script. */
export type Ceqr019TestOrchestrationCapability = {
  readonly __ceqr019TestOnlyOrchestration: true;
};
const TEST_ORCHESTRATION_CAPABILITIES = new WeakSet<object>();

export function createCeqr019TestOrchestrationCapability(): Ceqr019TestOrchestrationCapability {
  const capability: Ceqr019TestOrchestrationCapability = {
    __ceqr019TestOnlyOrchestration: true,
  };
  TEST_ORCHESTRATION_CAPABILITIES.add(capability);
  return capability;
}

function assertTestCapability(
  capability: Ceqr019TestOrchestrationCapability,
): void {
  if (!TEST_ORCHESTRATION_CAPABILITIES.has(capability)) {
    throw new Error(
      "CEQR-019 test orchestration requires a capability from createCeqr019TestOrchestrationCapability().",
    );
  }
}

export function claimCeqr019LiveRunOneshot(args: {
  claimPath: string;
  now?: () => Date;
}):
  | { ok: true; claim: Ceqr019LiveRunOneshotClaim; capability: Phase2Capability }
  | { ok: false; code: "claim_exists" | "io_error"; message: string } {
  const claim: Ceqr019LiveRunOneshotClaim = {
    slice: CEQR_019_SLICE_ID,
    campaignSlice: CEQR_019_CAMPAIGN_SLICE,
    claimedAt: (args.now ?? (() => new Date()))().toISOString(),
    purpose: "exactly_one_controlled_live_semantic_reproof_run",
    providerId: CEQR_019_EXPECTED_PROVIDER_ID,
    adjudicatorModelId: CEQR_019_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_019_EXPECTED_REFEREE_MODEL,
    timeoutMs: CEQR_019_EXPECTED_TIMEOUT_MS,
    maxTotalCalls: CEQR_019_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    maxRetries: CEQR_019_EXPECTED_MAX_RETRIES,
    schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
    casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
    neverAutoDelete: true,
  };
  try {
    const fd = openSync(args.claimPath, "wx");
    try {
      writeFileSync(fd, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
    } finally {
      closeSync(fd);
    }
    return { ok: true, claim, capability: mintCapability() };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return {
        ok: false,
        code: "claim_exists",
        message: `CEQR-019 live-run claim already exists at ${args.claimPath}`,
      };
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "claim write failed",
    };
  }
}

export type Ceqr019OrchestrationResult = {
  receipt: Ceqr019LiveExecutionReceipt | Ceqr019PreLiveReceipt;
  exitCode: number;
  providerConstructionAttempted: boolean;
  providerCalls: number;
  claimCreated: boolean;
  liveRunnerInvoked: boolean;
  boundaryCounters: Ceqr019BoundaryCounters;
};

type LiveProofRunner = (deps: {
  env: Record<string, string | undefined>;
  createAdapters: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
  caseObserver: {
    afterCase: (event: LiveProofCaseObserverEvent) => void;
  };
}) => Promise<LiveProofResult>;

function syncCountersFromBudget(
  counters: Ceqr019BoundaryCounters,
  budget: LiveCallBudget | null,
): void {
  if (budget == null) return;
  counters.adjudicatorCalls = budget.adjudicatorCalls();
  counters.refereeCalls = budget.refereeCalls();
}

async function executeCeqr019LiveOrchestrationCore(args: {
  env: Record<string, string | undefined>;
  receiptDir: string;
  createAdapters: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
  runLiveProof?: LiveProofRunner;
  now?: () => Date;
  writeReceipts: boolean;
}): Promise<Ceqr019OrchestrationResult> {
  const env = args.env;
  const counters = createEmptyCeqr019BoundaryCounters();
  const receiptDir = args.receiptDir;
  const liveClaimPath = join(receiptDir, CEQR_019_LIVE_RUN_CLAIM_FILENAME);
  const liveReceiptPath = join(receiptDir, CEQR_019_LIVE_RECEIPT_FILENAME);
  const caseObservations: Ceqr019CaseObservation[] = [];

  const stop = (
    receipt: Ceqr019LiveExecutionReceipt | Ceqr019PreLiveReceipt,
    exitCode: number,
    extras?: Partial<Ceqr019OrchestrationResult>,
  ): Ceqr019OrchestrationResult => ({
    receipt,
    exitCode,
    providerConstructionAttempted: false,
    providerCalls: 0,
    claimCreated: false,
    liveRunnerInvoked: false,
    boundaryCounters: counters,
    ...extras,
  });

  const caseHash = assertCeqr019FrozenCaseHashes();
  if (!caseHash.ok) {
    return stop(
      {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: false,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "FAIL_SOURCE_AUTHORITY_REGRESSION",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [
          `Frozen case hash mismatch: ${caseHash.mismatches.join("; ")}`,
        ],
      },
      5,
    );
  }

  const guards = assertCeqr019LiveGuards(env);
  if (!guards.ok) {
    const pre = buildCeqr019PreLiveReceipt({
      offlineHarnessClassification:
        "PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY",
    });
    return stop(
      {
        ...pre,
        notes: [
          ...pre.notes,
          `Live guards not satisfied: ${guards.message}`,
          "Zero provider calls.",
        ],
      },
      3,
    );
  }

  if (existsSync(liveClaimPath)) {
    return stop(
      {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: true,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "HOLD_PROVIDER_RESULT_INCONCLUSIVE",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [
          `Live-run oneshot claim already exists at ${liveClaimPath}`,
          "No second live execution is authorised automatically.",
          "Zero provider calls.",
        ],
      },
      5,
    );
  }

  const pin = assertCeqr019PinnedLiveEnv(env);
  if (!pin.ok) {
    return stop(
      {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: true,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "HOLD_PROVIDER_RESULT_INCONCLUSIVE",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [`Pinned runtime preflight failed: ${pin.message}`],
      },
      5,
    );
  }

  if (!existsSync(receiptDir)) {
    mkdirSync(receiptDir, { recursive: true });
  }

  const claimed = claimCeqr019LiveRunOneshot({
    claimPath: liveClaimPath,
    now: args.now,
  });
  if (!claimed.ok) {
    return stop(
      {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: true,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "HOLD_PROVIDER_RESULT_INCONCLUSIVE",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [claimed.message, "Zero provider calls."],
      },
      5,
    );
  }

  if (!consumeCapability(claimed.capability)) {
    throw new Error("CEQR-019 live capability already consumed.");
  }

  let providerConstructionAttempted = false;
  let liveResult: LiveProofResult | null = null;
  let schemaRejected = false;
  let capturedBudget: LiveCallBudget | null = null;

  const capturingCreateAdapters = async (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => {
    const adapters = await args.createAdapters(config);
    capturedBudget = adapters.callBudget;
    return adapters;
  };

  const caseObserver = {
    afterCase(event: LiveProofCaseObserverEvent) {
      caseObservations.push(buildCeqr019CaseObservationFromEvent(event));
    },
  };

  const finishReceipt = (
    receipt: Ceqr019LiveExecutionReceipt,
    exitCode: number,
    extras: Partial<Ceqr019OrchestrationResult>,
  ): Ceqr019OrchestrationResult => {
    if (args.writeReceipts) {
      writeFileSync(liveReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    return {
      receipt,
      exitCode,
      providerConstructionAttempted,
      providerCalls: counters.adjudicatorCalls + counters.refereeCalls,
      claimCreated: true,
      liveRunnerInvoked: true,
      boundaryCounters: counters,
      ...extras,
    };
  };

  try {
    providerConstructionAttempted = true;
    liveResult = await (args.runLiveProof
      ? args.runLiveProof({
          env,
          createAdapters: capturingCreateAdapters,
          caseObserver,
        })
      : runContradictionLiveProviderRefereeProof({
          env,
          cases: CEQR_019_SYNTHETIC_CASES,
          createAdapters: capturingCreateAdapters,
          caseObserver,
        }));

    syncCountersFromBudget(counters, capturedBudget);
    if (liveResult.ran) {
      // Prefer captured budget when present; fall back to live result counts.
      if (capturedBudget == null) {
        counters.adjudicatorCalls = liveResult.adjudicatorCallCount;
        counters.refereeCalls = liveResult.refereeCallCount;
      }
      for (const c of liveResult.cases) {
        if (c.writerInvoked) counters.writerCalls += 1;
      }
    } else if (
      /schema|structured.?output|response.?format/i.test(liveResult.message)
    ) {
      schemaRejected = true;
    }
  } catch (error) {
    syncCountersFromBudget(counters, capturedBudget);
    const message = error instanceof Error ? error.message : String(error);
    if (/schema|structured.?output|response.?format/i.test(message)) {
      schemaRejected = true;
    }
    const providerAttempts = counters.adjudicatorCalls + counters.refereeCalls;
    const receipt: Ceqr019LiveExecutionReceipt = {
      slice: CEQR_019_SLICE_ID,
      campaignSlice: CEQR_019_CAMPAIGN_SLICE,
      proofVersion: CEQR_019_PROOF_VERSION,
      phase: "live_semantic_reproof",
      liveAuthorised: true,
      liveExecuted: false,
      liveProviderAttempts: providerAttempts,
      classification: schemaRejected
        ? "HOLD_PROVIDER_SCHEMA_REJECTED"
        : "HOLD_PROVIDER_RESULT_INCONCLUSIVE",
      schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
      casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
      boundaryCounters: counters,
      caseObservations,
      underlyingLiveProof: null,
      productionReady: false,
      notes: [
        `Provider path stopped safely: ${message}`,
        `Exact provider attempts from captured adapter budget: ${providerAttempts}.`,
        "Schema must not be weakened merely to obtain acceptance.",
      ],
    };
    return finishReceipt(receipt, 4, {});
  }

  const classification = classifyCeqr019LiveResult({
    result: liveResult,
    caseObservations,
    schemaRejected,
  });

  const providerAttempts =
    counters.adjudicatorCalls + counters.refereeCalls ||
    (liveResult?.ran ? liveResult.totalCallCount : 0);

  const receipt: Ceqr019LiveExecutionReceipt = {
    slice: CEQR_019_SLICE_ID,
    campaignSlice: CEQR_019_CAMPAIGN_SLICE,
    proofVersion: CEQR_019_PROOF_VERSION,
    phase: "live_semantic_reproof",
    liveAuthorised: true,
    liveExecuted: liveResult?.ran === true,
    liveProviderAttempts: providerAttempts,
    classification,
    schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
    casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
    boundaryCounters: counters,
    caseObservations,
    underlyingLiveProof: liveResult,
    productionReady: false,
    notes: [
      "Synthetic source material only — no real account identifier required.",
      "No real database client and no production writer path.",
      "PASS requires complete inspectable case observations for all three frozen cases.",
      "Offline preparation is not live proof; production readiness remains NO.",
      "Provider schema rejection is a valid HOLD and must not trigger schema weakening.",
    ],
  };

  const exitCode =
    classification === "PASS_LIVE_SEMANTIC_REPROOF"
      ? 0
      : classification.startsWith("FAIL_")
        ? 5
        : 4;

  return finishReceipt(receipt, exitCode, {});
}

/**
 * Production controlled live entry. Receipt directory and cwd are locked to
 * the canonical CEQR-019 paths. Does not accept alternate receiptDir.
 */
export async function runCeqr019ControlledLiveSemanticReproof(args: {
  env?: Record<string, string | undefined>;
  createAdapters?: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
  now?: () => Date;
  writeReceipts?: boolean;
}): Promise<Ceqr019OrchestrationResult> {
  const pathGate = assertCeqr019ProductionLivePaths();
  if (!pathGate.ok) {
    const counters = createEmptyCeqr019BoundaryCounters();
    return {
      receipt: {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: false,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "FAIL_UNSAFE_LIVE_EXECUTION_PATH",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [pathGate.message, "Zero provider calls."],
      },
      exitCode: 5,
      providerConstructionAttempted: false,
      providerCalls: 0,
      claimCreated: false,
      liveRunnerInvoked: false,
      boundaryCounters: counters,
    };
  }

  return executeCeqr019LiveOrchestrationCore({
    env: args.env ?? process.env,
    receiptDir: pathGate.receiptDir,
    createAdapters:
      args.createAdapters ??
      ((config) => createOpenAiContradictionLiveAdapters(config)),
    now: args.now,
    writeReceipts: args.writeReceipts !== false,
  });
}

/**
 * Test-only orchestration. Requires an opaque test capability and an injected
 * fake live-proof runner. Cannot be invoked by the production live script.
 */
export async function runCeqr019ControlledLiveSemanticReproofForTests(args: {
  capability: Ceqr019TestOrchestrationCapability;
  env: Record<string, string | undefined>;
  receiptDir: string;
  runLiveProof: LiveProofRunner;
  createAdapters?: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
  now?: () => Date;
  writeReceipts?: boolean;
}): Promise<Ceqr019OrchestrationResult> {
  assertTestCapability(args.capability);
  if (typeof args.runLiveProof !== "function") {
    throw new Error(
      "CEQR-019 test orchestration requires an injected fake runLiveProof.",
    );
  }
  if (basename(resolve(args.receiptDir)) !== CEQR_019_SLICE_ID) {
    const counters = createEmptyCeqr019BoundaryCounters();
    return {
      receipt: {
        slice: CEQR_019_SLICE_ID,
        campaignSlice: CEQR_019_CAMPAIGN_SLICE,
        proofVersion: CEQR_019_PROOF_VERSION,
        phase: "live_semantic_reproof",
        liveAuthorised: false,
        liveExecuted: false,
        liveProviderAttempts: 0,
        classification: "FAIL_UNSAFE_LIVE_EXECUTION_PATH",
        schemaVersion: CEQR_019_EXPECTED_SCHEMA_VERSION,
        casesAggregateSha256: CEQR_019_CASES_AGGREGATE_SHA256,
        boundaryCounters: counters,
        caseObservations: [],
        underlyingLiveProof: null,
        productionReady: false,
        notes: [
          "Test receiptDir basename must equal CONTRADICTION-LIVE-SEMANTIC-REPROOF-001.",
          "Zero provider calls.",
        ],
      },
      exitCode: 5,
      providerConstructionAttempted: false,
      providerCalls: 0,
      claimCreated: false,
      liveRunnerInvoked: false,
      boundaryCounters: counters,
    };
  }

  return executeCeqr019LiveOrchestrationCore({
    env: args.env,
    receiptDir: resolve(args.receiptDir),
    createAdapters:
      args.createAdapters ??
      (async () => {
        throw new Error(
          "CEQR-019 test orchestration requires injected createAdapters or a runLiveProof that supplies fake adapters.",
        );
      }),
    runLiveProof: args.runLiveProof,
    now: args.now,
    writeReceipts: args.writeReceipts === true,
  });
}

/**
 * Offline isolation probe: prove missing authorisation never constructs adapters.
 */
export async function proveCeqr019MissingGuardZeroProviderCalls(
  env: Record<string, string | undefined>,
): Promise<{
  ok: boolean;
  providerCalls: number;
  adapterConstructionCount: number;
  guards: ReturnType<typeof assertCeqr019LiveGuards>;
}> {
  let adapterConstructionCount = 0;
  const result = await runCeqr019ControlledLiveSemanticReproof({
    env,
    writeReceipts: false,
    createAdapters: async () => {
      adapterConstructionCount += 1;
      throw new Error("adapter construction must not run without guards");
    },
  });
  return {
    ok:
      result.providerCalls === 0 &&
      adapterConstructionCount === 0 &&
      result.providerConstructionAttempted === false,
    providerCalls: result.providerCalls,
    adapterConstructionCount,
    guards: assertCeqr019LiveGuards(env),
  };
}
