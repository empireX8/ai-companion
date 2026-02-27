import { describe, expect, it } from "vitest";

import {
  computeAuditExplain,
  type AuditExplainInput,
} from "../weekly-audit-explain";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE: AuditExplainInput = {
  contradictionDensity: 0.36,
  stabilityProxy: 0.73,
  top3AvgComputedWeight: 12,
  totalAvoidanceCount: 3,
  totalSnoozeCount: 2,
  status: "draft",
};

// ── Density categories ────────────────────────────────────────────────────────

describe("computeAuditExplain — density category", () => {
  it("low when density < 0.2", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.1 });
    expect(result.densityCategory).toBe("low");
  });

  it("moderate when density is exactly 0.2", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.2 });
    expect(result.densityCategory).toBe("moderate");
  });

  it("moderate when density is 0.2–0.49", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.36 });
    expect(result.densityCategory).toBe("moderate");
  });

  it("high when density >= 0.5", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.5 });
    expect(result.densityCategory).toBe("high");
  });

  it("high when density is 0.8", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.8 });
    expect(result.densityCategory).toBe("high");
  });
});

// ── Stability categories ──────────────────────────────────────────────────────

describe("computeAuditExplain — stability category", () => {
  it("stable when stabilityProxy >= 0.75", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.75 });
    expect(result.stabilityCategory).toBe("stable");
  });

  it("stable for high proxy", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.95 });
    expect(result.stabilityCategory).toBe("stable");
  });

  it("stressed when stabilityProxy is 0.5–0.74", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.6 });
    expect(result.stabilityCategory).toBe("stressed");
  });

  it("stressed when stabilityProxy is exactly 0.5", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.5 });
    expect(result.stabilityCategory).toBe("stressed");
  });

  it("critical when stabilityProxy < 0.5", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.3 });
    expect(result.stabilityCategory).toBe("critical");
  });
});

// ── Top weight concentration ──────────────────────────────────────────────────

describe("computeAuditExplain — topWeightConcentration", () => {
  it("true when top3AvgComputedWeight > 10", () => {
    const result = computeAuditExplain({ ...BASE, top3AvgComputedWeight: 12 });
    expect(result.topWeightConcentration).toBe(true);
  });

  it("false when top3AvgComputedWeight is exactly 10", () => {
    const result = computeAuditExplain({ ...BASE, top3AvgComputedWeight: 10 });
    expect(result.topWeightConcentration).toBe(false);
  });

  it("false when top3AvgComputedWeight < 10", () => {
    const result = computeAuditExplain({ ...BASE, top3AvgComputedWeight: 5 });
    expect(result.topWeightConcentration).toBe(false);
  });
});

// ── Integrity ─────────────────────────────────────────────────────────────────

describe("computeAuditExplain — integrity", () => {
  it("immutable when status is locked", () => {
    const result = computeAuditExplain({ ...BASE, status: "locked" });
    expect(result.integrity).toBe("immutable");
  });

  it("mutable when status is draft", () => {
    const result = computeAuditExplain({ ...BASE, status: "draft" });
    expect(result.integrity).toBe("mutable");
  });

  it("mutable for any non-locked status", () => {
    const result = computeAuditExplain({ ...BASE, status: "anything" });
    expect(result.integrity).toBe("mutable");
  });
});

// ── Drivers ───────────────────────────────────────────────────────────────────

describe("computeAuditExplain — drivers", () => {
  it("produces no drivers when all metrics are at baseline", () => {
    const result = computeAuditExplain({
      contradictionDensity: 0.0,
      stabilityProxy: 1.0,
      top3AvgComputedWeight: 0,
      totalAvoidanceCount: 0,
      totalSnoozeCount: 0,
      status: "draft",
    });
    expect(result.drivers).toHaveLength(0);
  });

  it("includes density driver for moderate density", () => {
    const result = computeAuditExplain({ ...BASE, contradictionDensity: 0.36 });
    expect(result.drivers.some((d) => d.includes("density is moderate"))).toBe(true);
  });

  it("includes stability driver for stressed stability", () => {
    const result = computeAuditExplain({ ...BASE, stabilityProxy: 0.6 });
    expect(result.drivers.some((d) => d.includes("stressed"))).toBe(true);
  });

  it("includes weight concentration driver when applicable", () => {
    const result = computeAuditExplain({ ...BASE, top3AvgComputedWeight: 15 });
    expect(result.drivers.some((d) => d.includes("top-3 weight concentration"))).toBe(true);
  });

  it("includes avoidance driver when count > 0", () => {
    const result = computeAuditExplain({ ...BASE, totalAvoidanceCount: 3 });
    expect(result.drivers.some((d) => d.includes("avoidance event"))).toBe(true);
  });

  it("uses singular form for 1 avoidance event", () => {
    const result = computeAuditExplain({ ...BASE, totalAvoidanceCount: 1 });
    expect(result.drivers.some((d) => d === "1 avoidance event")).toBe(true);
  });

  it("includes snooze driver when count > 0", () => {
    const result = computeAuditExplain({ ...BASE, totalSnoozeCount: 2 });
    expect(result.drivers.some((d) => d.includes("snooze event"))).toBe(true);
  });

  it("is deterministic — same inputs always produce same output", () => {
    const r1 = computeAuditExplain(BASE);
    const r2 = computeAuditExplain({ ...BASE });
    expect(r1).toEqual(r2);
  });
});
