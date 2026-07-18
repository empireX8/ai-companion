/**
 * READ-ONLY materialisation audit counts for Kay's account.
 * Does not mutate any data. Does not dump message content.
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

function groupCount(rows, keyFn) {
  const m = {};
  for (const r of rows) {
    const k = keyFn(r);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

async function main() {
  const out = {
    userId: KAY,
    queriedAt: new Date().toISOString(),
    note: "Read-only. DATABASE_URL host is local postgres; this is Kay's persisted account used across prior production-path campaigns.",
  };

  // Upload sessions
  const uploads = await db.importUploadSession.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      status: true,
      filename: true,
      contentType: true,
      bytesTotal: true,
      chunkSize: true,
      totalChunks: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      finishedAt: true,
      sessionsCreated: true,
      messagesCreated: true,
      contradictionsCreated: true,
      processedConversations: true,
      processedMessages: true,
      processingProgress: true,
      error: true,
      resultErrors: true,
    },
  });
  const chunkCounts = {};
  for (const u of uploads) {
    chunkCounts[u.id] = await db.importUploadChunk.count({ where: { sessionId: u.id } });
  }
  out.importUploadSessions = uploads.map((u) => {
    const rawErrors = Array.isArray(u.resultErrors) ? u.resultErrors : [];
    const resultErrorsSample = rawErrors.slice(0, 8).map((s) => {
      if (typeof s === "string" && s.startsWith("__IMPORT_DIAGNOSTICS_V1__:")) {
        try {
          const diag = JSON.parse(s.slice("__IMPORT_DIAGNOSTICS_V1__:".length));
          const keep = {};
          for (const [k, v] of Object.entries(diag)) {
            if (/sample/i.test(k) || k === "rejectionSamplesByReason" || k === "samples") {
              keep[k] = "<redacted_private_samples>";
            } else if (v && typeof v === "object" && !Array.isArray(v)) {
              const nested = {};
              for (const [sk, sv] of Object.entries(v)) {
                nested[sk] = /sample/i.test(sk) ? "<redacted>" : sv;
              }
              keep[k] = nested;
            } else {
              keep[k] = v;
            }
          }
          return "__IMPORT_DIAGNOSTICS_V1__:" + JSON.stringify(keep);
        } catch {
          return "__IMPORT_DIAGNOSTICS_V1__:<parse_failed>";
        }
      }
      return s;
    });
    return {
      id: u.id,
      status: u.status,
      filename: u.filename,
      contentType: u.contentType,
      bytesTotal: u.bytesTotal?.toString?.() ?? u.bytesTotal,
      totalChunks: u.totalChunks,
      chunksPersisted: chunkCounts[u.id],
      createdAt: u.createdAt,
      startedAt: u.startedAt,
      finishedAt: u.finishedAt,
      sessionsCreated: u.sessionsCreated,
      messagesCreated: u.messagesCreated,
      contradictionsCreated: u.contradictionsCreated,
      processedConversations: u.processedConversations,
      processedMessages: u.processedMessages,
      processingProgress: u.processingProgress,
      error: u.error,
      resultErrorCount: rawErrors.length,
      resultErrorsSample,
    };
  });

  // Sessions
  const sessionAgg = await db.session.groupBy({
    by: ["origin"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.sessionsByOrigin = Object.fromEntries(sessionAgg.map((r) => [r.origin, r._count._all]));

  const importedSourceAgg = await db.session.groupBy({
    by: ["importedSource"],
    where: { userId: KAY, origin: "IMPORTED_ARCHIVE" },
    _count: { _all: true },
  });
  out.importedSessionsBySource = Object.fromEntries(
    importedSourceAgg.map((r) => [String(r.importedSource), r._count._all]),
  );

  out.importedProvenance = {
    withExternalId: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE", importedExternalId: { not: null } },
    }),
    withImportedAt: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE", importedAt: { not: null } },
    }),
    withImportedSource: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE", importedSource: { not: null } },
    }),
  };

  out.importedTimeRange = await db.session.aggregate({
    where: { userId: KAY, origin: "IMPORTED_ARCHIVE" },
    _min: { importedAt: true, createdAt: true, startedAt: true },
    _max: { importedAt: true, createdAt: true, startedAt: true },
  });

  out.appSessions = await db.session.findMany({
    where: { userId: KAY, origin: "APP" },
    select: {
      id: true,
      label: true,
      surfaceType: true,
      createdAt: true,
      startedAt: true,
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  out.messages = {
    imported: await db.message.count({
      where: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } },
    }),
    app: await db.message.count({ where: { userId: KAY, session: { origin: "APP" } } }),
    total: await db.message.count({ where: { userId: KAY } }),
  };

  // Derivation
  const derRuns = await db.derivationRun.groupBy({
    by: ["scope", "status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.derivationRunsByScopeStatus = derRuns;
  out.derivationRunsImportScope = await db.derivationRun.count({
    where: { userId: KAY, scope: "import" },
  });
  out.derivationRunsImportCompleted = await db.derivationRun.count({
    where: { userId: KAY, scope: "import", status: "completed" },
  });
  out.derivationRunsImportFailed = await db.derivationRun.count({
    where: { userId: KAY, scope: "import", status: "failed" },
  });
  out.derivationRunsImportCreated = await db.derivationRun.count({
    where: { userId: KAY, scope: "import", status: "created" },
  });
  out.derivationRunsImportRunning = await db.derivationRun.count({
    where: { userId: KAY, scope: "import", status: "running" },
  });
  out.derivationProcessorVersions = await db.derivationRun.groupBy({
    by: ["processorVersion"],
    where: { userId: KAY, scope: "import" },
    _count: { _all: true },
  });
  out.derivationRunSample = await db.derivationRun.findMany({
    where: { userId: KAY, scope: "import" },
    take: 5,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      scope: true,
      status: true,
      processorVersion: true,
      createdAt: true,
      messageCount: true,
      sessionCount: true,
      inputMessageSetHash: true,
    },
  });

  out.derivationArtifacts = await db.derivationArtifact.groupBy({
    by: ["type"],
    where: { userId: KAY },
    _count: { _all: true },
  });

  // Evidence / refs / contradictions
  out.evidenceSpansOnImportedMessages = await db.evidenceSpan.count({
    where: { message: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } } },
  });
  out.evidenceSpansOnAppMessages = await db.evidenceSpan.count({
    where: { message: { userId: KAY, session: { origin: "APP" } } },
  });

  const refByStatus = await db.referenceItem.groupBy({
    by: ["status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  const refByType = await db.referenceItem.groupBy({
    by: ["type"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.referenceItems = {
    total: await db.referenceItem.count({ where: { userId: KAY } }),
    fromImportedSession: await db.referenceItem.count({
      where: { userId: KAY, sourceSession: { origin: "IMPORTED_ARCHIVE" } },
    }),
    fromAppSession: await db.referenceItem.count({
      where: { userId: KAY, sourceSession: { origin: "APP" } },
    }),
    byStatus: Object.fromEntries(refByStatus.map((r) => [r.status, r._count._all])),
    byType: Object.fromEntries(refByType.map((r) => [r.type, r._count._all])),
  };

  const contraByStatus = await db.contradictionNode.groupBy({
    by: ["status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.contradictionNodes = {
    total: await db.contradictionNode.count({ where: { userId: KAY } }),
    onImportedSessions: await db.contradictionNode.count({
      where: { userId: KAY, sourceSession: { origin: "IMPORTED_ARCHIVE" } },
    }),
    onAppSessions: await db.contradictionNode.count({
      where: { userId: KAY, sourceSession: { origin: "APP" } },
    }),
    byStatus: Object.fromEntries(contraByStatus.map((r) => [r.status, r._count._all])),
  };

  // Patterns
  const patterns = await db.patternClaim.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      status: true,
      patternType: true,
      strengthLevel: true,
      createdAt: true,
      sourceRunId: true,
      summary: true,
    },
  });
  out.patternClaims = {
    total: patterns.length,
    byStatus: groupCount(patterns, (r) => r.status),
    byType: groupCount(patterns, (r) => r.patternType),
    // do not dump summaries in aggregate file beyond counts — keep short samples separately
  };
  out.patternClaimEvidence = {
    total: await db.patternClaimEvidence.count({
      where: { claim: { userId: KAY } },
    }),
    withSessionId: await db.patternClaimEvidence.count({
      where: { claim: { userId: KAY }, sessionId: { not: null } },
    }),
    citingImportedSession: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c
         FROM "PatternClaimEvidence" e
         JOIN "PatternClaim" c ON c.id = e."claimId"
         JOIN "Session" s ON s.id = e."sessionId"
         WHERE c."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    citingAppSession: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c
         FROM "PatternClaimEvidence" e
         JOIN "PatternClaim" c ON c.id = e."claimId"
         JOIN "Session" s ON s.id = e."sessionId"
         WHERE c."userId" = $1 AND s.origin = 'APP'`,
        KAY,
      )
    )[0].c,
  };

  // Understanding objects
  const um = await db.userMapConclusion.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      candidateLifecycleStatus: true,
      status: true,
      area: true,
      createdAt: true,
      title: true,
    },
  });
  out.userMapConclusions = {
    total: um.length,
    byVisibility: groupCount(um, (r) => r.visibility),
    byLifecycle: groupCount(um, (r) => r.candidateLifecycleStatus ?? "null"),
    byStatus: groupCount(um, (r) => r.status),
    byArea: groupCount(um, (r) => r.area),
    seedPrefixed: um.filter((r) => r.id.startsWith(SEED_PREFIX)).length,
    nonSeed: um.filter((r) => !r.id.startsWith(SEED_PREFIX)).length,
    nonSeedSample: um
      .filter((r) => !r.id.startsWith(SEED_PREFIX))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        visibility: r.visibility,
        lifecycle: r.candidateLifecycleStatus,
        area: r.area,
        title: r.title?.slice(0, 80),
        createdAt: r.createdAt,
      })),
  };

  const inv = await db.investigation.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      candidateLifecycleStatus: true,
      createdAt: true,
      title: true,
    },
  });
  out.investigations = {
    total: inv.length,
    byVisibility: groupCount(inv, (r) => r.visibility),
    byLifecycle: groupCount(inv, (r) => r.candidateLifecycleStatus ?? "null"),
    seedPrefixed: inv.filter((r) => r.id.startsWith(SEED_PREFIX)).length,
    nonSeed: inv.filter((r) => !r.id.startsWith(SEED_PREFIX)).length,
    nonSeedSample: inv
      .filter((r) => !r.id.startsWith(SEED_PREFIX))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        visibility: r.visibility,
        lifecycle: r.candidateLifecycleStatus,
        title: r.title?.slice(0, 80),
        createdAt: r.createdAt,
      })),
  };

  const fw = await db.fieldworkAssignment.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      candidateLifecycleStatus: true,
      createdAt: true,
      prompt: true,
      status: true,
    },
  });
  out.fieldwork = {
    total: fw.length,
    byVisibility: groupCount(fw, (r) => r.visibility),
    byLifecycle: groupCount(fw, (r) => r.candidateLifecycleStatus ?? "null"),
    byStatus: groupCount(fw, (r) => r.status),
    seedPrefixed: fw.filter((r) => r.id.startsWith(SEED_PREFIX)).length,
    nonSeed: fw.filter((r) => !r.id.startsWith(SEED_PREFIX)).length,
    nonSeedSample: fw
      .filter((r) => !r.id.startsWith(SEED_PREFIX))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        visibility: r.visibility,
        lifecycle: r.candidateLifecycleStatus,
        status: r.status,
        prompt: r.prompt?.slice(0, 80),
        createdAt: r.createdAt,
      })),
  };

  const mu = await db.modelUpdate.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      createdAt: true,
      updateType: true,
      userFacingSummary: true,
      isMeaningful: true,
      affectedObjectType: true,
      affectedObjectId: true,
      sourceRunId: true,
    },
  });
  out.modelUpdates = {
    total: mu.length,
    byVisibility: groupCount(mu, (r) => r.visibility),
    byType: groupCount(mu, (r) => r.updateType),
    seedPrefixed: mu.filter((r) => r.id.startsWith(SEED_PREFIX)).length,
    seedAffectedObject: mu.filter((r) =>
      String(r.affectedObjectId || "").startsWith(SEED_PREFIX),
    ).length,
    nonSeed: mu.filter((r) => !r.id.startsWith(SEED_PREFIX)).length,
    sample: mu.slice(0, 15).map((r) => ({
      id: r.id,
      visibility: r.visibility,
      updateType: r.updateType,
      summary: r.userFacingSummary?.slice(0, 80),
      affectedObjectType: r.affectedObjectType,
      affectedObjectId: r.affectedObjectId,
      isMeaningful: r.isMeaningful,
      sourceRunId: r.sourceRunId,
      createdAt: r.createdAt,
    })),
  };

  out.surfacedActions = {
    total: await db.surfacedAction.count({ where: { userId: KAY } }),
    byBucket: await db.surfacedAction.groupBy({
      by: ["bucket"],
      where: { userId: KAY },
      _count: { _all: true },
    }),
  };

  out.understandingEvidenceLinks = {
    total: await db.understandingEvidenceLink.count({ where: { userId: KAY } }),
    bySourceType: await db.understandingEvidenceLink.groupBy({
      by: ["sourceType"],
      where: { userId: KAY },
      _count: { _all: true },
    }),
    byTargetType: await db.understandingEvidenceLink.groupBy({
      by: ["targetType"],
      where: { userId: KAY },
      _count: { _all: true },
    }),
  };

  out.journalEntries = await db.journalEntry.count({ where: { userId: KAY } });

  // Session coverage
  out.importedSessionsWith = {
    evidenceSpans: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT m."sessionId")::int AS c
         FROM "EvidenceSpan" e
         JOIN "Message" m ON m.id = e."messageId"
         JOIN "Session" s ON s.id = m."sessionId"
         WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    referenceItems: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ri."sourceSessionId")::int AS c
         FROM "ReferenceItem" ri
         JOIN "Session" s ON s.id = ri."sourceSessionId"
         WHERE ri."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    contradictionNodes: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT cn."sourceSessionId")::int AS c
         FROM "ContradictionNode" cn
         JOIN "Session" s ON s.id = cn."sourceSessionId"
         WHERE cn."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    patternClaimEvidence: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT e."sessionId")::int AS c
         FROM "PatternClaimEvidence" e
         JOIN "Session" s ON s.id = e."sessionId"
         WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
  };

  out.importedSessionsUnprocessedApprox = (
    await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c
       FROM "Session" s
       WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'
         AND NOT EXISTS (
           SELECT 1 FROM "Message" m
           JOIN "EvidenceSpan" e ON e."messageId" = m.id
           WHERE m."sessionId" = s.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM "ReferenceItem" ri WHERE ri."sourceSessionId" = s.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM "ContradictionNode" cn WHERE cn."sourceSessionId" = s.id
         )`,
      KAY,
    )
  )[0].c;

  // Canonical seed tables (may exist even if client behind)
  try {
    out.canonicalTodayComposition = await db.$queryRawUnsafe(
      `SELECT id, source, version, "createdAt", "updatedAt",
              CASE WHEN payload::text LIKE '%' || $2 || '%' THEN true ELSE false END AS mentions_seed_prefix
       FROM "CanonicalTodayComposition"
       WHERE "userId" = $1`,
      KAY,
      SEED_PREFIX,
    );
  } catch (e) {
    out.canonicalTodayComposition = { error: String(e.message || e) };
  }
  try {
    out.canonicalModelMovementReports = await db.$queryRawUnsafe(
      `SELECT id, "createdAt", "updatedAt"
       FROM "CanonicalModelMovementReport"
       WHERE "userId" = $1`,
      KAY,
    );
  } catch (e) {
    out.canonicalModelMovementReports = { error: String(e.message || e) };
  }

  // UEL linking to import_record or imported messages
  try {
    out.uelImportRecord = (
      await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "UnderstandingEvidenceLink"
         WHERE "userId" = $1 AND "sourceType"::text = 'import_record'`,
        KAY,
      )
    )[0].c;
  } catch (e) {
    out.uelImportRecord = { error: String(e.message || e) };
  }

  // Pattern claim actions / outcomes
  out.patternClaimActions = await db.patternClaimAction.groupBy({
    by: ["status"],
    where: { userId: KAY },
    _count: { _all: true },
  });

  const path = join(OUT_DIR, "audit-readonly-counts.json");
  writeFileSync(path, serialize(out));
  console.log("Wrote", path);
  console.log(
    serialize({
      importedSessions: out.sessionsByOrigin,
      messages: out.messages,
      uploads: out.importUploadSessions.length,
      derivationImport: out.derivationRunsImportScope,
      refs: out.referenceItems.total,
      contradictions: out.contradictionNodes.total,
      patterns: out.patternClaims.total,
      umNonSeed: out.userMapConclusions.nonSeed,
      umSeed: out.userMapConclusions.seedPrefixed,
      unprocessed: out.importedSessionsUnprocessedApprox,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
