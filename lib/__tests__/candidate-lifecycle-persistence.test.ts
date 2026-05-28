/**
 * candidate-lifecycle-persistence.test.ts
 *
 * Phase 2L — Focused tests for UserMapConclusion candidate lifecycle persistence helper.
 *
 * Tests cover:
 * - Valid transitions (proposed → rejected, held → promoted, etc.)
 * - Invalid transitions (promoted → proposed, etc.)
 * - Null legacy records (null candidateLifecycleStatus)
 * - Missing records (conclusion not found)
 * - Wrong user ownership
 * - User ownership enforcement
 */

import { CandidateLifecycleStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LifecyclePersistenceError,
  updateCandidateLifecycleStatus,
} from "../candidate-lifecycle-persistence";

const FIXED_NOW = new Date("2026-05-28T12:00:00.000Z");

type InMemoryConclusion = {
  id: string;
  userId: string;
  candidateLifecycleStatus: string | null;
  updatedAt?: Date;
};

/**
 * Build a minimal mock PrismaClient for lifecycle persistence tests.
 */
function createMockDb(args?: {
  seedConclusions?: InMemoryConclusion[];
}) {
  const conclusions: InMemoryConclusion[] = [
    ...(args?.seedConclusions ?? []),
  ];

  const db = {
    userMapConclusion: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: string; userId: string };
        }) => {
          return (
            conclusions.find(
              (c) => c.id === where.id && c.userId === where.userId
            ) ?? null
          );
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { candidateLifecycleStatus: string; updatedAt: Date };
        }) => {
          const idx = conclusions.findIndex((c) => c.id === where.id);
          if (idx < 0) {
            throw new Error("conclusion not found in mock");
          }
          conclusions[idx] = {
            ...conclusions[idx],
            candidateLifecycleStatus: data.candidateLifecycleStatus,
            updatedAt: data.updatedAt,
          };
          return {
            id: conclusions[idx].id,
            userId: conclusions[idx].userId,
            candidateLifecycleStatus: conclusions[idx].candidateLifecycleStatus,
            updatedAt: conclusions[idx].updatedAt ?? FIXED_NOW,
          };
        }
      ),
    },
  } as unknown as import("@prisma/client").PrismaClient;

  return { db, conclusions };
}

describe("updateCandidateLifecycleStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Valid transitions ────────────────────────────────────────────

  it("allows proposed → rejected", async () => {
    const { db, conclusions } = createMockDb({
      seedConclusions: [
        {
          id: "umc-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-1",
      CandidateLifecycleStatus.rejected,
      { db, now: FIXED_NOW }
    );

    expect(result.id).toBe("umc-1");
    expect(result.userId).toBe("user-1");
    expect(result.previousStatus).toBe(CandidateLifecycleStatus.proposed);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.rejected);
    expect(result.updatedAt).toEqual(FIXED_NOW);

    // Verify the in-memory record was updated
    const updated = conclusions.find((c) => c.id === "umc-1");
    expect(updated?.candidateLifecycleStatus).toBe(
      CandidateLifecycleStatus.rejected
    );
  });

  it("allows held_for_more_evidence → promoted", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-2",
          userId: "user-1",
          candidateLifecycleStatus:
            CandidateLifecycleStatus.held_for_more_evidence,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-2",
      CandidateLifecycleStatus.promoted,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(result.newStatus).toBe(CandidateLifecycleStatus.promoted);
  });

  it("allows proposed → held_for_more_evidence", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-3",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-3",
      CandidateLifecycleStatus.held_for_more_evidence,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.proposed);
    expect(result.newStatus).toBe(
      CandidateLifecycleStatus.held_for_more_evidence
    );
  });

  it("allows proposed → expired", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-4",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-4",
      CandidateLifecycleStatus.expired,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.proposed);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.expired);
  });

  it("allows promoted → superseded", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-5",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-5",
      CandidateLifecycleStatus.superseded,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.promoted);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.superseded);
  });

  it("allows rejected → proposed (new candidate cycle)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-6",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-6",
      CandidateLifecycleStatus.proposed,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.rejected);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.proposed);
  });

  it("allows expired → proposed (new candidate cycle)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-7",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.expired,
        },
      ],
    });

    const result = await updateCandidateLifecycleStatus(
      "user-1",
      "umc-7",
      CandidateLifecycleStatus.proposed,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.expired);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.proposed);
  });

  // ── Invalid transitions ──────────────────────────────────────────

  it("forbids promoted → proposed (can't un-promote)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-10",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        },
      ],
    });

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "umc-10",
        CandidateLifecycleStatus.proposed,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(LifecyclePersistenceError);

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "umc-10",
        CandidateLifecycleStatus.proposed,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(/not allowed/);
  });

  it("forbids superseded → any status (terminal)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-11",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.superseded,
        },
      ],
    });

    const allStatuses = Object.values(CandidateLifecycleStatus);
    for (const to of allStatuses) {
      await expect(
        updateCandidateLifecycleStatus("user-1", "umc-11", to, {
          db,
          now: FIXED_NOW,
        })
      ).rejects.toThrow(LifecyclePersistenceError);
    }
  });

  it("forbids proposed → promoted (must go through held_for_more_evidence)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-12",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        },
      ],
    });

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "umc-12",
        CandidateLifecycleStatus.promoted,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(LifecyclePersistenceError);
  });

  // ── Null legacy records ──────────────────────────────────────────

  it("forbids transition from null (legacy/pre-lifecycle record)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-20",
          userId: "user-1",
          candidateLifecycleStatus: null,
        },
      ],
    });

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "umc-20",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(LifecyclePersistenceError);

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "umc-20",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(/null/);
  });

  // ── Missing records ──────────────────────────────────────────────

  it("throws CONCLUSION_NOT_FOUND for non-existent conclusion", async () => {
    const { db } = createMockDb();

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "nonexistent-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(LifecyclePersistenceError);

    await expect(
      updateCandidateLifecycleStatus(
        "user-1",
        "nonexistent-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(/not found/);
  });

  // ── User ownership ───────────────────────────────────────────────

  it("throws CONCLUSION_NOT_FOUND for wrong user (ownership check)", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-30",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        },
      ],
    });

    // user-2 tries to update user-1's conclusion
    await expect(
      updateCandidateLifecycleStatus(
        "user-2",
        "umc-30",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(LifecyclePersistenceError);

    await expect(
      updateCandidateLifecycleStatus(
        "user-2",
        "umc-30",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toThrow(/not found/);
  });

  // ── Error code verification ──────────────────────────────────────

  it("throws with correct error code for null lifecycle status", async () => {
    const { db } = createMockDb({
      seedConclusions: [
        {
          id: "umc-40",
          userId: "user-1",
          candidateLifecycleStatus: null,
        },
      ],
    });

    try {
      await updateCandidateLifecycleStatus(
        "user-1",
        "umc-40",
        CandidateLifecycleStatus.proposed,
        { db, now: FIXED_NOW }
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LifecyclePersistenceError);
      if (error instanceof LifecyclePersistenceError) {
        expect(error.code).toBe("NULL_LIFECYCLE_STATUS");
      }
    }
  });

  it("throws with correct error code for conclusion not found", async () => {
    const { db } = createMockDb();

    try {
      await updateCandidateLifecycleStatus(
        "user-1",
        "umc-nonexistent",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LifecyclePersistenceError);
      if (error instanceof LifecyclePersistenceError) {
        expect(error.code).toBe("CONCLUSION_NOT_FOUND");
      }
    }
  });
});
