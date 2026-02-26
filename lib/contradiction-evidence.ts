import type { PrismaClient } from "@prisma/client";

import {
  computeEscalationLevel,
  computeRecommendedRung,
  shouldEscalate,
} from "./contradiction-escalation";
import prismadb from "./prismadb";

export type EvidenceSource = "user_input" | "reflection" | "session";

export type AddEvidenceParams = {
  userId: string;
  contradictionId: string;
  source: EvidenceSource;
  note: string;
  sessionId?: string;
  now?: Date;
  db?: PrismaClient;
};

export type AddEvidenceResult = {
  evidence: {
    id: string;
    createdAt: Date;
    source: string;
    quote: string | null;
    sessionId: string | null;
  };
  node: {
    evidenceCount: number;
    lastEvidenceAt: Date | null;
    lastTouchedAt: Date;
    escalationLevel: number;
    recommendedRung: string | null;
  };
};

export async function addEvidenceToContradiction({
  userId,
  contradictionId,
  source,
  note,
  sessionId,
  now = new Date(),
  db = prismadb,
}: AddEvidenceParams): Promise<AddEvidenceResult> {
  const existing = await db.contradictionNode.findFirst({
    where: { id: contradictionId, userId },
    select: {
      id: true,
      snoozeCount: true,
      avoidanceCount: true,
      timesSurfaced: true,
      lastEscalatedAt: true,
      lastTouchedAt: true,
      lastEvidenceAt: true,
      escalationLevel: true,
    },
  });

  if (!existing) {
    throw new EvidenceNodeNotFoundError();
  }

  return db.$transaction(async (tx) => {
    const evidence = await tx.contradictionEvidence.create({
      data: {
        nodeId: contradictionId,
        source,
        quote: note,
        sessionId: sessionId ?? null,
      },
      select: {
        id: true,
        createdAt: true,
        source: true,
        quote: true,
        sessionId: true,
      },
    });

    const updated = await tx.contradictionNode.update({
      where: { id: contradictionId },
      data: {
        evidenceCount: { increment: 1 },
        lastEvidenceAt: now,
        lastTouchedAt: now,
      },
      select: {
        snoozeCount: true,
        avoidanceCount: true,
        timesSurfaced: true,
        lastEscalatedAt: true,
        lastTouchedAt: true,
        lastEvidenceAt: true,
        escalationLevel: true,
        evidenceCount: true,
        recommendedRung: true,
      },
    });

    const nextLevel = computeEscalationLevel(
      {
        snoozeCount: updated.snoozeCount,
        avoidanceCount: updated.avoidanceCount,
        timesSurfaced: updated.timesSurfaced,
        lastEscalatedAt: updated.lastEscalatedAt,
        lastTouchedAt: updated.lastTouchedAt,
        lastEvidenceAt: updated.lastEvidenceAt,
      },
      now
    );
    const escalatedNow = shouldEscalate(
      updated.escalationLevel,
      nextLevel,
      updated.lastEscalatedAt,
      now
    );

    const finalNode = await tx.contradictionNode.update({
      where: { id: contradictionId },
      data: {
        escalationLevel: nextLevel,
        recommendedRung: computeRecommendedRung(nextLevel),
        ...(escalatedNow ? { lastEscalatedAt: now } : {}),
      },
      select: {
        evidenceCount: true,
        lastEvidenceAt: true,
        lastTouchedAt: true,
        escalationLevel: true,
        recommendedRung: true,
      },
    });

    return { evidence, node: finalNode };
  });
}

export class EvidenceNodeNotFoundError extends Error {
  status = 404;
  code = "CONTRADICTION_NOT_FOUND";

  constructor() {
    super("Contradiction not found");
  }
}
