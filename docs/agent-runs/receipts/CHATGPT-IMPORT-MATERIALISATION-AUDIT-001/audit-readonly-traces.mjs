/**
 * READ-ONLY: representative conversation traces + coverage.
 * Does not mutate data. Does not dump full message bodies.
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

function short(s, n = 60) {
  return (s || "").replace(/\s+/g, " ").slice(0, n);
}

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

async function main() {
  const upload = await db.importUploadSession.findFirst({ where: { userId: KAY } });

  const richSpan = await db.$queryRawUnsafe(
    `SELECT s.id, s.label, s."importedExternalId", s."importedSource", s."importedAt", s."createdAt",
            COUNT(e.id)::int AS span_count, COUNT(DISTINCT m.id)::int AS msg_count
     FROM "Session" s
     JOIN "Message" m ON m."sessionId" = s.id
     LEFT JOIN "EvidenceSpan" e ON e."messageId" = m.id
     WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
     GROUP BY s.id
     ORDER BY span_count DESC
     LIMIT 3`,
    KAY,
  );

  const withRef = await db.$queryRawUnsafe(
    `SELECT s.id, s.label, s."importedExternalId", s."importedSource", s."importedAt",
            COUNT(ri.id)::int AS ref_count
     FROM "Session" s
     JOIN "ReferenceItem" ri ON ri."sourceSessionId" = s.id
     WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
     GROUP BY s.id
     ORDER BY ref_count DESC
     LIMIT 3`,
    KAY,
  );

  const withContra = await db.$queryRawUnsafe(
    `SELECT s.id, s.label, s."importedExternalId", COUNT(cn.id)::int AS contra_count
     FROM "Session" s
     JOIN "ContradictionNode" cn ON cn."sourceSessionId" = s.id
     WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
     GROUP BY s.id
     ORDER BY contra_count DESC
     LIMIT 3`,
    KAY,
  );

  const withPattern = await db.$queryRawUnsafe(
    `SELECT s.id, s.label, s."importedExternalId", COUNT(e.id)::int AS pattern_ev_count
     FROM "Session" s
     JOIN "PatternClaimEvidence" e ON e."sessionId" = s.id
     WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
     GROUP BY s.id
     ORDER BY pattern_ev_count DESC
     LIMIT 3`,
    KAY,
  );

  const unprocessed = await db.$queryRawUnsafe(
    `SELECT s.id, s.label, s."importedExternalId", s."importedSource", s."importedAt", s."createdAt",
            (SELECT COUNT(*)::int FROM "Message" m WHERE m."sessionId" = s.id) AS msg_count
     FROM "Session" s
     WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
       AND NOT EXISTS (
         SELECT 1 FROM "Message" m JOIN "EvidenceSpan" e ON e."messageId" = m.id WHERE m."sessionId" = s.id
       )
       AND NOT EXISTS (SELECT 1 FROM "ReferenceItem" ri WHERE ri."sourceSessionId" = s.id)
       AND NOT EXISTS (SELECT 1 FROM "ContradictionNode" cn WHERE cn."sourceSessionId" = s.id)
     ORDER BY s."createdAt" ASC
     LIMIT 5`,
    KAY,
  );

  const chosenIds = [];
  const pick = (rows) => {
    for (const r of rows) {
      if (!chosenIds.includes(r.id)) {
        chosenIds.push(r.id);
        return r;
      }
    }
    return null;
  };

  const picks = [
    { bucket: "rich_evidence_spans", row: pick(richSpan) },
    { bucket: "has_reference_items", row: pick(withRef) },
    { bucket: "has_contradiction", row: pick(withContra) },
    { bucket: "has_pattern_evidence", row: pick(withPattern) },
    { bucket: "unprocessed_no_downstream", row: pick(unprocessed) },
  ].filter((p) => p.row);

  for (const r of [...richSpan, ...unprocessed, ...withRef]) {
    if (picks.length >= 5) break;
    if (!chosenIds.includes(r.id)) {
      chosenIds.push(r.id);
      picks.push({ bucket: "additional", row: r });
    }
  }

  const traces = [];
  for (const p of picks) {
    const s = await db.session.findUnique({
      where: { id: p.row.id },
      select: {
        id: true,
        label: true,
        origin: true,
        importedSource: true,
        importedAt: true,
        importedExternalId: true,
        createdAt: true,
        startedAt: true,
      },
    });
    const msgCount = await db.message.count({ where: { sessionId: s.id } });
    const userMsgCount = await db.message.count({ where: { sessionId: s.id, role: "user" } });
    const spans = await db.evidenceSpan.count({ where: { message: { sessionId: s.id } } });
    const refs = await db.referenceItem.findMany({
      where: { sourceSessionId: s.id },
      select: { id: true, type: true, status: true, statement: true, sourceMessageId: true, createdAt: true },
    });
    const contras = await db.contradictionNode.findMany({
      where: { sourceSessionId: s.id },
      select: { id: true, title: true, status: true, type: true, createdAt: true },
    });
    const patternEv = await db.$queryRawUnsafe(
      `SELECT e.id, e."claimId", e."messageId", e.quote, c.status AS claim_status, c."patternType", c.summary
       FROM "PatternClaimEvidence" e
       JOIN "PatternClaim" c ON c.id = e."claimId"
       WHERE e."sessionId" = $1
       LIMIT 10`,
      s.id,
    );
    const refArtifacts = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "DerivationArtifact" a
       WHERE a."userId" = $1 AND a.type = 'reference_candidate' AND a.payload::text LIKE '%' || $2 || '%'`,
      KAY,
      s.id,
    );
    const contraArtifacts = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "DerivationArtifact" a
       WHERE a."userId" = $1 AND a.type = 'contradiction_candidate' AND a.payload::text LIKE '%' || $2 || '%'`,
      KAY,
      s.id,
    );
    const uelToMessages = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "UnderstandingEvidenceLink" u
       JOIN "Message" m ON m.id = u."sourceId"
       WHERE u."userId" = $1 AND u."sourceType"::text = 'message' AND m."sessionId" = $2`,
      KAY,
      s.id,
    );
    const linkedTargets = await db.$queryRawUnsafe(
      `SELECT u."targetType"::text AS target_type, u."targetId", COUNT(*)::int AS c
       FROM "UnderstandingEvidenceLink" u
       JOIN "Message" m ON m.id = u."sourceId"
       WHERE u."userId" = $1 AND u."sourceType"::text = 'message' AND m."sessionId" = $2
       GROUP BY u."targetType", u."targetId"
       LIMIT 20`,
      KAY,
      s.id,
    );

    let breakPoint = null;
    if (msgCount === 0) breakPoint = "no_messages";
    else if (spans === 0 && refs.length === 0 && contras.length === 0) breakPoint = "no_extraction_outputs";
    else if (refs.length === 0 && contras.length === 0 && patternEv.length === 0)
      breakPoint = "spans_only_no_candidates";
    else if (linkedTargets.length === 0)
      breakPoint = "candidates_or_patterns_exist_but_no_understanding_object_links";
    else breakPoint = "lineage_reaches_understanding_links";

    traces.push({
      bucket: p.bucket,
      importUploadSessionId: upload?.id ?? null,
      importUploadStatus: upload?.status ?? null,
      conversation: { ...s, label: short(s.label, 100) },
      messages: { total: msgCount, user: userMsgCount },
      sourceUnits: {
        note: "No SourceUnit table; EvidenceSpan used as extraction unit",
        evidenceSpans: spans,
      },
      derivationArtifactsMentioningSession: {
        reference_candidate: refArtifacts[0].c,
        contradiction_candidate: contraArtifacts[0].c,
      },
      referenceItems: refs.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        statement: short(r.statement, 100),
        sourceMessageId: r.sourceMessageId,
      })),
      contradictionNodes: contras.map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        title: short(c.title, 100),
      })),
      patternEvidence: patternEv.map((e) => ({
        evidenceId: e.id,
        claimId: e.claimId,
        claimStatus: e.claim_status,
        patternType: e.patternType,
        summary: short(e.summary, 100),
        quote: short(e.quote, 80),
      })),
      understandingEvidenceLinksFromMessages: uelToMessages[0].c,
      linkedUnderstandingTargets: linkedTargets,
      firstLineageBreak: breakPoint,
    });
  }

  const coverage = {
    totalImported: await db.session.count({ where: { userId: KAY, origin: "IMPORTED_ARCHIVE" } }),
    withAnySpan: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT m."sessionId")::int AS c FROM "EvidenceSpan" e
         JOIN "Message" m ON m.id=e."messageId" JOIN "Session" s ON s.id=m."sessionId"
         WHERE s."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    withAnyRef: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ri."sourceSessionId")::int AS c FROM "ReferenceItem" ri
         JOIN "Session" s ON s.id=ri."sourceSessionId"
         WHERE ri."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    withAnyContra: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT cn."sourceSessionId")::int AS c FROM "ContradictionNode" cn
         JOIN "Session" s ON s.id=cn."sourceSessionId"
         WHERE cn."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    withAnyPatternEv: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT e."sessionId")::int AS c FROM "PatternClaimEvidence" e
         JOIN "Session" s ON s.id=e."sessionId"
         WHERE s."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    withUelFromMessage: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT m."sessionId")::int AS c
         FROM "UnderstandingEvidenceLink" u
         JOIN "Message" m ON m.id = u."sourceId"
         JOIN "Session" s ON s.id = m."sessionId"
         WHERE u."userId"=$1 AND u."sourceType"::text='message' AND s.origin='IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
  };

  const refStatusImported = await db.$queryRawUnsafe(
    `SELECT ri.status::text AS status, COUNT(*)::int AS c
     FROM "ReferenceItem" ri
     JOIN "Session" s ON s.id = ri."sourceSessionId"
     WHERE ri."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'
     GROUP BY ri.status`,
    KAY,
  );

  const umFromImport = await db.$queryRawUnsafe(
    `SELECT DISTINCT um.id, um.visibility::text AS visibility, um."candidateLifecycleStatus"::text AS lifecycle, um.title
     FROM "UserMapConclusion" um
     JOIN "UnderstandingEvidenceLink" u ON u."targetId" = um.id AND u."targetType"::text = 'user_map_conclusion'
     JOIN "Message" m ON m.id = u."sourceId" AND u."sourceType"::text = 'message'
     JOIN "Session" s ON s.id = m."sessionId"
     WHERE um."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
    KAY,
  );

  const invFromImport = await db.$queryRawUnsafe(
    `SELECT DISTINCT i.id, i.visibility::text AS visibility, i."candidateLifecycleStatus"::text AS lifecycle, i.title
     FROM "Investigation" i
     JOIN "UnderstandingEvidenceLink" u ON u."targetId" = i.id AND u."targetType"::text = 'investigation'
     JOIN "Message" m ON m.id = u."sourceId" AND u."sourceType"::text = 'message'
     JOIN "Session" s ON s.id = m."sessionId"
     WHERE i."userId"=$1 AND s.origin='IMPORTED_ARCHIVE'`,
    KAY,
  );

  let compositionImportReview = null;
  try {
    compositionImportReview = await db.$queryRawUnsafe(
      `SELECT id, source,
        payload->'workbench'->'importReview' IS NOT NULL AS has_import_review,
        jsonb_array_length(COALESCE(payload->'workbench'->'importReview'->'candidates', '[]'::jsonb)) AS candidate_count,
        payload->'workbench'->'importReview'->>'sourceObjectId' AS source_object_id
       FROM "CanonicalTodayComposition"
       WHERE "userId"=$1`,
      KAY,
    );
  } catch (e) {
    compositionImportReview = { error: e.message };
  }

  let seedObjectStats = null;
  try {
    seedObjectStats = await db.$queryRawUnsafe(
      `SELECT id, source,
        jsonb_array_length(COALESCE(payload->'objects', '[]'::jsonb)) AS object_count,
        (
          SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(payload->'objects','[]'::jsonb)) o
          WHERE o->>'id' LIKE $2 || '%'
        ) AS seed_prefixed_objects
       FROM "CanonicalTodayComposition"
       WHERE "userId"=$1`,
      KAY,
      SEED_PREFIX,
    );
  } catch (e) {
    seedObjectStats = { error: e.message };
  }

  const result = {
    queriedAt: new Date().toISOString(),
    note: "READ-ONLY. Partial PatternClaims/UM are not proof of complete automatic materialisation.",
    uploadSession: upload
      ? {
          id: upload.id,
          status: upload.status,
          filename: upload.filename,
          sessionsCreated: upload.sessionsCreated,
          messagesCreated: upload.messagesCreated,
          contradictionsCreated: upload.contradictionsCreated,
          processedConversations: upload.processedConversations,
          processingProgress: upload.processingProgress,
          resultErrorCount: upload.resultErrors?.length ?? 0,
          createdAt: upload.createdAt,
          finishedAt: upload.finishedAt,
        }
      : null,
    coverage,
    referenceItemsFromImportedByStatus: refStatusImported,
    userMapLinkedToImportedMessages: umFromImport.map((r) => ({
      ...r,
      title: short(r.title, 80),
    })),
    investigationsLinkedToImportedMessages: invFromImport.map((r) => ({
      ...r,
      title: short(r.title, 80),
    })),
    compositionImportReview,
    seedObjectStats,
    traces,
  };

  const path = join(OUT_DIR, "audit-readonly-traces.json");
  writeFileSync(path, serialize(result));
  console.log("Wrote", path);
  console.log(
    serialize({
      coverage,
      breakPoints: traces.map((t) => ({
        bucket: t.bucket,
        break: t.firstLineageBreak,
        spans: t.sourceUnits.evidenceSpans,
        refs: t.referenceItems.length,
        contras: t.contradictionNodes.length,
        patterns: t.patternEvidence.length,
      })),
      seedImportReviewCandidates: compositionImportReview?.[0]?.candidate_count ?? null,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
