/**
 * READ-ONLY before-state capture for one chosen genuine import candidate.
 *
 * Does NOT accept/reject. Does NOT mutate any row.
 *
 * Usage (from worktree, with Kay DB URL):
 *   set -a && source .env && set +a
 *   node docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-before-state.mjs \
 *     --candidate reference_item:<id>
 *   # or:
 *   node .../readonly-selected-candidate-before-state.mjs --candidate <ReferenceItemUUID>
 *
 * Output:
 *   readonly-selected-candidate-before-state.json (same directory)
 */

import { createRequire } from "module";
import { existsSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";

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
  // bare uuid / cuid → ReferenceItem (this campaign phase only shortlists RI)
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

async function main() {
  const { candidate: rawCandidate } = parseArgs(process.argv.slice(2));
  if (!rawCandidate) {
    console.error(
      "Usage: node readonly-selected-candidate-before-state.mjs --candidate <reviewKey|ReferenceItemId>",
    );
    process.exitCode = 2;
    return;
  }

  const key = parseReviewKeyOrId(rawCandidate);
  if (!key) {
    console.error("Could not parse candidate id / review key.");
    process.exitCode = 2;
    return;
  }

  const { require, root } = resolvePrismaRequire();
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();

  const out = {
    campaign: "SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001",
    phase: "before_state",
    userId: KAY,
    queriedAt: new Date().toISOString(),
    mode: "read_only",
    mutationsPerformed: false,
    prismaClientRoot: root,
    selectedKey: key,
    confirmation: {
      noMutationPerformed: true,
      scriptContainsNoWriteCalls: true,
    },
  };

  try {
    const [
      referenceItemPending,
      contradictionNodePending,
      patternClaimTotal,
      activeReferenceTotal,
      uploadBatches,
      selected,
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
      db.importUploadSession.findMany({
        where: { userId: KAY, status: "complete" },
        select: { id: true, createdAt: true, status: true },
        orderBy: { createdAt: "desc" },
      }),
      key.sourceTable === "ReferenceItem"
        ? db.referenceItem.findFirst({
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
              sourceMessage: {
                select: { id: true, role: true, content: true },
              },
            },
          })
        : db.contradictionNode.findFirst({
            where: { id: key.id, userId: KAY },
            select: {
              id: true,
              type: true,
              status: true,
              confidence: true,
              title: true,
              sideA: true,
              sideB: true,
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
              sourceMessage: {
                select: { id: true, role: true, content: true },
              },
            },
          }),
    ]);

    if (!selected) {
      out.error = "SELECTED_CANDIDATE_NOT_FOUND";
      out.counts = {
        pendingCandidateTotal: referenceItemPending + contradictionNodePending,
        referenceItemCandidateTotal: referenceItemPending,
        contradictionNodeCandidateTotal: contradictionNodePending,
        patternClaimTotal,
        activeReferenceTotal,
      };
      const outPath = join(OUT_DIR, "readonly-selected-candidate-before-state.json");
      writeFileSync(outPath, serialize(out));
      console.log(serialize(out));
      console.error(`\nWrote ${outPath}`);
      process.exitCode = 1;
      return;
    }

    const statementOrTitle =
      key.sourceTable === "ReferenceItem"
        ? selected.statement
        : selected.title;

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

    const relatedModelUpdates = await db.modelUpdate.findMany({
      where: {
        userId: KAY,
        OR: [
          { affectedObjectId: key.id },
          ...(selected.sourceSessionId
            ? [{ affectedObjectId: selected.sourceSessionId }]
            : []),
        ],
      },
      take: 20,
    });

    const relatedContraLinks =
      key.sourceTable === "ReferenceItem"
        ? await db.contradictionReferenceLink.findMany({
            where: { referenceId: key.id },
            take: 20,
          })
        : [];

    const activeQualityRefs = await db.referenceItem.findMany({
      where: { userId: KAY, status: "active" },
      select: {
        id: true,
        type: true,
        statement: true,
        status: true,
        confidence: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const providerVisibleActiveMemories = activeQualityRefs
      .filter((r) => isQualityMindContextStatement(r.statement))
      .map((r) => ({
        id: r.id,
        type: r.type,
        statementPreview: String(r.statement).slice(0, 160),
        updatedAt: r.updatedAt,
      }));

    const patternClaims = await db.patternClaim.findMany({
      where: { userId: KAY },
      select: {
        id: true,
        summary: true,
        status: true,
        patternType: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Map mind-context rail uses buildMindContextDisplayItems(snapshot, 3):
    // memories + active patterns, sorted by updatedAt, limit 3.
    const combinedPreview = [
      ...providerVisibleActiveMemories.map((m) => ({
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

    const msg = selected.sourceMessage?.content
      ? String(selected.sourceMessage.content)
      : "";

    out.counts = {
      pendingCandidateTotal: referenceItemPending + contradictionNodePending,
      referenceItemCandidateTotal: referenceItemPending,
      contradictionNodeCandidateTotal: contradictionNodePending,
      patternClaimTotal,
      activeReferenceTotal,
      completedImportBatches: uploadBatches.length,
    };

    out.selectedRow = {
      sourceTable: key.sourceTable,
      id: selected.id,
      reviewKey: key.reviewKey,
      type: selected.type,
      status: selected.status,
      confidence: selected.confidence,
      titleOrStatement: statementOrTitle,
      provenance: {
        sourceSessionOrigin: selected.sourceSession?.origin ?? null,
        sourceSessionId: selected.sourceSessionId,
        sourceMessageId: selected.sourceMessageId,
        conversationLabel: selected.sourceSession?.label ?? null,
        chatgptConversationExternalId:
          selected.sourceSession?.importedExternalId ?? null,
        importBatchIds: uploadBatches.map((b) => b.id),
        importBatchIdPrimary: uploadBatches[0]?.id ?? null,
      },
      sourceExcerpt: msg.replace(/\s+/g, " ").trim().slice(0, 220),
      createdAt: selected.createdAt,
      updatedAt: selected.updatedAt,
      passesMindContextQualityGate: isQualityMindContextStatement(
        String(statementOrTitle || ""),
      ),
    };

    out.existingRelatedObjects = {
      understandingEvidenceLinks: relatedUels,
      modelUpdates: relatedModelUpdates,
      contradictionReferenceLinks: relatedContraLinks,
      note:
        "ReferenceItem accept does not create UELs or ModelUpdates (schema target gaps).",
    };

    out.providerVisibleStateBeforeAcceptance = {
      destination:
        "Orvek Map → Background / Context rail (mind_context) + Inspector when selected",
      providerPath: [
        "OrvekMapPage / useOrvekHybridWorkbenchDataApi",
        "fetchMindContextSnapshot → GET /api/reference/list?status=active&limit=50",
        "buildMindContextDisplayItems(snapshot, 3)",
        "mapMapDataToV0Props / buildMapProductionDataApi context rail",
      ],
      activeQualityReferenceMemories: providerVisibleActiveMemories,
      mapContextRailTop3Preview: combinedPreview,
      selectedCurrentlyVisibleOnMap:
        selected.status === "active" &&
        isQualityMindContextStatement(String(statementOrTitle || "")) &&
        combinedPreview.some((x) => x.kind === "memory" && x.id === selected.id),
      todayConsumesReferenceItems: false,
      timelineConsumesReferenceItems: false,
    };

    out.integrity = {
      selectedIsImportDerived:
        selected.sourceSession?.origin === "IMPORTED_ARCHIVE",
      patternClaimTotalExpectedBaseline: 7,
      patternClaimTotalObserved: patternClaimTotal,
      mutationsPerformed: false,
    };

    out.verdict =
      selected.sourceSession?.origin === "IMPORTED_ARCHIVE"
        ? "BEFORE_STATE_CAPTURED_READ_ONLY"
        : "FAIL_SELECTED_NOT_IMPORT_DERIVED";

    const outPath = join(OUT_DIR, "readonly-selected-candidate-before-state.json");
    writeFileSync(outPath, serialize(out));
    console.log(serialize(out));
    console.log(`\nWrote ${outPath}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
