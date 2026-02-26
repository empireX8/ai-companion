import type { PrismaClient, ProbeRung } from "@prisma/client";

import prismadb from "./prismadb";

// ── Tuning constants ──────────────────────────────────────────────────────────
const LEVEL1_MIN_EVIDENCE = 2;
const LEVEL2_MIN_EVIDENCE = 4;
const LEVEL2_MIN_SESSIONS = 2;
const LEVEL3_MIN_EVIDENCE = 7;
const LEVEL3_MIN_SESSIONS = 3;
const LEVEL3_MIN_DAYS = 14;
const LEVEL4_MIN_EVIDENCE = 12;
const LEVEL4_MIN_SESSIONS = 4;
const LEVEL4_MIN_DAYS = 30;
const UPDATE_BATCH_SIZE = 200;

const ELIGIBLE_STATUSES = ["open", "explored"] as const;

// ── Internal types ────────────────────────────────────────────────────────────
// Resolved evidence row: historical timestamp + best-effort sessionId
type EvidenceRow = {
  nodeId: string;
  sessionId: string | null;
  createdAt: Date; // message.createdAt if available, else evidence.createdAt
};

type NodeStats = {
  totalEvidence: number;
  distinctSessions: number;
  daysSpan: number;
  temporalSpacingOk: boolean;
};

// ── Pure computation helpers ──────────────────────────────────────────────────
function computeStatsFromEvidence(rows: EvidenceRow[]): NodeStats {
  if (rows.length === 0) {
    return { totalEvidence: 0, distinctSessions: 0, daysSpan: 0, temporalSpacingOk: false };
  }

  const totalEvidence = rows.length;
  const distinctSessions = new Set(rows.filter((r) => r.sessionId).map((r) => r.sessionId!)).size;

  const timestamps = rows.map((r) => r.createdAt.getTime());
  const daysSpan = (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24);
  const temporalSpacingOk = distinctSessions >= 2 || daysSpan >= 2;

  return { totalEvidence, distinctSessions, daysSpan, temporalSpacingOk };
}

export function computeEscalationLevelFromEvidence(stats: NodeStats): number {
  const { totalEvidence, distinctSessions, daysSpan, temporalSpacingOk } = stats;

  if (
    totalEvidence >= LEVEL4_MIN_EVIDENCE &&
    distinctSessions >= LEVEL4_MIN_SESSIONS &&
    daysSpan >= LEVEL4_MIN_DAYS
  ) {
    return 4;
  }
  if (
    totalEvidence >= LEVEL3_MIN_EVIDENCE &&
    distinctSessions >= LEVEL3_MIN_SESSIONS &&
    daysSpan >= LEVEL3_MIN_DAYS
  ) {
    return 3;
  }
  if (totalEvidence >= LEVEL2_MIN_EVIDENCE && distinctSessions >= LEVEL2_MIN_SESSIONS) {
    return 2;
  }
  if (totalEvidence >= LEVEL1_MIN_EVIDENCE && temporalSpacingOk) {
    return 1;
  }
  return 0;
}

export function escalationLevelToRung(level: number): ProbeRung {
  if (level >= 4) return "rung5_structured_probe_offer";
  if (level === 3) return "rung4_forced_choice_framing";
  if (level === 2) return "rung3_evidence_pressure";
  if (level === 1) return "rung2_explicit_contradiction";
  return "rung1_gentle_mirror";
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function reconcileImportedStructureForUser({
  userId,
  db = prismadb,
}: {
  userId: string;
  db?: PrismaClient;
}): Promise<{ updatedNodes: number }> {
  const nodes = await db.contradictionNode.findMany({
    where: { userId, status: { in: [...ELIGIBLE_STATUSES] } },
    select: { id: true, escalationLevel: true, recommendedRung: true },
  });

  if (nodes.length === 0) {
    return { updatedNodes: 0 };
  }

  const rawEvidence = await db.contradictionEvidence.findMany({
    where: { nodeId: { in: nodes.map((n) => n.id) } },
    select: { nodeId: true, sessionId: true, createdAt: true, messageId: true },
  });

  // Bulk-fetch message timestamps so we can use the historical conversation time
  // rather than evidence.createdAt which is always the import-run time.
  // ContradictionEvidence has no Prisma relation to Message, so we join manually.
  const messageIds = [
    ...new Set(rawEvidence.filter((e) => e.messageId).map((e) => e.messageId!)),
  ];
  const messageMap = new Map<string, { createdAt: Date; sessionId: string }>();
  if (messageIds.length > 0) {
    const messages = await db.message.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, createdAt: true, sessionId: true },
    });
    for (const m of messages) {
      messageMap.set(m.id, { createdAt: m.createdAt, sessionId: m.sessionId });
    }
  }

  // Resolve each evidence row to a historical timestamp and best-effort sessionId
  const resolvedEvidence: EvidenceRow[] = rawEvidence.map((e) => {
    const msg = e.messageId ? messageMap.get(e.messageId) : undefined;
    return {
      nodeId: e.nodeId,
      // evidence.sessionId first; fall back to message.sessionId for completeness
      sessionId: e.sessionId ?? msg?.sessionId ?? null,
      // prefer the original conversation timestamp over insert time
      createdAt: msg?.createdAt ?? e.createdAt,
    };
  });

  // Group resolved evidence by nodeId
  const evidenceByNode = new Map<string, EvidenceRow[]>();
  for (const row of resolvedEvidence) {
    const bucket = evidenceByNode.get(row.nodeId) ?? [];
    bucket.push(row);
    evidenceByNode.set(row.nodeId, bucket);
  }

  // Compute updates — only collect nodes whose stored values differ
  const updates: Array<{ id: string; escalationLevel: number; recommendedRung: ProbeRung }> = [];

  for (const node of nodes) {
    const stats = computeStatsFromEvidence(evidenceByNode.get(node.id) ?? []);
    const newLevel = computeEscalationLevelFromEvidence(stats);
    const newRung = escalationLevelToRung(newLevel);

    if (newLevel !== node.escalationLevel || newRung !== node.recommendedRung) {
      updates.push({ id: node.id, escalationLevel: newLevel, recommendedRung: newRung });
    }
  }

  if (updates.length === 0) {
    return { updatedNodes: 0 };
  }

  // Batch-update in chunks — lastTouchedAt intentionally not touched
  for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
    const slice = updates.slice(i, i + UPDATE_BATCH_SIZE);
    await db.$transaction(
      slice.map((u) =>
        db.contradictionNode.update({
          where: { id: u.id },
          data: { escalationLevel: u.escalationLevel, recommendedRung: u.recommendedRung },
        })
      )
    );
  }

  return { updatedNodes: updates.length };
}

export async function reconcileImportedStructureForSession({
  importUploadSessionId,
  db = prismadb,
}: {
  importUploadSessionId: string;
  db?: PrismaClient;
}): Promise<{ updatedNodes: number }> {
  const session = await db.importUploadSession.findUnique({
    where: { id: importUploadSessionId },
    select: { userId: true },
  });

  if (!session) {
    throw new Error(`Import upload session not found: ${importUploadSessionId}`);
  }

  return reconcileImportedStructureForUser({ userId: session.userId, db });
}
