/**
 * READ-ONLY shortlist builder for pending ContradictionNode candidates (Kay).
 * SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001 — Phase A
 *
 * FORBIDDEN: create, update, upsert, delete, transaction write, decide API.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node docs/agent-runs/receipts/SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001/readonly-contradiction-candidate-shortlist.mjs
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

const CODING_NOISE = [
  /forget me too/i,
  /forget double/i,
  /codespring/i,
  /branch · branch/i,
  /prompt/i,
  /json schema/i,
  /typescript/i,
  /npm run/i,
  /git commit/i,
  /cursor/i,
  /prisma migrate/i,
];

const SENSITIVE = [
  /dating/i,
  /race/i,
  /sexual/i,
  /suicid/i,
  /self-harm/i,
  /abuse/i,
];

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

function excerpt(text, max = 120) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function assessCodingNoise(sideA, sideB, title, sessionLabel) {
  const blob = `${title} ${sideA} ${sideB} ${sessionLabel ?? ""}`;
  const hits = CODING_NOISE.filter((re) => re.test(blob));
  if (hits.length >= 2) return { level: "high", hits: hits.map(String) };
  if (hits.length === 1) return { level: "medium", hits: hits.map(String) };
  return { level: "low", hits: [] };
}

function assessSensitivity(sideA, sideB) {
  const blob = `${sideA} ${sideB}`;
  const hits = SENSITIVE.filter((re) => re.test(blob));
  if (hits.length) return { level: "elevated", hits: hits.map(String) };
  return { level: "low", hits: [] };
}

function assessDuplicateRisk(sideA, sideB, allRows) {
  let similar = 0;
  for (const other of allRows) {
    if (other.id === sideA) continue;
    const aNorm = sideA.toLowerCase().slice(0, 40);
    const bNorm = sideB.toLowerCase().slice(0, 40);
    if (
      other.sideA.toLowerCase().includes(aNorm) ||
      other.sideB.toLowerCase().includes(bNorm) ||
      (other.sideA.toLowerCase() === aNorm && other.sideB.toLowerCase() === bNorm)
    ) {
      similar += 1;
    }
  }
  if (similar >= 3) return "high";
  if (similar >= 1) return "medium";
  return "low";
}

function uiIdentifyingText(row) {
  const raw =
    row.evidenceExcerpt?.trim() ||
    row.claimOrSummary?.trim() ||
    `${row.sideA.trim()} ↔ ${row.sideB.trim()}`;
  return {
    overlayTitle: row.title.trim(),
    theirWordsExcerpt: excerpt(raw, 160),
    proposedLine: row.title.trim(),
    claimOrSummary: excerpt(row.claimOrSummary, 180),
    metadataHints: [
      "Source table: ContradictionNode",
      `Type: ${row.type}`,
      "Provenance: import_derived_session",
      "Status: candidate",
      row.sourceSessionId ? `Conversation: ${row.sourceSessionId.slice(0, 12)}…` : null,
      row.sourceMessageId ? `Message: ${row.sourceMessageId.slice(0, 12)}…` : null,
      row.sourceImportBatchId ? `Import batch: ${row.sourceImportBatchId.slice(0, 12)}…` : null,
    ].filter(Boolean),
  };
}

function scoreCandidate(row, ctx) {
  let score = 0;
  const reasons = [];
  const penalties = [];

  if (row.status !== "candidate") {
    penalties.push("status_not_candidate");
    score -= 100;
  }
  if (!row.sourceMessageId) {
    penalties.push("missing_sourceMessageId");
    score -= 50;
  }
  if (!row.sideA.trim() || !row.sideB.trim()) {
    penalties.push("missing_side");
    score -= 40;
  } else if (row.sideA.trim().length >= 20 && row.sideB.trim().length >= 20) {
    score += 15;
    reasons.push("both_sides_substantive");
  }

  const sideDistinct =
    row.sideA.trim().toLowerCase() !== row.sideB.trim().toLowerCase();
  if (sideDistinct) {
    score += 10;
    reasons.push("genuine_two_sided");
  } else {
    penalties.push("duplicate_wording");
    score -= 30;
  }

  if (row.contradictionEvidenceCount > 0) {
    score += 8;
    reasons.push("has_contradiction_evidence");
  }
  if (row.existingModelUpdateCount > 0) {
    penalties.push("existing_model_update");
    score -= 100;
  }
  if (row.linkedUelCount > 0) {
    penalties.push("existing_uel_for_candidate");
    score -= 20;
  }

  const coding = assessCodingNoise(row.sideA, row.sideB, row.title, row.sessionLabel);
  if (coding.level === "high") {
    score -= 25;
    penalties.push("coding_noise_high");
  } else if (coding.level === "medium") {
    score -= 10;
    penalties.push("coding_noise_medium");
  } else {
    score += 5;
    reasons.push("low_coding_noise");
  }

  const sens = assessSensitivity(row.sideA, row.sideB);
  if (sens.level === "elevated") {
    score -= 20;
    penalties.push("sensitivity_elevated");
  } else {
    score += 5;
    reasons.push("low_sensitivity");
  }

  if (row.type === "constraint_conflict") {
    score += 6;
    reasons.push("constraint_conflict_often_clearer");
  }

  if (row.confidence === "medium") {
    score += 4;
    reasons.push("medium_confidence");
  }

  if (ctx.openGenuineCount > 0) {
    penalties.push("open_cn_already_exists");
    score -= 100;
  }

  return { score, reasons, penalties, coding, sensitivity: sens };
}

async function main() {
  const queriedAt = new Date().toISOString();

  const [openGenuineCount, uploadBatches] = await Promise.all([
    db.contradictionNode.count({
      where: { userId: KAY, status: "open", sourceSession: { origin: "IMPORTED_ARCHIVE" } },
    }),
    db.importUploadSession.findMany({
      where: { userId: KAY, status: "complete" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const soleBatchId = uploadBatches.length === 1 ? uploadBatches[0].id : uploadBatches[0]?.id ?? null;

  const rows = await db.contradictionNode.findMany({
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
      sideA: true,
      sideB: true,
      sourceSessionId: true,
      sourceMessageId: true,
      createdAt: true,
      sourceSession: { select: { label: true, origin: true } },
      sourceMessage: { select: { content: true } },
      evidence: { select: { id: true, quote: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const enriched = [];
  for (const row of rows) {
    const [uelCount, muCount, spanCount] = await Promise.all([
      db.understandingEvidenceLink.count({
        where: {
          userId: KAY,
          targetType: "contradiction_node",
          targetId: row.id,
        },
      }),
      db.modelUpdate.count({
        where: {
          userId: KAY,
          affectedObjectType: "contradiction_node",
          affectedObjectId: row.id,
        },
      }),
      row.sourceMessageId
        ? db.evidenceSpan.count({
            where: { userId: KAY, messageId: row.sourceMessageId },
          })
        : Promise.resolve(0),
    ]);

    const evidenceExcerpt =
      row.evidence[0]?.quote?.trim() ||
      row.sourceMessage?.content?.trim().slice(0, 280) ||
      row.sideA.trim().slice(0, 280) ||
      null;

    enriched.push({
      id: row.id,
      reviewKey: `contradiction_node:${row.id}`,
      type: row.type,
      status: row.status,
      confidence: row.confidence,
      title: row.title.trim(),
      sideA: row.sideA.trim(),
      sideB: row.sideB.trim(),
      claimOrSummary: `${row.sideA.trim()} ↔ ${row.sideB.trim()}`,
      sourceSessionId: row.sourceSessionId,
      sourceMessageId: row.sourceMessageId,
      sourceImportBatchId: soleBatchId,
      sessionLabel: row.sourceSession?.label ?? null,
      sessionOrigin: row.sourceSession?.origin ?? null,
      createdAt: row.createdAt.toISOString(),
      contradictionEvidenceCount: row.evidence.length,
      linkedUelCount: uelCount,
      existingModelUpdateCount: muCount,
      sourceMessageSpanCount: spanCount,
      evidenceExcerpt,
      duplicateRisk: "pending",
      ui: null,
      score: null,
    });
  }

  for (const row of enriched) {
    row.duplicateRisk = assessDuplicateRisk(row.sideA, row.sideB, enriched);
    row.ui = uiIdentifyingText(row);
    row.score = scoreCandidate(row, { openGenuineCount });
  }

  enriched.sort((a, b) => b.score.score - a.score.score || a.createdAt.localeCompare(b.createdAt));

  const shortlist = enriched.slice(0, 5).map((row, idx) => ({
    ...row,
    shortlistRank: idx + 1,
    recommendationRank: idx + 1,
  }));

  const out = {
    campaign: "SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001",
    phase: "A",
    userId: KAY,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    totalPendingContradictionCandidates: enriched.length,
    openGenuineContradictionNodes: openGenuineCount,
    shortlistMax: 5,
    shortlist,
    allCandidatesRanked: enriched.map((r) => ({
      id: r.id,
      reviewKey: r.reviewKey,
      type: r.type,
      confidence: r.confidence,
      title: r.title,
      sideAPreview: excerpt(r.sideA, 100),
      sideBPreview: excerpt(r.sideB, 100),
      score: r.score.score,
      penalties: r.score.penalties,
      duplicateRisk: r.duplicateRisk,
      contradictionEvidenceCount: r.contradictionEvidenceCount,
      linkedUelCount: r.linkedUelCount,
      existingModelUpdateCount: r.existingModelUpdateCount,
      sourceMessageSpanCount: r.sourceMessageSpanCount,
    })),
    recommendedId: enriched[0]?.id ?? null,
    recommendedReviewKey: enriched[0]?.reviewKey ?? null,
  };

  const jsonPath = join(OUT_DIR, "candidate-shortlist.json");
  writeFileSync(jsonPath, serialize(out));
  console.log("Wrote", jsonPath);
  console.log(
    serialize({
      total: enriched.length,
      openGenuine: openGenuineCount,
      top5: shortlist.map((s) => ({
        rank: s.shortlistRank,
        id: s.id,
        reviewKey: s.reviewKey,
        score: s.score.score,
        title: s.title,
        sideA: excerpt(s.sideA, 80),
        sideB: excerpt(s.sideB, 80),
      })),
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
