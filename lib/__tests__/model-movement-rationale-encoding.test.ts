import { describe, expect, it } from "vitest";

import {
  decodeMovementRationaleFromInternalNotes,
  encodeMovementRationaleInInternalNotes,
  MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX,
} from "../model-movement-rationale";
import { materializePublishedModelUpdateSnapshots } from "../model-movement-snapshot";

describe("movement rationale internalNotes encoding", () => {
  it("round-trips rationale containing semicolons", () => {
    const rationale = "Evening overwork; missing stop point; scope reopened.";
    const encoded = encodeMovementRationaleInInternalNotes(
      "candidateLane:internal_only",
      rationale,
    );

    expect(decodeMovementRationaleFromInternalNotes(encoded)).toBe(rationale);
    expect(encoded).toContain("candidateLane:internal_only");
  });

  it("preserves unrelated internal note markers", () => {
    const encoded = encodeMovementRationaleInInternalNotes(
      "candidateLane:internal_only;processorVersion:v1",
      "Distinct from movement summary.",
    );

    expect(encoded).toContain("candidateLane:internal_only");
    expect(encoded).toContain("processorVersion:v1");
    expect(decodeMovementRationaleFromInternalNotes(encoded)).toBe(
      "Distinct from movement summary.",
    );
  });

  it("decodes legacy semicolon-split values without semicolons in rationale", () => {
    const legacy = `${MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX}Short legacy rationale;candidateLane:internal_only`;
    expect(decodeMovementRationaleFromInternalNotes(legacy)).toBe("Short legacy rationale");
  });

  it("returns null for malformed legacy values without a rationale prefix", () => {
    expect(decodeMovementRationaleFromInternalNotes("candidateLane:internal_only")).toBeNull();
  });

  it("materializes rationale idempotently on repeated publication", async () => {
    const rows = [
      {
        id: "mu-idempotent",
        userId: "user-1",
        affectedObjectType: "pattern_claim" as const,
        affectedObjectId: "pc-1",
        beforeSummary: "Before",
        afterSummary: "After",
        internalNotes: "candidateLane:internal_only",
        visibility: "user_visible" as const,
      },
    ];

    const db = {
      modelUpdate: {
        findFirst: async () => rows[0],
        updateMany: async ({ data }: { data: { internalNotes?: string } }) => {
          if (data.internalNotes !== undefined) {
            rows[0]!.internalNotes = data.internalNotes;
          }
          return { count: 1 };
        },
      },
      patternClaim: {
        findFirst: async () => ({ summary: "After" }),
      },
    };

    const first = await materializePublishedModelUpdateSnapshots({
      userId: "user-1",
      modelUpdateId: "mu-idempotent",
      db: db as never,
      movementRationale: "Reason; with semicolon.",
    });
    const notesAfterFirst = rows[0]!.internalNotes;

    const second = await materializePublishedModelUpdateSnapshots({
      userId: "user-1",
      modelUpdateId: "mu-idempotent",
      db: db as never,
      movementRationale: "Reason; with semicolon.",
    });

    expect(first.movementRationale).toBe("Reason; with semicolon.");
    expect(second.movementRationale).toBe("Reason; with semicolon.");
    expect(second.updated).toBe(false);
    expect(rows[0]!.internalNotes).toBe(notesAfterFirst);
  });
});
