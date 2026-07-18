/**
 * READ-ONLY human gate for Kay's account.
 * Proves the production query returns genuine pending import candidates.
 * Does NOT accept/reject any candidate. Does NOT mutate any row.
 *
 * Usage (from worktree, with Kay DB URL):
 *   set -a && source /path/to/.env && set +a
 *   node docs/agent-runs/receipts/DB-BACKED-IMPORT-CANDIDATE-MATERIALISATION-001/readonly-kay-import-review-gate.mjs
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const SEED_PREFIX = "dev-exact-rt-";
const OUT_DIR = dirname(fileURLToPath(import.meta.url));

function serialize(obj) {
  return JSON.stringify(
    obj,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

async function main() {
  const out = {
    userId: KAY,
    queriedAt: new Date().toISOString(),
    mode: "read_only",
    mutationsPerformed: false,
    note: "Human gate only. No accept/reject. No writes.",
  };

  const [refCount, contraCount, refs, contras, patternClaims, composition] =
    await Promise.all([
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
      db.referenceItem.findMany({
        where: {
          userId: KAY,
          status: "candidate",
          sourceSession: { origin: "IMPORTED_ARCHIVE" },
        },
        select: {
          id: true,
          type: true,
          status: true,
          confidence: true,
          sourceSessionId: true,
          sourceMessageId: true,
          createdAt: true,
          statement: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 100,
      }),
      db.contradictionNode.findMany({
        where: {
          userId: KAY,
          status: "candidate",
          sourceSession: { origin: "IMPORTED_ARCHIVE" },
        },
        select: {
          id: true,
          type: true,
          status: true,
          confidence: true,
          title: true,
          sourceSessionId: true,
          sourceMessageId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 100,
      }),
      db.patternClaim.count({ where: { userId: KAY } }),
      db.canonicalTodayComposition.findUnique({
        where: { userId: KAY },
        select: { id: true, source: true, payload: true },
      }),
    ]);

  const totalPendingCount = refCount + contraCount;

  const seedImportReview =
    composition?.payload &&
    typeof composition.payload === "object" &&
    composition.payload.workbench?.importReview
      ? composition.payload.workbench.importReview
      : null;

  const seedCandidateIds = Array.isArray(seedImportReview?.candidates)
    ? seedImportReview.candidates.map((c) => c.id)
    : [];

  const productionCandidates = [
    ...refs.map((r) => ({
      reviewKey: `reference_item:${r.id}`,
      sourceTable: "ReferenceItem",
      id: r.id,
      type: r.type,
      status: r.status,
      confidence: r.confidence,
      provenance: "import_derived_session",
      sourceSessionId: r.sourceSessionId,
      sourceMessageId: r.sourceMessageId,
      createdAt: r.createdAt,
      titlePreview: String(r.statement ?? "").slice(0, 80),
    })),
    ...contras.map((c) => ({
      reviewKey: `contradiction_node:${c.id}`,
      sourceTable: "ContradictionNode",
      id: c.id,
      type: c.type,
      status: c.status,
      confidence: c.confidence,
      provenance: "import_derived_session",
      sourceSessionId: c.sourceSessionId,
      sourceMessageId: c.sourceMessageId,
      createdAt: c.createdAt,
      titlePreview: String(c.title ?? "").slice(0, 80),
    })),
  ].sort((a, b) => {
    const t = new Date(a.createdAt) - new Date(b.createdAt);
    if (t !== 0) return t;
    return String(a.reviewKey).localeCompare(String(b.reviewKey));
  });

  const seedLeakIntoProductionKeys = productionCandidates.filter((c) =>
    String(c.id).includes(SEED_PREFIX),
  );

  out.productionQuery = {
    sourceTables: ["ReferenceItem", "ContradictionNode"],
    referenceItemPending: refCount,
    contradictionNodePending: contraCount,
    totalPendingCount,
    pageSizeUsed: 100,
    returnedCount: productionCandidates.length,
    candidatesSample: productionCandidates.slice(0, 8),
  };

  out.seedCompositionStillPresent = {
    compositionId: composition?.id ?? null,
    compositionSource: composition?.source ?? null,
    seedImportReviewCandidateCount: seedCandidateIds.length,
    seedImportReviewCandidateIds: seedCandidateIds,
    note: "Seed may still exist in composition JSON; production Import path must not use these ids.",
  };

  out.integrity = {
    patternClaimCountUnchangedExpectation: 7,
    patternClaimCountObserved: patternClaims,
    seedIdsAbsentFromProductionQuery: seedLeakIntoProductionKeys.length === 0,
    allProductionCandidatesHaveImportProvenance: productionCandidates.every(
      (c) => c.provenance === "import_derived_session" && c.sourceSessionId,
    ),
    noMutations: true,
  };

  out.verdict =
    totalPendingCount > 0 &&
    seedLeakIntoProductionKeys.length === 0 &&
    productionCandidates.every((c) => !String(c.id).includes(SEED_PREFIX))
      ? "REAL_IMPORT_CANDIDATES_VISIBLE"
      : "FAIL_NO_REAL_CANDIDATES_OR_SEED_LEAK";

  const outPath = join(OUT_DIR, "readonly-kay-import-review-gate.json");
  writeFileSync(outPath, serialize(out));
  console.log(serialize(out));
  console.log(`\nWrote ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
