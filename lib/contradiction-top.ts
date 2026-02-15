import type { ContradictionStatus, ProbeRung, ReferenceConfidence } from "@prisma/client";

import {
  getTop3WithOptionalSurfacing,
  type ContradictionSurfaceDb,
} from "./contradiction-surface";

type TopEligibleStatus = "open" | "snoozed" | "explored";

export type ContradictionTopDb = {
  contradictionNode: {
    findMany: (args: {
      where: {
        userId: string;
        status: { in: TopEligibleStatus[] };
      };
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
        weight: true;
        snoozeCount: true;
        evidenceCount: true;
        recommendedRung: true;
        lastEvidenceAt: true;
        lastTouchedAt: true;
        snoozedUntil: true;
      };
    }) => Promise<
      Array<{
        id: string;
        title: string;
        sideA: string;
        sideB: string;
        type: string;
        confidence: ReferenceConfidence;
        status: ContradictionStatus;
        weight: number;
        snoozeCount: number;
        evidenceCount: number;
        recommendedRung: ProbeRung | null;
        lastEvidenceAt: Date | null;
        lastTouchedAt: Date;
        snoozedUntil: Date | null;
      }>
    >;
  };
};

export type TopContradiction = Awaited<ReturnType<typeof getTop3WithOptionalSurfacing>>["items"][number];

export async function getTopContradictions(
  userId: string,
  now: Date = new Date(),
  db: ContradictionTopDb
): Promise<TopContradiction[]> {
  const { items } = await getTop3WithOptionalSurfacing({
    userId,
    mode: "read_only",
    now,
    db: db as unknown as ContradictionSurfaceDb,
  });

  return items;
}
