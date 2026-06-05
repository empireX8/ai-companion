import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  FieldworkStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FieldworkLifecyclePersistenceError,
  updateFieldworkCandidateLifecycleStatus,
} from "../fieldwork-candidate-lifecycle-persistence";

const FIXED_NOW = new Date("2026-06-05T12:00:00.000Z");

type InMemoryFieldworkAssignment = {
  id: string;
  userId: string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  status: FieldworkStatus;
  visibility: FieldworkAssignmentVisibility;
  updatedAt?: Date;
};

function createMockDb(args?: { seedAssignments?: InMemoryFieldworkAssignment[] }) {
  const assignments: InMemoryFieldworkAssignment[] = [...(args?.seedAssignments ?? [])];

  const db = {
    fieldworkAssignment: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) => {
          return (
            assignments.find(
              (row) => row.id === where.id && row.userId === where.userId
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
          data: { candidateLifecycleStatus: CandidateLifecycleStatus; updatedAt: Date };
        }) => {
          const idx = assignments.findIndex((row) => row.id === where.id);
          if (idx < 0) {
            throw new Error("fieldwork assignment not found in mock");
          }
          assignments[idx] = {
            ...assignments[idx],
            candidateLifecycleStatus: data.candidateLifecycleStatus,
            updatedAt: data.updatedAt,
          };
          const row = assignments[idx];
          return {
            id: row.id,
            userId: row.userId,
            candidateLifecycleStatus: row.candidateLifecycleStatus,
            status: row.status,
            visibility: row.visibility,
            updatedAt: row.updatedAt ?? FIXED_NOW,
          };
        }
      ),
    },
  } as unknown as import("@prisma/client").PrismaClient;

  return { db, assignments };
}

describe("updateFieldworkCandidateLifecycleStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("promotes Fieldwork candidate from proposed through held_for_more_evidence", async () => {
    const { db, assignments } = createMockDb({
      seedAssignments: [
        {
          id: "fw-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: FieldworkStatus.assigned,
          visibility: FieldworkAssignmentVisibility.internal_only,
        },
      ],
    });

    await updateFieldworkCandidateLifecycleStatus(
      "user-1",
      "fw-1",
      CandidateLifecycleStatus.held_for_more_evidence,
      { db, now: FIXED_NOW }
    );

    const result = await updateFieldworkCandidateLifecycleStatus(
      "user-1",
      "fw-1",
      CandidateLifecycleStatus.promoted,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.held_for_more_evidence);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.promoted);

    const row = assignments[0];
    expect(row?.candidateLifecycleStatus).toBe(CandidateLifecycleStatus.promoted);
    expect(row?.status).toBe(FieldworkStatus.assigned);
    expect(row?.visibility).toBe(FieldworkAssignmentVisibility.internal_only);
  });

  it("changes only candidateLifecycleStatus", async () => {
    const { db, assignments } = createMockDb({
      seedAssignments: [
        {
          id: "fw-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: FieldworkStatus.active,
          visibility: FieldworkAssignmentVisibility.internal_only,
        },
      ],
    });

    await updateFieldworkCandidateLifecycleStatus(
      "user-1",
      "fw-1",
      CandidateLifecycleStatus.rejected,
      { db, now: FIXED_NOW }
    );

    expect(assignments[0]).toMatchObject({
      candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
      status: FieldworkStatus.active,
      visibility: FieldworkAssignmentVisibility.internal_only,
    });
  });

  it("throws FIELDWORK_NOT_FOUND for missing row", async () => {
    const { db } = createMockDb();

    await expect(
      updateFieldworkCandidateLifecycleStatus(
        "user-1",
        "missing-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "FIELDWORK_NOT_FOUND" });
  });

  it("throws NULL_LIFECYCLE_STATUS for legacy rows", async () => {
    const { db } = createMockDb({
      seedAssignments: [
        {
          id: "fw-legacy",
          userId: "user-1",
          candidateLifecycleStatus: null,
          status: FieldworkStatus.assigned,
          visibility: FieldworkAssignmentVisibility.user_visible,
        },
      ],
    });

    await expect(
      updateFieldworkCandidateLifecycleStatus(
        "user-1",
        "fw-legacy",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "NULL_LIFECYCLE_STATUS" });
  });

  it("throws FORBIDDEN_TRANSITION for invalid transition", async () => {
    const { db } = createMockDb({
      seedAssignments: [
        {
          id: "fw-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: FieldworkStatus.assigned,
          visibility: FieldworkAssignmentVisibility.internal_only,
        },
      ],
    });

    await expect(
      updateFieldworkCandidateLifecycleStatus(
        "user-1",
        "fw-1",
        CandidateLifecycleStatus.promoted,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN_TRANSITION" });
  });

  it("throws FORBIDDEN_TRANSITION for wrong user ownership via missing row", async () => {
    const { db } = createMockDb({
      seedAssignments: [
        {
          id: "fw-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: FieldworkStatus.assigned,
          visibility: FieldworkAssignmentVisibility.internal_only,
        },
      ],
    });

    await expect(
      updateFieldworkCandidateLifecycleStatus(
        "user-2",
        "fw-1",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "FIELDWORK_NOT_FOUND" });
  });

  it("throws FieldworkLifecyclePersistenceError for failures", async () => {
    const { db } = createMockDb();

    await expect(
      updateFieldworkCandidateLifecycleStatus(
        "user-1",
        "missing-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toBeInstanceOf(FieldworkLifecyclePersistenceError);
  });
});
