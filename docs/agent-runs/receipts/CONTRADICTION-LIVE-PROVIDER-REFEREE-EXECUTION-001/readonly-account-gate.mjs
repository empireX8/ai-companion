/**
 * READ-ONLY account gate for CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001
 * (CEQR-011).
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, decide API,
 * confirm/dismiss candidates, persistRepairedContradictionCandidate,
 * live provider writes against the real account.
 *
 * Requires env:
 *   CEQR_READONLY_ACCOUNT_USER_ID=<account user id>
 *
 * The value is used only for the read-only Prisma query filter.
 * It is never printed and never written into receipt JSON
 * (`userId` is always `[REDACTED_ACCOUNT_ID]`).
 *
 * Usage:
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID" \
 *     node docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001/readonly-account-gate.mjs --label before
 *   CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID" \
 *     node docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001/readonly-account-gate.mjs --label after
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const REDACTED_USER_ID = "[REDACTED_ACCOUNT_ID]";

const labelArg = process.argv.find((a) => a.startsWith("--label="));
const label =
  labelArg?.split("=")[1] ??
  process.argv[process.argv.indexOf("--label") + 1] ??
  "run";

function serialize(obj) {
  return JSON.stringify(
    obj,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

function classifyLineage(row) {
  const a = row.sideASourceSpanId;
  const b = row.sideBSourceSpanId;
  const aPresent = typeof a === "string" && a.length > 0;
  const bPresent = typeof b === "string" && b.length > 0;
  if (aPresent && bPresent) return "complete_exact_dual_side";
  if (!aPresent && !bPresent) return "legacy_incomplete";
  return "invalid_partial";
}

function resolveAccountUserId() {
  const raw = process.env.CEQR_READONLY_ACCOUNT_USER_ID;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    console.error(
      "CEQR_READONLY_ACCOUNT_USER_ID is required and must be a non-blank string.",
    );
    process.exit(2);
  }
  return raw.trim();
}

async function main() {
  const accountUserId = resolveAccountUserId();
  const queriedAt = new Date().toISOString();

  const [evidenceSpans, cnStatusGroups, allContradictionNodes, duplicateGroups] =
    await Promise.all([
      db.evidenceSpan.count({ where: { userId: accountUserId } }),
      db.contradictionNode.groupBy({
        by: ["status"],
        where: { userId: accountUserId },
        _count: { _all: true },
      }),
      db.contradictionNode.findMany({
        where: { userId: accountUserId },
        select: {
          id: true,
          status: true,
          sideASourceSpanId: true,
          sideBSourceSpanId: true,
        },
        orderBy: { id: "asc" },
      }),
      db.$queryRaw`
      SELECT
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId",
        COUNT(*)::int AS "count"
      FROM "ContradictionNode"
      WHERE
        "sideASourceSpanId" IS NOT NULL
        AND "sideBSourceSpanId" IS NOT NULL
      GROUP BY
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId"
      HAVING COUNT(*) > 1
    `,
    ]);

  // Node rows remain in memory only for aggregate lineage/count validation.
  const lineageCounts = {
    complete_exact_dual_side: 0,
    legacy_incomplete: 0,
    invalid_partial: 0,
  };
  for (const row of allContradictionNodes) {
    lineageCounts[classifyLineage(row)] += 1;
  }

  const cnByStatus = Object.fromEntries(
    cnStatusGroups.map((r) => [r.status, r._count._all]),
  );
  const candidateTotal = cnByStatus.candidate ?? 0;
  const completePairDuplicateGroups = Number(duplicateGroups.length);

  const expected = {
    contradictionNodeTotal: 25,
    candidateTotal: 25,
    evidenceSpans: 5941,
    completeExactDualSideRows: 0,
    invalidPartialRows: 0,
    legacyIncompleteRows: 25,
    completePairDuplicateGroups: 0,
  };

  // Never serialize node/span IDs or the real account user id.
  const observed = {
    contradictionNodeTotal: allContradictionNodes.length,
    candidateTotal,
    evidenceSpans,
    contradictionNodesByStatus: cnByStatus,
    lineageCounts,
    completePairDuplicateGroups,
  };

  const matchesExpected =
    allContradictionNodes.length === expected.contradictionNodeTotal &&
    candidateTotal === expected.candidateTotal &&
    evidenceSpans === expected.evidenceSpans &&
    lineageCounts.complete_exact_dual_side ===
      expected.completeExactDualSideRows &&
    lineageCounts.invalid_partial === expected.invalidPartialRows &&
    lineageCounts.legacy_incomplete === expected.legacyIncompleteRows &&
    completePairDuplicateGroups === expected.completePairDuplicateGroups;

  const out = {
    campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001",
    slice: "CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001",
    campaignSlice: "CEQR-011",
    phase: "live_provider_referee_execution_001",
    label,
    userId: REDACTED_USER_ID,
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

  const jsonPath = join(OUT_DIR, `account-gate-${label}.json`);
  writeFileSync(jsonPath, serialize(out));
  console.log("Wrote", jsonPath);
  console.log(
    serialize({
      label,
      matchesExpected,
      userId: REDACTED_USER_ID,
      observed: {
        contradictionNodeTotal: observed.contradictionNodeTotal,
        candidateTotal: observed.candidateTotal,
        evidenceSpans: observed.evidenceSpans,
        contradictionNodesByStatus: observed.contradictionNodesByStatus,
        lineageCounts: observed.lineageCounts,
        completePairDuplicateGroups: observed.completePairDuplicateGroups,
      },
    }),
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "account gate failed");
    process.exit(1);
  })
  .finally(() => db.$disconnect());
