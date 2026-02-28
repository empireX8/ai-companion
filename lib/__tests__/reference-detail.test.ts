import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getReferenceDetail,
  ReferenceDetailNotFoundError,
} from "../reference-detail";

// ── Mock DB factory ──────────────────────────────────────────────────────────

type MockItem = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  supersedesId: string | null;
  sourceMessageId: string | null;
};

function makeItem(overrides: Partial<MockItem> = {}): MockItem {
  return {
    id: "ref_1",
    type: "goal",
    confidence: "medium",
    statement: "I want to be consistent",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    supersedesId: null,
    sourceMessageId: null,
    ...overrides,
  };
}

type FindFirstArgs = {
  where: Record<string, unknown>;
  select?: unknown;
  orderBy?: unknown;
};

function makeMockDb(opts: {
  // Map from id → item, or null to simulate not found
  items: Record<string, MockItem | null>;
  // Items where supersedesId = a given referenceId
  supersededByMap?: Record<string, MockItem>;
  // Optional: span to return for a given messageId
  spanByMessageId?: Record<string, { id: string } | null>;
}) {
  const db = {
    referenceItem: {
      findFirst: async ({ where }: FindFirstArgs): Promise<MockItem | null> => {
        // Looking up by { id, userId } — main fetch
        if (where.id && typeof where.id === "string") {
          return opts.items[where.id] ?? null;
        }

        // Looking up by { supersedesId, userId } — previousVersion fetch
        if (where.supersedesId && typeof where.supersedesId === "string") {
          return opts.supersededByMap?.[where.supersedesId as string] ?? null;
        }

        return null;
      },
    },
    evidenceSpan: {
      findFirst: async ({ where }: FindFirstArgs): Promise<{ id: string } | null> => {
        const messageId =
          typeof where.messageId === "string" ? where.messageId : null;
        if (!messageId) return null;
        return opts.spanByMessageId?.[messageId] ?? null;
      },
    },
  };

  return db as unknown as PrismaClient;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getReferenceDetail", () => {
  it("returns current reference", async () => {
    const current = makeItem({ id: "ref_1" });
    const db = makeMockDb({ items: { ref_1: current } });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_1",
      db,
    });

    expect(result.current).toMatchObject({ id: "ref_1", statement: current.statement });
  });

  it("throws ReferenceDetailNotFoundError when reference does not exist", async () => {
    const db = makeMockDb({ items: { ref_1: null } });

    await expect(
      getReferenceDetail({ userId: "u1", referenceId: "ref_1", db })
    ).rejects.toThrow(ReferenceDetailNotFoundError);
  });

  it("throws ReferenceDetailNotFoundError for another user's reference", async () => {
    const db = makeMockDb({ items: {} });

    await expect(
      getReferenceDetail({ userId: "other_user", referenceId: "ref_1", db })
    ).rejects.toThrow(ReferenceDetailNotFoundError);
  });

  it("returns previousVersion when an older item points to current (supersedesId = current.id)", async () => {
    const current = makeItem({ id: "ref_new" });
    const older = makeItem({ id: "ref_old", status: "superseded", supersedesId: "ref_new" });
    const db = makeMockDb({
      items: { ref_new: current },
      supersededByMap: { ref_new: older },
    });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_new",
      db,
    });

    expect(result.previousVersion).toMatchObject({ id: "ref_old" });
  });

  it("returns null previousVersion when no older item points to current", async () => {
    const current = makeItem({ id: "ref_1" });
    const db = makeMockDb({ items: { ref_1: current } });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_1",
      db,
    });

    expect(result.previousVersion).toBeNull();
  });

  it("returns nextVersions when current has a supersedesId (points to newer item)", async () => {
    const current = makeItem({ id: "ref_old", status: "superseded", supersedesId: "ref_new" });
    const newer = makeItem({ id: "ref_new", status: "active" });
    const db = makeMockDb({ items: { ref_old: current, ref_new: newer } });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_old",
      db,
    });

    expect(result.nextVersions).toHaveLength(1);
    expect(result.nextVersions[0]).toMatchObject({ id: "ref_new" });
  });

  it("returns empty nextVersions when current has no supersedesId", async () => {
    const current = makeItem({ id: "ref_1", supersedesId: null });
    const db = makeMockDb({ items: { ref_1: current } });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_1",
      db,
    });

    expect(result.nextVersions).toHaveLength(0);
  });

  it("can return both previousVersion and nextVersions for a middle item", async () => {
    // ref_old → ref_mid → ref_new
    const current = makeItem({ id: "ref_mid", status: "superseded", supersedesId: "ref_new" });
    const older = makeItem({ id: "ref_old", status: "superseded", supersedesId: "ref_mid" });
    const newer = makeItem({ id: "ref_new", status: "active" });
    const db = makeMockDb({
      items: { ref_mid: current, ref_new: newer },
      supersededByMap: { ref_mid: older },
    });

    const result = await getReferenceDetail({
      userId: "u1",
      referenceId: "ref_mid",
      db,
    });

    expect(result.previousVersion).toMatchObject({ id: "ref_old" });
    expect(result.nextVersions).toHaveLength(1);
    expect(result.nextVersions[0]).toMatchObject({ id: "ref_new" });
  });

  it("ReferenceDetailNotFoundError has status 404 and correct code", () => {
    const err = new ReferenceDetailNotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe("REFERENCE_NOT_FOUND");
  });

  it("returns spanId when an EvidenceSpan exists for the sourceMessageId", async () => {
    const current = makeItem({ id: "ref_1", sourceMessageId: "msg_1" });
    const db = makeMockDb({
      items: { ref_1: current },
      spanByMessageId: { msg_1: { id: "span_42" } },
    });

    const result = await getReferenceDetail({ userId: "u1", referenceId: "ref_1", db });

    expect(result.current.spanId).toBe("span_42");
  });

  it("returns spanId null when no EvidenceSpan exists for the sourceMessageId", async () => {
    const current = makeItem({ id: "ref_1", sourceMessageId: "msg_no_span" });
    const db = makeMockDb({
      items: { ref_1: current },
      spanByMessageId: {},
    });

    const result = await getReferenceDetail({ userId: "u1", referenceId: "ref_1", db });

    expect(result.current.spanId).toBeNull();
  });

  it("returns spanId null when sourceMessageId is null", async () => {
    const current = makeItem({ id: "ref_1", sourceMessageId: null });
    const db = makeMockDb({ items: { ref_1: current } });

    const result = await getReferenceDetail({ userId: "u1", referenceId: "ref_1", db });

    expect(result.current.spanId).toBeNull();
  });

  it("chain items (previousVersion, nextVersions) have spanId null", async () => {
    const current = makeItem({ id: "ref_mid", status: "superseded", supersedesId: "ref_new" });
    const older = makeItem({ id: "ref_old", status: "superseded", supersedesId: "ref_mid" });
    const newer = makeItem({ id: "ref_new", status: "active" });
    const db = makeMockDb({
      items: { ref_mid: current, ref_new: newer },
      supersededByMap: { ref_mid: older },
    });

    const result = await getReferenceDetail({ userId: "u1", referenceId: "ref_mid", db });

    expect(result.previousVersion?.spanId).toBeNull();
    expect(result.nextVersions[0]?.spanId).toBeNull();
  });
});
