import { describe, expect, it } from "vitest";

import {
  computeEscalationLevel,
  computeRecommendedRung,
  shouldEscalate,
} from "../contradiction-escalation";

describe("computeEscalationLevel", () => {
  const now = new Date("2026-02-15T00:00:00.000Z");
  const base = {
    snoozeCount: 0,
    avoidanceCount: 0,
    timesSurfaced: 0,
    lastEscalatedAt: null,
    lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
    lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
  };

  it("increases with snoozeCount thresholds", () => {
    const level0 = computeEscalationLevel(base, now);
    const level1 = computeEscalationLevel({ ...base, snoozeCount: 2 }, now);
    const level2 = computeEscalationLevel({ ...base, snoozeCount: 4 }, now);

    expect(level0).toBe(0);
    expect(level1).toBeGreaterThanOrEqual(1);
    expect(level2).toBeGreaterThanOrEqual(2);
  });

  it("sets level >= 2 when avoidanceCount reaches threshold", () => {
    const level = computeEscalationLevel({ ...base, avoidanceCount: 2 }, now);
    expect(level).toBeGreaterThanOrEqual(2);
  });

  it("increases across timesSurfaced thresholds", () => {
    const level3 = computeEscalationLevel({ ...base, timesSurfaced: 6 }, now);
    const level4 = computeEscalationLevel({ ...base, timesSurfaced: 10 }, now);

    expect(level3).toBeGreaterThanOrEqual(3);
    expect(level4).toBeGreaterThanOrEqual(4);
  });
});

describe("computeRecommendedRung", () => {
  it("maps levels 0..4 to expected rungs", () => {
    expect(computeRecommendedRung(0)).toBe("rung1_gentle_mirror");
    expect(computeRecommendedRung(1)).toBe("rung2_explicit_contradiction");
    expect(computeRecommendedRung(2)).toBe("rung3_evidence_pressure");
    expect(computeRecommendedRung(3)).toBe("rung4_forced_choice_framing");
    expect(computeRecommendedRung(4)).toBe("rung5_structured_probe_offer");
  });
});

describe("shouldEscalate cooldown behavior", () => {
  it("updates when level increases and cooldown is satisfied", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const oldEnough = new Date("2026-02-13T00:00:00.000Z");

    expect(shouldEscalate(1, 2, null, now)).toBe(true);
    expect(shouldEscalate(1, 2, oldEnough, now)).toBe(true);
    expect(
      shouldEscalate(1, 2, new Date("2026-02-14T12:00:00.000Z"), now)
    ).toBe(false);
    expect(shouldEscalate(2, 2, null, now)).toBe(false);
  });
});
