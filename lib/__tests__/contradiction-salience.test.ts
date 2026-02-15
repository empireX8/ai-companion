import { describe, expect, it } from "vitest";

import { computeSalience, isTop3Eligible } from "../contradiction-salience";

describe("computeSalience", () => {
  it("increases when snoozeCount increases", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const base = {
      status: "open" as const,
      snoozeCount: 0,
      evidenceCount: 2,
      lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
      lastTouchedAt: new Date("2026-02-13T00:00:00.000Z"),
    };

    const low = computeSalience(base, now);
    const high = computeSalience({ ...base, snoozeCount: 3 }, now);

    expect(high).toBeGreaterThan(low);
  });

  it("gives higher score to more recent evidence", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const base = {
      status: "open" as const,
      snoozeCount: 0,
      evidenceCount: 5,
      lastTouchedAt: new Date("2026-02-13T00:00:00.000Z"),
    };

    const recent = computeSalience(
      { ...base, lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z") },
      now
    );
    const old = computeSalience(
      { ...base, lastEvidenceAt: new Date("2026-01-20T00:00:00.000Z") },
      now
    );

    expect(recent).toBeGreaterThan(old);
  });
});

describe("isTop3Eligible", () => {
  it("excludes snoozed contradictions with future snoozedUntil", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const eligibleIds = [
      {
        id: "a",
        status: "open" as const,
        snoozedUntil: null,
      },
      {
        id: "b",
        status: "snoozed" as const,
        snoozedUntil: new Date("2026-02-14T00:00:00.000Z"),
      },
      {
        id: "c",
        status: "snoozed" as const,
        snoozedUntil: new Date("2026-02-20T00:00:00.000Z"),
      },
    ]
      .filter((item) => isTop3Eligible(item, now))
      .map((item) => item.id);

    expect(eligibleIds).toEqual(["a", "b"]);
  });
});
