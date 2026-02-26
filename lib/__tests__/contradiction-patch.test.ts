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

  it("always sets lastTouchedAt — invariant holds for resolve and archive", () => {
    const now = new Date("2026-02-24T12:00:00Z");

    const resolve = buildContradictionPatchData(
      { action: "resolve" },
      0,
      now,
      { statusOverride: "resolved", forceSnoozedUntilNull: true }
    );
    expect(resolve.lastTouchedAt).toBe(now);

    const archive = buildContradictionPatchData(
      { action: "archive_tension" },
      0,
      now,
      { statusOverride: "archived_tension", forceSnoozedUntilNull: true }
    );
    expect(archive.lastTouchedAt).toBe(now);
  });

  it("sets snoozedUntil to null when forceSnoozedUntilNull is true", () => {
    const now = new Date("2026-02-24T12:00:00Z");

    const resolve = buildContradictionPatchData(
      { action: "resolve" },
      0,
      now,
      { statusOverride: "resolved", forceSnoozedUntilNull: true }
    );
    expect(resolve.snoozedUntil).toBeNull();

    const tradeoff = buildContradictionPatchData(
      { action: "accept_tradeoff" },
      0,
      now,
      { statusOverride: "accepted_tradeoff", forceSnoozedUntilNull: true }
    );
    expect(tradeoff.snoozedUntil).toBeNull();

    const archive = buildContradictionPatchData(
      { action: "archive_tension" },
      0,
      now,
      { statusOverride: "archived_tension", forceSnoozedUntilNull: true }
    );
    expect(archive.snoozedUntil).toBeNull();
  });

  it("converts snoozedUntil ISO string to a Date instance for snooze action", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const iso = "2026-03-07T23:59:59.000Z";

    const result = buildContradictionPatchData(
      { action: "snooze", snoozedUntil: iso },
      0,
      now,
      { statusOverride: "snoozed" }
    );

    expect(result.snoozedUntil).toBeInstanceOf(Date);
    expect((result.snoozedUntil as Date).toISOString()).toBe(iso);
  });

  it("does not set snoozeCount for resolve or reopen transitions", () => {
    const now = new Date("2026-02-24T12:00:00Z");

    const resolve = buildContradictionPatchData(
      { action: "resolve" },
      0,
      now,
      { statusOverride: "resolved", forceSnoozedUntilNull: true }
    );
    expect(resolve.snoozeCount).toBeUndefined();

    const reopen = buildContradictionPatchData(
      { action: "reopen" },
      0,
      now,
      { statusOverride: "open" }
    );
    expect(reopen.snoozeCount).toBeUndefined();
  });

  it("applies weightDelta as a Prisma increment", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const result = buildContradictionPatchData({ weightDelta: 3 }, 0, now);
    expect(result.weight).toEqual({ increment: 3 });
  });

  it("leaves weight undefined when no weightDelta is provided", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const result = buildContradictionPatchData({}, 0, now);
    expect(result.weight).toBeUndefined();
  });

  it("unsnooze: clears snoozedUntil and sets status=open and lastTouchedAt", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const result = buildContradictionPatchData(
      { action: "unsnooze" },
      0,
      now,
      { statusOverride: "open", forceSnoozedUntilNull: true }
    );
    expect(result.snoozedUntil).toBeNull();
    expect(result.status).toBe("open");
    expect(result.lastTouchedAt).toBe(now);
    expect(result.snoozeCount).toBeUndefined();
  });
});
