/**
 * CEQR-021 — one-shot claim, dual guards, atomic execution lock, and
 * canonical frozen-plan live preflight.
 *
 * Offline tests must use isolated temporary claim paths. The final canonical
 * claim must not be created or consumed by offline preparation.
 *
 * Does not call providers. Does not create canonical claims.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { basename, dirname, join, relative, resolve, sep } from "path";
import { execSync } from "child_process";

import {
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV,
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
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
  CEQR_021_EXECUTION_LOCK_FILENAME,
  CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME,
  CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  CEQR_021_LIVE_RECEIPT_FILENAME,
  CEQR_021_ONESHOT_CLAIM_FILENAME,
  CEQR_021_PENDING_EXECUTION_HEAD,
  CEQR_021_PROOF_VERSION,
  CEQR_021_SLICE_ID,
  CEQR_021_TASK_ID,
  CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
  CEQR_021_WORKTREE_PATH,
} from "./ceqr021-constants";
import {
  CEQR_021_APPROVED_SPAN_SET_SHA256,
  CEQR_021_FROZEN_CATALOG_SHA256,
  CEQR_021_SOURCE_SHA256,
} from "./ceqr021-approved-evidence-spans";
import { buildCeqr021LiveAddendumSha256 } from "./ceqr021-schema-v4-contract";
import { createOpenAiContradictionLiveAdapters } from "./contradiction-live-provider-adapters";

export type Ceqr021ClaimArmingState = "unarmed" | "armed" | "consumed";

export type Ceqr021OneshotClaim = {
  slice: typeof CEQR_021_SLICE_ID;
  campaignSlice: typeof CEQR_021_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_021_PROOF_VERSION;
  armingState: Ceqr021ClaimArmingState;
  purpose: "exactly_one_controlled_schema_v4_live_semantic_proof";
  providerId: typeof CEQR_021_EXPECTED_PROVIDER_ID;
  adjudicatorModelId: typeof CEQR_021_EXPECTED_ADJUDICATOR_MODEL;
  refereeModelId: typeof CEQR_021_EXPECTED_REFEREE_MODEL;
  timeoutMs: typeof CEQR_021_EXPECTED_TIMEOUT_MS;
  maxTotalCalls: typeof CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS;
  maxRetries: typeof CEQR_021_EXPECTED_MAX_RETRIES;
  schemaVersion: typeof CEQR_021_EXPECTED_SCHEMA_VERSION;
  promptVersion: typeof CEQR_021_EXPECTED_PROMPT_VERSION;
  liveAddendumVersion: typeof CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION;
  casesAggregateSha256: typeof CEQR_021_CASES_AGGREGATE_SHA256;
  frozenPlanSha256: string | null;
  committedExecutionHead: string | typeof CEQR_021_PENDING_EXECUTION_HEAD;
  neverAutoDelete: true;
  createdAt: string;
  consumedAt: string | null;
};

/** Final frozen live plan after post-commit freeze (committedExecutionHead is a real SHA). */
export type Ceqr021FrozenLivePlan = {
  taskId: typeof CEQR_021_TASK_ID;
  campaignId: typeof CEQR_021_CAMPAIGN_ID;
  sliceId: typeof CEQR_021_SLICE_ID;
  campaignSlice: typeof CEQR_021_CAMPAIGN_SLICE;
  proofVersion: typeof CEQR_021_PROOF_VERSION;
  branch: typeof CEQR_021_BRANCH;
  worktreePath: typeof CEQR_021_WORKTREE_PATH;
  baseHead: typeof CEQR_021_BASE_HEAD;
  committedExecutionHead: string;
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
    receiptDir: string;
    oneshotClaim: string;
    liveReceipt: string;
    finalFrozenPlan: string;
    unarmedClaimTemplate: string;
  };
  hardSafetyBoundaries: string[];
  productionReady: false;
  liveProviderAttempts: 0;
  [key: string]: unknown;
};

export type Ceqr021ExecutionLockStatus =
  | "acquired"
  | "consumed_claim"
  | "failed_claim_state";

export type Ceqr021ExecutionLockRecord = {
  slice: typeof CEQR_021_SLICE_ID;
  campaignSlice: typeof CEQR_021_CAMPAIGN_SLICE;
  frozenPlanSha256: string;
  committedExecutionHead: string;
  claimPathBasename: string;
  acquiredAt: string;
  status: Ceqr021ExecutionLockStatus;
};

const GIT_SHA40_RE = /^[0-9a-f]{40}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const CLAIM_KEYS = [
  "slice",
  "campaignSlice",
  "proofVersion",
  "armingState",
  "purpose",
  "providerId",
  "adjudicatorModelId",
  "refereeModelId",
  "timeoutMs",
  "maxTotalCalls",
  "maxRetries",
  "schemaVersion",
  "promptVersion",
  "liveAddendumVersion",
  "casesAggregateSha256",
  "frozenPlanSha256",
  "committedExecutionHead",
  "neverAutoDelete",
  "createdAt",
  "consumedAt",
] as const;

function realPathOrResolve(dir: string): string {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) return resolved;
  try {
    return realpathSync.native
      ? realpathSync.native(resolved)
      : realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function pathIsInsideDir(candidatePath: string, dirPath: string): boolean {
  const dirReal = realPathOrResolve(dirPath);
  const candidateReal = realPathOrResolve(candidatePath);
  if (candidateReal === dirReal) return true;
  const prefix = dirReal.endsWith(sep) ? dirReal : `${dirReal}${sep}`;
  return candidateReal.startsWith(prefix);
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isGitSha40(value: unknown): value is string {
  return typeof value === "string" && GIT_SHA40_RE.test(value);
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_RE.test(value);
}

export function ceqr021ReceiptDir(cwd: string = process.cwd()): string {
  return join(cwd, "docs/agent-runs/receipts", CEQR_021_SLICE_ID);
}

export function ceqr021CanonicalOneshotClaimPath(
  cwd: string = CEQR_021_WORKTREE_PATH,
): string {
  return join(ceqr021ReceiptDir(cwd), CEQR_021_ONESHOT_CLAIM_FILENAME);
}

export function ceqr021CanonicalLiveReceiptPath(
  cwd: string = CEQR_021_WORKTREE_PATH,
): string {
  return join(ceqr021ReceiptDir(cwd), CEQR_021_LIVE_RECEIPT_FILENAME);
}

export function ceqr021FinalFrozenPlanPath(
  cwd: string = CEQR_021_WORKTREE_PATH,
): string {
  return join(ceqr021ReceiptDir(cwd), CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME);
}

export function ceqr021ExecutionLockPath(
  cwd: string = process.cwd(),
): string {
  return join(ceqr021ReceiptDir(cwd), CEQR_021_EXECUTION_LOCK_FILENAME);
}

export function assertCeqr021ProductionLivePaths(args?: {
  cwd?: string;
  receiptDir?: string;
}):
  | { ok: true; receiptDir: typeof CEQR_021_CANONICAL_RECEIPT_DIR }
  | {
      ok: false;
      code: "cwd_mismatch" | "receipt_dir_mismatch" | "receipt_dir_override";
      message: string;
    } {
  if (args?.receiptDir != null) {
    const provided = realPathOrResolve(args.receiptDir);
    const expected = realPathOrResolve(CEQR_021_CANONICAL_RECEIPT_DIR);
    if (provided !== expected) {
      return {
        ok: false,
        code: "receipt_dir_override",
        message: `CEQR-021 canonical receiptDir cannot be overridden (got ${provided}).`,
      };
    }
  }
  const cwd = resolve(args?.cwd ?? process.cwd());
  const expectedCwd = resolve(CEQR_021_WORKTREE_PATH);
  if (cwd !== expectedCwd) {
    return {
      ok: false,
      code: "cwd_mismatch",
      message: `CEQR-021 live execution requires cwd ${expectedCwd} (got ${cwd}).`,
    };
  }
  const expectedReceipt = realPathOrResolve(CEQR_021_CANONICAL_RECEIPT_DIR);
  const derived = realPathOrResolve(ceqr021ReceiptDir(cwd));
  if (derived !== expectedReceipt) {
    return {
      ok: false,
      code: "receipt_dir_mismatch",
      message: `CEQR-021 live execution requires receipt dir ${expectedReceipt} (got ${derived}).`,
    };
  }
  return { ok: true, receiptDir: CEQR_021_CANONICAL_RECEIPT_DIR };
}

export function isCeqr021AllowGuardSet(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env[CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV] ===
    CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE
  );
}

export function isCeqr021ConfirmGuardSet(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env[CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV] ===
    CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE
  );
}

export function assertCeqr021LiveGuards(
  env: Record<string, string | undefined> = process.env,
):
  | { ok: true }
  | {
      ok: false;
      code: "allow_guard_missing" | "confirm_guard_missing";
      message: string;
    } {
  if (!isCeqr021AllowGuardSet(env)) {
    return {
      ok: false,
      code: "allow_guard_missing",
      message: `${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV} must be exactly ${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE} (got ${JSON.stringify(env[CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV])}).`,
    };
  }
  if (!isCeqr021ConfirmGuardSet(env)) {
    return {
      ok: false,
      code: "confirm_guard_missing",
      message: `${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV} must be exactly ${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE} (got ${JSON.stringify(env[CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV])}).`,
    };
  }
  return { ok: true };
}

export function readGitBranch(cwd: string = process.cwd()): string {
  return execSync("git branch --show-current", { cwd, encoding: "utf8" }).trim();
}

export function readGitHead(cwd: string = process.cwd()): string {
  return execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
}

export function isGitWorkingTreeClean(cwd: string = process.cwd()): boolean {
  const status = execSync("git status --porcelain --untracked-files=all", {
    cwd,
    encoding: "utf8",
  }).trim();
  return status.length === 0;
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
    // Directory fsync is not supported on every platform; best-effort only.
  }
}

function writeFileAtomicDurable(args: {
  finalPath: string;
  contents: string;
  tmpSuffix: string;
}): void {
  const tmp = `${args.finalPath}${args.tmpSuffix}`;
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, args.contents, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, args.finalPath);
  fsyncDirectoryBestEffort(dirname(args.finalPath));
}

/** Exact untracked runtime artifacts allowed after freeze/arm (relative paths). */
export function ceqr021AllowedExecutionUntrackedRelPaths(
  cwd: string = process.cwd(),
): readonly string[] {
  const receiptRel = relative(
    resolve(cwd),
    resolve(ceqr021ReceiptDir(cwd)),
  ).split(sep).join("/");
  return [
    `${receiptRel}/${CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME}`,
    `${receiptRel}/${CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME}`,
    `${receiptRel}/${CEQR_021_ONESHOT_CLAIM_FILENAME}`,
  ];
}

export type Ceqr021ExecutionTreePhase = "pre_freeze" | "pre_live_execution";

/**
 * Strict CEQR-021 execution-tree verifier.
 *
 * pre_freeze: entire worktree must be clean (no exceptions).
 * pre_live_execution: zero staged / zero modified-deleted tracked files;
 * only the exact freeze/arm untracked artifacts may exist; lock and live
 * receipt must be absent; expected freeze+arm artifacts must exist.
 */
export function assertCeqr021ExecutionTree(args: {
  cwd?: string;
  phase: Ceqr021ExecutionTreePhase;
  /** Test-only: override receipt dir for artifact path checks. */
  receiptDirForTests?: string;
}): { ok: true } | { ok: false; code: "dirty_tree"; message: string } {
  const cwd = resolve(args.cwd ?? process.cwd());
  const porcelain = execSync("git status --porcelain --untracked-files=all", {
    cwd,
    encoding: "utf8",
  });
  const lines = porcelain
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.length > 0);

  if (args.phase === "pre_freeze") {
    if (lines.length > 0) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 freeze requires a completely clean worktree (got ${lines.length} porcelain entries).`,
      };
    }
    return { ok: true };
  }

  const receiptDir = args.receiptDirForTests
    ? resolve(args.receiptDirForTests)
    : resolve(ceqr021ReceiptDir(cwd));
  const allowed = new Set(
    args.receiptDirForTests
      ? [
          join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME),
          join(receiptDir, CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME),
          join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME),
        ].map((p) => relative(cwd, p).split(sep).join("/"))
      : ceqr021AllowedExecutionUntrackedRelPaths(cwd),
  );

  const untracked: string[] = [];
  for (const line of lines) {
    if (line.startsWith("?? ")) {
      const path = line.slice(3).trim();
      // Reject directory entries / nested junk.
      if (path.endsWith("/")) {
        return {
          ok: false,
          code: "dirty_tree",
          message: `CEQR-021 execution tree rejects untracked directory ${path}.`,
        };
      }
      untracked.push(path);
      continue;
    }
    // Any staged or tracked modification/deletion/rename fails.
    return {
      ok: false,
      code: "dirty_tree",
      message: `CEQR-021 execution tree rejects staged or tracked change: ${line}`,
    };
  }

  for (const path of untracked) {
    if (!allowed.has(path)) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 execution tree rejects unexpected untracked file ${path}.`,
      };
    }
  }

  const forbidden = [
    CEQR_021_EXECUTION_LOCK_FILENAME,
    CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME,
    CEQR_021_LIVE_RECEIPT_FILENAME,
  ];
  for (const name of forbidden) {
    if (existsSync(join(receiptDir, name))) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 execution tree requires ${name} to be absent before acquisition.`,
      };
    }
  }

  for (const name of [
    CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
    CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
    CEQR_021_ONESHOT_CLAIM_FILENAME,
  ]) {
    const full = join(receiptDir, name);
    if (!existsSync(full)) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 execution tree missing expected artifact ${name}.`,
      };
    }
    let st;
    try {
      st = lstatSync(full);
    } catch (error) {
      return {
        ok: false,
        code: "dirty_tree",
        message: error instanceof Error ? error.message : "artifact stat failed",
      };
    }
    if (!st.isFile() || st.isSymbolicLink()) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 expected artifact ${name} must be a regular non-symlink file.`,
      };
    }
    if (!pathIsInsideDir(full, receiptDir)) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 expected artifact ${name} escapes receiptDir.`,
      };
    }
  }

  // All three expected artifacts must appear in porcelain as untracked (or be
  // present as the only allowed set). Missing from porcelain means they were
  // committed — which changes HEAD semantics and is forbidden.
  for (const rel of allowed) {
    if (!untracked.includes(rel)) {
      return {
        ok: false,
        code: "dirty_tree",
        message: `CEQR-021 expected runtime artifact must remain untracked (not committed): ${rel}`,
      };
    }
  }

  return { ok: true };
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256Bytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Presence-only check that the real OpenAI live adapter factory is wired.
 * Does not construct or call a provider.
 */
export function assertCeqr021ProviderWiringPresent():
  | { ok: true }
  | { ok: false; message: string } {
  if (typeof createOpenAiContradictionLiveAdapters !== "function") {
    return {
      ok: false,
      message:
        "CEQR-021 provider wiring missing: createOpenAiContradictionLiveAdapters is not a function.",
    };
  }
  return { ok: true };
}

export function validateCeqr021OneshotClaimStrict(
  raw: unknown,
):
  | { ok: true; claim: Ceqr021OneshotClaim }
  | { ok: false; message: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "CEQR-021 claim must be a JSON object." };
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== CLAIM_KEYS.length) {
    return {
      ok: false,
      message: `CEQR-021 claim key count mismatch (expected ${CLAIM_KEYS.length}, got ${keys.length}).`,
    };
  }
  for (const key of CLAIM_KEYS) {
    if (!(key in obj)) {
      return { ok: false, message: `CEQR-021 claim missing field ${key}.` };
    }
  }
  for (const key of keys) {
    if (!(CLAIM_KEYS as readonly string[]).includes(key)) {
      return { ok: false, message: `CEQR-021 claim has unknown field ${key}.` };
    }
  }

  if (obj.slice !== CEQR_021_SLICE_ID) {
    return { ok: false, message: `claim.slice mismatch (got ${String(obj.slice)}).` };
  }
  if (obj.campaignSlice !== CEQR_021_CAMPAIGN_SLICE) {
    return {
      ok: false,
      message: `claim.campaignSlice mismatch (got ${String(obj.campaignSlice)}).`,
    };
  }
  if (obj.proofVersion !== CEQR_021_PROOF_VERSION) {
    return {
      ok: false,
      message: `claim.proofVersion mismatch (got ${String(obj.proofVersion)}).`,
    };
  }
  if (
    obj.armingState !== "unarmed" &&
    obj.armingState !== "armed" &&
    obj.armingState !== "consumed"
  ) {
    return {
      ok: false,
      message: `claim.armingState invalid (got ${String(obj.armingState)}).`,
    };
  }
  if (obj.purpose !== "exactly_one_controlled_schema_v4_live_semantic_proof") {
    return { ok: false, message: "claim.purpose mismatch." };
  }
  if (obj.providerId !== CEQR_021_EXPECTED_PROVIDER_ID) {
    return { ok: false, message: "claim.providerId mismatch." };
  }
  if (obj.adjudicatorModelId !== CEQR_021_EXPECTED_ADJUDICATOR_MODEL) {
    return { ok: false, message: "claim.adjudicatorModelId mismatch." };
  }
  if (obj.refereeModelId !== CEQR_021_EXPECTED_REFEREE_MODEL) {
    return { ok: false, message: "claim.refereeModelId mismatch." };
  }
  if (obj.timeoutMs !== CEQR_021_EXPECTED_TIMEOUT_MS) {
    return { ok: false, message: "claim.timeoutMs mismatch." };
  }
  if (obj.maxTotalCalls !== CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS) {
    return { ok: false, message: "claim.maxTotalCalls mismatch." };
  }
  if (obj.maxRetries !== CEQR_021_EXPECTED_MAX_RETRIES) {
    return { ok: false, message: "claim.maxRetries mismatch." };
  }
  if (obj.schemaVersion !== CEQR_021_EXPECTED_SCHEMA_VERSION) {
    return { ok: false, message: "claim.schemaVersion mismatch." };
  }
  if (obj.promptVersion !== CEQR_021_EXPECTED_PROMPT_VERSION) {
    return { ok: false, message: "claim.promptVersion mismatch." };
  }
  if (obj.liveAddendumVersion !== CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION) {
    return { ok: false, message: "claim.liveAddendumVersion mismatch." };
  }
  if (obj.casesAggregateSha256 !== CEQR_021_CASES_AGGREGATE_SHA256) {
    return { ok: false, message: "claim.casesAggregateSha256 mismatch." };
  }
  if (obj.neverAutoDelete !== true) {
    return { ok: false, message: "claim.neverAutoDelete must be true." };
  }
  if (!isNonEmptyString(obj.createdAt) || !ISO_TIMESTAMP_RE.test(obj.createdAt)) {
    return { ok: false, message: "claim.createdAt must be an ISO timestamp." };
  }

  const armingState = obj.armingState as Ceqr021ClaimArmingState;
  const frozenPlanSha256 = obj.frozenPlanSha256;
  const committedExecutionHead = obj.committedExecutionHead;
  const consumedAt = obj.consumedAt;

  if (armingState === "unarmed") {
    if (frozenPlanSha256 !== null && !isSha256Hex(frozenPlanSha256)) {
      return {
        ok: false,
        message:
          "unarmed claim.frozenPlanSha256 must be null or a SHA-256 hex digest.",
      };
    }
    if (
      committedExecutionHead !== CEQR_021_PENDING_EXECUTION_HEAD &&
      !isGitSha40(committedExecutionHead)
    ) {
      return {
        ok: false,
        message:
          "unarmed claim.committedExecutionHead must be PENDING or a 40-char git SHA.",
      };
    }
    if (consumedAt !== null) {
      return { ok: false, message: "unarmed claim.consumedAt must be null." };
    }
  } else {
    if (!isSha256Hex(frozenPlanSha256)) {
      return {
        ok: false,
        message: `${armingState} claim.frozenPlanSha256 must be a SHA-256 hex digest.`,
      };
    }
    if (!isGitSha40(committedExecutionHead)) {
      return {
        ok: false,
        message: `${armingState} claim.committedExecutionHead must be a 40-char git SHA.`,
      };
    }
    if (armingState === "consumed") {
      if (!isNonEmptyString(consumedAt) || !ISO_TIMESTAMP_RE.test(consumedAt)) {
        return {
          ok: false,
          message: "consumed claim.consumedAt must be an ISO timestamp.",
        };
      }
    } else if (consumedAt !== null) {
      return { ok: false, message: "armed claim.consumedAt must be null." };
    }
  }

  return { ok: true, claim: obj as Ceqr021OneshotClaim };
}

function validateCanonicalPathsShape(
  paths: unknown,
  receiptDir: string | null,
): { ok: true } | { ok: false; message: string } {
  if (paths == null || typeof paths !== "object" || Array.isArray(paths)) {
    return { ok: false, message: "frozen plan canonicalPaths must be an object." };
  }
  const p = paths as Record<string, unknown>;
  const required = [
    "receiptDir",
    "oneshotClaim",
    "liveReceipt",
    "finalFrozenPlan",
    "unarmedClaimTemplate",
  ] as const;
  for (const key of required) {
    if (!isNonEmptyString(p[key])) {
      return {
        ok: false,
        message: `frozen plan canonicalPaths.${key} must be a non-empty string.`,
      };
    }
  }
  const oneshotClaim = p.oneshotClaim as string;
  const liveReceipt = p.liveReceipt as string;
  const finalFrozenPlan = p.finalFrozenPlan as string;
  const unarmedClaimTemplate = p.unarmedClaimTemplate as string;
  const planReceiptDir = p.receiptDir as string;

  if (basename(oneshotClaim) !== CEQR_021_ONESHOT_CLAIM_FILENAME) {
    return { ok: false, message: "canonicalPaths.oneshotClaim basename mismatch." };
  }
  if (basename(liveReceipt) !== CEQR_021_LIVE_RECEIPT_FILENAME) {
    return { ok: false, message: "canonicalPaths.liveReceipt basename mismatch." };
  }
  if (basename(finalFrozenPlan) !== CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME) {
    return {
      ok: false,
      message: "canonicalPaths.finalFrozenPlan basename mismatch.",
    };
  }
  if (basename(unarmedClaimTemplate) !== CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME) {
    return {
      ok: false,
      message: "canonicalPaths.unarmedClaimTemplate basename mismatch.",
    };
  }
  if (receiptDir != null) {
    const expectedReceipt = realPathOrResolve(receiptDir);
    const planReceipt = realPathOrResolve(planReceiptDir);
    if (planReceipt !== expectedReceipt && planReceiptDir !== receiptDir) {
      return {
        ok: false,
        message: `frozen plan canonicalPaths.receiptDir mismatch (got ${planReceiptDir}).`,
      };
    }
  }
  return { ok: true };
}

export function validateCeqr021FrozenPlanStrict(
  raw: unknown,
  planSha256: string,
):
  | { ok: true; plan: Ceqr021FrozenLivePlan }
  | { ok: false; message: string } {
  if (!isSha256Hex(planSha256)) {
    return {
      ok: false,
      message: "planSha256 argument must be a SHA-256 hex digest.",
    };
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "CEQR-021 frozen plan must be a JSON object." };
  }
  const obj = raw as Record<string, unknown>;

  const requiredExact: Array<[string, unknown]> = [
    ["taskId", CEQR_021_TASK_ID],
    ["campaignId", CEQR_021_CAMPAIGN_ID],
    ["sliceId", CEQR_021_SLICE_ID],
    ["campaignSlice", CEQR_021_CAMPAIGN_SLICE],
    ["proofVersion", CEQR_021_PROOF_VERSION],
    ["branch", CEQR_021_BRANCH],
    ["worktreePath", CEQR_021_WORKTREE_PATH],
    ["baseHead", CEQR_021_BASE_HEAD],
    ["providerId", CEQR_021_EXPECTED_PROVIDER_ID],
    ["adjudicatorModelId", CEQR_021_EXPECTED_ADJUDICATOR_MODEL],
    ["refereeModelId", CEQR_021_EXPECTED_REFEREE_MODEL],
    ["schemaVersion", CEQR_021_EXPECTED_SCHEMA_VERSION],
    ["promptVersion", CEQR_021_EXPECTED_PROMPT_VERSION],
    ["liveAddendumVersion", CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION],
    ["kernelContract", CEQR_021_EXPECTED_KERNEL_CONTRACT],
    ["timeoutMs", CEQR_021_EXPECTED_TIMEOUT_MS],
    ["retryCount", CEQR_021_EXPECTED_MAX_RETRIES],
    ["totalCallBudget", CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS],
    ["expectedAdjudicatorCalls", CEQR_021_EXPECTED_ADJUDICATOR_CALLS],
    ["expectedRefereeCalls", CEQR_021_EXPECTED_REFEREE_CALLS],
    ["casesAggregateSha256", CEQR_021_CASES_AGGREGATE_SHA256],
    ["productionReady", false],
    ["liveProviderAttempts", 0],
  ];
  for (const [key, expected] of requiredExact) {
    if (!(key in obj)) {
      return { ok: false, message: `frozen plan missing field ${key}.` };
    }
    if (obj[key] !== expected) {
      return {
        ok: false,
        message: `frozen plan.${key} mismatch (got ${JSON.stringify(obj[key])}).`,
      };
    }
  }

  if (!isGitSha40(obj.committedExecutionHead)) {
    return {
      ok: false,
      message:
        "frozen plan.committedExecutionHead must be a 40-char hex SHA (not PENDING).",
    };
  }
  if (obj.committedExecutionHead === CEQR_021_PENDING_EXECUTION_HEAD) {
    return {
      ok: false,
      message: "frozen plan.committedExecutionHead must not be PENDING.",
    };
  }

  const expectedAddendumSha = buildCeqr021LiveAddendumSha256();
  if (obj.liveAddendumSha256 !== expectedAddendumSha) {
    return {
      ok: false,
      message: `frozen plan.liveAddendumSha256 mismatch (expected ${expectedAddendumSha}).`,
    };
  }

  if (!deepEqualJson(obj.caseSha256ById, CEQR_021_CASE_SHA256)) {
    return { ok: false, message: "frozen plan.caseSha256ById mismatch." };
  }
  if (!deepEqualJson(obj.catalogSha256ByCaseSide, CEQR_021_FROZEN_CATALOG_SHA256)) {
    return {
      ok: false,
      message: "frozen plan.catalogSha256ByCaseSide mismatch.",
    };
  }
  if (
    !deepEqualJson(
      obj.approvedSpanSetSha256ByCaseSide,
      CEQR_021_APPROVED_SPAN_SET_SHA256,
    )
  ) {
    return {
      ok: false,
      message: "frozen plan.approvedSpanSetSha256ByCaseSide mismatch.",
    };
  }
  if (!deepEqualJson(obj.sourceSha256ByCaseSide, CEQR_021_SOURCE_SHA256)) {
    return {
      ok: false,
      message: "frozen plan.sourceSha256ByCaseSide mismatch.",
    };
  }

  const guards = obj.guards;
  if (guards == null || typeof guards !== "object" || Array.isArray(guards)) {
    return { ok: false, message: "frozen plan.guards must be an object." };
  }
  const g = guards as Record<string, unknown>;
  if (g.allowEnv !== CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV) {
    return { ok: false, message: "frozen plan.guards.allowEnv mismatch." };
  }
  if (g.allowValue !== CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE) {
    return { ok: false, message: "frozen plan.guards.allowValue mismatch." };
  }
  if (g.confirmEnv !== CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV) {
    return { ok: false, message: "frozen plan.guards.confirmEnv mismatch." };
  }
  if (g.confirmValue !== CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE) {
    return { ok: false, message: "frozen plan.guards.confirmValue mismatch." };
  }

  const pathsCheck = validateCanonicalPathsShape(obj.canonicalPaths, null);
  if (!pathsCheck.ok) return pathsCheck;

  if (!Array.isArray(obj.hardSafetyBoundaries)) {
    return {
      ok: false,
      message: "frozen plan.hardSafetyBoundaries must be an array.",
    };
  }
  for (const entry of obj.hardSafetyBoundaries) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        message: "frozen plan.hardSafetyBoundaries entries must be strings.",
      };
    }
  }

  // Execution-phase authorisation fields on the plan itself must remain false.
  if ("liveAuthorisedByThisTemplate" in obj && obj.liveAuthorisedByThisTemplate !== false) {
    return {
      ok: false,
      message: "frozen plan.liveAuthorisedByThisTemplate must be false when present.",
    };
  }
  if ("liveAuthorisedByThisFreeze" in obj && obj.liveAuthorisedByThisFreeze !== false) {
    return {
      ok: false,
      message: "frozen plan.liveAuthorisedByThisFreeze must be false when present.",
    };
  }
  if ("armed" in obj && obj.armed !== false) {
    return {
      ok: false,
      message: "frozen plan.armed must be false when present.",
    };
  }

  // planSha256 is the hash of exact file bytes; keep it as an authority pin
  // argument (callers bind it to the claim). Reject blank/malformed above.
  void planSha256;

  return { ok: true, plan: obj as Ceqr021FrozenLivePlan };
}

function writeExecutionLockProgress(
  receiptDir: string,
  record: Ceqr021ExecutionLockRecord,
): void {
  // Never truncate/rewrite the acquired lock file. Progress is a companion.
  const progressPath = join(
    receiptDir,
    CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME,
  );
  try {
    writeFileAtomicDurable({
      finalPath: progressPath,
      contents: `${JSON.stringify(record, null, 2)}\n`,
      tmpSuffix: `.progress-${process.pid}.tmp`,
    });
  } catch {
    // Acquired lock remains inspectable even if progress write fails.
  }
}

export type Ceqr021ConsumeFaultPoint =
  | "after_lock_create"
  | "after_lock_fsync"
  | "after_consumed_temp_write"
  | "before_rename"
  | "after_rename";

/**
 * Atomic single-winner execution lock + crash-durable claim consumption.
 * Lock is created with O_EXCL (wx), fsynced, and never deleted automatically.
 * The acquired lock record is never truncated; progress uses a companion file.
 */
export function acquireCeqr021ExecutionLockAndConsumeClaim(args: {
  receiptDir: string;
  claimPath: string;
  frozenPlanSha256: string;
  committedExecutionHead: string;
  now?: () => Date;
  /** Test-only fault injection after named durability points. */
  faultInjectForTests?: {
    point: Ceqr021ConsumeFaultPoint;
    error?: Error;
  };
}):
  | { ok: true; claim: Ceqr021OneshotClaim; lockPath: string }
  | {
      ok: false;
      code:
        | "execution_locked"
        | "claim_missing"
        | "claim_not_armed"
        | "already_consumed"
        | "claim_invalid"
        | "claim_mismatch"
        | "io_error";
      message: string;
    } {
  const lockPath = join(args.receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME);
  const now = args.now ?? (() => new Date());
  const acquiredAt = now().toISOString();
  const fault = args.faultInjectForTests;

  const throwFault = (point: Ceqr021ConsumeFaultPoint): void => {
    if (fault?.point === point) {
      throw fault.error ?? new Error(`CEQR-021 fault inject at ${point}`);
    }
  };

  const lockRecord: Ceqr021ExecutionLockRecord = {
    slice: CEQR_021_SLICE_ID,
    campaignSlice: CEQR_021_CAMPAIGN_SLICE,
    frozenPlanSha256: args.frozenPlanSha256,
    committedExecutionHead: args.committedExecutionHead,
    claimPathBasename: basename(args.claimPath),
    acquiredAt,
    status: "acquired",
  };

  try {
    const fd = openSync(lockPath, "wx");
    try {
      writeFileSync(fd, `${JSON.stringify(lockRecord, null, 2)}\n`, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    throwFault("after_lock_create");
    fsyncDirectoryBestEffort(args.receiptDir);
    throwFault("after_lock_fsync");
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return {
        ok: false,
        code: "execution_locked",
        message: `CEQR-021 execution lock already exists at ${lockPath}; fail before provider.`,
      };
    }
    // If fault inject or fsync failed after create, lock remains.
    if (existsSync(lockPath)) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "io_error",
        message:
          error instanceof Error
            ? error.message
            : "execution lock durability failed",
      };
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "execution lock create failed",
    };
  }

  // Exclusive ownership held — consume claim under durability barriers.
  try {
    if (!existsSync(args.claimPath)) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "claim_missing",
        message: `Claim missing at ${args.claimPath}`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(args.claimPath, "utf8"));
    } catch (error) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "claim_invalid",
        message: error instanceof Error ? error.message : "claim parse failed",
      };
    }

    const validated = validateCeqr021OneshotClaimStrict(parsed);
    if (!validated.ok) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return { ok: false, code: "claim_invalid", message: validated.message };
    }

    const claim = validated.claim;
    if (claim.armingState === "consumed") {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "already_consumed",
        message: "Claim already consumed.",
      };
    }
    if (claim.armingState !== "armed") {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "claim_not_armed",
        message: `Claim not armed (state=${claim.armingState}).`,
      };
    }
    if (claim.frozenPlanSha256 !== args.frozenPlanSha256) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "claim_mismatch",
        message: "Claim frozenPlanSha256 does not match lock acquisition args.",
      };
    }
    if (claim.committedExecutionHead !== args.committedExecutionHead) {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
      return {
        ok: false,
        code: "claim_mismatch",
        message:
          "Claim committedExecutionHead does not match lock acquisition args.",
      };
    }

    const consumed: Ceqr021OneshotClaim = {
      ...claim,
      armingState: "consumed",
      consumedAt: now().toISOString(),
    };
    const tmp = `${args.claimPath}.consuming-${process.pid}`;
    const tmpFd = openSync(tmp, "w");
    try {
      writeFileSync(
        tmpFd,
        `${JSON.stringify(consumed, null, 2)}\n`,
        "utf8",
      );
      fsyncSync(tmpFd);
    } finally {
      closeSync(tmpFd);
    }
    throwFault("after_consumed_temp_write");
    throwFault("before_rename");
    renameSync(tmp, args.claimPath);
    throwFault("after_rename");
    fsyncDirectoryBestEffort(dirname(args.claimPath));

    writeExecutionLockProgress(args.receiptDir, {
      ...lockRecord,
      status: "consumed_claim",
    });

    return { ok: true, claim: consumed, lockPath };
  } catch (error) {
    try {
      writeExecutionLockProgress(args.receiptDir, {
        ...lockRecord,
        status: "failed_claim_state",
      });
    } catch {
      // Lock remains inspectable even if progress rewrite fails.
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "consume under lock failed",
    };
  }
}

/**
 * @deprecated Prefer acquireCeqr021ExecutionLockAndConsumeClaim as the only
 * production consume path. This wrapper routes through the atomic lock using
 * dirname(claimPath) as receiptDir.
 */
export function consumeCeqr021ArmedClaim(args: {
  claimPath: string;
  now?: () => Date;
}):
  | { ok: true; claim: Ceqr021OneshotClaim }
  | {
      ok: false;
      code: "missing" | "not_armed" | "already_consumed" | "io_error";
      message: string;
    } {
  if (!existsSync(args.claimPath)) {
    return {
      ok: false,
      code: "missing",
      message: `Claim missing at ${args.claimPath}`,
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(args.claimPath, "utf8"));
    const validated = validateCeqr021OneshotClaimStrict(parsed);
    if (!validated.ok) {
      return { ok: false, code: "io_error", message: validated.message };
    }
    if (validated.claim.armingState === "consumed") {
      return {
        ok: false,
        code: "already_consumed",
        message: "Claim already consumed.",
      };
    }
    if (validated.claim.armingState !== "armed") {
      return {
        ok: false,
        code: "not_armed",
        message: `Claim not armed (state=${validated.claim.armingState}).`,
      };
    }
    if (!isNonEmptyString(validated.claim.frozenPlanSha256)) {
      return {
        ok: false,
        code: "io_error",
        message: "Armed claim missing frozenPlanSha256 for lock acquisition.",
      };
    }
    if (!isGitSha40(validated.claim.committedExecutionHead)) {
      return {
        ok: false,
        code: "io_error",
        message:
          "Armed claim missing committedExecutionHead for lock acquisition.",
      };
    }

    const acquired = acquireCeqr021ExecutionLockAndConsumeClaim({
      receiptDir: dirname(args.claimPath),
      claimPath: args.claimPath,
      frozenPlanSha256: validated.claim.frozenPlanSha256,
      committedExecutionHead: validated.claim.committedExecutionHead,
      now: args.now,
    });
    if (!acquired.ok) {
      if (acquired.code === "execution_locked" || acquired.code === "already_consumed") {
        return {
          ok: false,
          code: "already_consumed",
          message: acquired.message,
        };
      }
      if (acquired.code === "claim_not_armed") {
        return { ok: false, code: "not_armed", message: acquired.message };
      }
      if (acquired.code === "claim_missing") {
        return { ok: false, code: "missing", message: acquired.message };
      }
      return { ok: false, code: "io_error", message: acquired.message };
    }
    return { ok: true, claim: acquired.claim };
  } catch (error) {
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "consume failed",
    };
  }
}

export type Ceqr021PreflightFailureCode =
  | "cwd_mismatch"
  | "branch_mismatch"
  | "dirty_tree"
  | "head_mismatch"
  | "guard_missing"
  | "claim_missing"
  | "claim_not_armed"
  | "claim_consumed"
  | "claim_invalid"
  | "claim_path_override"
  | "plan_hash_mismatch"
  | "plan_invalid"
  | "frozen_plan_missing"
  | "frozen_plan_not_regular_file"
  | "frozen_plan_symlink_escape"
  | "live_receipt_exists"
  | "execution_lock_exists"
  | "api_key_missing"
  | "receipt_dir_invalid"
  | "ceqr019_rerun_blocked";

/**
 * Mandatory live preflight. Production derives all authority from canonical
 * files under the receipt directory (exact frozen plan + armed claim).
 */
export function assertCeqr021LivePreflight(args: {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** Test-only: override receipt dir (must still end with CEQR_021_SLICE_ID). Production must not pass this. */
  receiptDirForTests?: string;
  skipGitChecksForTests?: boolean;
  skipApiKeyCheckForTests?: boolean;
}):
  | {
      ok: true;
      frozenPlan: Ceqr021FrozenLivePlan;
      frozenPlanSha256: string;
      claim: Ceqr021OneshotClaim;
      committedHead: string;
      apiKeyPresent: true;
    }
  | { ok: false; code: Ceqr021PreflightFailureCode; message: string } {
  const cwd = resolve(args.cwd ?? process.cwd());
  const env = args.env ?? process.env;
  const testMode = args.receiptDirForTests != null;

  if (basename(cwd) === "desktop-contradiction-live-semantic-reproof-001") {
    return {
      ok: false,
      code: "ceqr019_rerun_blocked",
      message: "CEQR-019 cannot be rerun through the CEQR-021 runner.",
    };
  }

  let receiptDir: string;
  if (testMode) {
    const testReceiptDir = args.receiptDirForTests!;
    if (!testReceiptDir.endsWith(CEQR_021_SLICE_ID)) {
      return {
        ok: false,
        code: "receipt_dir_invalid",
        message: `Test receiptDir must end with ${CEQR_021_SLICE_ID}.`,
      };
    }
    receiptDir = testReceiptDir;
  } else {
    const paths = assertCeqr021ProductionLivePaths({ cwd });
    if (!paths.ok) {
      return {
        ok: false,
        code: paths.code === "cwd_mismatch" ? "cwd_mismatch" : "claim_path_override",
        message: paths.message,
      };
    }
    receiptDir = paths.receiptDir;
  }

    if (!args.skipGitChecksForTests) {
    try {
      const branch = readGitBranch(cwd);
      if (branch !== CEQR_021_BRANCH) {
        return {
          ok: false,
          code: "branch_mismatch",
          message: `Expected branch ${CEQR_021_BRANCH}, got ${branch}.`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        code: "branch_mismatch",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const tree = assertCeqr021ExecutionTree({
      cwd,
      phase: "pre_live_execution",
      receiptDirForTests: args.receiptDirForTests,
    });
    if (!tree.ok) {
      return {
        ok: false,
        code: "dirty_tree",
        message: tree.message,
      };
    }
  }

  // Exact frozen plan path — no alternate authority.
  const planPath = join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME);
  if (!existsSync(planPath)) {
    return {
      ok: false,
      code: "frozen_plan_missing",
      message: `CEQR-021 final frozen plan missing at ${planPath}.`,
    };
  }

  let planStat;
  try {
    planStat = statSync(planPath);
  } catch (error) {
    return {
      ok: false,
      code: "frozen_plan_missing",
      message: error instanceof Error ? error.message : "frozen plan stat failed",
    };
  }
  if (!planStat.isFile()) {
    return {
      ok: false,
      code: "frozen_plan_not_regular_file",
      message: `CEQR-021 final frozen plan is not a regular file: ${planPath}.`,
    };
  }
  if (!pathIsInsideDir(planPath, receiptDir)) {
    return {
      ok: false,
      code: "frozen_plan_symlink_escape",
      message: `CEQR-021 final frozen plan realpath escapes receiptDir (${receiptDir}).`,
    };
  }

  const planBytes = readFileSync(planPath);
  const frozenPlanSha256 = sha256Bytes(planBytes);

  let planRaw: unknown;
  try {
    planRaw = JSON.parse(planBytes.toString("utf8"));
  } catch (error) {
    return {
      ok: false,
      code: "plan_invalid",
      message: error instanceof Error ? error.message : "frozen plan JSON parse failed",
    };
  }

  const planValidated = validateCeqr021FrozenPlanStrict(planRaw, frozenPlanSha256);
  if (!planValidated.ok) {
    return { ok: false, code: "plan_invalid", message: planValidated.message };
  }
  const frozenPlan = planValidated.plan;

  // Tighten canonical path receiptDir against the active receiptDir.
  const pathsCheck = validateCanonicalPathsShape(
    frozenPlan.canonicalPaths,
    receiptDir,
  );
  if (!pathsCheck.ok) {
    return { ok: false, code: "plan_invalid", message: pathsCheck.message };
  }
  if (!testMode) {
    const expectedPaths = {
      receiptDir: CEQR_021_CANONICAL_RECEIPT_DIR,
      oneshotClaim: join(
        CEQR_021_CANONICAL_RECEIPT_DIR,
        CEQR_021_ONESHOT_CLAIM_FILENAME,
      ),
      liveReceipt: join(
        CEQR_021_CANONICAL_RECEIPT_DIR,
        CEQR_021_LIVE_RECEIPT_FILENAME,
      ),
      finalFrozenPlan: join(
        CEQR_021_CANONICAL_RECEIPT_DIR,
        CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
      ),
      unarmedClaimTemplate: join(
        CEQR_021_CANONICAL_RECEIPT_DIR,
        CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
      ),
    };
    if (
      realPathOrResolve(frozenPlan.canonicalPaths.receiptDir) !==
        realPathOrResolve(expectedPaths.receiptDir) ||
      realPathOrResolve(frozenPlan.canonicalPaths.oneshotClaim) !==
        realPathOrResolve(expectedPaths.oneshotClaim) ||
      realPathOrResolve(frozenPlan.canonicalPaths.liveReceipt) !==
        realPathOrResolve(expectedPaths.liveReceipt) ||
      realPathOrResolve(frozenPlan.canonicalPaths.finalFrozenPlan) !==
        realPathOrResolve(expectedPaths.finalFrozenPlan) ||
      realPathOrResolve(frozenPlan.canonicalPaths.unarmedClaimTemplate) !==
        realPathOrResolve(expectedPaths.unarmedClaimTemplate)
    ) {
      return {
        ok: false,
        code: "plan_invalid",
        message: "frozen plan canonicalPaths do not match production canonical paths.",
      };
    }
  }

  const claimPath = join(receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME);
  if (!existsSync(claimPath)) {
    return {
      ok: false,
      code: "claim_missing",
      message: `CEQR-021 oneshot claim missing at ${claimPath}.`,
    };
  }

  let claimRaw: unknown;
  try {
    claimRaw = JSON.parse(readFileSync(claimPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      code: "claim_invalid",
      message: error instanceof Error ? error.message : "claim JSON parse failed",
    };
  }

  const claimValidated = validateCeqr021OneshotClaimStrict(claimRaw);
  if (!claimValidated.ok) {
    return { ok: false, code: "claim_invalid", message: claimValidated.message };
  }
  const claim = claimValidated.claim;

  if (claim.armingState === "consumed") {
    return {
      ok: false,
      code: "claim_consumed",
      message: "CEQR-021 oneshot claim already consumed.",
    };
  }
  if (claim.armingState !== "armed") {
    return {
      ok: false,
      code: "claim_not_armed",
      message: `CEQR-021 oneshot claim armingState must be armed (got ${claim.armingState}).`,
    };
  }

  if (claim.frozenPlanSha256 !== frozenPlanSha256) {
    return {
      ok: false,
      code: "plan_hash_mismatch",
      message: `Claim frozenPlanSha256 mismatch: expected ${frozenPlanSha256} got ${claim.frozenPlanSha256}.`,
    };
  }

  if (claim.committedExecutionHead !== frozenPlan.committedExecutionHead) {
    return {
      ok: false,
      code: "head_mismatch",
      message: `Claim committedExecutionHead (${claim.committedExecutionHead}) !== plan.committedExecutionHead (${frozenPlan.committedExecutionHead}).`,
    };
  }

  if (!args.skipGitChecksForTests) {
    let head: string;
    try {
      head = readGitHead(cwd);
    } catch (error) {
      return {
        ok: false,
        code: "head_mismatch",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (
      head !== frozenPlan.committedExecutionHead ||
      head !== claim.committedExecutionHead
    ) {
      return {
        ok: false,
        code: "head_mismatch",
        message: `Git HEAD (${head}) must equal plan and claim committedExecutionHead (${frozenPlan.committedExecutionHead}).`,
      };
    }
  }

  const guards = assertCeqr021LiveGuards(env);
  if (!guards.ok) {
    return { ok: false, code: "guard_missing", message: guards.message };
  }

  const liveReceiptPath = join(receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME);
  if (existsSync(liveReceiptPath)) {
    return {
      ok: false,
      code: "live_receipt_exists",
      message: "Existing CEQR-021 live execution receipt prevents execution.",
    };
  }

  const lockPath = join(receiptDir, CEQR_021_EXECUTION_LOCK_FILENAME);
  if (existsSync(lockPath)) {
    return {
      ok: false,
      code: "execution_lock_exists",
      message: `Existing CEQR-021 execution lock prevents execution (${lockPath}).`,
    };
  }

  // AFTER all non-provider gates: presence-only API key check.
  if (!args.skipApiKeyCheckForTests) {
    const apiKey = env.OPENAI_API_KEY;
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return {
        ok: false,
        code: "api_key_missing",
        message: "OPENAI_API_KEY must be a non-empty string (presence only; value not recorded).",
      };
    }
  }

  return {
    ok: true,
    frozenPlan,
    frozenPlanSha256,
    claim,
    committedHead: frozenPlan.committedExecutionHead,
    apiKeyPresent: true,
  };
}

export function buildCeqr021UnarmedClaimTemplate(args?: {
  frozenPlanSha256?: string | null;
  committedExecutionHead?: string;
  now?: () => Date;
}): Ceqr021OneshotClaim {
  return {
    slice: CEQR_021_SLICE_ID,
    campaignSlice: CEQR_021_CAMPAIGN_SLICE,
    proofVersion: CEQR_021_PROOF_VERSION,
    armingState: "unarmed",
    purpose: "exactly_one_controlled_schema_v4_live_semantic_proof",
    providerId: CEQR_021_EXPECTED_PROVIDER_ID,
    adjudicatorModelId: CEQR_021_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_021_EXPECTED_REFEREE_MODEL,
    timeoutMs: CEQR_021_EXPECTED_TIMEOUT_MS,
    maxTotalCalls: CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    maxRetries: CEQR_021_EXPECTED_MAX_RETRIES,
    schemaVersion: CEQR_021_EXPECTED_SCHEMA_VERSION,
    promptVersion: CEQR_021_EXPECTED_PROMPT_VERSION,
    liveAddendumVersion: CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
    casesAggregateSha256: CEQR_021_CASES_AGGREGATE_SHA256,
    frozenPlanSha256: args?.frozenPlanSha256 ?? null,
    committedExecutionHead:
      args?.committedExecutionHead ?? CEQR_021_PENDING_EXECUTION_HEAD,
    neverAutoDelete: true,
    createdAt: (args?.now ?? (() => new Date()))().toISOString(),
    consumedAt: null,
  };
}

/**
 * Write an UNARMED claim template with O_EXCL. Does not arm or consume.
 * Offline tests and the post-commit freeze script may use this; preparation
 * must not write the canonical armed claim.
 */
export function writeCeqr021UnarmedClaimTemplate(args: {
  claimPath: string;
  frozenPlanSha256?: string | null;
  committedExecutionHead?: string;
  now?: () => Date;
}):
  | { ok: true; claim: Ceqr021OneshotClaim }
  | { ok: false; code: "claim_exists" | "io_error"; message: string } {
  const claim = buildCeqr021UnarmedClaimTemplate(args);
  try {
    const fd = openSync(args.claimPath, "wx");
    try {
      writeFileSync(fd, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
    } finally {
      closeSync(fd);
    }
    return { ok: true, claim };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return {
        ok: false,
        code: "claim_exists",
        message: `CEQR-021 claim already exists at ${args.claimPath}`,
      };
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "claim write failed",
    };
  }
}

/** Test-only helper: arm a previously written unarmed claim at a temp path. */
export function armCeqr021ClaimForTests(args: {
  claimPath: string;
  frozenPlanSha256: string;
  committedExecutionHead: string;
}): Ceqr021OneshotClaim {
  const claim = JSON.parse(
    readFileSync(args.claimPath, "utf8"),
  ) as Ceqr021OneshotClaim;
  if (claim.armingState !== "unarmed") {
    throw new Error(`Expected unarmed claim, got ${claim.armingState}`);
  }
  if (!isSha256Hex(args.frozenPlanSha256)) {
    throw new Error(
      "armCeqr021ClaimForTests requires a SHA-256 hex frozenPlanSha256",
    );
  }
  if (!isGitSha40(args.committedExecutionHead)) {
    throw new Error(
      "armCeqr021ClaimForTests requires a 40-char committedExecutionHead",
    );
  }
  const armed: Ceqr021OneshotClaim = {
    ...claim,
    armingState: "armed",
    frozenPlanSha256: args.frozenPlanSha256,
    committedExecutionHead: args.committedExecutionHead,
  };
  writeFileSync(args.claimPath, `${JSON.stringify(armed, null, 2)}\n`, "utf8");
  return armed;
}

/**
 * Build a final frozen plan object that passes validateCeqr021FrozenPlanStrict.
 * Test-only — does not write canonical artifacts.
 */
export function buildCeqr021FinalFrozenPlanForTests(args: {
  receiptDir: string;
  committedExecutionHead: string;
}): Ceqr021FrozenLivePlan {
  if (!isGitSha40(args.committedExecutionHead)) {
    throw new Error("committedExecutionHead must be a 40-char git SHA");
  }
  return {
    taskId: CEQR_021_TASK_ID,
    campaignId: CEQR_021_CAMPAIGN_ID,
    sliceId: CEQR_021_SLICE_ID,
    campaignSlice: CEQR_021_CAMPAIGN_SLICE,
    proofVersion: CEQR_021_PROOF_VERSION,
    branch: CEQR_021_BRANCH,
    worktreePath: CEQR_021_WORKTREE_PATH,
    baseHead: CEQR_021_BASE_HEAD,
    committedExecutionHead: args.committedExecutionHead,
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
      receiptDir: args.receiptDir,
      oneshotClaim: join(args.receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME),
      liveReceipt: join(args.receiptDir, CEQR_021_LIVE_RECEIPT_FILENAME),
      finalFrozenPlan: join(
        args.receiptDir,
        CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
      ),
      unarmedClaimTemplate: join(
        args.receiptDir,
        CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
      ),
    },
    hardSafetyBoundaries: [
      "test harness frozen plan",
      "no live provider",
      "no writer/persistence",
    ],
    productionReady: false,
    liveProviderAttempts: 0,
    liveAuthorisedByThisFreeze: false,
    armed: false,
  };
}

/**
 * Write final-frozen-live-plan.json + armed claim under a temp receiptDir.
 * Test-only. Does not touch the canonical receipt directory.
 */
export function writeCeqr021TempArmedHarnessForTests(args: {
  receiptDir: string;
  committedExecutionHead?: string;
}): {
  claimPath: string;
  planPath: string;
  frozenPlanSha256: string;
  committedExecutionHead: string;
} {
  const committedExecutionHead =
    args.committedExecutionHead ?? CEQR_021_BASE_HEAD;
  const plan = buildCeqr021FinalFrozenPlanForTests({
    receiptDir: args.receiptDir,
    committedExecutionHead,
  });
  const planPath = join(
    args.receiptDir,
    CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  );
  const serialized = `${JSON.stringify(plan, null, 2)}\n`;
  writeFileSync(planPath, serialized, "utf8");
  const frozenPlanSha256 = sha256Bytes(Buffer.from(serialized, "utf8"));
  const claimPath = join(args.receiptDir, CEQR_021_ONESHOT_CLAIM_FILENAME);
  const written = writeCeqr021UnarmedClaimTemplate({ claimPath });
  if (!written.ok) {
    throw new Error(written.message);
  }
  armCeqr021ClaimForTests({
    claimPath,
    frozenPlanSha256,
    committedExecutionHead,
  });
  return {
    claimPath,
    planPath,
    frozenPlanSha256,
    committedExecutionHead,
  };
}

export function canonicalClaimMustNotExistForOfflinePrep(
  cwd: string = process.cwd(),
): boolean {
  return !existsSync(ceqr021CanonicalOneshotClaimPath(cwd));
}

export function canonicalLiveReceiptMustNotExist(
  cwd: string = process.cwd(),
): boolean {
  return !existsSync(ceqr021CanonicalLiveReceiptPath(cwd));
}

export function canonicalExecutionLockMustNotExist(
  cwd: string = process.cwd(),
): boolean {
  return !existsSync(ceqr021ExecutionLockPath(cwd));
}
