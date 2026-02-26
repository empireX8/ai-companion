import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { expireSnoozedContradictionsForUser } from "../contradiction-snooze-expiry";

type UpdateManyArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

function makeMockDb(count = 0) {
  const calls: UpdateManyArgs[] = [];

  const db = {
    contradictionNode: {
      updateMany: async ({ where, data }: UpdateManyArgs) => {
        calls.push({ where, data });
        return { count };
      },
    },
  };

  return { db: db as unknown as PrismaClient, calls };
}

describe("expireSnoozedContradictionsForUser", () => {
  const now = new Date("2026-02-24T12:00:00Z");

  it("calls updateMany with the correct where clause", async () => {
    const { db, calls } = makeMockDb(2);
    await expireSnoozedContradictionsForUser({ userId: "u1", db, now });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.where).toMatchObject({
      userId: "u1",
      status: "snoozed",
      snoozedUntil: { not: null, lte: now },
    });
  });

  it("sets status to open and clears snoozedUntil in the update data", async () => {
    const { db, calls } = makeMockDb(1);
    await expireSnoozedContradictionsForUser({ userId: "u1", db, now });

    expect(calls[0]!.data).toMatchObject({
      status: "open",
      snoozedUntil: null,
    });
  });

  it("does not include lastTouchedAt in the update data", async () => {
    const { db, calls } = makeMockDb(1);
    await expireSnoozedContradictionsForUser({ userId: "u1", db, now });

    expect(calls[0]!.data).not.toHaveProperty("lastTouchedAt");
  });

  it("returns the count of expired nodes", async () => {
    const { db } = makeMockDb(3);
    const result = await expireSnoozedContradictionsForUser({ userId: "u1", db, now });

    expect(result).toEqual({ expired: 3 });
  });

  it("returns expired: 0 when no nodes are eligible", async () => {
    const { db } = makeMockDb(0);
    const result = await expireSnoozedContradictionsForUser({ userId: "u1", db, now });

    expect(result).toEqual({ expired: 0 });
  });

  it("filters by the supplied userId", async () => {
    const { db, calls } = makeMockDb(0);
    await expireSnoozedContradictionsForUser({ userId: "user_xyz", db, now });

    expect(calls[0]!.where).toMatchObject({ userId: "user_xyz" });
  });

  it("uses the supplied now timestamp in the snoozedUntil lte filter", async () => {
    const customNow = new Date("2025-06-01T00:00:00Z");
    const { db, calls } = makeMockDb(0);
    await expireSnoozedContradictionsForUser({ userId: "u1", db, now: customNow });

    expect(calls[0]!.where).toMatchObject({
      snoozedUntil: { lte: customNow },
    });
  });
});
