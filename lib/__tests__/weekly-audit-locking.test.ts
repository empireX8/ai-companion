import { describe, expect, it, vi } from "vitest";

import {
  WeeklyAuditLockedError,
  ensureWeeklyAuditForWeekStart,
  getWeekStart,
} from "../weekly-audit";
import {
  computeWeeklyAuditHash,
  type WeeklyAuditHashInput,
} from "../weekly-audit-hash";

// ── Mock DB factory ───────────────────────────────────────────────────────────

const createBaseDb = (overrides: { findUniqueResult?: unknown } = {}) => ({
  weeklyAudit: {
    findUnique: vi.fn().mockResolvedValue(overrides.findUniqueResult ?? null),
    create: vi.fn().mockResolvedValue({ id: "created-audit" }),
  },
  referenceItem: {
    count: vi.fn().mockResolvedValue(5),
  },
  contradictionNode: {
    count: vi.fn().mockImplementation(async (args: { where: unknown }) => {
      const where = args.where as { status?: { in: string[] } };
      return where?.status ? 2 : 6;
    }),
    aggregate: vi.fn().mockResolvedValue({
      _sum: { avoidanceCount: 3, snoozeCount: 7 },
    }),
    findMany: vi.fn().mockResolvedValue([]),
  },
});

// ── computeWeeklyAuditHash — deterministic ────────────────────────────────────

describe("computeWeeklyAuditHash", () => {
  const BASE: WeeklyAuditHashInput = {
    referenceCount: 10,
    contradictionCount: 5,
    openContradictionCount: 3,
    resolvedCount: 2,
    salienceAggregate: 0.82,
    escalationCount: 1,
    artifactCounts: { reference_candidate: 4, contradiction_candidate: 2 },
  };

  it("returns a 64-char hex string", () => {
    const hash = computeWeeklyAuditHash(BASE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs always produce same hash", () => {
    const h1 = computeWeeklyAuditHash(BASE);
    const h2 = computeWeeklyAuditHash({ ...BASE });
    expect(h1).toBe(h2);
  });

  it("differs when any input field changes", () => {
    const base = computeWeeklyAuditHash(BASE);
    expect(computeWeeklyAuditHash({ ...BASE, referenceCount: 11 })).not.toBe(base);
    expect(computeWeeklyAuditHash({ ...BASE, openContradictionCount: 4 })).not.toBe(base);
    expect(computeWeeklyAuditHash({ ...BASE, resolvedCount: 3 })).not.toBe(base);
    expect(computeWeeklyAuditHash({ ...BASE, escalationCount: 2 })).not.toBe(base);
  });

  it("is stable regardless of top-level key insertion order", () => {
    // Build an object with keys in a different insertion order
    const reversed: WeeklyAuditHashInput = {
      artifactCounts: BASE.artifactCounts,
      escalationCount: BASE.escalationCount,
      salienceAggregate: BASE.salienceAggregate,
      resolvedCount: BASE.resolvedCount,
      openContradictionCount: BASE.openContradictionCount,
      contradictionCount: BASE.contradictionCount,
      referenceCount: BASE.referenceCount,
    };
    expect(computeWeeklyAuditHash(reversed)).toBe(computeWeeklyAuditHash(BASE));
  });

  it("is stable regardless of artifactCounts key insertion order", () => {
    const swapped: WeeklyAuditHashInput = {
      ...BASE,
      artifactCounts: {
        contradiction_candidate: 2,
        reference_candidate: 4,
      },
    };
    expect(computeWeeklyAuditHash(swapped)).toBe(computeWeeklyAuditHash(BASE));
  });

  it("differs when artifactCounts values change", () => {
    const changed: WeeklyAuditHashInput = {
      ...BASE,
      artifactCounts: { reference_candidate: 99, contradiction_candidate: 2 },
    };
    expect(computeWeeklyAuditHash(changed)).not.toBe(computeWeeklyAuditHash(BASE));
  });
});

// ── Status transition: only draft → locked ────────────────────────────────────

describe("WeeklyAudit status transitions", () => {
  it("only allows draft → locked (not locked → locked)", async () => {
    const db = createBaseDb({
      findUniqueResult: { id: "audit_1", status: "locked" },
    });
    await expect(
      ensureWeeklyAuditForWeekStart("user-1", new Date("2026-02-18T12:00:00.000Z"), db)
    ).rejects.toThrow(WeeklyAuditLockedError);
  });

  it("allows normal create when audit is in draft status (no existing record)", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb({ findUniqueResult: null });
    const result = await ensureWeeklyAuditForWeekStart("user-1", now, db);
    expect(result.created).toBe(true);
    expect(db.weeklyAudit.create).toHaveBeenCalledTimes(1);
  });
});

// ── Cannot modify locked audit (via ensure) ───────────────────────────────────

describe("ensureWeeklyAuditForWeekStart — locked guard", () => {
  it("throws WeeklyAuditLockedError when existing audit is locked", async () => {
    const db = createBaseDb({
      findUniqueResult: { id: "audit_locked", status: "locked" },
    });

    await expect(
      ensureWeeklyAuditForWeekStart("user-1", new Date("2026-02-18T12:00:00.000Z"), db)
    ).rejects.toThrow(WeeklyAuditLockedError);

    // Must not attempt creation
    expect(db.weeklyAudit.create).not.toHaveBeenCalled();
  });

  it("skips (returns created:false) when existing audit is draft", async () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const db = createBaseDb({
      findUniqueResult: { id: "audit_draft", status: "draft" },
    });

    const result = await ensureWeeklyAuditForWeekStart("user-1", now, db);
    expect(result).toEqual({ weekStart: getWeekStart(now), created: false });
    expect(db.weeklyAudit.create).not.toHaveBeenCalled();
  });

  it("error message includes the audit id", async () => {
    const db = createBaseDb({
      findUniqueResult: { id: "audit_xyz", status: "locked" },
    });

    const err = await ensureWeeklyAuditForWeekStart(
      "user-1",
      new Date("2026-02-18T12:00:00.000Z"),
      db
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WeeklyAuditLockedError);
    expect((err as WeeklyAuditLockedError).message).toContain("audit_xyz");
  });
});

// ── Backfill refuses locked audit ─────────────────────────────────────────────

describe("backfill refuses locked audits", () => {
  it("throws when backfill encounters a locked week", async () => {
    // Simulates what backfill does: calls ensureWeeklyAuditForWeekStart,
    // which should throw for a locked audit.
    const db = createBaseDb({
      findUniqueResult: { id: "week_locked", status: "locked" },
    });

    await expect(
      ensureWeeklyAuditForWeekStart("user-1", new Date("2026-02-10T00:00:00.000Z"), db)
    ).rejects.toBeInstanceOf(WeeklyAuditLockedError);
  });
});

// ── Locked audit retains metrics even if underlying data changes ──────────────

describe("locked audit metric stability", () => {
  it("hash of same inputs is the same regardless of when it is computed", () => {
    const inputs: WeeklyAuditHashInput = {
      referenceCount: 12,
      contradictionCount: 7,
      openContradictionCount: 4,
      resolvedCount: 3,
      salienceAggregate: 0.61,
      escalationCount: 2,
      artifactCounts: {},
    };

    // Simulated lock at t=0
    const hashAtLock = computeWeeklyAuditHash(inputs);

    // Simulated re-computation at t=1 (same inputs, different time)
    const hashAtRecompute = computeWeeklyAuditHash({ ...inputs });

    expect(hashAtLock).toBe(hashAtRecompute);
  });

  it("different underlying data produces different hash — seal is meaningful", () => {
    const atLock: WeeklyAuditHashInput = {
      referenceCount: 10,
      contradictionCount: 5,
      openContradictionCount: 3,
      resolvedCount: 2,
      salienceAggregate: 0.7,
      escalationCount: 1,
      artifactCounts: {},
    };

    const afterDataChange: WeeklyAuditHashInput = {
      ...atLock,
      referenceCount: 15, // data changed after lock
    };

    expect(computeWeeklyAuditHash(atLock)).not.toBe(computeWeeklyAuditHash(afterDataChange));
  });
});

// ── Cannot lock twice ─────────────────────────────────────────────────────────

describe("cannot lock twice", () => {
  it("WeeklyAuditLockedError is thrown when attempting to modify a locked record via ensure", async () => {
    const db = createBaseDb({
      findUniqueResult: { id: "audit_already_locked", status: "locked" },
    });

    const call1 = ensureWeeklyAuditForWeekStart(
      "user-1",
      new Date("2026-02-18T12:00:00.000Z"),
      db
    );
    await expect(call1).rejects.toThrow(WeeklyAuditLockedError);

    // Second attempt with same locked audit still throws
    const call2 = ensureWeeklyAuditForWeekStart(
      "user-1",
      new Date("2026-02-18T12:00:00.000Z"),
      db
    );
    await expect(call2).rejects.toThrow(WeeklyAuditLockedError);

    // Never attempted to create
    expect(db.weeklyAudit.create).not.toHaveBeenCalled();
  });
});
