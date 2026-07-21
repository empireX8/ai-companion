/**
 * READ-ONLY account gate for CONTRADICTION-DUAL-SOURCE-PRESENTATION-001
 * (CEQR-008 / CEQR-009).
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, decide API,
 * confirm/dismiss candidates, persistRepairedContradictionCandidate.
 *
 * Usage:
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   node docs/agent-runs/receipts/CONTRADICTION-DUAL-SOURCE-PRESENTATION-001/readonly-account-gate.mjs --label dual-source-presentation-before
 *   node docs/agent-runs/receipts/CONTRADICTION-DUAL-SOURCE-PRESENTATION-001/readonly-account-gate.mjs --label dual-source-presentation-after
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const OUT_DIR = dirname(fileURLToPath(import.meta.url));

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

async function main() {
  const queriedAt = new Date().toISOString();

  const [evidenceSpans, cnStatusGroups, allContradictionNodes, duplicateGroups] =
    await Promise.all([
      db.evidenceSpan.count({ where: { userId: KAY } }),
      db.contradictionNode.groupBy({
        by: ["status"],
        where: { userId: KAY },
        _count: { _all: true },
      }),
      db.contradictionNode.findMany({
        where: { userId: KAY },
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
    contradictionNodeIdsAndSpanFks: allContradictionNodes,
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
    slice: "CONTRADICTION-DUAL-SOURCE-PRESENTATION-001",
    campaignSlice: "CEQR-008/CEQR-009",
    phase: "contradiction_dual_source_presentation_001",
    label,
    userId: KAY,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    decisionPostCalled: false,
    writerInvokedAgainstAccount: false,
    confirmDismissCalled: false,
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
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
