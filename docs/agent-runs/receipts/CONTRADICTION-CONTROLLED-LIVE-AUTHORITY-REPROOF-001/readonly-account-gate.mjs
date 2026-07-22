/**
 * CEQR-017 read-only account gate executable.
 * Writes ONLY into CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001/.
 *
 * FORBIDDEN: create/update/upsert/delete; writing into CEQR-011…016 dirs.
 *
 * Requires:
 *   CEQR_READONLY_ACCOUNT_USER_ID=<account user id>
 *
 * Usage (Phase 2 only — do not run against the real DB in Phase 1):
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID" \
 *     node docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001/readonly-account-gate.mjs --label before
 */

import { createRequire } from "module";
import { realpathSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { basename, dirname, join, resolve, sep } from "path";

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const REDACTED_USER_ID = "[REDACTED_ACCOUNT_ID]";
const SLICE_ID = "CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001";
const PRODUCTION_RECEIPT_DIR =
  "/Users/user/ai-companion-worktrees/desktop-contradiction-controlled-live-authority-reproof-001/docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001";

const resolvedOutDir = realpathSync.native
  ? realpathSync.native(OUT_DIR)
  : realpathSync(OUT_DIR);
const productionReal = realpathSync.native
  ? realpathSync.native(PRODUCTION_RECEIPT_DIR)
  : realpathSync(PRODUCTION_RECEIPT_DIR);
if (resolvedOutDir !== productionReal) {
  console.error("Refusing to run outside exact CEQR-017 production receipt directory.");
  process.exit(2);
}

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const labelArg = process.argv.find((a) => a.startsWith("--label="));
const labelRaw =
  labelArg?.split("=")[1] ??
  process.argv[process.argv.indexOf("--label") + 1] ??
  "";
const label = labelRaw === "after" ? "after" : labelRaw === "before" ? "before" : null;
if (label == null) {
  console.error("CEQR-017 account gate requires --label before|after");
  process.exit(2);
}

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
        "userId" = ${accountUserId}
        AND "sideASourceSpanId" IS NOT NULL
        AND "sideBSourceSpanId" IS NOT NULL
      GROUP BY
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId"
      HAVING COUNT(*) > 1
    `,
    ]);

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
    slice: SLICE_ID,
    campaignSlice: "CEQR-017",
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

  const filename =
    label === "before" ? "account-gate-before.json" : "account-gate-after.json";
  const jsonPath = join(resolvedOutDir, filename);
  if (basename(jsonPath) !== filename || !jsonPath.startsWith(resolvedOutDir + sep)) {
    console.error("CEQR-017 account gate path validation failed.");
    process.exit(2);
  }
  writeFileSync(jsonPath, `${serialize(out)}\n`);
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
        lineageCounts: observed.lineageCounts,
        completePairDuplicateGroups: observed.completePairDuplicateGroups,
      },
    }),
  );
  if (!matchesExpected) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "account gate failed");
    process.exit(1);
  })
  .finally(() => db.$disconnect());
