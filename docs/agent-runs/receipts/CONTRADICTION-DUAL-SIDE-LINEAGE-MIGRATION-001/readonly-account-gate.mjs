/**
 * READ-ONLY account gate for CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001.
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, decide API.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node docs/agent-runs/receipts/CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001/readonly-account-gate.mjs [--label before|after]
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
const label = labelArg?.split("=")[1] ?? process.argv[process.argv.indexOf("--label") + 1] ?? "run";

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
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
    cnStatusGroups,
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
    db.contradictionNode.groupBy({
      by: ["status"],
      where: { userId: KAY },
      _count: { _all: true },
    }),
  ]);

  const pendingTotal = refPendingImport + contraPendingImport;
  const cnByStatus = Object.fromEntries(
    cnStatusGroups.map((r) => [r.status, r._count._all]),
  );

  const expected = {
    pendingTotal: 53,
    referenceItemPendingImport: 28,
    contradictionNodePendingImport: 25,
    openGenuineContradictionNodes: 0,
    chickenBurgerActiveCount: 1,
    selectedReferenceItemStatus: "active",
    patternClaims: 7,
    modelUpdates: 1,
    understandingEvidenceLinks: 50,
  };

  const observed = {
    pendingTotal,
    referenceItemPendingImport: refPendingImport,
    contradictionNodePendingImport: contraPendingImport,
    openGenuineContradictionNodes: openGenuineImport,
    chickenBurgerActiveCount: chickenActive,
    selectedReferenceItem: selectedRi,
    patternClaims,
    modelUpdates,
    understandingEvidenceLinks: uels,
    contradictionNodesByStatus: cnByStatus,
  };

  const matchesExpected =
    pendingTotal === expected.pendingTotal &&
    refPendingImport === expected.referenceItemPendingImport &&
    contraPendingImport === expected.contradictionNodePendingImport &&
    openGenuineImport === expected.openGenuineContradictionNodes &&
    chickenActive === expected.chickenBurgerActiveCount &&
    selectedRi?.status === expected.selectedReferenceItemStatus &&
    patternClaims === expected.patternClaims &&
    modelUpdates === expected.modelUpdates &&
    uels === expected.understandingEvidenceLinks;

  const out = {
    campaign: "CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001",
    slice: "CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001",
    phase: "ceqr_005_dual_side_lineage",
    label,
    userId: KAY,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    decisionPostCalled: false,
    expected,
    observed,
    matchesExpected,
  };

  const jsonPath = join(OUT_DIR, `account-gate-${label}.json`);
  writeFileSync(jsonPath, serialize(out));
  console.log("Wrote", jsonPath);
  console.log(serialize({ label, matchesExpected, observed: { ...observed, selectedReferenceItem: selectedRi?.status } }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
