import { createHash } from "crypto";

export type WeeklyAuditHashInput = {
  referenceCount: number;
  contradictionCount: number;
  openContradictionCount: number;
  resolvedCount: number;
  salienceAggregate: number;
  escalationCount: number;
  artifactCounts: Record<string, number>;
};

/**
 * Deterministic SHA-256 hash of the epistemic state for a week.
 *
 * Keys are sorted before serialization to guarantee identical inputs always
 * produce the same hash regardless of property insertion order.
 * Returns a 64-char lowercase hex string.
 */
export function computeWeeklyAuditHash(input: WeeklyAuditHashInput): string {
  const sortedKeys = Object.keys(input).sort() as Array<keyof WeeklyAuditHashInput>;

  // Build an object with sorted top-level keys
  const ordered: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const value = input[key];
    // For nested objects (artifactCounts), sort their keys too
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const innerSorted: Record<string, unknown> = {};
      for (const innerKey of Object.keys(value as Record<string, unknown>).sort()) {
        innerSorted[innerKey] = (value as Record<string, unknown>)[innerKey];
      }
      ordered[key] = innerSorted;
    } else {
      ordered[key] = value;
    }
  }

  const serialized = JSON.stringify(ordered);
  return createHash("sha256").update(serialized).digest("hex");
}
