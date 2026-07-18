/**
 * READ-ONLY: full-reference seed inventory + UM UEL provenance.
 * Does not mutate data. Does not execute cleanup.
 * Run from a directory with @prisma/client installed; DATABASE_URL required.
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
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

async function main() {
  const cols = await db.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'CanonicalTodayComposition' ORDER BY ordinal_position`,
  );

  const composition = await db.$queryRawUnsafe(
    `SELECT id, source, "createdAt", "updatedAt",
      jsonb_array_length(COALESCE(payload->'objects','[]'::jsonb)) AS object_count,
      payload->'workbench'->'importReview' IS NOT NULL AS has_import_review,
      jsonb_array_length(COALESCE(payload->'workbench'->'importReview'->'candidates','[]'::jsonb)) AS import_review_candidates,
      payload->'workbench'->'importReview'->>'sourceObjectId' AS import_review_source_object_id
     FROM "CanonicalTodayComposition" WHERE "userId"=$1`,
    KAY,
  );

  const importReviewSample = await db.$queryRawUnsafe(
    `SELECT c->>'id' AS id, left(COALESCE(c->>'title', c->>'proposed', ''), 100) AS title
     FROM "CanonicalTodayComposition" t,
     LATERAL jsonb_array_elements(COALESCE(t.payload->'workbench'->'importReview'->'candidates','[]'::jsonb)) c
     WHERE t."userId"=$1`,
    KAY,
  );

  const umId = "cmq6frqdx0000ql8h6nkavzue";
  const uels = await db.understandingEvidenceLink.findMany({
    where: { userId: KAY, targetId: umId },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      targetType: true,
      role: true,
      createdAt: true,
    },
  });
  const sourceTypeCounts = {};
  for (const u of uels) sourceTypeCounts[u.sourceType] = (sourceTypeCounts[u.sourceType] || 0) + 1;

  const importRecordIds = uels.filter((u) => u.sourceType === "import_record").map((u) => u.sourceId);
  const uploadSessions = await db.importUploadSession.findMany({
    where: { id: { in: importRecordIds } },
    select: { id: true, filename: true, status: true },
  });
  const sessionsAsImportRecord = await db.session.findMany({
    where: { id: { in: importRecordIds } },
    select: { id: true, origin: true, label: true, importedExternalId: true },
  });

  const patterns = await db.patternClaim.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      patternType: true,
      status: true,
      strengthLevel: true,
      summary: true,
      createdAt: true,
      sourceRunId: true,
    },
  });

  const darkDiag = await db.derivationArtifact.findMany({
    where: { userId: KAY, type: "understanding_dark_engine_diagnostics" },
    select: { id: true, createdAt: true, payload: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const seedCleanupVerifyBefore = {
    compositions: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "CanonicalTodayComposition" WHERE "userId"=$1`,
        KAY,
      )
    )[0].c,
    reportsPrefixed: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "CanonicalModelMovementReport" WHERE "userId"=$1 AND id LIKE $2 || '%'`,
        KAY,
        SEED_PREFIX,
      )
    )[0].c,
    importedSessions: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE" },
    }),
    importedMessages: await db.message.count({
      where: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } },
    }),
    referenceItems: await db.referenceItem.count({ where: { userId: KAY } }),
    contradictionNodes: await db.contradictionNode.count({ where: { userId: KAY } }),
    patternClaims: await db.patternClaim.count({ where: { userId: KAY } }),
    userMap: await db.userMapConclusion.count({ where: { userId: KAY } }),
    modelUpdates: await db.modelUpdate.count({ where: { userId: KAY } }),
    evidenceSpansImported: await db.evidenceSpan.count({
      where: { message: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } } },
    }),
  };

  const internalCandidates = {
    userMap: await db.userMapConclusion.count({
      where: { userId: KAY, visibility: "internal_only" },
    }),
    investigation: await db.investigation.count({
      where: { userId: KAY, visibility: "internal_only" },
    }),
    fieldwork: await db.fieldworkAssignment.count({
      where: { userId: KAY, visibility: "internal_only" },
    }),
    modelUpdate: await db.modelUpdate.count({
      where: { userId: KAY, visibility: "internal_only" },
    }),
  };

  const refIds = (
    await db.referenceItem.findMany({ where: { userId: KAY }, select: { id: true } })
  ).map((r) => r.id);
  let refsInComposition = 0;
  if (refIds.length) {
    const hit = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c
       FROM "CanonicalTodayComposition" t,
       LATERAL jsonb_array_elements(COALESCE(t.payload->'objects','[]'::jsonb)) o
       WHERE t."userId"=$1 AND o->>'id' = ANY($2::text[])`,
      KAY,
      refIds,
    );
    refsInComposition = hit[0].c;
  }

  const out = {
    queriedAt: new Date().toISOString(),
    note: "READ-ONLY. cleanupFullReferenceRoundTrip NOT invoked. Seven PatternClaims + one UM/MU are partial side-effects, not complete automatic materialisation.",
    compositionTableColumns: cols,
    composition,
    importReviewSample,
    userMapUels: uels,
    sourceTypeCounts,
    importRecordResolution: { uploadSessions, sessionsAsImportRecord, importRecordIds },
    patterns: patterns.map((p) => ({ ...p, summary: (p.summary || "").slice(0, 120) })),
    darkEngineDiagnosticsSample: darkDiag.map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      payloadPreview: JSON.stringify(d.payload)?.slice(0, 800),
    })),
    internalCandidates,
    seedCleanupVerifyBefore,
    refsInComposition,
  };

  const path = join(OUT_DIR, "audit-readonly-seed-and-uel.json");
  writeFileSync(path, serialize(out));
  console.log("Wrote", path);
  console.log(
    serialize({
      composition,
      importReviewSampleIds: importReviewSample.map((c) => c.id),
      patternCount: patterns.length,
      internalCandidates,
      seedCleanupVerifyBefore,
      refsInComposition,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
