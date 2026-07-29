import { describe, expect, it } from "vitest";
import {
  UserMapConclusionStatus,
  UserMapConfidenceLevel,
} from "@prisma/client";

import {
  CANONICAL_UMC_SNAPSHOT_VERSION,
  deriveCanonicalUmcSnapshotHash,
  type CanonicalUmcSnapshotInput,
} from "../canonical-umc-snapshot-hash";

function baseInput(
  overrides: Partial<CanonicalUmcSnapshotInput> = {},
): CanonicalUmcSnapshotInput {
  return {
    id: "umc_1",
    title: "Title",
    summary: "Summary",
    status: UserMapConclusionStatus.emerging,
    confidenceScore: 0.5,
    confidenceLevel: UserMapConfidenceLevel.medium,
    updatedAt: new Date("2026-07-27T12:00:00.000Z"),
    ...overrides,
  };
}

describe("deriveCanonicalUmcSnapshotHash", () => {
  it("is deterministic for repeated identical input", () => {
    const a = deriveCanonicalUmcSnapshotHash(baseInput());
    const b = deriveCanonicalUmcSnapshotHash(baseInput());
    expect(a).toBe(b);
  });

  it("matches umc_snap_v1:<64 lowercase hex> shape", () => {
    const hash = deriveCanonicalUmcSnapshotHash(baseInput());
    expect(hash).toMatch(
      new RegExp(`^${CANONICAL_UMC_SNAPSHOT_VERSION}:[0-9a-f]{64}$`),
    );
  });

  it("changes when any individual authority field changes", () => {
    const baseline = deriveCanonicalUmcSnapshotHash(baseInput());
    const variants: CanonicalUmcSnapshotInput[] = [
      baseInput({ id: "umc_2" }),
      baseInput({ title: "Other title" }),
      baseInput({ summary: "Other summary" }),
      baseInput({ status: UserMapConclusionStatus.supported }),
      baseInput({ confidenceScore: 0.51 }),
      baseInput({ confidenceLevel: UserMapConfidenceLevel.high }),
      baseInput({ updatedAt: new Date("2026-07-27T12:00:01.000Z") }),
    ];
    for (const variant of variants) {
      expect(deriveCanonicalUmcSnapshotHash(variant)).not.toBe(baseline);
    }
  });

  it("uses Number.toString() float serialization", () => {
    const withNumber = deriveCanonicalUmcSnapshotHash(
      baseInput({ confidenceScore: 0.1 + 0.2 }),
    );
    const withLiteral = deriveCanonicalUmcSnapshotHash(
      baseInput({ confidenceScore: Number((0.1 + 0.2).toString()) }),
    );
    expect(withNumber).toBe(withLiteral);
    expect(withNumber).not.toBe(
      deriveCanonicalUmcSnapshotHash(baseInput({ confidenceScore: 0.3 })),
    );
  });

  it("uses Date.toISOString() UTC serialization", () => {
    const a = deriveCanonicalUmcSnapshotHash(
      baseInput({ updatedAt: new Date("2026-07-27T12:00:00.000Z") }),
    );
    const b = deriveCanonicalUmcSnapshotHash(
      baseInput({ updatedAt: new Date(Date.UTC(2026, 6, 27, 12, 0, 0)) }),
    );
    expect(a).toBe(b);
  });
});
