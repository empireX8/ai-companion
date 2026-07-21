/**
 * READ-ONLY account gate for CONTRADICTION-DUPLICATE-PREVENTION-001 (CEQR-007).
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, decide API.
 *
 * Usage:
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   node docs/agent-runs/receipts/CONTRADICTION-DUPLICATE-PREVENTION-001/readonly-account-gate.mjs --label contradiction-duplicate-prevention-before
 *   node docs/agent-runs/receipts/CONTRADICTION-DUPLICATE-PREVENTION-001/readonly-account-gate.mjs --label contradiction-duplicate-prevention-after
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const SELECTED_RI_ID = "3a6163dd-0f85-4bf5-8eb8-924579f1db62";
const CHICKEN_STATEMENT = "chicken burgers";
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

  const [
    refPendingImport,
    contraPendingImport,
    openGenuineImport,
    chickenActive,
    selectedRi,
    patternClaims,
    modelUpdates,
    uels,
    evidenceSpans,
    cnStatusGroups,
    allContradictionNodes,
    duplicateGroups,
  ] = await Promise.all([
    db.referenceItem.count({
      where: {
        userId: KAY,
        status: "candidate",
        sourceSession: { origin: "IMPORTED_ARCHIVE" },
      },
    }),
    db.contradictionNode.count({
      where: {
        userId: KAY,
        status: "candidate",
        sourceSession: { origin: "IMPORTED_ARCHIVE" },
      },
    }),
    db.contradictionNode.count({
      where: {
        userId: KAY,
        status: "open",
        sourceSession: { origin: "IMPORTED_ARCHIVE" },
      },
    }),
    db.referenceItem.count({
      where: {
        userId: KAY,
        status: "active",
        statement: { contains: CHICKEN_STATEMENT },
      },
    }),
    db.referenceItem.findUnique({
      where: { id: SELECTED_RI_ID },
      select: {
        id: true,
        type: true,
        status: true,
        confidence: true,
        statement: true,
        updatedAt: true,
      },
    }),
    db.patternClaim.count({ where: { userId: KAY } }),
    db.modelUpdate.count({ where: { userId: KAY } }),
    db.understandingEvidenceLink.count({ where: { userId: KAY } }),
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

  const pendingTotal = refPendingImport + contraPendingImport;
  const cnByStatus = Object.fromEntries(
    cnStatusGroups.map((r) => [r.status, r._count._all]),
  );
  const completePairDuplicateGroups = Number(duplicateGroups.length);

  // Pre-slice baseline captured 2026-07-21 from Kay account (read-only).
  const expected = {
    pendingTotal: 53,
    referenceItemPendingImport: 28,
    contradictionNodePendingImport: 25,
    contradictionNodeTotal: 25,
    openGenuineContradictionNodes: 0,
    chickenBurgerActiveCount: 1,
    selectedReferenceItemStatus: "active",
    patternClaims: 7,
    modelUpdates: 1,
    understandingEvidenceLinks: 50,
    evidenceSpans: 5941,
    completeExactDualSideRows: 0,
    invalidPartialRows: 0,
    legacyIncompleteRows: 25,
    completePairDuplicateGroups: 0,
  };

  const observed = {
    pendingTotal,
    referenceItemPendingImport: refPendingImport,
    contradictionNodePendingImport: contraPendingImport,
    contradictionNodeTotal: allContradictionNodes.length,
    openGenuineContradictionNodes: openGenuineImport,
    chickenBurgerActiveCount: chickenActive,
    selectedReferenceItem: selectedRi,
    patternClaims,
    modelUpdates,
    understandingEvidenceLinks: uels,
    evidenceSpans,
    contradictionNodesByStatus: cnByStatus,
    lineageCounts,
    completePairDuplicateGroups,
    contradictionNodeIdsAndSpanFks: allContradictionNodes,
  };

  const matchesExpected =
    pendingTotal === expected.pendingTotal &&
    refPendingImport === expected.referenceItemPendingImport &&
    contraPendingImport === expected.contradictionNodePendingImport &&
    allContradictionNodes.length === expected.contradictionNodeTotal &&
    openGenuineImport === expected.openGenuineContradictionNodes &&
    chickenActive === expected.chickenBurgerActiveCount &&
    selectedRi?.status === expected.selectedReferenceItemStatus &&
    patternClaims === expected.patternClaims &&
    modelUpdates === expected.modelUpdates &&
    uels === expected.understandingEvidenceLinks &&
    evidenceSpans === expected.evidenceSpans &&
    lineageCounts.complete_exact_dual_side ===
      expected.completeExactDualSideRows &&
    lineageCounts.invalid_partial === expected.invalidPartialRows &&
    lineageCounts.legacy_incomplete === expected.legacyIncompleteRows &&
    completePairDuplicateGroups === expected.completePairDuplicateGroups;

  const out = {
    campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001",
    slice: "CONTRADICTION-DUPLICATE-PREVENTION-001",
    campaignSlice: "CEQR-007",
    phase: "contradiction_duplicate_prevention_001",
    label,
    userId: KAY,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    decisionPostCalled: false,
    writerInvokedAgainstAccount: false,
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
        pendingTotal: observed.pendingTotal,
        referenceItemPendingImport: observed.referenceItemPendingImport,
        contradictionNodePendingImport: observed.contradictionNodePendingImport,
        contradictionNodeTotal: observed.contradictionNodeTotal,
        openGenuineContradictionNodes: observed.openGenuineContradictionNodes,
        chickenBurgerActiveCount: observed.chickenBurgerActiveCount,
        selectedReferenceItemStatus: selectedRi?.status,
        patternClaims: observed.patternClaims,
        modelUpdates: observed.modelUpdates,
        understandingEvidenceLinks: observed.understandingEvidenceLinks,
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
