import { describe, expect, it, vi } from "vitest";

import { ensureWeeklyAuditForCurrentWeek, getWeekStart } from "../weekly-audit";

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

describe("ensureWeeklyAuditForCurrentWeek", () => {
  it("does not create when weekly audit already exists", async () => {
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue({ id: "existing-audit" });

    await ensureWeeklyAuditForCurrentWeek("user-1", new Date("2026-02-18T12:00:00.000Z"), db);

    expect(db.weeklyAudit.create).not.toHaveBeenCalled();
    expect(db.referenceItem.count).not.toHaveBeenCalled();
  });

  it("creates audit once when missing", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue(null);
    db.weeklyAudit.create.mockResolvedValue({ id: "created-audit" });

    await ensureWeeklyAuditForCurrentWeek("user-1", now, db);

    expect(db.weeklyAudit.create).toHaveBeenCalledTimes(1);
    expect(db.referenceItem.count).toHaveBeenCalled();
    expect(db.weeklyAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        weekStart: getWeekStart(now),
      }),
    });
  });

  it("swallows P2002 unique violation race on create", async () => {
    const db = createBaseDb();
    db.weeklyAudit.findUnique.mockResolvedValue(null);
    db.weeklyAudit.create.mockRejectedValue({ code: "P2002" });

    await expect(
      ensureWeeklyAuditForCurrentWeek("user-1", new Date("2026-02-18T12:00:00.000Z"), db)
    ).resolves.toBeUndefined();
  });
});
