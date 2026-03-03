import prismadb from "./prismadb";
import { getTopContradictions, type ContradictionTopDb } from "./contradiction-top";
import { InvariantViolationError, WeeklyAuditInvalidDataError } from "./invariant-errors";

export { WeeklyAuditInvalidDataError } from "./invariant-errors";

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
      select?: { id: true; status: true };
    }) => Promise<{ id: string; status: string } | null>;
    create: (args: { data: WeeklyAuditInput }) => Promise<{ id: string }>;
  };
};

export class WeeklyAuditLockedError extends InvariantViolationError {
  constructor(auditId: string) {
    super(
      `WeeklyAudit ${auditId} is locked and cannot be modified.`,
      "WEEKLY_AUDIT_LOCKED",
      { auditId }
    );
    this.name = "WeeklyAuditLockedError";
  }
}

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

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Throws WeeklyAuditLockedError if the supplied audit row is locked.
 * Use before any write that must not touch a locked record.
 */
export function assertNotLocked(audit: { id: string; status: string }): void {
  if (audit.status === "locked") {
    throw new WeeklyAuditLockedError(audit.id);
  }
}

/**
 * Validates that a WeeklyAuditInput satisfies all structural invariants.
 * Throws WeeklyAuditInvalidDataError for any violation.
 *
 * Invariants enforced:
 *  - Integer counters >= 0
 *  - top3AvgComputedWeight >= 0
 *  - contradictionDensity >= 0
 *  - stabilityProxy in [0, 1]
 *  - top3Ids length <= 3 (reject if > 3)
 *  - top3Ids must not contain duplicate ids
 *  - weekStart must be a Monday at 00:00 UTC
 */
export function assertValidWeeklyAuditData(data: WeeklyAuditInput): void {
  const integerCounters: Array<[string, number]> = [
    ["activeReferenceCount", data.activeReferenceCount],
    ["openContradictionCount", data.openContradictionCount],
    ["totalContradictionCount", data.totalContradictionCount],
    ["totalAvoidanceCount", data.totalAvoidanceCount],
    ["totalSnoozeCount", data.totalSnoozeCount],
  ];

  for (const [field, value] of integerCounters) {
    if (!Number.isInteger(value) || value < 0) {
      throw new WeeklyAuditInvalidDataError(
        `${field} must be a non-negative integer (got ${value})`,
        { field, value }
      );
    }
  }

  if (!Number.isFinite(data.top3AvgComputedWeight) || data.top3AvgComputedWeight < 0) {
    throw new WeeklyAuditInvalidDataError(
      `top3AvgComputedWeight must be >= 0 (got ${data.top3AvgComputedWeight})`,
      { field: "top3AvgComputedWeight", value: data.top3AvgComputedWeight }
    );
  }

  if (!Number.isFinite(data.contradictionDensity) || data.contradictionDensity < 0) {
    throw new WeeklyAuditInvalidDataError(
      `contradictionDensity must be >= 0 (got ${data.contradictionDensity})`,
      { field: "contradictionDensity", value: data.contradictionDensity }
    );
  }

  if (
    !Number.isFinite(data.stabilityProxy) ||
    data.stabilityProxy < 0 ||
    data.stabilityProxy > 1
  ) {
    throw new WeeklyAuditInvalidDataError(
      `stabilityProxy must be in [0, 1] (got ${data.stabilityProxy})`,
      { field: "stabilityProxy", value: data.stabilityProxy }
    );
  }

  if (data.top3Ids.length > 3) {
    throw new WeeklyAuditInvalidDataError(
      `top3Ids must have at most 3 entries (got ${data.top3Ids.length})`,
      { field: "top3Ids", count: data.top3Ids.length }
    );
  }

  const idSet = new Set(data.top3Ids);
  if (idSet.size !== data.top3Ids.length) {
    throw new WeeklyAuditInvalidDataError("top3Ids must not contain duplicate ids", {
      field: "top3Ids",
    });
  }

  const normalized = getWeekStart(data.weekStart);
  if (normalized.getTime() !== data.weekStart.getTime()) {
    throw new WeeklyAuditInvalidDataError(
      `weekStart must be a Monday at 00:00 UTC (got ${data.weekStart.toISOString()})`,
      {
        field: "weekStart",
        given: data.weekStart.toISOString(),
        expected: normalized.toISOString(),
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const result: WeeklyAuditInput = {
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

  assertValidWeeklyAuditData(result);
  return result;
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
): Promise<{ weekStart: Date; created: boolean; locked: boolean }> {
  const weekStart = getWeekStart(targetNow);
  const existing = await db.weeklyAudit.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    // Locked audits are immutable — ensure-path is read-only and must not throw.
    // Only explicit mutation routes (backfill, recompute, lock) should reject locked audits.
    const locked = existing.status === "locked";
    return { weekStart, created: false, locked };
  }

  const auditData = await buildWeeklyAudit(userId, targetNow, db);

  try {
    await db.weeklyAudit.create({
      data: auditData,
    });
    return { weekStart, created: true, locked: false };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { weekStart, created: false, locked: false };
    }

    throw error;
  }
}
