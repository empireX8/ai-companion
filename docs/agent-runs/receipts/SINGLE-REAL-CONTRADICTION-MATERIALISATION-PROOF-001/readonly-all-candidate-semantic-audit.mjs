/**
 * READ-ONLY semantic + lineage audit for all pending ContradictionNode candidates.
 * SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001 — Phase A2
 *
 * FORBIDDEN: writes, decide API, accept/reject.
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");

const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const OUT_DIR = dirname(fileURLToPath(import.meta.url));

const GOAL_MARKERS = ["i didn't", "i failed", "i avoided", "i skipped", "i procrastinated"];
const CONSTRAINT_MARKERS = ["but i", "however i", "even though"];

const SENSITIVE = [
  /interracial/i,
  /\bdating\b/i,
  /\brace\b/i,
  /gender or ethnic hate/i,
  /suicid/i,
  /self-harm/i,
];
const CODING = [
  /codespring/i,
  /typescript/i,
  /npm run/i,
  /git commit/i,
  /prisma migrate/i,
  /tutorial/i,
  /screenshot/i,
  /notion/i,
  /chat gpt/i,
  /organise my chat/i,
  /# tactiq/i,
  /youtube transcript/i,
];

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function overlapCount(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function overlapTokens(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  return [...a].filter((t) => b.has(t)).sort();
}

function detectMarkers(content) {
  const lower = content.toLowerCase();
  const goal = GOAL_MARKERS.filter((m) => lower.includes(m));
  const constraint = CONSTRAINT_MARKERS.filter((m) => lower.includes(m));
  const markerPositions = [];
  for (const m of [...goal, ...constraint]) {
    const idx = lower.indexOf(m);
    if (idx >= 0) markerPositions.push({ marker: m, index: idx, context: content.slice(Math.max(0, idx - 20), idx + m.length + 40) });
  }
  return { goal, constraint, markerPositions };
}

function extractQualifiers(sideA, sideB) {
  const quals = [];
  if (/\balthough\b/i.test(sideA)) quals.push({ side: "A", text: "although-clause in sideA" });
  if (/\balthough\b/i.test(sideB)) quals.push({ side: "B", text: "although-clause in sideB" });
  if (/\bbut i also\b/i.test(sideB)) quals.push({ side: "B", text: "but I also — moderated continuation, not necessarily violation" });
  if (/\bi'?m not reactive\b/i.test(sideB)) quals.push({ side: "B", text: "explicit non-reactivity" });
  if (/\bjust having fun\b/i.test(sideA)) quals.push({ side: "A", text: "situational fun framing" });
  if (/\boptimise for objectivity\b/i.test(sideA)) quals.push({ side: "A", text: "objectivity co-asserted with indifference" });
  if (/\bi did review\b/i.test(sideB)) quals.push({ side: "B", text: "partial compliance acknowledged" });
  if (/\bnot even hard\b/i.test(sideB)) quals.push({ side: "B", text: "comprehension claimed alongside retention doubt" });
  if (/\bi'?m trying to work out if i'?m lying to myself\b/i.test(sideB)) quals.push({ side: "B", text: "self-uncertainty, not firm contradiction" });
  return quals;
}

function assessSensitivity(sideA, sideB) {
  const blob = `${sideA} ${sideB}`;
  const hits = SENSITIVE.filter((re) => re.test(blob));
  return hits.length ? "elevated" : "low";
}

function assessCodingNoise(sideA, sideB, sessionLabel) {
  const blob = `${sideA} ${sideB} ${sessionLabel ?? ""}`;
  const hits = CODING.filter((re) => re.test(blob));
  if (hits.length >= 2) return { level: "high", hits: hits.map(String) };
  if (hits.length === 1) return { level: "medium", hits: hits.map(String) };
  return { level: "low", hits: [] };
}

function classifyCandidate(row) {
  const {
    sameMessage,
    sameSession,
    sideAMessageId,
    sideBMessageId,
    markers,
    overlap,
    qualifiers,
    type,
    sideA,
    sideB,
    crossSessionSideA,
    onlyGenericMarker,
    sideBIsBehavioralFailure,
    coding,
    sensitivity,
  } = row;

  // D: insufficient or misaligned
  if (!sideAMessageId && crossSessionSideA) {
    // cross session without sideA machine lineage on CN row
  }
  if (coding.level === "high") {
    return "D. INSUFFICIENT OR MISALIGNED CONTEXT";
  }
  if (sensitivity === "elevated" && !sameSession) {
    return "D. INSUFFICIENT OR MISALIGNED CONTEXT";
  }

  // C: compatible / overinterpreted
  if (onlyGenericMarker && !sideBIsBehavioralFailure) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }
  if (crossSessionSideA && overlap < 3 && !sideBIsBehavioralFailure) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }
  if (qualifiers.some((q) => q.text.includes("objectivity co-asserted")) && onlyGenericMarker) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }
  if (qualifiers.some((q) => q.text.includes("explicit non-reactivity"))) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }
  if (/\balthough I always optimise for objectivity\b/i.test(sideA) && type === "constraint_conflict") {
    if (onlyGenericMarker || !sideBIsBehavioralFailure) {
      return "C. COMPATIBLE STATES — OVERINTERPRETED";
    }
  }

  // Same sideA shared across many CNs with different sideB - likely fanout overinterpretation for constraint
  if (type === "constraint_conflict" && crossSessionSideA && onlyGenericMarker) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }

  // A: clear contradiction - same session, behavioral failure markers
  if (sameSession && sideBIsBehavioralFailure) {
    if (type === "goal_behavior_gap" && GOAL_MARKERS.some((m) => sideB.toLowerCase().includes(m))) {
      return "A. CLEAR CONTRADICTION";
    }
  }

  if (sameMessage) {
    return "D. INSUFFICIENT OR MISALIGNED CONTEXT";
  }

  // goal gap: intention vs behavior in same session
  if (sameSession && type === "goal_behavior_gap") {
    const failureVerbs = ["didn't finish", "didn't even finish", "i didn't", "i skipped", "i avoided", "i procrastinated", "already got another"];
    if (failureVerbs.some((v) => sideB.toLowerCase().includes(v))) {
      if (overlap >= 2 || (sideB.toLowerCase().includes("book") && sideA.toLowerCase().includes("book"))) {
        return "A. CLEAR CONTRADICTION";
      }
      return "B. PLAUSIBLE UNRESOLVED TENSION";
    }
  }

  if (sameSession && type === "goal_behavior_gap" && overlap >= 2) {
    if (sideB.toLowerCase().includes("wasting my time") && sideA.toLowerCase().includes("review")) {
      return "B. PLAUSIBLE UNRESOLVED TENSION";
    }
    if (sideB.toLowerCase().includes("didn't even finish")) {
      return "A. CLEAR CONTRADICTION";
    }
  }

  if (crossSessionSideA) {
    return "C. COMPATIBLE STATES — OVERINTERPRETED";
  }

  if (overlap < 2) {
    return "D. INSUFFICIENT OR MISALIGNED CONTEXT";
  }

  return "B. PLAUSIBLE UNRESOLVED TENSION";
}

function isBehavioralFailure(sideB) {
  return /\b(?:but\s+)?i\s+(?:(?:didn'?t|did not)\s+(?:finish|even|open|do|review|read|complete|start|keep|bother)|(?:skipped|avoided|procrastinated|failed|already got another))\b/i.test(
    sideB,
  );
}

function onlyGenericContrastTrigger(markers, sideB, sideBIsBehavioralFailure) {
  if (sideBIsBehavioralFailure) return false;
  const constraint = markers.constraint;
  if (constraint.length === 0) return false;
  // If ONLY "but i" matches and not goal mismatch markers
  if (markers.goal.length > 0) return false;
  // Check if "but i" appears in non-violation contexts
  const lower = sideB.toLowerCase();
  const butIIndices = [];
  let idx = 0;
  while ((idx = lower.indexOf("but i", idx)) !== -1) {
    butIIndices.push(idx);
    idx += 1;
  }
  if (butIIndices.length === 0) return false;
  // behavioral admissions with but i aren't generic-only
  return true;
}

function proofEligible(classification, row) {
  if (!["A. CLEAR CONTRADICTION", "B. PLAUSIBLE UNRESOLVED TENSION"].includes(classification)) {
    return { eligible: false, reasons: [`classification=${classification}`] };
  }
  if (classification === "B. PLAUSIBLE UNRESOLVED TENSION" && row.crossSessionSideA) {
    return { eligible: false, reasons: ["weak B cross-session"] };
  }
  if (row.onlyGenericMarker) {
    return { eligible: false, reasons: ["generic contrast marker only"] };
  }
  if (row.existingModelUpdateCount > 0) {
    return { eligible: false, reasons: ["existing MU"] };
  }
  if (row.openDuplicate) {
    return { eligible: false, reasons: ["open duplicate"] };
  }
  if (row.sensitivity === "elevated") {
    return { eligible: false, reasons: ["sensitivity"] };
  }
  if (row.coding.level === "high" || row.coding.level === "medium") {
    return { eligible: false, reasons: [`coding=${row.coding.level}`] };
  }
  if (row.crossSessionSideA && !row.sideAMachineLineage) {
    return { eligible: false, reasons: ["cross-session without sideA lineage on CN"] };
  }
  if (row.inspectorLineageMisleading) {
    return { eligible: false, reasons: ["inspector lineage misleading"] };
  }
  if (classification === "B. PLAUSIBLE UNRESOLVED TENSION" && row.sameSessionSideBShared) {
    return { eligible: false, reasons: ["ambiguous same-message-id sibling CN"] };
  }
  return { eligible: true, reasons: [] };
}

async function main() {
  const db = new PrismaClient();
  const queriedAt = new Date().toISOString();

  const refs = await db.referenceItem.findMany({
    where: { userId: KAY, type: { in: ["goal", "constraint"] } },
    select: {
      id: true,
      type: true,
      statement: true,
      status: true,
      sourceSessionId: true,
      sourceMessageId: true,
      sourceSession: { select: { label: true } },
    },
  });

  const refByStatement = new Map();
  for (const r of refs) {
    const key = normalize(r.statement);
    if (!refByStatement.has(key)) refByStatement.set(key, r);
  }

  const rows = await db.contradictionNode.findMany({
    where: {
      userId: KAY,
      status: "candidate",
      sourceSession: { origin: "IMPORTED_ARCHIVE" },
    },
    select: {
      id: true,
      type: true,
      title: true,
      sideA: true,
      sideB: true,
      confidence: true,
      sourceSessionId: true,
      sourceMessageId: true,
      sourceSession: { select: { label: true } },
      sourceMessage: { select: { id: true, content: true, role: true, sessionId: true } },
      evidence: { select: { quote: true, messageId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const sideBUsage = new Map();
  for (const row of rows) {
    const k = normalize(row.sideB);
    sideBUsage.set(k, (sideBUsage.get(k) || 0) + 1);
  }

  const openNodes = await db.contradictionNode.findMany({
    where: { userId: KAY, status: "open" },
    select: { id: true, sideA: true, sideB: true },
  });

  const audited = [];

  for (const row of rows) {
    const sideA = row.sideA.trim();
    const sideB = row.sideB.trim();
    const sideBMsg = row.sourceMessage;
    const sideBMessageId = row.sourceMessageId;
    const sideBSessionId = row.sourceSessionId;

    const refMatch = refByStatement.get(normalize(sideA)) ?? refs.find((r) => r.statement.trim() === sideA);
    const sideAMessageId = refMatch?.sourceMessageId ?? null;
    const sideASessionId = refMatch?.sourceSessionId ?? null;

    let sideAMessage = null;
    if (sideAMessageId) {
      sideAMessage = await db.message.findUnique({
        where: { id: sideAMessageId },
        select: { id: true, content: true, role: true, sessionId: true },
      });
    }

    const sameMessage = sideAMessageId && sideBMessageId && sideAMessageId === sideBMessageId;
    const sameSession = sideASessionId && sideBSessionId && sideASessionId === sideBSessionId;
    const crossSessionSideA = Boolean(sideASessionId && sideBSessionId && sideASessionId !== sideBSessionId);

    const markers = detectMarkers(sideB);
    const sideBIsBehavioralFailure = isBehavioralFailure(sideB);
    const onlyGenericMarker = onlyGenericContrastTrigger(markers, sideB, sideBIsBehavioralFailure);
    const overlap = overlapCount(sideA, sideB);
    const sharedTokens = overlapTokens(sideA, sideB);
    const qualifiers = extractQualifiers(sideA, sideB);
    const sensitivity = assessSensitivity(sideA, sideB);
    const coding = assessCodingNoise(sideA, sideB, row.sourceSession?.label);

    const [uelCount, muCount] = await Promise.all([
      db.understandingEvidenceLink.count({
        where: { userId: KAY, targetType: "contradiction_node", targetId: row.id },
      }),
      db.modelUpdate.count({
        where: {
          userId: KAY,
          affectedObjectType: "contradiction_node",
          affectedObjectId: row.id,
        },
      }),
    ]);

    const openDuplicate = openNodes.some(
      (o) => normalize(o.sideA) === normalize(sideA) && normalize(o.sideB) === normalize(sideB),
    );

    const sideAMachineLineage = Boolean(refMatch?.sourceMessageId && refMatch?.sourceSessionId);
    const cnRowLineageSideBOnly = crossSessionSideA;
    const inspectorLineageMisleading = crossSessionSideA;

    const detectorRule =
      row.type === "goal_behavior_gap"
        ? markers.goal.length
          ? `goal_behavior_gap:${markers.goal.join(",")}`
          : "goal_behavior_gap:unknown"
        : markers.constraint.length
          ? `constraint_conflict:${markers.constraint.join(",")}`
          : "constraint_conflict:unknown";

    const auditRow = {
      id: row.id,
      reviewKey: `contradiction_node:${row.id}`,
      type: row.type,
      confidence: row.confidence,
      title: row.title,
      sideA,
      sideB,
      sideASource: {
        referenceItemId: refMatch?.id ?? null,
        messageId: sideAMessageId,
        sessionId: sideASessionId,
        sessionLabel: refMatch?.sourceSession?.label ?? null,
        passage: sideAMessage?.content ?? (refMatch ? refMatch.statement : null),
        machineReadableLineage: sideAMachineLineage,
      },
      sideBSource: {
        messageId: sideBMessageId,
        sessionId: sideBSessionId,
        sessionLabel: row.sourceSession?.label ?? null,
        passage: sideBMsg?.content ?? sideB,
      },
      sameMessage,
      sameSession,
      crossSessionSideA,
      cnSourceMetadataRepresents: "sideB only (sourceSessionId/sourceMessageId on CN row)",
      sideAMachineLineage,
      inspectorLineageMisleading,
      detectorRule,
      markerContexts: markers.markerPositions,
      tokenOverlapCount: overlap,
      tokenOverlapSample: sharedTokens.slice(0, 12),
      qualifiers,
      sideBIsBehavioralFailure,
      onlyGenericMarker,
      intentionVsBehavior: row.type === "goal_behavior_gap",
      goalVsObstacle: /\bwasting my time\b/i.test(sideB) || /\bdidn'?t finish\b/i.test(sideB),
      coding,
      sensitivity,
      contradictionEvidenceCount: row.evidence.length,
      linkedUelCount: uelCount,
      existingModelUpdateCount: muCount,
      openDuplicate,
      sameSessionSideBShared: (sideBUsage.get(normalize(sideB)) || 0) > 1,
    };

    auditRow.classification = classifyCandidate(auditRow);
    auditRow.proofEligibility = proofEligible(auditRow.classification, auditRow);

    auditRow.uiIdentifyingText = {
      theirWordsExcerpt: (row.evidence[0]?.quote ?? sideB).slice(0, 160),
      proposed: row.title,
      metadataConversation: sideBSessionId?.slice(0, 12) + "…",
      metadataMessage: sideBMessageId?.slice(0, 12) + "…",
    };

    audited.push(auditRow);
  }

  const eligible = audited.filter((a) => a.proofEligibility.eligible);
  eligible.sort((a, b) => {
    const score = (x) =>
      (x.classification.startsWith("A") ? 20 : 10) +
      (x.sameSession ? 8 : 0) +
      (x.sameMessage ? 4 : 0) +
      (x.sideBIsBehavioralFailure ? 6 : 0) +
      -x.onlyGenericMarker * 10 +
      x.tokenOverlapCount;
    return score(b) - score(a);
  });

  const revisedShortlist = eligible.slice(0, 5);
  if (revisedShortlist.length === 0) {
    // fallback: best non-C/D for documentation, not eligibility
    const fallbackRank = [...audited]
      .filter((a) => a.classification === "A. CLEAR CONTRADICTION" || a.classification === "B. PLAUSIBLE UNRESOLVED TENSION")
      .sort((a, b) => {
        const score = (x) =>
          (x.sameSession ? 10 : 0) + (x.sideBIsBehavioralFailure ? 5 : 0) + x.tokenOverlapCount;
        return score(b) - score(a);
      })
      .slice(0, 5)
      .map((x, i) => ({ ...x, documentationRank: i + 1, proofEligible: false }));
    revisedShortlist.push(...fallbackRank.slice(0, Math.max(0, 5 - revisedShortlist.length)));
  }

  revisedShortlist.forEach((x, i) => {
    x.recommendationRank = i + 1;
  });

  const recommended =
    eligible.length > 0 && eligible[0].classification === "A. CLEAR CONTRADICTION"
      ? eligible[0]
      : eligible.find((e) => e.classification === "A. CLEAR CONTRADICTION") ??
        (eligible.length === 1 && eligible[0].classification === "B. PLAUSIBLE UNRESOLVED TENSION" && eligible[0].sameSession && eligible[0].sideBIsBehavioralFailure
          ? eligible[0]
          : null);

  const out = {
    campaign: "SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001",
    phase: "A2",
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    disqualifiedId: "cmp2fvq8f00aoqlsyy9z3sckc",
    disqualifiedClassification: "C. COMPATIBLE STATES — OVERINTERPRETED",
    totalCandidates: audited.length,
    classificationCounts: audited.reduce((m, a) => {
      m[a.classification] = (m[a.classification] || 0) + 1;
      return m;
    }, {}),
    proofEligibleCount: eligible.length,
    allCandidates: audited,
    revisedShortlist: revisedShortlist.slice(0, 5),
    recommended: recommended
      ? {
          id: recommended.id,
          reviewKey: recommended.reviewKey,
          classification: recommended.classification,
          sameSession: recommended.sameSession,
          sameMessage: recommended.sameMessage,
          sideA: recommended.sideA,
          sideB: recommended.sideB,
        }
      : null,
  };

  const jsonPath = join(OUT_DIR, "revised-candidate-shortlist.json");
  writeFileSync(jsonPath, serialize(out));
  console.log("Wrote", jsonPath);
  console.log(
    serialize({
      counts: out.classificationCounts,
      proofEligibleCount: out.proofEligibleCount,
      recommended: out.recommended?.id ?? null,
      top3: revisedShortlist.slice(0, 3).map((s) => ({
        id: s.id,
        class: s.classification,
        eligible: s.proofEligibility?.eligible,
        sameSession: s.sameSession,
      })),
    }),
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
