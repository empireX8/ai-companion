import { describe, expect, it } from "vitest";

import {
  computeWeeklyAuditDiff,
  summarizeWeeklyAuditDiff,
  type AuditDiffInput,
} from "../weekly-audit-diff";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FROM: AuditDiffInput = {
  activeReferenceCount: 8,
  openContradictionCount: 5,
  totalContradictionCount: 7,
  top3AvgComputedWeight: 10,
  totalAvoidanceCount: 7,
  totalSnoozeCount: 5,
  contradictionDensity: 0.56,
  stabilityProxy: 0.64,
  top3Ids: ["a", "b", "c"],
};

const TO: AuditDiffInput = {
  activeReferenceCount: 10,
  openContradictionCount: 4,
  totalContradictionCount: 8,
  top3AvgComputedWeight: 12,
  totalAvoidanceCount: 9,
  totalSnoozeCount: 6,
  contradictionDensity: 0.36,
  stabilityProxy: 0.73,
  top3Ids: ["b", "c", "d"],
};

// ── Metric delta math ─────────────────────────────────────────────────────────

describe("computeWeeklyAuditDiff — metric deltas", () => {
  it("computes positive and negative integer deltas", () => {
    const diff = computeWeeklyAuditDiff(FROM, TO);
    expect(diff.activeReferenceCountDelta).toBe(2);
    expect(diff.openContradictionCountDelta).toBe(-1);
    expect(diff.totalContradictionCountDelta).toBe(1);
    expect(diff.totalAvoidanceDelta).toBe(2);
    expect(diff.totalSnoozeDelta).toBe(1);
  });

  it("computes float deltas", () => {
    const diff = computeWeeklyAuditDiff(FROM, TO);
    expect(diff.contradictionDensityDelta).toBeCloseTo(-0.2, 5);
    expect(diff.stabilityProxyDelta).toBeCloseTo(0.09, 5);
    expect(diff.top3AvgComputedWeightDelta).toBeCloseTo(2, 5);
  });

  it("all deltas are zero when from === to", () => {
    const diff = computeWeeklyAuditDiff(FROM, FROM);
    expect(diff.activeReferenceCountDelta).toBe(0);
    expect(diff.openContradictionCountDelta).toBe(0);
    expect(diff.contradictionDensityDelta).toBe(0);
    expect(diff.stabilityProxyDelta).toBe(0);
  });
});

// ── Top-3 movement ────────────────────────────────────────────────────────────

describe("computeWeeklyAuditDiff — top-3 movement", () => {
  it("detects entered, exited, and moved correctly", () => {
    const diff = computeWeeklyAuditDiff(FROM, TO);
    // FROM: [a, b, c]  TO: [b, c, d]
    // a: exited (was #1), d: entered (#3), b: moved #2→#1, c: moved #3→#2
    const map = new Map(diff.top3Movement.map((m) => [m.id, m]));

    expect(map.get("a")?.status).toBe("exited");
    expect(map.get("a")?.fromRank).toBe(1);
    expect(map.get("a")?.toRank).toBeNull();

    expect(map.get("d")?.status).toBe("entered");
    expect(map.get("d")?.fromRank).toBeNull();
    expect(map.get("d")?.toRank).toBe(3);

    expect(map.get("b")?.status).toBe("moved");
    expect(map.get("b")?.fromRank).toBe(2);
    expect(map.get("b")?.toRank).toBe(1);

    expect(map.get("c")?.status).toBe("moved");
    expect(map.get("c")?.fromRank).toBe(3);
    expect(map.get("c")?.toRank).toBe(2);
  });

  it("all unchanged when top3Ids are identical", () => {
    const diff = computeWeeklyAuditDiff(FROM, FROM);
    expect(diff.top3Movement.every((m) => m.status === "unchanged")).toBe(true);
  });

  it("all entered when from has empty top3Ids", () => {
    const diff = computeWeeklyAuditDiff({ ...FROM, top3Ids: [] }, TO);
    expect(diff.top3Movement.every((m) => m.status === "entered")).toBe(true);
  });

  it("all exited when to has empty top3Ids", () => {
    const diff = computeWeeklyAuditDiff(FROM, { ...TO, top3Ids: [] });
    expect(diff.top3Movement.every((m) => m.status === "exited")).toBe(true);
  });

  it("returns empty movement when both top3Ids are empty", () => {
    const diff = computeWeeklyAuditDiff(
      { ...FROM, top3Ids: [] },
      { ...TO, top3Ids: [] }
    );
    expect(diff.top3Movement).toHaveLength(0);
  });

  it("only uses first 3 ids from each list", () => {
    const diff = computeWeeklyAuditDiff(
      { ...FROM, top3Ids: ["a", "b", "c", "extra-from"] },
      { ...TO, top3Ids: ["x", "y", "z", "extra-to"] }
    );
    // extra-from and extra-to should NOT appear in movement
    const ids = diff.top3Movement.map((m) => m.id);
    expect(ids).not.toContain("extra-from");
    expect(ids).not.toContain("extra-to");
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe("computeWeeklyAuditDiff — determinism", () => {
  it("same inputs always produce the same result", () => {
    const d1 = computeWeeklyAuditDiff(FROM, TO);
    const d2 = computeWeeklyAuditDiff({ ...FROM }, { ...TO });
    expect(d1).toEqual(d2);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────

describe("summarizeWeeklyAuditDiff", () => {
  it("produces expected bullets for the base fixture diff", () => {
    const diff = computeWeeklyAuditDiff(FROM, TO);
    const summary = summarizeWeeklyAuditDiff(diff);

    expect(summary.some((s) => s.includes("1 open contradiction resolved"))).toBe(true);
    expect(summary.some((s) => s.includes("density decreased"))).toBe(true);
    expect(summary.some((s) => s.includes("Stability improved"))).toBe(true);
    expect(summary.some((s) => s.includes("avoidance event"))).toBe(true);
    expect(summary.some((s) => s.includes("snooze event"))).toBe(true);
    expect(summary.some((s) => s.includes("more active reference"))).toBe(true);
    expect(summary.some((s) => s.includes("entered top-3"))).toBe(true);
    expect(summary.some((s) => s.includes("exited top-3"))).toBe(true);
  });

  it("returns single no-change bullet when nothing changed", () => {
    const diff = computeWeeklyAuditDiff(FROM, FROM);
    const summary = summarizeWeeklyAuditDiff(diff);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain("No significant changes");
  });

  it("uses singular for 1 open contradiction resolved", () => {
    const diff = computeWeeklyAuditDiff(
      { ...FROM, openContradictionCount: 1 },
      { ...TO, openContradictionCount: 0 }
    );
    const summary = summarizeWeeklyAuditDiff(diff);
    expect(summary.some((s) => s === "1 open contradiction resolved")).toBe(true);
  });

  it("uses singular for 1 new open contradiction", () => {
    const diff = computeWeeklyAuditDiff(
      { ...FROM, openContradictionCount: 3 },
      { ...TO, openContradictionCount: 4 }
    );
    const summary = summarizeWeeklyAuditDiff(diff);
    expect(summary.some((s) => s === "1 new open contradiction")).toBe(true);
  });

  it("skips density/stability noise below 0.001 threshold", () => {
    const diff = computeWeeklyAuditDiff(
      { ...FROM, contradictionDensity: 0.5, stabilityProxy: 0.7 },
      { ...TO, contradictionDensity: 0.5, stabilityProxy: 0.7, openContradictionCount: FROM.openContradictionCount, totalAvoidanceCount: FROM.totalAvoidanceCount, totalSnoozeCount: FROM.totalSnoozeCount, activeReferenceCount: FROM.activeReferenceCount, top3Ids: FROM.top3Ids }
    );
    const summary = summarizeWeeklyAuditDiff(diff);
    expect(summary.every((s) => !s.includes("density"))).toBe(true);
    expect(summary.every((s) => !s.includes("Stability"))).toBe(true);
  });

  it("is deterministic", () => {
    const diff = computeWeeklyAuditDiff(FROM, TO);
    expect(summarizeWeeklyAuditDiff(diff)).toEqual(summarizeWeeklyAuditDiff(diff));
  });
});
