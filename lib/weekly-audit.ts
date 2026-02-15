import prismadb from "./prismadb";
import { getTopContradictions, type ContradictionTopDb } from "./contradiction-top";

type WeeklyAuditMetricsDb = ContradictionTopDb & {
  referenceItem: {
    count: (args: { where: { userId: string; status?: "active" } }) => Promise<number>;
  };
  contradictionNode: ContradictionTopDb["contradictionNode"] & {
    count: (args: {
      where:
        | { userId: string }
        | { userId: string; status: { in: Array<"open" | "explored"> } };
    }) => Promise<number>;
    aggregate: (args: {
      where: { userId: string };
      _sum: { avoidanceCount: true; snoozeCount: true };
    }) => Promise<{ _sum: { avoidanceCount: number | null; snoozeCount: number | null } }>;
  };
};

type WeeklyAuditEnsureDb = WeeklyAuditMetricsDb & {
  weeklyAudit: {
    findUnique: (args: {
      where: { userId_weekStart: { userId: string; weekStart: Date } };
      select?: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: WeeklyAuditInput }) => Promise<{ id: string }>;
  };
};

export type WeeklyAuditInput = {
  userId: string;
  weekStart: Date;
  activeReferenceCount: number;
  openContradictionCount: number;
  totalContradictionCount: number;
  top3AvgComputedWeight: number;
  top3Ids: string[];
  totalAvoidanceCount: number;
  totalSnoozeCount: number;
  contradictionDensity: number;
  stabilityProxy: number;
  top3Snapshot: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    recommendedRung: string | null;
    lastEvidenceAt: string | null;
    computedWeight: number;
    sideA: string;
    sideB: string;
  }>;
};

const truncate = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};

export function getWeekStart(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const weekday = start.getUTCDay();
  const offsetToMonday = (weekday + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offsetToMonday);
  return start;
}

export function addWeeks(date: Date, weeksDelta: number): Date {
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + weeksDelta * 7);
  return shifted;
}

export async function buildWeeklyAudit(
  userId: string,
  now: Date = new Date(),
  db: WeeklyAuditMetricsDb = prismadb
): Promise<WeeklyAuditInput> {
  const weekStart = getWeekStart(now);
  const [
    activeReferenceCount,
    openContradictionCount,
    totalContradictionCount,
    sumCounts,
    top3,
  ] = await Promise.all([
    db.referenceItem.count({
      where: { userId, status: "active" },
    }),
    db.contradictionNode.count({
      where: { userId, status: { in: ["open", "explored"] } },
    }),
    db.contradictionNode.count({
      where: { userId },
    }),
    db.contradictionNode.aggregate({
      where: { userId },
      _sum: { avoidanceCount: true, snoozeCount: true },
    }),
    getTopContradictions(userId, now, db),
  ]);

  const top3AvgComputedWeight =
    top3.length === 0
      ? 0
      : top3.reduce((sum, item) => sum + item.computedWeight, 0) / top3.length;
  const contradictionDensity = openContradictionCount / (activeReferenceCount + 1);
  const stabilityProxy = 1 / (1 + contradictionDensity);

  return {
    userId,
    weekStart,
    activeReferenceCount,
    openContradictionCount,
    totalContradictionCount,
    top3AvgComputedWeight,
    top3Ids: top3.map((item) => item.id),
    totalAvoidanceCount: sumCounts._sum.avoidanceCount ?? 0,
    totalSnoozeCount: sumCounts._sum.snoozeCount ?? 0,
    contradictionDensity,
    stabilityProxy,
    top3Snapshot: top3.map((item) => ({
      id: item.id,
      title: truncate(item.title, 180),
      type: item.type,
      status: item.status,
      recommendedRung: item.recommendedRung,
      lastEvidenceAt: item.lastEvidenceAt ? item.lastEvidenceAt.toISOString() : null,
      computedWeight: item.computedWeight,
      sideA: truncate(item.sideA, 240),
      sideB: truncate(item.sideB, 240),
    })),
  };
}

const isUniqueConstraintError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" && maybeCode === "P2002";
};

export async function ensureWeeklyAuditForCurrentWeek(
  userId: string,
  now: Date = new Date(),
  db: WeeklyAuditEnsureDb = prismadb
): Promise<void> {
  await ensureWeeklyAuditForWeekStart(userId, now, db);
}

export async function ensureWeeklyAuditForWeekStart(
  userId: string,
  targetNow: Date,
  db: WeeklyAuditEnsureDb = prismadb
): Promise<{ weekStart: Date; created: boolean }> {
  const weekStart = getWeekStart(targetNow);
  const existing = await db.weeklyAudit.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { weekStart, created: false };
  }

  const auditData = await buildWeeklyAudit(userId, targetNow, db);

  try {
    await db.weeklyAudit.create({
      data: auditData,
    });
    return { weekStart, created: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { weekStart, created: false };
    }

    throw error;
  }
}
