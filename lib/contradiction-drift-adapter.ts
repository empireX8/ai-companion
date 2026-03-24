/**
 * Contradiction Drift Adapter (P3-04)
 *
 * Adapts the existing ContradictionNode infrastructure into PatternClaim clues
 * for the contradiction_drift pattern type.
 *
 * Does NOT build a second contradiction detector. Reads the existing
 * contradiction data that the infrastructure has already produced and
 * evaluates whether a recurring drift pattern warrants a PatternClaim.
 *
 * A "contradiction drift" pattern is present when a user has multiple
 * open or escalated contradictions of the same type across sessions,
 * indicating a systematic drift rather than an isolated conflict.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";
import type { PatternClue } from "./pattern-claim-lifecycle";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum total qualifying contradictions before any drift clues are emitted. */
const DRIFT_MIN_TOTAL = 3;

/** Minimum number of contradictions of the same type to constitute a type-level drift. */
const DRIFT_MIN_PER_TYPE = 2;

/** Only consider contradictions with escalation >= this level. */
const DRIFT_MIN_ESCALATION = 1;

// ── Adapter ───────────────────────────────────────────────────────────────────

export type ContradictionDriftInput = {
  userId: string;
  db?: PrismaClient;
};

type ContradictionRow = {
  id: string;
  type: string;
  title: string;
  escalationLevel: number;
  weight: number;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  evidence: Array<{
    quote: string | null;
    sessionId: string | null;
    messageId: string | null;
  }>;
};

/**
 * Read the user's existing ContradictionNode data and return PatternClue
 * instances for contradiction_drift if the pattern is present.
 *
 * Returns an empty array when the pattern is absent.
 */
export async function deriveContradictionDriftClues({
  userId,
  db = prismadb,
}: ContradictionDriftInput): Promise<PatternClue[]> {
  const nodes = (await db.contradictionNode.findMany({
    where: {
      userId,
      status: { in: ["open", "explored", "snoozed"] },
      escalationLevel: { gte: DRIFT_MIN_ESCALATION },
    },
    select: {
      id: true,
      type: true,
      title: true,
      escalationLevel: true,
      weight: true,
      sourceSessionId: true,
      sourceMessageId: true,
      evidence: {
        select: { quote: true, sessionId: true, messageId: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ escalationLevel: "desc" }, { weight: "desc" }],
  })) as ContradictionRow[];

  if (nodes.length < DRIFT_MIN_TOTAL) {
    return [];
  }

  // Group by contradiction type
  const byType = new Map<string, ContradictionRow[]>();
  for (const node of nodes) {
    const existing = byType.get(node.type) ?? [];
    existing.push(node);
    byType.set(node.type, existing);
  }

  const clues: PatternClue[] = [];

  for (const [type, group] of byType) {
    if (group.length < DRIFT_MIN_PER_TYPE) continue;

    const representative = group[0]!;
    const recentEvidence = representative.evidence[0];

    clues.push({
      userId,
      patternType: "contradiction_drift",
      summary: `Recurring ${type.replace(/_/g, " ")} across ${group.length} contradictions`,
      sessionId:
        recentEvidence?.sessionId ??
        representative.sourceSessionId ??
        undefined,
      messageId:
        recentEvidence?.messageId ??
        representative.sourceMessageId ??
        undefined,
      quote: recentEvidence?.quote ?? undefined,
    });
  }

  return clues;
}
