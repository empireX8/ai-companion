import { describe, expect, it, vi } from "vitest";

import { addWeeks, ensureWeeklyAuditForWeekStart, getWeekStart } from "../weekly-audit";

const createBaseDb = () => ({
  weeklyAudit: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  referenceItem: {
    count: vi.fn().mockResolvedValue(2),
  },
  contradictionNode: {
    count: vi.fn().mockImplementation(async (args: { where: unknown }) => {
      const where = args.where as { status?: { in: string[] } };
      if (where?.status && "in" in where.status) {
        return 1;
      }
      return 3;
    }),
    aggregate: vi.fn().mockResolvedValue({
      _sum: { avoidanceCount: 2, snoozeCount: 4 },
    }),
    findMany: vi.fn().mockResolvedValue([]),
  },
});

describe("addWeeks", () => {
  it("moves date back by 7 days for -1 week", () => {
    const shifted = addWeeks(new Date("2026-02-18T00:00:00.000Z"), -1);
    expect(shifted.toISOString()).toBe("2026-02-11T00:00:00.000Z");
  });
});

describe("ensureWeeklyAuditForWeekStart", () => {
  it("returns created:false when weekly audit exists", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue({ id: "existing-audit" });

    const result = await ensureWeeklyAuditForWeekStart("user-1", now, db);

    expect(result).toEqual({ weekStart: getWeekStart(now), created: false });
    expect(db.weeklyAudit.create).not.toHaveBeenCalled();
  });

  it("returns created:true when missing and create succeeds", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue(null);
    db.weeklyAudit.create.mockResolvedValue({ id: "created-audit" });

    const result = await ensureWeeklyAuditForWeekStart("user-1", now, db);

    expect(result).toEqual({ weekStart: getWeekStart(now), created: true });
    expect(db.weeklyAudit.create).toHaveBeenCalledTimes(1);
  });

  it("swallows P2002 and returns created:false", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue(null);
    db.weeklyAudit.create.mockRejectedValue({ code: "P2002" });

    const result = await ensureWeeklyAuditForWeekStart("user-1", now, db);

    expect(result).toEqual({ weekStart: getWeekStart(now), created: false });
  });
});
