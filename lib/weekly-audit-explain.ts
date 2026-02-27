export type DensityCategory = "low" | "moderate" | "high";
export type StabilityCategory = "stable" | "stressed" | "critical";

export type ExplainPayload = {
  densityCategory: DensityCategory;
  stabilityCategory: StabilityCategory;
  topWeightConcentration: boolean;
  integrity: "immutable" | "mutable";
  drivers: string[];
};

export type AuditExplainInput = {
  contradictionDensity: number;
  stabilityProxy: number;
  top3AvgComputedWeight: number;
  totalAvoidanceCount: number;
  totalSnoozeCount: number;
  status: string;
};

export function computeAuditExplain(audit: AuditExplainInput): ExplainPayload {
  const densityCategory: DensityCategory =
    audit.contradictionDensity < 0.2
      ? "low"
      : audit.contradictionDensity < 0.5
        ? "moderate"
        : "high";

  const stabilityCategory: StabilityCategory =
    audit.stabilityProxy >= 0.75
      ? "stable"
      : audit.stabilityProxy >= 0.5
        ? "stressed"
        : "critical";

  const topWeightConcentration = audit.top3AvgComputedWeight > 10;

  const integrity: "immutable" | "mutable" =
    audit.status === "locked" ? "immutable" : "mutable";

  const drivers: string[] = [];

  if (densityCategory !== "low") {
    drivers.push(
      `Contradiction density is ${densityCategory} (${audit.contradictionDensity.toFixed(3)})`
    );
  }
  if (stabilityCategory !== "stable") {
    drivers.push(
      `Stability is ${stabilityCategory} (${audit.stabilityProxy.toFixed(3)})`
    );
  }
  if (topWeightConcentration) {
    drivers.push(
      `High top-3 weight concentration (avg ${audit.top3AvgComputedWeight.toFixed(2)})`
    );
  }
  if (audit.totalAvoidanceCount > 0) {
    drivers.push(
      `${audit.totalAvoidanceCount} avoidance event${audit.totalAvoidanceCount !== 1 ? "s" : ""}`
    );
  }
  if (audit.totalSnoozeCount > 0) {
    drivers.push(
      `${audit.totalSnoozeCount} snooze event${audit.totalSnoozeCount !== 1 ? "s" : ""}`
    );
  }

  return { densityCategory, stabilityCategory, topWeightConcentration, integrity, drivers };
}
