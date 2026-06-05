import {
  CandidateLifecycleStatus,
  InvestigationStatus,
  InvestigationVisibility,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InvestigationLifecyclePersistenceError,
  updateInvestigationCandidateLifecycleStatus,
} from "../investigation-candidate-lifecycle-persistence";

const FIXED_NOW = new Date("2026-06-05T12:00:00.000Z");

type InMemoryInvestigation = {
  id: string;
  userId: string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  status: InvestigationStatus;
  visibility: InvestigationVisibility;
  updatedAt?: Date;
};

function createMockDb(args?: { seedInvestigations?: InMemoryInvestigation[] }) {
  const investigations: InMemoryInvestigation[] = [...(args?.seedInvestigations ?? [])];

  const db = {
    investigation: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) => {
          return (
            investigations.find(
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
          const idx = investigations.findIndex((row) => row.id === where.id);
          if (idx < 0) {
            throw new Error("investigation not found in mock");
          }
          investigations[idx] = {
            ...investigations[idx],
            candidateLifecycleStatus: data.candidateLifecycleStatus,
            updatedAt: data.updatedAt,
          };
          const row = investigations[idx];
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

  return { db, investigations };
}

describe("updateInvestigationCandidateLifecycleStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("promotes Investigation candidate from proposed through held_for_more_evidence", async () => {
    const { db, investigations } = createMockDb({
      seedInvestigations: [
        {
          id: "inv-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: InvestigationStatus.open,
          visibility: InvestigationVisibility.internal_only,
        },
      ],
    });

    await updateInvestigationCandidateLifecycleStatus(
      "user-1",
      "inv-1",
      CandidateLifecycleStatus.held_for_more_evidence,
      { db, now: FIXED_NOW }
    );

    const result = await updateInvestigationCandidateLifecycleStatus(
      "user-1",
      "inv-1",
      CandidateLifecycleStatus.promoted,
      { db, now: FIXED_NOW }
    );

    expect(result.previousStatus).toBe(CandidateLifecycleStatus.held_for_more_evidence);
    expect(result.newStatus).toBe(CandidateLifecycleStatus.promoted);

    const row = investigations[0];
    expect(row?.candidateLifecycleStatus).toBe(CandidateLifecycleStatus.promoted);
    expect(row?.status).toBe(InvestigationStatus.open);
    expect(row?.visibility).toBe(InvestigationVisibility.internal_only);
  });

  it("changes only candidateLifecycleStatus", async () => {
    const { db, investigations } = createMockDb({
      seedInvestigations: [
        {
          id: "inv-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: InvestigationStatus.gathering_evidence,
          visibility: InvestigationVisibility.internal_only,
        },
      ],
    });

    await updateInvestigationCandidateLifecycleStatus(
      "user-1",
      "inv-1",
      CandidateLifecycleStatus.rejected,
      { db, now: FIXED_NOW }
    );

    expect(investigations[0]).toMatchObject({
      candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
      status: InvestigationStatus.gathering_evidence,
      visibility: InvestigationVisibility.internal_only,
    });
  });

  it("throws INVESTIGATION_NOT_FOUND for missing row", async () => {
    const { db } = createMockDb();

    await expect(
      updateInvestigationCandidateLifecycleStatus(
        "user-1",
        "missing-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "INVESTIGATION_NOT_FOUND" });
  });

  it("throws NULL_LIFECYCLE_STATUS for legacy rows", async () => {
    const { db } = createMockDb({
      seedInvestigations: [
        {
          id: "inv-legacy",
          userId: "user-1",
          candidateLifecycleStatus: null,
          status: InvestigationStatus.open,
          visibility: InvestigationVisibility.user_visible,
        },
      ],
    });

    await expect(
      updateInvestigationCandidateLifecycleStatus(
        "user-1",
        "inv-legacy",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "NULL_LIFECYCLE_STATUS" });
  });

  it("throws FORBIDDEN_TRANSITION for invalid transition", async () => {
    const { db } = createMockDb({
      seedInvestigations: [
        {
          id: "inv-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: InvestigationStatus.open,
          visibility: InvestigationVisibility.internal_only,
        },
      ],
    });

    await expect(
      updateInvestigationCandidateLifecycleStatus(
        "user-1",
        "inv-1",
        CandidateLifecycleStatus.promoted,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN_TRANSITION" });
  });

  it("throws FORBIDDEN_TRANSITION for wrong user ownership via missing row", async () => {
    const { db } = createMockDb({
      seedInvestigations: [
        {
          id: "inv-1",
          userId: "user-1",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          status: InvestigationStatus.open,
          visibility: InvestigationVisibility.internal_only,
        },
      ],
    });

    await expect(
      updateInvestigationCandidateLifecycleStatus(
        "user-2",
        "inv-1",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toMatchObject({ code: "INVESTIGATION_NOT_FOUND" });
  });

  it("throws InvestigationLifecyclePersistenceError for failures", async () => {
    const { db } = createMockDb();

    await expect(
      updateInvestigationCandidateLifecycleStatus(
        "user-1",
        "missing-id",
        CandidateLifecycleStatus.rejected,
        { db, now: FIXED_NOW }
      )
    ).rejects.toBeInstanceOf(InvestigationLifecyclePersistenceError);
  });
});
