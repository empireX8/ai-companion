/**
 * CEQR-021 — identity, path, guard, and historical-hash constants.
 *
 * Offline preparation only. Does not authorise a live provider call.
 */

import {
  CEQR_017_LIVE_RECEIPT_SHA256,
  CEQR_017_PERMANENT_CLAIM_SHA256,
  CEQR_019_CASE_SHA256,
  CEQR_019_CASES_AGGREGATE_SHA256,
  CEQR_019_FROZEN_LIVE_PLAN_BYTES,
  CEQR_019_FROZEN_LIVE_PLAN_SHA256,
  CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES,
  CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256,
  CEQR_019_LIVE_ONESHOT_CLAIM_BYTES,
  CEQR_019_LIVE_ONESHOT_CLAIM_SHA256,
  CEQR_019_LIVE_PROVIDER_ATTEMPTS,
  CEQR_019_LIVE_RESULT_CLASSIFICATION,
  CEQR_019_PERMANENT_CLAIM_BYTES,
  CEQR_019_PERMANENT_CLAIM_SHA256,
} from "./contradiction-controlled-live-semantic-reproof";

/** Historical CEQR-020 identity pins (do not import the forensic helper module). */
const CEQR_020_SLICE_ID_PIN =
  "CONTRADICTION-LIVE-EVIDENCE-OFFSET-FORENSIC-REPAIR-001" as const;
const CEQR_020_CAMPAIGN_SLICE_PIN = "CEQR-020" as const;

export const CEQR_021_TASK_ID =
  "CONTRADICTION-SCHEMA-V4-CONTROLLED-LIVE-PROOF-001" as const;
export const CEQR_021_CAMPAIGN_ID =
  "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001" as const;
export const CEQR_021_SLICE_ID =
  "CONTRADICTION-SCHEMA-V4-CONTROLLED-LIVE-PROOF-001" as const;
export const CEQR_021_CAMPAIGN_SLICE = "CEQR-021" as const;
export const CEQR_021_PROOF_VERSION =
  "contradiction-schema-v4-controlled-live-proof-v1" as const;

export const CEQR_021_WORKTREE_PATH =
  "/Users/user/ai-companion-worktrees/desktop-contradiction-schema-v4-controlled-live-proof-001" as const;
export const CEQR_021_BRANCH =
  "desktop-contradiction-schema-v4-controlled-live-proof-001" as const;
export const CEQR_021_BASE_HEAD =
  "785d88640fdb284805a958f5a7f25cd0c68b7188" as const;

/** Exact canonical receipt directory for eventual production live execution. */
export const CEQR_021_CANONICAL_RECEIPT_DIR =
  `${CEQR_021_WORKTREE_PATH}/docs/agent-runs/receipts/${CEQR_021_SLICE_ID}` as const;

/**
 * Dual live guards — require exact nontrivial acknowledgement values,
 * not mere presence or "1".
 */
export const CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV =
  "ORVEK_CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF" as const;
export const CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE =
  "ALLOW_SCHEMA_V4_CONTROLLED_LIVE_PROOF" as const;

export const CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV =
  "ORVEK_CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT" as const;
export const CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE =
  "CONFIRM_SYNTHETIC_ONLY_ONE_SHOT" as const;

export const CEQR_021_ONESHOT_CLAIM_FILENAME =
  "ceqr021-oneshot-claim.json" as const;
export const CEQR_021_PRE_LIVE_PLAN_TEMPLATE_FILENAME =
  "pre-live-plan-template.json" as const;
export const CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME =
  "final-frozen-live-plan.json" as const;
export const CEQR_021_LIVE_RECEIPT_FILENAME =
  "live-execution-receipt.json" as const;
export const CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME =
  "ceqr021-unarmed-claim-template.json" as const;
/** Exclusive atomic execution lock (wx). Never auto-deleted. */
export const CEQR_021_EXECUTION_LOCK_FILENAME =
  "ceqr021-execution-lock.json" as const;
/** Best-effort progress companion; the acquired lock record is never truncated. */
export const CEQR_021_EXECUTION_LOCK_PROGRESS_FILENAME =
  "ceqr021-execution-lock-progress.json" as const;

/** Exact frozen source IDs — not arbitrary message:/reference: prefixes. */
export const CEQR_021_FROZEN_SOURCE_IDS = {
  clear_contradiction_candidate: {
    A: "message:ceqr021:clear_contradiction_candidate:A",
    B: "message:ceqr021:clear_contradiction_candidate:B",
  },
  compatible_contextual: {
    A: "message:ceqr021:compatible_contextual:A",
    B: "message:ceqr021:compatible_contextual:B",
  },
  ambiguous_insufficient: {
    A: "message:ceqr021:ambiguous_insufficient:A",
    B: "message:ceqr021:ambiguous_insufficient:B",
  },
} as const;

/** Exact expected compatible classification for the frozen compatible case. */
export const CEQR_021_EXPECTED_COMPATIBLE_CLASSIFICATION =
  "compatible_states" as const;

/** Expected total provider attempts on strict PASS (3 adj + 1 ref). */
export const CEQR_021_EXPECTED_TOTAL_PROVIDER_ATTEMPTS_ON_PASS = 4 as const;

export const CEQR_021_EXPECTED_PROVIDER_ID = "openai" as const;
export const CEQR_021_EXPECTED_ADJUDICATOR_MODEL = "gpt-4o-mini" as const;
export const CEQR_021_EXPECTED_REFEREE_MODEL = "gpt-4o-mini" as const;
export const CEQR_021_EXPECTED_MAX_RETRIES = 0 as const;
export const CEQR_021_EXPECTED_TIMEOUT_MS = 45_000 as const;
export const CEQR_021_EXPECTED_MAX_PROVIDER_ATTEMPTS = 6 as const;
export const CEQR_021_EXPECTED_ADJUDICATOR_CALLS = 3 as const;
/** One clear case → one referee call through the validated clear path. */
export const CEQR_021_EXPECTED_REFEREE_CALLS = 1 as const;

export const CEQR_021_EXPECTED_SCHEMA_VERSION =
  "contradiction-adjudication-schema-v4" as const;
export const CEQR_021_EXPECTED_PROMPT_VERSION =
  "contradiction-adjudication-prompt-v4" as const;
/**
 * Distinct CEQR-021 controlled-live addendum identity (pinned for this proof).
 * Does not replace the production addendum-v4 used by ordinary live adapters.
 */
export const CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION =
  "contradiction-live-adjudicator-prompt-addendum-ceqr021-schema-v4" as const;
export const CEQR_021_EXPECTED_KERNEL_CONTRACT =
  "orvek-intelligence-kernel-v1" as const;

/** Reused CEQR-019 frozen scenario hashes (byte-identical sources). */
export const CEQR_021_CASE_SHA256 = CEQR_019_CASE_SHA256;
export const CEQR_021_CASES_AGGREGATE_SHA256 = CEQR_019_CASES_AGGREGATE_SHA256;

export const CEQR_021_PENDING_EXECUTION_HEAD =
  "PENDING_POST_REVIEW_COMMIT_FREEZE" as const;

/** Historical immutability pins. */
export const CEQR_021_HISTORICAL = {
  ceqr017LiveReceiptSha256: CEQR_017_LIVE_RECEIPT_SHA256,
  ceqr017PermanentClaimSha256: CEQR_017_PERMANENT_CLAIM_SHA256,
  ceqr019LiveOneshotClaimSha256: CEQR_019_LIVE_ONESHOT_CLAIM_SHA256,
  ceqr019LiveOneshotClaimBytes: CEQR_019_LIVE_ONESHOT_CLAIM_BYTES,
  ceqr019FrozenLivePlanSha256: CEQR_019_FROZEN_LIVE_PLAN_SHA256,
  ceqr019FrozenLivePlanBytes: CEQR_019_FROZEN_LIVE_PLAN_BYTES,
  ceqr019LiveExecutionReceiptSha256: CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256,
  ceqr019LiveExecutionReceiptBytes: CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES,
  ceqr019PermanentClaimSha256: CEQR_019_PERMANENT_CLAIM_SHA256,
  ceqr019PermanentClaimBytes: CEQR_019_PERMANENT_CLAIM_BYTES,
  ceqr019LiveResultClassification: CEQR_019_LIVE_RESULT_CLASSIFICATION,
  ceqr019LiveProviderAttempts: CEQR_019_LIVE_PROVIDER_ATTEMPTS,
  ceqr020SliceId: CEQR_020_SLICE_ID_PIN,
  ceqr020CampaignSlice: CEQR_020_CAMPAIGN_SLICE_PIN,
  ceqr020ValidationSummarySha256:
    "4b4325874afb2995623bd911194fc4413149dd6552eb530e04738a77fb4113d3",
  ceqr020ChangedFilesSha256:
    "806c16038d84bbbd9d718fecab9b5da6f65bc69b6fe1ce74077d316ee2bd7b41",
  ceqr020HashVerificationSha256:
    "e3607dc47780c9135492560b204e935f7e23e090f9f9fe8d5030b6bc46197aec",
  /** Immutable CEQR-021 archived live-execution artifacts (byte pins). */
  ceqr021LiveExecutionReceiptSha256:
    "000b98231443fe7d1dcf4b434d3305e2fe9e665986de72bf5fd067f558789014",
  ceqr021OneshotClaimSha256:
    "9527cca6f9da51c10c7ad7f14f37ea0934e3bf2995f60a62c9a6a8c86547a020",
  ceqr021FinalFrozenLivePlanSha256:
    "ec411a3c3bc8c2b99514ca2bc312604dfab1a64e766370f95322dad50e6072c1",
  ceqr021InvalidCredentialResultMdSha256:
    "1528ed4e75765071747b2306c1fc4246c12f67e0a2db563128d52ad6282bbe5f",
  ceqr021ExecutionLockSha256:
    "6c91915601bec2dec2618e8870d52ac67d06f2055230291cd694119d06156fa8",
  ceqr021ExecutionLockProgressSha256:
    "802791495a14fb4e4f2f65361c2bc56c187a120f690b956bf68ec2e6e85f8a00",
} as const;

export type Ceqr021OfflineClassification =
  | "PASS_OFFLINE_SCHEMA_V4_LIVE_PROOF_HARNESS_READY"
  | "HOLD_SCHEMA_V4_PROVIDER_CONTRACT_INCOMPLETE"
  | "HOLD_APPROVED_EVIDENCE_CONTRACT_INCOMPLETE"
  | "HOLD_ONE_SHOT_SAFETY_INCOMPLETE"
  | "HOLD_CALL_ACCOUNTING_INCOMPLETE"
  | "HOLD_LIVE_PASS_CLASSIFIER_INCOMPLETE"
  | "FAIL_SOURCE_AUTHORITY_REGRESSION"
  | "FAIL_SEMANTIC_CONTRACT_REGRESSION"
  | "FAIL_HISTORICAL_ARTIFACT_MUTATION"
  | "FAIL_WRITER_OR_DATABASE_BOUNDARY"
  | "FAIL_LIVE_PROVIDER_PATH_REACHED";

export type Ceqr021LiveClassification =
  | "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED"
  | "FAIL_PROVIDER_OR_TRANSPORT"
  | "FAIL_SCHEMA_V4_PARSE"
  | "FAIL_INVALID_BOUNDARY_INDEX"
  | "FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN"
  | "FAIL_SEMANTIC_CLASSIFICATION_MISMATCH"
  | "FAIL_COMPATIBILITY_FLAG_CONTRACT"
  | "FAIL_ABSTENTION_CONTRACT"
  | "FAIL_REFEREE_NOT_REACHED"
  | "FAIL_REFEREE_OR_TRANSPORT"
  | "FAIL_CALL_BUDGET"
  | "FAIL_RETRY_BOUNDARY"
  | "FAIL_SOURCE_AUTHORITY"
  | "FAIL_WRITER_OR_PERSISTENCE_BOUNDARY"
  | "FAIL_ACCOUNT_OR_DATABASE_BOUNDARY"
  | "FAIL_ONE_SHOT_OR_CANONICAL_PATH"
  | "FAIL_CANONICAL_RECEIPT_FINALIZATION"
  | "FAIL_UNSAFE_MUTATION"
  | "HOLD_LIVE_SCHEMA_V4_PROOF_NOT_YET_EXECUTED"
  | "PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW";

export type Ceqr021CallAccounting = {
  providerConstructionAttempted: number;
  liveRunnerInvoked: number;
  adjudicatorAttempts: number;
  refereeAttempts: number;
  totalProviderAttempts: number;
  automaticRetries: number;
  writerCalls: number;
  persistenceCalls: number;
  accountGateCalls: number;
  realDatabaseCalls: number;
  productionIngestionCalls: number;
  nodesCreated: number;
};

export function createEmptyCeqr021CallAccounting(): Ceqr021CallAccounting {
  return {
    providerConstructionAttempted: 0,
    liveRunnerInvoked: 0,
    adjudicatorAttempts: 0,
    refereeAttempts: 0,
    totalProviderAttempts: 0,
    automaticRetries: 0,
    writerCalls: 0,
    persistenceCalls: 0,
    accountGateCalls: 0,
    realDatabaseCalls: 0,
    productionIngestionCalls: 0,
    nodesCreated: 0,
  };
}

export function syncCeqr021TotalProviderAttempts(
  accounting: Ceqr021CallAccounting,
): void {
  accounting.totalProviderAttempts =
    accounting.adjudicatorAttempts + accounting.refereeAttempts;
}
