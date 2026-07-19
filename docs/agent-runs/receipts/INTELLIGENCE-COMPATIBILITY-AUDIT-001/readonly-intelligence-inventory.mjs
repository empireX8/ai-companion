/**
 * READ-ONLY intelligence inventory for Kay's account.
 * INTELLIGENCE-COMPATIBILITY-AUDIT-001
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, raw write SQL,
 * API mutation. Select / count / groupBy / findMany / aggregate / read-only
 * $queryRaw SELECT only.
 *
 * Usage (from worktree):
 *   set -a && source .env && set +a
 *   node docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.mjs
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
const CHICKEN_STATEMENT = "chicken burgers";
const SELECTED_RI_ID = "3a6163dd-0f85-4bf5-8eb8-924579f1db62";
const OUT_DIR = dirname(fileURLToPath(import.meta.url));

function groupCount(rows, keyFn) {
  const m = {};
  for (const r of rows) {
    const k = keyFn(r);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function fromGroupBy(rows, key = "status") {
  return Object.fromEntries(rows.map((r) => [String(r[key]), r._count._all]));
}

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

function isSeedId(id) {
  return typeof id === "string" && id.startsWith(SEED_PREFIX);
}

async function main() {
  const out = {
    campaign: "INTELLIGENCE-COMPATIBILITY-AUDIT-001",
    userId: KAY,
    queriedAt: new Date().toISOString(),
    mode: "read_only",
    mutationsPerformed: false,
    note: "Read-only inventory. No writes. No accept/reject. No content dumps of private messages.",
  };

  // ── Gate checks (must match campaign expectations) ─────────────────────
  const [
    refPendingImport,
    contraPendingImport,
    chickenActive,
    selectedRi,
    patternClaimTotal,
    modelUpdateTotal,
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
        sourceSessionId: true,
        sourceMessageId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.patternClaim.count({ where: { userId: KAY } }),
    db.modelUpdate.count({ where: { userId: KAY } }),
  ]);

  out.gate = {
    pendingTotal: refPendingImport + contraPendingImport,
    referenceItemPendingImport: refPendingImport,
    contradictionNodePendingImport: contraPendingImport,
    chickenBurgerActiveCount: chickenActive,
    selectedReferenceItem: selectedRi
      ? {
          id: selectedRi.id,
          type: selectedRi.type,
          status: selectedRi.status,
          confidence: selectedRi.confidence,
          statementPreview: selectedRi.statement?.slice(0, 80),
          sourceSessionId: selectedRi.sourceSessionId,
          sourceMessageId: selectedRi.sourceMessageId,
          updatedAt: selectedRi.updatedAt,
        }
      : null,
    patternClaims: patternClaimTotal,
    modelUpdates: modelUpdateTotal,
    expected: {
      pendingTotal: 53,
      referenceItemPending: 28,
      contradictionNodePending: 25,
      chickenBurgerActive: 1,
      patternClaims: 7,
      selectedIdActive: true,
    },
  };

  out.gate.matchesExpected =
    out.gate.pendingTotal === 53 &&
    out.gate.referenceItemPendingImport === 28 &&
    out.gate.contradictionNodePendingImport === 25 &&
    out.gate.chickenBurgerActiveCount === 1 &&
    selectedRi?.status === "active" &&
    out.gate.patternClaims === 7;

  // ── Sessions / messages / import lineage ───────────────────────────────
  const sessionAgg = await db.session.groupBy({
    by: ["origin"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.sessions = {
    byOrigin: Object.fromEntries(sessionAgg.map((r) => [r.origin, r._count._all])),
    importedWithExternalId: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE", importedExternalId: { not: null } },
    }),
    importedWithImportedAt: await db.session.count({
      where: { userId: KAY, origin: "IMPORTED_ARCHIVE", importedAt: { not: null } },
    }),
  };

  out.messages = {
    imported: await db.message.count({
      where: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } },
    }),
    app: await db.message.count({
      where: { userId: KAY, session: { origin: "APP" } },
    }),
    total: await db.message.count({ where: { userId: KAY } }),
  };

  const uploads = await db.importUploadSession.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      status: true,
      filename: true,
      sessionsCreated: true,
      messagesCreated: true,
      contradictionsCreated: true,
      processedConversations: true,
      processedMessages: true,
      createdAt: true,
      finishedAt: true,
    },
  });
  out.importUploadSessions = uploads.map((u) => ({
    ...u,
    provenance: "import_upload",
  }));

  // ── Evidence spans ─────────────────────────────────────────────────────
  out.evidenceSpans = {
    onImportedMessages: await db.evidenceSpan.count({
      where: { message: { userId: KAY, session: { origin: "IMPORTED_ARCHIVE" } } },
    }),
    onAppMessages: await db.evidenceSpan.count({
      where: { message: { userId: KAY, session: { origin: "APP" } } },
    }),
    total: await db.evidenceSpan.count({
      where: { message: { userId: KAY } },
    }),
  };

  // ── Derivation ─────────────────────────────────────────────────────────
  const derRuns = await db.derivationRun.groupBy({
    by: ["scope", "status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.derivationRuns = {
    byScopeStatus: derRuns,
    importCompleted: await db.derivationRun.count({
      where: { userId: KAY, scope: "import", status: "completed" },
    }),
    importFailed: await db.derivationRun.count({
      where: { userId: KAY, scope: "import", status: "failed" },
    }),
    nativeTotal: await db.derivationRun.count({
      where: { userId: KAY, scope: "native" },
    }),
  };

  const artifacts = await db.derivationArtifact.groupBy({
    by: ["type", "status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.derivationArtifacts = artifacts;

  // ── ReferenceItem ──────────────────────────────────────────────────────
  const refs = await db.referenceItem.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      type: true,
      status: true,
      confidence: true,
      sourceSessionId: true,
      createdAt: true,
      updatedAt: true,
      statement: true,
      sourceSession: { select: { origin: true } },
    },
  });
  out.referenceItems = {
    total: refs.length,
    byStatus: groupCount(refs, (r) => r.status),
    byType: groupCount(refs, (r) => r.type),
    byTypeStatus: groupCount(refs, (r) => `${r.type}:${r.status}`),
    fromImportedSession: refs.filter((r) => r.sourceSession?.origin === "IMPORTED_ARCHIVE").length,
    fromAppSession: refs.filter((r) => r.sourceSession?.origin === "APP").length,
    seedPrefixed: refs.filter((r) => isSeedId(r.id)).length,
    active: refs
      .filter((r) => r.status === "active")
      .map((r) => ({
        id: r.id,
        type: r.type,
        confidence: r.confidence,
        statementPreview: r.statement?.slice(0, 100),
        origin: r.sourceSession?.origin ?? null,
        updatedAt: r.updatedAt,
      })),
    pendingImportSample: refs
      .filter((r) => r.status === "candidate" && r.sourceSession?.origin === "IMPORTED_ARCHIVE")
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        type: r.type,
        confidence: r.confidence,
        statementPreview: r.statement?.slice(0, 100),
        createdAt: r.createdAt,
      })),
  };

  // ── ContradictionNode ──────────────────────────────────────────────────
  const contras = await db.contradictionNode.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      type: true,
      status: true,
      confidence: true,
      title: true,
      sourceSessionId: true,
      createdAt: true,
      sourceSession: { select: { origin: true } },
    },
  });
  out.contradictionNodes = {
    total: contras.length,
    byStatus: groupCount(contras, (r) => r.status),
    byType: groupCount(contras, (r) => r.type),
    byTypeStatus: groupCount(contras, (r) => `${r.type}:${r.status}`),
    fromImportedSession: contras.filter((r) => r.sourceSession?.origin === "IMPORTED_ARCHIVE")
      .length,
    fromAppSession: contras.filter((r) => r.sourceSession?.origin === "APP").length,
    seedPrefixed: contras.filter((r) => isSeedId(r.id)).length,
    pendingImportSample: contras
      .filter((r) => r.status === "candidate" && r.sourceSession?.origin === "IMPORTED_ARCHIVE")
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        type: r.type,
        confidence: r.confidence,
        titlePreview: r.title?.slice(0, 100),
        createdAt: r.createdAt,
      })),
  };

  out.contradictionEvidence = {
    total: await db.contradictionEvidence.count({
      where: { node: { userId: KAY } },
    }),
  };

  // ── PatternClaim ───────────────────────────────────────────────────────
  const patterns = await db.patternClaim.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      status: true,
      patternType: true,
      strengthLevel: true,
      summary: true,
      sourceRunId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  out.patternClaims = {
    total: patterns.length,
    byStatus: groupCount(patterns, (r) => r.status),
    byType: groupCount(patterns, (r) => r.patternType),
    byStrength: groupCount(patterns, (r) => r.strengthLevel),
    seedPrefixed: patterns.filter((r) => isSeedId(r.id)).length,
    rows: patterns.map((r) => ({
      id: r.id,
      status: r.status,
      patternType: r.patternType,
      strengthLevel: r.strengthLevel,
      summaryPreview: r.summary?.slice(0, 120),
      sourceRunId: r.sourceRunId,
      createdAt: r.createdAt,
    })),
  };

  out.patternClaimEvidence = {
    total: await db.patternClaimEvidence.count({
      where: { claim: { userId: KAY } },
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
  };

  out.patternClaimActions = fromGroupBy(
    await db.patternClaimAction.groupBy({
      by: ["status"],
      where: { userId: KAY },
      _count: { _all: true },
    }),
  );

  // ── ProfileArtifact (legacy) ───────────────────────────────────────────
  const profileArts = await db.profileArtifact.groupBy({
    by: ["type", "status"],
    where: { userId: KAY },
    _count: { _all: true },
  });
  out.profileArtifacts = {
    total: await db.profileArtifact.count({ where: { userId: KAY } }),
    byTypeStatus: profileArts,
    activeByType: fromGroupBy(
      await db.profileArtifact.groupBy({
        by: ["type"],
        where: { userId: KAY, status: "active" },
        _count: { _all: true },
      }),
      "type",
    ),
  };

  // ── UserMapConclusion / Investigation / Fieldwork / ModelUpdate ────────
  const um = await db.userMapConclusion.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      area: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      confidenceLevel: true,
      evidenceCount: true,
      title: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  out.userMapConclusions = {
    total: um.length,
    byArea: groupCount(um, (r) => r.area),
    byStatus: groupCount(um, (r) => r.status),
    byVisibility: groupCount(um, (r) => r.visibility),
    byLifecycle: groupCount(um, (r) => r.candidateLifecycleStatus ?? "null"),
    seedPrefixed: um.filter((r) => isSeedId(r.id)).length,
    rows: um.map((r) => ({
      id: r.id,
      area: r.area,
      status: r.status,
      visibility: r.visibility,
      lifecycle: r.candidateLifecycleStatus,
      confidenceLevel: r.confidenceLevel,
      evidenceCount: r.evidenceCount,
      titlePreview: r.title?.slice(0, 100),
      summaryPreview: r.summary?.slice(0, 120),
      createdAt: r.createdAt,
      seed: isSeedId(r.id),
    })),
  };

  const inv = await db.investigation.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      candidateLifecycleStatus: true,
      status: true,
      title: true,
      organizingQuestion: true,
      createdAt: true,
    },
  });
  out.investigations = {
    total: inv.length,
    byVisibility: groupCount(inv, (r) => r.visibility),
    byLifecycle: groupCount(inv, (r) => r.candidateLifecycleStatus ?? "null"),
    seedPrefixed: inv.filter((r) => isSeedId(r.id)).length,
    rows: inv.map((r) => ({
      id: r.id,
      visibility: r.visibility,
      lifecycle: r.candidateLifecycleStatus,
      status: r.status,
      titlePreview: r.title?.slice(0, 80),
      questionPreview: r.organizingQuestion?.slice(0, 80),
      seed: isSeedId(r.id),
    })),
  };

  const fw = await db.fieldworkAssignment.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      visibility: true,
      candidateLifecycleStatus: true,
      status: true,
      prompt: true,
      createdAt: true,
    },
  });
  out.fieldwork = {
    total: fw.length,
    byVisibility: groupCount(fw, (r) => r.visibility),
    byLifecycle: groupCount(fw, (r) => r.candidateLifecycleStatus ?? "null"),
    byStatus: groupCount(fw, (r) => r.status),
    seedPrefixed: fw.filter((r) => isSeedId(r.id)).length,
    rows: fw.map((r) => ({
      id: r.id,
      visibility: r.visibility,
      lifecycle: r.candidateLifecycleStatus,
      status: r.status,
      promptPreview: r.prompt?.slice(0, 80),
      seed: isSeedId(r.id),
    })),
  };

  const mu = await db.modelUpdate.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      updateType: true,
      visibility: true,
      isMeaningful: true,
      affectedObjectType: true,
      affectedObjectId: true,
      userFacingSummary: true,
      sourceRunId: true,
      createdAt: true,
    },
  });
  out.modelUpdates = {
    total: mu.length,
    byType: groupCount(mu, (r) => r.updateType),
    byVisibility: groupCount(mu, (r) => r.visibility),
    seedPrefixed: mu.filter((r) => isSeedId(r.id)).length,
    rows: mu.map((r) => ({
      id: r.id,
      updateType: r.updateType,
      visibility: r.visibility,
      isMeaningful: r.isMeaningful,
      affectedObjectType: r.affectedObjectType,
      affectedObjectId: r.affectedObjectId,
      summaryPreview: r.userFacingSummary?.slice(0, 100),
      seed: isSeedId(r.id),
      createdAt: r.createdAt,
    })),
  };

  // ── Goals proxies (no Goal table) ──────────────────────────────────────
  out.goalsProxy = {
    referenceItemGoals: {
      total: await db.referenceItem.count({ where: { userId: KAY, type: "goal" } }),
      byStatus: fromGroupBy(
        await db.referenceItem.groupBy({
          by: ["status"],
          where: { userId: KAY, type: "goal" },
          _count: { _all: true },
        }),
      ),
    },
    profileArtifactGoals: {
      total: await db.profileArtifact.count({ where: { userId: KAY, type: "GOAL" } }),
      byStatus: fromGroupBy(
        await db.profileArtifact.groupBy({
          by: ["status"],
          where: { userId: KAY, type: "GOAL" },
          _count: { _all: true },
        }),
      ),
    },
    userMapModelGoalAreas: um
      .filter((r) =>
        ["developmental_vector", "current_frontier", "meaning_system"].includes(r.area),
      )
      .map((r) => ({
        id: r.id,
        area: r.area,
        status: r.status,
        visibility: r.visibility,
        titlePreview: r.title?.slice(0, 80),
      })),
    surfacedActionsWithLinkedGoal: await db.surfacedAction.count({
      where: { userId: KAY, linkedGoalRefId: { not: null } },
    }),
  };

  // ── Decisions / outcomes proxies ───────────────────────────────────────
  const actions = await db.surfacedAction.findMany({
    where: { userId: KAY },
    select: {
      id: true,
      bucket: true,
      status: true,
      linkedClaimId: true,
      linkedGoalRefId: true,
      linkedFamily: true,
      surfacedAt: true,
    },
  });
  out.surfacedActions = {
    total: actions.length,
    byBucket: groupCount(actions, (r) => r.bucket),
    byStatus: groupCount(actions, (r) => r.status),
    withLinkedClaim: actions.filter((r) => r.linkedClaimId).length,
    withLinkedGoal: actions.filter((r) => r.linkedGoalRefId).length,
    seedPrefixed: actions.filter((r) => isSeedId(r.id)).length,
  };

  // ── Understanding evidence / reports / composition ─────────────────────
  out.understandingEvidenceLinks = {
    total: await db.understandingEvidenceLink.count({ where: { userId: KAY } }),
    bySourceType: fromGroupBy(
      await db.understandingEvidenceLink.groupBy({
        by: ["sourceType"],
        where: { userId: KAY },
        _count: { _all: true },
      }),
      "sourceType",
    ),
    byTargetType: fromGroupBy(
      await db.understandingEvidenceLink.groupBy({
        by: ["targetType"],
        where: { userId: KAY },
        _count: { _all: true },
      }),
      "targetType",
    ),
  };

  out.surfacedEvidencePointers = {
    total: await db.surfacedEvidencePointer.count({ where: { userId: KAY } }),
  };

  out.exploreMovementProposals = {
    total: await db.exploreMovementProposal.count({ where: { userId: KAY } }),
    byStatus: fromGroupBy(
      await db.exploreMovementProposal.groupBy({
        by: ["status"],
        where: { userId: KAY },
        _count: { _all: true },
      }),
    ),
  };

  out.journalEntries = await db.journalEntry.count({ where: { userId: KAY } });
  out.weeklyAudits = await db.weeklyAudit.count({ where: { userId: KAY } });

  try {
    const comps = await db.canonicalTodayComposition.findMany({
      where: { userId: KAY },
      select: { id: true, source: true, createdAt: true, updatedAt: true },
    });
    out.canonicalTodayComposition = comps.map((c) => ({
      ...c,
      seedLikely:
        typeof c.source === "string" &&
        (c.source.includes("round_trip") || c.source.includes("reference")),
    }));
  } catch (e) {
    out.canonicalTodayComposition = { error: String(e.message || e) };
  }

  try {
    const reports = await db.canonicalModelMovementReport.findMany({
      where: { userId: KAY },
      select: {
        id: true,
        reportType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    out.canonicalModelMovementReports = reports.map((r) => ({
      ...r,
      seed: isSeedId(r.id),
    }));
  } catch (e) {
    out.canonicalModelMovementReports = { error: String(e.message || e) };
  }

  // ── Coverage / funnel ──────────────────────────────────────────────────
  out.importCoverage = {
    importedSessionsWithEvidenceSpans: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT m."sessionId")::int AS c
         FROM "EvidenceSpan" e
         JOIN "Message" m ON m.id = e."messageId"
         JOIN "Session" s ON s.id = m."sessionId"
         WHERE s."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    importedSessionsWithReferenceItems: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ri."sourceSessionId")::int AS c
         FROM "ReferenceItem" ri
         JOIN "Session" s ON s.id = ri."sourceSessionId"
         WHERE ri."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    importedSessionsWithContradictionNodes: (
      await db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT cn."sourceSessionId")::int AS c
         FROM "ContradictionNode" cn
         JOIN "Session" s ON s.id = cn."sourceSessionId"
         WHERE cn."userId" = $1 AND s.origin = 'IMPORTED_ARCHIVE'`,
        KAY,
      )
    )[0].c,
    importedSessionsUnprocessedApprox: (
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
    )[0].c,
  };

  // ── Provenance buckets summary ─────────────────────────────────────────
  out.provenanceBuckets = {
    genuineImportDerived: {
      sessions: out.sessions.byOrigin.IMPORTED_ARCHIVE ?? 0,
      messages: out.messages.imported,
      evidenceSpans: out.evidenceSpans.onImportedMessages,
      referenceItems: out.referenceItems.fromImportedSession,
      contradictionNodes: out.contradictionNodes.fromImportedSession,
      patternClaims: out.patternClaims.total - out.patternClaims.seedPrefixed,
      patternClaimEvidenceImported: out.patternClaimEvidence.citingImportedSession,
    },
    nativeApp: {
      sessions: out.sessions.byOrigin.APP ?? 0,
      messages: out.messages.app,
      evidenceSpans: out.evidenceSpans.onAppMessages,
      referenceItems: out.referenceItems.fromAppSession,
      contradictionNodes: out.contradictionNodes.fromAppSession,
    },
    syntheticSeed: {
      compositionRows: Array.isArray(out.canonicalTodayComposition)
        ? out.canonicalTodayComposition.filter((c) => c.seedLikely).length
        : null,
      seedPrefixedReferenceItems: out.referenceItems.seedPrefixed,
      seedPrefixedContradictions: out.contradictionNodes.seedPrefixed,
      seedPrefixedPatternClaims: out.patternClaims.seedPrefixed,
      seedPrefixedUserMap: out.userMapConclusions.seedPrefixed,
      seedPrefixedModelUpdates: out.modelUpdates.seedPrefixed,
      seedPrefixedSurfacedActions: out.surfacedActions.seedPrefixed,
    },
    note: "Seed densograph objects live inside CanonicalTodayComposition.payload JSON, not as Prisma ReferenceItem/PatternClaim rows with seed IDs. Count composition separately from table rows.",
  };

  // ── Non-mutation confirmation fingerprint ──────────────────────────────
  out.nonMutationFingerprint = {
    pendingTotal: out.gate.pendingTotal,
    referenceItemPending: out.gate.referenceItemPendingImport,
    contradictionNodePending: out.gate.contradictionNodePendingImport,
    selectedRiStatus: selectedRi?.status ?? null,
    selectedRiUpdatedAt: selectedRi?.updatedAt ?? null,
    patternClaims: out.gate.patternClaims,
    modelUpdates: out.gate.modelUpdates,
    chickenActive: out.gate.chickenBurgerActiveCount,
  };

  const path = join(OUT_DIR, "readonly-intelligence-inventory.json");
  writeFileSync(path, serialize(out));
  console.log("Wrote", path);
  console.log(
    serialize({
      gate: out.gate,
      sessions: out.sessions.byOrigin,
      messages: out.messages,
      evidenceSpans: out.evidenceSpans,
      referenceItems: {
        total: out.referenceItems.total,
        byStatus: out.referenceItems.byStatus,
        byType: out.referenceItems.byType,
      },
      contradictionNodes: {
        total: out.contradictionNodes.total,
        byStatus: out.contradictionNodes.byStatus,
      },
      patternClaims: out.patternClaims.total,
      userMapConclusions: out.userMapConclusions.total,
      modelUpdates: out.modelUpdates.total,
      goalsProxy: out.goalsProxy,
      composition: out.canonicalTodayComposition,
      coverage: out.importCoverage,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
