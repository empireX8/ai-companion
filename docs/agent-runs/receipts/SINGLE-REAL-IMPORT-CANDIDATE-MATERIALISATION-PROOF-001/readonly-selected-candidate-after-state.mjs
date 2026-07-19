/**
 * READ-ONLY after-state verification for one chosen genuine import candidate.
 *
 * Run AFTER Kay manually accepts the locked candidate in the canonical Import UI.
 * Does NOT accept/reject. Does NOT mutate any row.
 *
 * Usage (from worktree, with Kay DB URL):
 *   set -a && source .env && set +a
 *   node docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-after-state.mjs \
 *     --candidate reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62
 *
 * Optionally compares against:
 *   readonly-selected-candidate-before-state.json
 *
 * Output:
 *   readonly-selected-candidate-after-state.json (same directory)
 */

import { createRequire } from "module";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const LOCKED_REVIEW_KEY =
  "reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62";
const LOCKED_ID = "3a6163dd-0f85-4bf5-8eb8-924579f1db62";

const EXPECTED = {
  pendingTotalBefore: 54,
  pendingTotalAfter: 53,
  referenceItemPendingBefore: 29,
  referenceItemPendingAfter: 28,
  contradictionNodePending: 25,
  patternClaimTotal: 7,
  previousStatus: "candidate",
  nextStatus: "active",
};

function resolvePrismaRequire() {
  const roots = [
    process.cwd(),
    join(process.cwd(), "..", "ai-companion"),
    "/Users/user/ai-companion",
  ];
  for (const root of roots) {
    const pkg = join(root, "package.json");
    const client = join(root, "node_modules", "@prisma", "client");
    if (existsSync(pkg) && existsSync(client)) {
      return { require: createRequire(pkg), root };
    }
  }
  throw new Error(
    "Could not resolve @prisma/client. Run npm install in this worktree or set cwd to a checkout with node_modules.",
  );
}

function parseArgs(argv) {
  let candidate = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--candidate" || a === "--id" || a === "--review-key") {
      candidate = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (a.startsWith("--candidate=")) {
      candidate = a.slice("--candidate=".length);
    }
  }
  return { candidate };
}

function parseReviewKeyOrId(raw) {
  if (!raw || !String(raw).trim()) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("reference_item:")) {
    const id = trimmed.slice("reference_item:".length).trim();
    return id ? { sourceTable: "ReferenceItem", id, reviewKey: trimmed } : null;
  }
  if (trimmed.startsWith("contradiction_node:")) {
    const id = trimmed.slice("contradiction_node:".length).trim();
    return id
      ? { sourceTable: "ContradictionNode", id, reviewKey: trimmed }
      : null;
  }
  return {
    sourceTable: "ReferenceItem",
    id: trimmed,
    reviewKey: `reference_item:${trimmed}`,
  };
}

function serialize(obj) {
  return JSON.stringify(
    obj,
    (_, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    },
    2,
  );
}

function isQualityMindContextStatement(statement) {
  const t = String(statement || "").trim();
  if (t.length < 20) return false;
  const wordCount = (t.match(/\b\w{2,}\b/g) ?? []).length;
  if (wordCount < 4) return false;
  const specialChars = (t.match(/[<>{}()[\]|\\=;:$#@!`]/g) ?? []).length;
  if (specialChars / t.length > 0.1) return false;
  if (
    /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/.test(
      t,
    )
  ) {
    return false;
  }
  if (/^[$%#>]\s/.test(t) || /\n\s*[$%#>]\s/.test(t)) return false;
  if (/\b(?:WARN|ERROR|DEBUG|INFO)\b.*?:/.test(t)) return false;
  return true;
}

function loadBeforeState() {
  const path = join(OUT_DIR, "readonly-selected-candidate-before-state.json");
  if (!existsSync(path)) return { path, present: false, data: null };
  try {
    return {
      path,
      present: true,
      data: JSON.parse(readFileSync(path, "utf8")),
    };
  } catch (error) {
    return { path, present: true, data: null, parseError: String(error) };
  }
}

async function main() {
  const { candidate: rawCandidate } = parseArgs(process.argv.slice(2));
  const raw = rawCandidate || LOCKED_REVIEW_KEY;
  const key = parseReviewKeyOrId(raw);
  if (!key || key.sourceTable !== "ReferenceItem") {
    console.error(
      "After-state script expects a ReferenceItem review key / id (Candidate A).",
    );
    process.exitCode = 2;
    return;
  }
  if (key.id !== LOCKED_ID) {
    console.error(
      `Refusing to verify a different candidate. Locked id is ${LOCKED_ID}.`,
    );
    process.exitCode = 2;
    return;
  }

  const { require, root } = resolvePrismaRequire();
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const before = loadBeforeState();

  const out = {
    campaign: "SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001",
    phase: "after_state",
    userId: KAY,
    queriedAt: new Date().toISOString(),
    mode: "read_only",
    mutationsPerformed: false,
    prismaClientRoot: root,
    selectedKey: key,
    lockedReviewKey: LOCKED_REVIEW_KEY,
    confirmation: {
      noMutationPerformed: true,
      scriptContainsNoWriteCalls: true,
      scriptDoesNotPerformAcceptance: true,
    },
    schemaGaps: {
      modelUpdateExpected: false,
      understandingEvidenceLinkExpected: false,
      reason:
        "ReferenceItem accept only flips status to active. ModelUpdate.affectedObjectType and UnderstandingEvidenceLink cannot target reference_item.",
    },
    beforeStateFile: {
      path: before.path,
      present: before.present,
      parseError: before.parseError ?? null,
    },
  };

  try {
    const [
      referenceItemPending,
      contradictionNodePending,
      patternClaimTotal,
      activeReferenceTotal,
      selected,
      allRefs,
      pendingContraIds,
      patternClaims,
      modelUpdates,
      userMapConclusions,
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
      db.patternClaim.count({ where: { userId: KAY } }),
      db.referenceItem.count({ where: { userId: KAY, status: "active" } }),
      db.referenceItem.findFirst({
        where: { id: key.id, userId: KAY },
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
          sourceSession: {
            select: {
              id: true,
              origin: true,
              label: true,
              importedExternalId: true,
              importedSource: true,
            },
          },
        },
      }),
      db.referenceItem.findMany({
        where: { userId: KAY },
        select: {
          id: true,
          status: true,
          type: true,
          statement: true,
          sourceSessionId: true,
          sourceMessageId: true,
          updatedAt: true,
        },
      }),
      db.contradictionNode.findMany({
        where: {
          userId: KAY,
          status: "candidate",
          sourceSession: { origin: "IMPORTED_ARCHIVE" },
        },
        select: { id: true, status: true },
      }),
      db.patternClaim.findMany({
        where: { userId: KAY },
        select: {
          id: true,
          summary: true,
          status: true,
          patternType: true,
          updatedAt: true,
        },
        orderBy: { id: "asc" },
      }),
      db.modelUpdate.findMany({
        where: { userId: KAY },
        select: {
          id: true,
          userFacingSummary: true,
          updateType: true,
          visibility: true,
          affectedObjectType: true,
          affectedObjectId: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      }),
      db.userMapConclusion.findMany({
        where: { userId: KAY },
        select: {
          id: true,
          title: true,
          summary: true,
          area: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { id: "asc" },
      }),
    ]);

    if (!selected) {
      out.error = "SELECTED_CANDIDATE_NOT_FOUND";
      out.verdict = "FAIL_SELECTED_MISSING";
      const outPath = join(OUT_DIR, "readonly-selected-candidate-after-state.json");
      writeFileSync(outPath, serialize(out));
      console.log(serialize(out));
      process.exitCode = 1;
      return;
    }

    const relatedUels = await db.understandingEvidenceLink.findMany({
      where: {
        userId: KAY,
        OR: [
          { targetId: key.id },
          { sourceId: key.id },
          ...(selected.sourceMessageId
            ? [{ sourceId: selected.sourceMessageId }]
            : []),
          ...(selected.sourceSessionId
            ? [{ sourceId: selected.sourceSessionId }]
            : []),
        ],
      },
      take: 50,
    });

    const relatedModelUpdatesForTarget = modelUpdates.filter(
      (m) => m.affectedObjectId === key.id,
    );

    const duplicateActiveSameStatement = allRefs.filter(
      (r) =>
        r.id !== key.id &&
        r.status === "active" &&
        String(r.statement || "").trim() ===
          String(selected.statement || "").trim(),
    );

    const activeListEquivalent = allRefs
      .filter((r) => r.status === "active")
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    const providerActiveReturnsExactItem = activeListEquivalent.some(
      (r) => r.id === key.id,
    );

    const qualityActiveMemories = activeListEquivalent
      .filter((r) => isQualityMindContextStatement(r.statement))
      .map((r) => ({
        id: r.id,
        type: r.type,
        statementPreview: String(r.statement).slice(0, 160),
        updatedAt: r.updatedAt,
      }));

    const combinedMapTop3 = [
      ...qualityActiveMemories.map((m) => ({
        kind: "memory",
        id: m.id,
        updatedAt: m.updatedAt,
        preview: m.statementPreview,
      })),
      ...patternClaims
        .filter((p) => p.status === "active")
        .map((p) => ({
          kind: "pattern",
          id: p.id,
          updatedAt: p.updatedAt,
          preview: String(p.summary).slice(0, 160),
        })),
    ]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 3);

    const mapProviderReceivesItem = combinedMapTop3.some(
      (x) => x.kind === "memory" && x.id === key.id,
    );

    const beforeRow = before.data?.selectedRow ?? null;
    const provenanceUnchanged =
      beforeRow != null
        ? beforeRow.provenance?.sourceSessionId === selected.sourceSessionId &&
          beforeRow.provenance?.sourceMessageId === selected.sourceMessageId &&
          beforeRow.provenance?.sourceSessionOrigin ===
            selected.sourceSession?.origin &&
          String(beforeRow.titleOrStatement || "") ===
            String(selected.statement || "")
        : selected.sourceSession?.origin === "IMPORTED_ARCHIVE" &&
          Boolean(selected.sourceSessionId) &&
          Boolean(selected.sourceMessageId);

    // Unrelated pending RI candidates: all remaining import candidates still candidate
    const otherImportRefCandidates = allRefs.filter(
      (r) =>
        r.id !== key.id &&
        r.status === "candidate" /* origin filtered via pending count */,
    );

    const checks = {
      sameReferenceItemIdExists: selected.id === LOCKED_ID,
      statusChangedCandidateToActive:
        selected.status === EXPECTED.nextStatus &&
        (beforeRow ? beforeRow.status === EXPECTED.previousStatus : true),
      pendingTotal_54_to_53:
        referenceItemPending + contradictionNodePending ===
        EXPECTED.pendingTotalAfter,
      referenceItemPending_29_to_28:
        referenceItemPending === EXPECTED.referenceItemPendingAfter,
      contradictionNodePendingRemains_25:
        contradictionNodePending === EXPECTED.contradictionNodePending,
      patternClaimsRemain_7: patternClaimTotal === EXPECTED.patternClaimTotal,
      provenanceUnchanged: Boolean(provenanceUnchanged),
      noDuplicateReferenceItemCreated:
        duplicateActiveSameStatement.length === 0 &&
        allRefs.filter((r) => r.id === LOCKED_ID).length === 1,
      noUnrelatedCandidateStatusChangeHeuristic: {
        note: "Remaining import-derived ReferenceItem candidates should still be candidate; selected must not remain candidate.",
        selectedNotCandidate: selected.status !== "candidate",
        contradictionPendingCountOk:
          pendingContraIds.length === EXPECTED.contradictionNodePending,
        otherRefsStillOnlyCandidateOrNonImport:
          otherImportRefCandidates.length ===
          EXPECTED.referenceItemPendingAfter,
      },
      activeReferenceProviderReturnsExactItem: providerActiveReturnsExactItem,
      canonicalMapProviderReceivesIt:
        mapProviderReceivesItem &&
        isQualityMindContextStatement(selected.statement),
      noModelUpdateClaimedOrCreatedForAccept:
        relatedModelUpdatesForTarget.length === 0,
      noUelClaimedOrCreatedForAccept: relatedUels.length === 0,
    };

    const durableSnapshots = {
      patternClaimIds: patternClaims.map((p) => p.id),
      modelUpdateIds: modelUpdates.map((m) => m.id),
      userMapConclusionIds: userMapConclusions.map((c) => c.id),
      activeReferenceIds: activeListEquivalent.map((r) => r.id),
    };

    if (before.data?.counts) {
      checks.beforeCountsMatchExpectation = {
        pendingWas54:
          before.data.counts.pendingCandidateTotal ===
          EXPECTED.pendingTotalBefore,
        riWas29:
          before.data.counts.referenceItemCandidateTotal ===
          EXPECTED.referenceItemPendingBefore,
        cnWas25:
          before.data.counts.contradictionNodeCandidateTotal ===
          EXPECTED.contradictionNodePending,
        pcWas7:
          before.data.counts.patternClaimTotal === EXPECTED.patternClaimTotal,
      };
    }

    const hardPass =
      checks.sameReferenceItemIdExists &&
      selected.status === "active" &&
      checks.pendingTotal_54_to_53 &&
      checks.referenceItemPending_29_to_28 &&
      checks.contradictionNodePendingRemains_25 &&
      checks.patternClaimsRemain_7 &&
      checks.provenanceUnchanged &&
      checks.noDuplicateReferenceItemCreated &&
      checks.activeReferenceProviderReturnsExactItem &&
      checks.canonicalMapProviderReceivesIt &&
      checks.noModelUpdateClaimedOrCreatedForAccept &&
      checks.noUelClaimedOrCreatedForAccept &&
      checks.noUnrelatedCandidateStatusChangeHeuristic.selectedNotCandidate &&
      checks.noUnrelatedCandidateStatusChangeHeuristic
        .contradictionPendingCountOk &&
      checks.noUnrelatedCandidateStatusChangeHeuristic
        .otherRefsStillOnlyCandidateOrNonImport;

    out.counts = {
      pendingCandidateTotal: referenceItemPending + contradictionNodePending,
      referenceItemCandidateTotal: referenceItemPending,
      contradictionNodeCandidateTotal: contradictionNodePending,
      patternClaimTotal,
      activeReferenceTotal,
    };

    out.selectedRow = {
      id: selected.id,
      reviewKey: key.reviewKey,
      type: selected.type,
      status: selected.status,
      confidence: selected.confidence,
      statement: selected.statement,
      provenance: {
        sourceSessionOrigin: selected.sourceSession?.origin ?? null,
        sourceSessionId: selected.sourceSessionId,
        sourceMessageId: selected.sourceMessageId,
        conversationLabel: selected.sourceSession?.label ?? null,
        chatgptConversationExternalId:
          selected.sourceSession?.importedExternalId ?? null,
      },
      createdAt: selected.createdAt,
      updatedAt: selected.updatedAt,
      passesMindContextQualityGate: isQualityMindContextStatement(
        selected.statement,
      ),
    };

    out.providerVisibleStateAfterAcceptance = {
      activeReferenceListContainsExactId: providerActiveReturnsExactItem,
      activeReferenceIds: durableSnapshots.activeReferenceIds,
      mapContextRailTop3Preview: combinedMapTop3,
      mapProviderReceivesExactItem: mapProviderReceivesItem,
      todayConsumesReferenceItems: false,
      timelineConsumesReferenceItems: false,
      decisionsConsumesPreference: false,
    };

    out.relatedArtifacts = {
      understandingEvidenceLinks: relatedUels,
      modelUpdatesTargetingSelected: relatedModelUpdatesForTarget,
      note: "None expected for ReferenceItem acceptance under current schema.",
    };

    out.durableObjectSnapshot = durableSnapshots;
    out.checks = checks;
    out.verdict = hardPass
      ? "PASS_GENUINE_REFERENCEITEM_ACCEPTANCE_MATERIALISED"
      : selected.status === "candidate"
        ? "FAIL_STILL_CANDIDATE_ACCEPTANCE_NOT_OBSERVED"
        : "FAIL_AFTER_STATE_MISMATCH";

    const outPath = join(OUT_DIR, "readonly-selected-candidate-after-state.json");
    writeFileSync(outPath, serialize(out));
    console.log(serialize(out));
    console.log(`\nWrote ${outPath}`);
    if (!hardPass) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
