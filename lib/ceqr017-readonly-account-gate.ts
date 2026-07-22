/**
 * CEQR-017 read-only account gate (logic + injectable reader).
 *
 * Production executable: docs/.../readonly-account-gate.mjs
 * Phase 1 tests must inject fake readers — no real Prisma queries.
 */

import { writeFileSync } from "fs";

import { assertCeqr017AccountGateWriteTarget } from "./ceqr017-account-gate-path";
import {
  CEQR_015_EXPECTED_ACCOUNT_GATE,
  CEQR_017_CAMPAIGN_SLICE,
  CEQR_017_SLICE_ID,
  ceqr017ReceiptDir,
} from "./contradiction-controlled-live-authority-reproof";

export const CEQR_READONLY_ACCOUNT_USER_ID_ENV =
  "CEQR_READONLY_ACCOUNT_USER_ID" as const;
export const CEQR_017_REDACTED_ACCOUNT_ID = "[REDACTED_ACCOUNT_ID]" as const;

export type Ceqr017AccountGateLabel = "before" | "after";

export type Ceqr017AccountGateLineageRow = {
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
  status: string;
};

export type Ceqr017AccountGateReader = {
  countEvidenceSpans: (userId: string) => Promise<number>;
  groupContradictionStatuses: (
    userId: string,
  ) => Promise<Record<string, number>>;
  findContradictionLineageRows: (
    userId: string,
  ) => Promise<Ceqr017AccountGateLineageRow[]>;
  countCompletePairDuplicateGroups: (userId: string) => Promise<number>;
};

export type Ceqr017AccountGateResult = {
  campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001";
  slice: typeof CEQR_017_SLICE_ID;
  campaignSlice: typeof CEQR_017_CAMPAIGN_SLICE;
  label: Ceqr017AccountGateLabel;
  userId: typeof CEQR_017_REDACTED_ACCOUNT_ID;
  queriedAt: string;
  mode: "read_only";
  mutationsPerformed: false;
  decisionPostCalled: false;
  writerInvokedAgainstAccount: false;
  confirmDismissCalled: false;
  liveProofWroteToAccount: false;
  expected: typeof CEQR_015_EXPECTED_ACCOUNT_GATE;
  observed: {
    contradictionNodeTotal: number;
    candidateTotal: number;
    evidenceSpans: number;
    contradictionNodesByStatus: Record<string, number>;
    lineageCounts: {
      complete_exact_dual_side: number;
      legacy_incomplete: number;
      invalid_partial: number;
    };
    completePairDuplicateGroups: number;
  };
  matchesExpected: boolean;
};

function classifyLineage(row: Ceqr017AccountGateLineageRow) {
  const aPresent =
    typeof row.sideASourceSpanId === "string" &&
    row.sideASourceSpanId.length > 0;
  const bPresent =
    typeof row.sideBSourceSpanId === "string" &&
    row.sideBSourceSpanId.length > 0;
  if (aPresent && bPresent) return "complete_exact_dual_side" as const;
  if (!aPresent && !bPresent) return "legacy_incomplete" as const;
  return "invalid_partial" as const;
}

export function resolveCeqr017ReadonlyAccountUserId(
  env: Record<string, string | undefined>,
): string {
  const raw = env[CEQR_READONLY_ACCOUNT_USER_ID_ENV];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(
      `${CEQR_READONLY_ACCOUNT_USER_ID_ENV} is required and must be a non-blank string.`,
    );
  }
  return raw.trim();
}

export async function runCeqr017ReadonlyAccountGate(args: {
  label: Ceqr017AccountGateLabel;
  reader: Ceqr017AccountGateReader;
  env?: Record<string, string | undefined>;
  receiptDir?: string;
  now?: () => Date;
  write?: boolean;
  /** Test-only: permit temporary receipt dirs with the exact slice basename. */
  allowTestReceiptDir?: boolean;
}): Promise<Ceqr017AccountGateResult> {
  const env = args.env ?? process.env;
  const accountUserId = resolveCeqr017ReadonlyAccountUserId(env);
  const queriedAt = (args.now ?? (() => new Date()))().toISOString();

  const [evidenceSpans, cnByStatus, rows, completePairDuplicateGroups] =
    await Promise.all([
      args.reader.countEvidenceSpans(accountUserId),
      args.reader.groupContradictionStatuses(accountUserId),
      args.reader.findContradictionLineageRows(accountUserId),
      args.reader.countCompletePairDuplicateGroups(accountUserId),
    ]);

  const lineageCounts = {
    complete_exact_dual_side: 0,
    legacy_incomplete: 0,
    invalid_partial: 0,
  };
  for (const row of rows) {
    lineageCounts[classifyLineage(row)] += 1;
  }

  const candidateTotal = cnByStatus.candidate ?? 0;
  const expected = CEQR_015_EXPECTED_ACCOUNT_GATE;
  const observed = {
    contradictionNodeTotal: rows.length,
    candidateTotal,
    evidenceSpans,
    contradictionNodesByStatus: cnByStatus,
    lineageCounts,
    completePairDuplicateGroups,
  };

  const matchesExpected =
    rows.length === expected.contradictionNodeTotal &&
    candidateTotal === expected.candidateTotal &&
    evidenceSpans === expected.evidenceSpans &&
    lineageCounts.complete_exact_dual_side ===
      expected.completeExactDualSideRows &&
    lineageCounts.invalid_partial === expected.invalidPartialRows &&
    lineageCounts.legacy_incomplete === expected.legacyIncompleteRows &&
    completePairDuplicateGroups === expected.completePairDuplicateGroups;

  const out: Ceqr017AccountGateResult = {
    campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001",
    slice: CEQR_017_SLICE_ID,
    campaignSlice: CEQR_017_CAMPAIGN_SLICE,
    label: args.label,
    userId: CEQR_017_REDACTED_ACCOUNT_ID,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    decisionPostCalled: false,
    writerInvokedAgainstAccount: false,
    confirmDismissCalled: false,
    liveProofWroteToAccount: false,
    expected,
    observed,
    matchesExpected,
  };

  if (args.write !== false) {
    const dir = args.receiptDir ?? ceqr017ReceiptDir();
    const { outPath } = assertCeqr017AccountGateWriteTarget({
      receiptDir: dir,
      label: args.label,
      allowTestReceiptDir: args.allowTestReceiptDir,
    });
    writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  }

  return out;
}

/** Persist an already-computed gate result (claim-winner path only). */
export function writeCeqr017AccountGateResult(args: {
  result: Ceqr017AccountGateResult;
  receiptDir: string;
  allowTestReceiptDir?: boolean;
}): string {
  const { outPath } = assertCeqr017AccountGateWriteTarget({
    receiptDir: args.receiptDir,
    label: args.result.label,
    allowTestReceiptDir: args.allowTestReceiptDir,
  });
  writeFileSync(outPath, `${JSON.stringify(args.result, null, 2)}\n`, "utf8");
  return outPath;
}

export function createMatchingFakeCeqr017AccountGateReader(): Ceqr017AccountGateReader {
  const expected = CEQR_015_EXPECTED_ACCOUNT_GATE;
  return {
    async countEvidenceSpans() {
      return expected.evidenceSpans;
    },
    async groupContradictionStatuses() {
      return { candidate: expected.candidateTotal };
    },
    async findContradictionLineageRows() {
      return Array.from({ length: expected.legacyIncompleteRows }, () => ({
        sideASourceSpanId: null,
        sideBSourceSpanId: null,
        status: "candidate",
      }));
    },
    async countCompletePairDuplicateGroups() {
      return expected.completePairDuplicateGroups;
    },
  };
}

export function createMismatchingFakeCeqr017AccountGateReader(): Ceqr017AccountGateReader {
  const base = createMatchingFakeCeqr017AccountGateReader();
  return {
    ...base,
    async countEvidenceSpans() {
      return 9999;
    },
  };
}
