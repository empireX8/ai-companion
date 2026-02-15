import { describe, expect, it } from "vitest";

import { buildContradictionPatchData } from "../contradiction-patch";

describe("buildContradictionPatchData", () => {
  it("increments snoozeCount when status is snoozed", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const result = buildContradictionPatchData(
      {
        status: "snoozed",
      },
      0,
      now
    );

    expect(result.snoozeCount).toEqual({ increment: 1 });
    expect(result.lastTouchedAt).toEqual(now);
  });

  it("updates evidenceCount and lastEvidenceAt when evidence is added", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const result = buildContradictionPatchData(
      {
        touch: true,
      },
      2,
      now
    );

    expect(result.evidenceCount).toEqual({ increment: 2 });
    expect(result.lastEvidenceAt).toEqual(now);
    expect(result.lastTouchedAt).toEqual(now);
  });

  it("increments avoidanceCount and sets lastAvoidedAt for avoid action", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const result = buildContradictionPatchData(
      {
        action: "avoid",
      },
      0,
      now
    );

    expect(result.avoidanceCount).toEqual({ increment: 1 });
    expect(result.lastAvoidedAt).toEqual(now);
    expect(result.lastTouchedAt).toEqual(now);
  });
});
