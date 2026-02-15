import type { ContradictionStatus, ProbeRung, ReferenceConfidence } from "@prisma/client";

import prismadb from "./prismadb";
import {
  computeEscalationLevel,
  computeRecommendedRung,
  shouldEscalate,
} from "./contradiction-escalation";
import { computeSalience, isTop3Eligible } from "./contradiction-salience";

type TopEligibleStatus = "open" | "snoozed" | "explored";

const TOP_ELIGIBLE_STATUSES: TopEligibleStatus[] = ["open", "snoozed", "explored"];

type SurfaceCandidate = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  confidence: ReferenceConfidence;
  status: ContradictionStatus;
  recommendedRung: ProbeRung | null;
  snoozeCount: number;
  avoidanceCount: number;
  evidenceCount: number;
  timesSurfaced: number;
  escalationLevel: number;
  lastEscalatedAt: Date | null;
  lastEvidenceAt: Date | null;
  lastTouchedAt: Date;
  snoozedUntil: Date | null;
};

type ContradictionNodeRepo = {
  findMany: (args: {
    where: { userId: string; status: { in: TopEligibleStatus[] } };
    orderBy: { lastTouchedAt: "desc" };
    take: number;
    select: {
      id: true;
      title: true;
      sideA: true;
      sideB: true;
      type: true;
      confidence: true;
      status: true;
      recommendedRung: true;
      snoozeCount: true;
      avoidanceCount: true;
      evidenceCount: true;
      timesSurfaced: true;
      escalationLevel: true;
      lastEscalatedAt: true;
      lastEvidenceAt: true;
      lastTouchedAt: true;
      snoozedUntil: true;
    };
  }) => Promise<SurfaceCandidate[]>;
  update?: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

type ContradictionSurfaceTxDb = {
  contradictionNode: ContradictionNodeRepo;
};

export type ContradictionSurfaceDb = {
  contradictionNode: ContradictionNodeRepo;
  $transaction?: <T>(fn: (tx: ContradictionSurfaceTxDb) => Promise<T>) => Promise<T>;
};

export type TopContradiction = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  confidence: ReferenceConfidence;
  status: ContradictionStatus;
  recommendedRung: ProbeRung | null;
  lastEvidenceAt: Date | null;
  lastTouchedAt: Date;
  computedWeight: number;
};

export type ContradictionSurfacingMode = "read_only" | "recorded";

export async function getTop3WithOptionalSurfacing({
  userId,
  mode = "read_only",
  now = new Date(),
  db = prismadb as unknown as ContradictionSurfaceDb,
}: {
  userId: string;
  mode?: ContradictionSurfacingMode;
  now?: Date;
  db?: ContradictionSurfaceDb;
}): Promise<{ items: TopContradiction[]; surfacedIds: string[] }> {
  const candidates = await db.contradictionNode.findMany({
    where: {
      userId,
      status: { in: TOP_ELIGIBLE_STATUSES },
    },
    orderBy: {
      lastTouchedAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      title: true,
      sideA: true,
      sideB: true,
      type: true,
      confidence: true,
      status: true,
      recommendedRung: true,
      snoozeCount: true,
      avoidanceCount: true,
      evidenceCount: true,
      timesSurfaced: true,
      escalationLevel: true,
      lastEscalatedAt: true,
      lastEvidenceAt: true,
      lastTouchedAt: true,
      snoozedUntil: true,
    },
  });

  const weightedAll = candidates.map((candidate) => ({
    ...candidate,
    computedWeight: computeSalience(
      {
        status: candidate.status as TopEligibleStatus,
        snoozeCount: candidate.snoozeCount,
        evidenceCount: candidate.evidenceCount,
        lastEvidenceAt: candidate.lastEvidenceAt,
        lastTouchedAt: candidate.lastTouchedAt,
      },
      now
    ),
  }));

  const items = weightedAll
    .filter((candidate) => TOP_ELIGIBLE_STATUSES.includes(candidate.status as TopEligibleStatus))
    .filter((candidate) =>
      isTop3Eligible(
        {
          status: candidate.status as TopEligibleStatus,
          snoozedUntil: candidate.snoozedUntil,
        },
        now
      )
    )
    .sort((left, right) => {
      if (right.computedWeight !== left.computedWeight) {
        return right.computedWeight - left.computedWeight;
      }

      return right.lastTouchedAt.getTime() - left.lastTouchedAt.getTime();
    })
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      sideA: item.sideA,
      sideB: item.sideB,
      type: item.type,
      confidence: item.confidence,
      status: item.status,
      recommendedRung: item.recommendedRung,
      lastEvidenceAt: item.lastEvidenceAt,
      lastTouchedAt: item.lastTouchedAt,
      computedWeight: item.computedWeight,
    }));

  const topIds = items.map((item) => item.id);
  if (mode === "read_only" || topIds.length === 0) {
    return {
      items,
      surfacedIds: [],
    };
  }

  const weightedById = new Map(weightedAll.map((item) => [item.id, item.computedWeight]));
  const candidateById = new Map(weightedAll.map((item) => [item.id, item]));
  const topIdSet = new Set(topIds);

  if (!db.$transaction || !db.contradictionNode.update) {
    throw new Error("Recorded mode requires transaction and update support");
  }

  await db.$transaction(async (tx) => {
    if (!tx.contradictionNode.update) {
      throw new Error("Recorded mode requires transactional update support");
    }
    const updateNode = tx.contradictionNode.update;

    await Promise.all(
      weightedAll.map((candidate) =>
        updateNode({
          where: { id: candidate.id },
          data: {
            weight: weightedById.get(candidate.id) ?? 0,
          },
        })
      )
    );

    await Promise.all(
      topIds.map((id) => {
        const candidate = candidateById.get(id);
        if (!candidate) {
          return Promise.resolve(null);
        }

        const nextLevel = computeEscalationLevel(
          {
            snoozeCount: candidate.snoozeCount,
            avoidanceCount: candidate.avoidanceCount,
            timesSurfaced: candidate.timesSurfaced + 1,
            lastEscalatedAt: candidate.lastEscalatedAt,
            lastTouchedAt: candidate.lastTouchedAt,
            lastEvidenceAt: candidate.lastEvidenceAt,
          },
          now
        );
        const escalatedNow = shouldEscalate(
          candidate.escalationLevel,
          nextLevel,
          candidate.lastEscalatedAt,
          now
        );

        return updateNode({
          where: { id },
          data: {
            timesSurfaced: { increment: 1 },
            lastSurfacedAt: now,
            escalationLevel: nextLevel,
            recommendedRung: computeRecommendedRung(nextLevel),
            lastEscalatedAt: escalatedNow ? now : undefined,
          },
        });
      })
    );
  });

  return {
    items,
    surfacedIds: items.filter((item) => topIdSet.has(item.id)).map((item) => item.id),
  };
}
