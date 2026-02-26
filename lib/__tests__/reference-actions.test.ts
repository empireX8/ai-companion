import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  performReferenceAction,
  ReferenceNotFoundError,
  ReferenceTransitionError,
} from "../reference-actions";

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
  userId?: string;
};

type UpdateArgs = { where: { id: string }; data: Record<string, unknown>; select?: unknown };
type CreateArgs = { data: Record<string, unknown>; select?: unknown };

function makeMockDb(opts: { item?: Partial<MockItem> | null }) {
  const updateCalls: UpdateArgs[] = [];
  const createCalls: CreateArgs[] = [];

  const baseItem: MockItem = {
    id: "ref_1",
    type: "goal",
    confidence: "medium",
    statement: "I want to be consistent",
    status: "active",
    userId: "u1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    supersedesId: null,
    ...(opts.item ?? {}),
  };

  const db = {
    referenceItem: {
      findFirst: async () => {
        if (opts.item === null) return null;
        return baseItem;
      },
      update: async ({ where, data, select }: UpdateArgs) => {
        updateCalls.push({ where, data, select });
        return { ...baseItem, ...data, id: where.id };
      },
      create: async ({ data, select }: CreateArgs) => {
        createCalls.push({ data, select });
        return {
          id: "ref_new",
          type: data.type,
          confidence: data.confidence,
          statement: data.statement,
          status: data.status,
          createdAt: new Date(),
          updatedAt: new Date(),
          supersedesId: null,
        };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(db);
    },
  };

  return {
    db: db as unknown as PrismaClient,
    updateCalls,
    createCalls,
    baseItem,
  };
}

// ── promote_candidate ─────────────────────────────────────────────────────────

describe("promote_candidate", () => {
  it("promotes a candidate to active", async () => {
    const { db, updateCalls } = makeMockDb({
      item: { status: "candidate" },
    });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "promote_candidate",
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ status: "active" });
  });

  it("throws ReferenceTransitionError when status is not candidate", async () => {
    const { db } = makeMockDb({ item: { status: "active" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "promote_candidate",
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });

  it("throws for superseded status", async () => {
    const { db } = makeMockDb({ item: { status: "superseded" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "promote_candidate",
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });
});

// ── supersede ─────────────────────────────────────────────────────────────────

describe("supersede", () => {
  it("creates a new active reference with the new statement", async () => {
    const { db, createCalls } = makeMockDb({ item: { status: "active" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "supersede",
      payload: { newStatement: "Updated statement" },
      db,
    });

    expect(createCalls[0]!.data).toMatchObject({
      statement: "Updated statement",
      status: "active",
      type: "goal",
    });
  });

  it("marks old reference as superseded with supersedesId pointing to new item", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "active" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "supersede",
      payload: { newStatement: "Updated statement" },
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({
      status: "superseded",
      supersedesId: "ref_new",
    });
  });

  it("inherits confidence from old item when newConfidence is omitted", async () => {
    const { db, createCalls } = makeMockDb({
      item: { status: "active", confidence: "high" },
    });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "supersede",
      payload: { newStatement: "New version" },
      db,
    });

    expect(createCalls[0]!.data).toMatchObject({ confidence: "high" });
  });

  it("uses newConfidence when provided", async () => {
    const { db, createCalls } = makeMockDb({ item: { status: "active" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "supersede",
      payload: { newStatement: "Updated", newConfidence: "low" },
      db,
    });

    expect(createCalls[0]!.data).toMatchObject({ confidence: "low" });
  });

  it("throws ReferenceTransitionError when status is not active", async () => {
    const { db } = makeMockDb({ item: { status: "candidate" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "supersede",
        payload: { newStatement: "x" },
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });

  it("returns both newItem and oldItem", async () => {
    const { db } = makeMockDb({ item: { status: "active" } });

    const result = await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "supersede",
      payload: { newStatement: "New statement" },
      db,
    });

    expect(result).toHaveProperty("newItem");
    expect(result).toHaveProperty("oldItem");
  });
});

// ── deactivate ────────────────────────────────────────────────────────────────

describe("deactivate", () => {
  it("deactivates an active reference (sets status=inactive)", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "active" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "deactivate",
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ status: "inactive" });
  });

  it("deactivates a candidate reference", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "candidate" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "deactivate",
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ status: "inactive" });
  });

  it("throws for superseded status", async () => {
    const { db } = makeMockDb({ item: { status: "superseded" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "deactivate",
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });

  it("throws for inactive status", async () => {
    const { db } = makeMockDb({ item: { status: "inactive" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "deactivate",
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });
});

// ── update_confidence ────────────────────────────────────────────────────────

describe("update_confidence", () => {
  it("updates confidence for an active reference", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "active" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "update_confidence",
      payload: { confidence: "high" },
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ confidence: "high" });
  });

  it("updates confidence for a candidate reference", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "candidate" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "update_confidence",
      payload: { confidence: "low" },
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ confidence: "low" });
  });

  it("updates confidence for an inactive reference", async () => {
    const { db, updateCalls } = makeMockDb({ item: { status: "inactive" } });

    await performReferenceAction({
      userId: "u1",
      referenceId: "ref_1",
      action: "update_confidence",
      payload: { confidence: "medium" },
      db,
    });

    expect(updateCalls[0]!.data).toMatchObject({ confidence: "medium" });
  });

  it("throws ReferenceTransitionError for superseded status", async () => {
    const { db } = makeMockDb({ item: { status: "superseded" } });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_1",
        action: "update_confidence",
        payload: { confidence: "high" },
        db,
      })
    ).rejects.toThrow(ReferenceTransitionError);
  });
});

// ── not found ─────────────────────────────────────────────────────────────────

describe("not found", () => {
  it("throws ReferenceNotFoundError when reference does not exist", async () => {
    const { db } = makeMockDb({ item: null });

    await expect(
      performReferenceAction({
        userId: "u1",
        referenceId: "ref_missing",
        action: "promote_candidate",
        db,
      })
    ).rejects.toThrow(ReferenceNotFoundError);
  });

  it("ReferenceNotFoundError has status 404", () => {
    const err = new ReferenceNotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe("REFERENCE_NOT_FOUND");
  });
});

// ── transition errors ────────────────────────────────────────────────────────

describe("ReferenceTransitionError", () => {
  it("has status 422 and code INVALID_STATUS_FOR_ACTION", () => {
    const err = new ReferenceTransitionError(
      "INVALID_STATUS_FOR_ACTION",
      "not allowed"
    );
    expect(err.status).toBe(422);
    expect(err.code).toBe("INVALID_STATUS_FOR_ACTION");
  });
});
