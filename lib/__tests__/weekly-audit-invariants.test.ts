import { describe, expect, it } from "vitest";

import {
  assertNotLocked,
  assertValidWeeklyAuditData,
  type WeeklyAuditInput,
  WeeklyAuditLockedError,
} from "../weekly-audit";
import { WeeklyAuditInvalidDataError } from "../invariant-errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// 2026-02-23 is a Monday — valid weekStart
const VALID_WEEK_START = new Date("2026-02-23T00:00:00.000Z");

function makeValidInput(overrides: Partial<WeeklyAuditInput> = {}): WeeklyAuditInput {
  return {
    userId: "u1",
    weekStart: VALID_WEEK_START,
    activeReferenceCount: 3,
    openContradictionCount: 2,
    totalContradictionCount: 5,
    top3AvgComputedWeight: 4.2,
    top3Ids: ["c1", "c2", "c3"],
    totalAvoidanceCount: 1,
    totalSnoozeCount: 0,
    contradictionDensity: 0.5,
    stabilityProxy: 0.67,
    top3Snapshot: [],
    ...overrides,
  };
}

// ── assertValidWeeklyAuditData — good path ────────────────────────────────────

describe("assertValidWeeklyAuditData — good path", () => {
  it("accepts valid data without throwing", () => {
    expect(() => assertValidWeeklyAuditData(makeValidInput())).not.toThrow();
  });

  it("accepts zero values for all counters", () => {
    expect(() =>
      assertValidWeeklyAuditData(
        makeValidInput({
          activeReferenceCount: 0,
          openContradictionCount: 0,
          totalContradictionCount: 0,
          totalAvoidanceCount: 0,
          totalSnoozeCount: 0,
          top3AvgComputedWeight: 0,
          contradictionDensity: 0,
          stabilityProxy: 1, // 1/(1+0)
          top3Ids: [],
        })
      )
    ).not.toThrow();
  });

  it("accepts stabilityProxy of exactly 1", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ stabilityProxy: 1 }))
    ).not.toThrow();
  });

  it("accepts stabilityProxy of exactly 0", () => {
    // stabilityProxy=0 is technically allowed by the [0,1] check
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ stabilityProxy: 0 }))
    ).not.toThrow();
  });

  it("accepts contradictionDensity > 1 (more open contradictions than references+1)", () => {
    // density CAN exceed 1 in real data; we only require >= 0
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ contradictionDensity: 2.5, stabilityProxy: 0.29 }))
    ).not.toThrow();
  });

  it("accepts top3Ids with 1 or 2 entries", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["c1"] }))
    ).not.toThrow();
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["c1", "c2"] }))
    ).not.toThrow();
  });
});

// ── assertValidWeeklyAuditData — integer counters ─────────────────────────────

describe("assertValidWeeklyAuditData — integer counter violations", () => {
  const COUNTER_FIELDS = [
    "activeReferenceCount",
    "openContradictionCount",
    "totalContradictionCount",
    "totalAvoidanceCount",
    "totalSnoozeCount",
  ] as const;

  for (const field of COUNTER_FIELDS) {
    it(`rejects negative ${field}`, () => {
      expect(() =>
        assertValidWeeklyAuditData(makeValidInput({ [field]: -1 }))
      ).toThrow(WeeklyAuditInvalidDataError);
    });

    it(`rejects non-integer ${field}`, () => {
      expect(() =>
        assertValidWeeklyAuditData(makeValidInput({ [field]: 1.5 }))
      ).toThrow(WeeklyAuditInvalidDataError);
    });
  }
});

// ── assertValidWeeklyAuditData — float field violations ───────────────────────

describe("assertValidWeeklyAuditData — float field violations", () => {
  it("rejects negative top3AvgComputedWeight", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3AvgComputedWeight: -0.1 }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects NaN top3AvgComputedWeight", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3AvgComputedWeight: NaN }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects negative contradictionDensity", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ contradictionDensity: -0.01 }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects stabilityProxy > 1", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ stabilityProxy: 1.01 }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects negative stabilityProxy", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ stabilityProxy: -0.1 }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("error has code WEEKLY_AUDIT_INVALID_DATA", () => {
    try {
      assertValidWeeklyAuditData(makeValidInput({ stabilityProxy: 2 }));
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(WeeklyAuditInvalidDataError);
      expect((err as WeeklyAuditInvalidDataError).code).toBe("WEEKLY_AUDIT_INVALID_DATA");
    }
  });
});

// ── assertValidWeeklyAuditData — top3Ids ──────────────────────────────────────

describe("assertValidWeeklyAuditData — top3Ids violations", () => {
  it("rejects top3Ids with length 4", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["c1", "c2", "c3", "c4"] }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects top3Ids with duplicate ids", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["c1", "c1", "c2"] }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects top3Ids with all duplicates", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["c1", "c1", "c1"] }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("accepts top3Ids of exactly 3 distinct ids", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: ["a", "b", "c"] }))
    ).not.toThrow();
  });

  it("accepts empty top3Ids", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ top3Ids: [] }))
    ).not.toThrow();
  });
});

// ── assertValidWeeklyAuditData — weekStart normalization ──────────────────────

describe("assertValidWeeklyAuditData — weekStart normalization", () => {
  it("rejects weekStart that is not a Monday (Tuesday)", () => {
    // 2026-02-24 is a Tuesday
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ weekStart: new Date("2026-02-24T00:00:00.000Z") }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("rejects weekStart that is a Monday but not at 00:00 UTC", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ weekStart: new Date("2026-02-23T01:00:00.000Z") }))
    ).toThrow(WeeklyAuditInvalidDataError);
  });

  it("accepts weekStart that is Monday at 00:00 UTC", () => {
    expect(() =>
      assertValidWeeklyAuditData(makeValidInput({ weekStart: new Date("2026-02-23T00:00:00.000Z") }))
    ).not.toThrow();
  });
});

// ── assertNotLocked ───────────────────────────────────────────────────────────

describe("assertNotLocked", () => {
  it("throws WeeklyAuditLockedError for a locked audit", () => {
    expect(() => assertNotLocked({ id: "a1", status: "locked" })).toThrow(
      WeeklyAuditLockedError
    );
  });

  it("thrown error has code WEEKLY_AUDIT_LOCKED", () => {
    try {
      assertNotLocked({ id: "a1", status: "locked" });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(WeeklyAuditLockedError);
      expect((err as WeeklyAuditLockedError).code).toBe("WEEKLY_AUDIT_LOCKED");
    }
  });

  it("does not throw for a draft audit", () => {
    expect(() => assertNotLocked({ id: "a1", status: "draft" })).not.toThrow();
  });

  it("does not throw for an audit with arbitrary non-locked status", () => {
    expect(() => assertNotLocked({ id: "a1", status: "pending" })).not.toThrow();
  });
});
