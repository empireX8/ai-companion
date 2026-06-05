import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  FieldworkStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  PublishFieldworkCandidateError,
  publishFieldworkCandidate,
} from "../fieldwork-publish-helper";

const FIXED_TIME = new Date("2026-06-05T12:00:00.000Z");

function makePublishDbMock() {
  let visibility: FieldworkAssignmentVisibility =
    FieldworkAssignmentVisibility.internal_only;
  const lifecycleStatus: CandidateLifecycleStatus | null = CandidateLifecycleStatus.promoted;
  const status = FieldworkStatus.assigned;
  let updatedAt = FIXED_TIME;
  let concurrentPublishClaimed = false;
  const modelUpdates: Array<Record<string, unknown>> = [];

  const fieldworkAssignment = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; userId: string } }) => {
        if (where.id === "missing-id") {
          return null;
        }
        if (where.id === "legacy-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: null,
            status,
            prompt: "Legacy prompt",
            updatedAt,
          };
        }
        if (where.id === "proposed-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
            status,
            prompt: "Proposed prompt",
            updatedAt,
          };
        }
        if (where.id === "rejected-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
            status,
            prompt: "Rejected prompt",
            updatedAt,
          };
        }
        if (where.id === "held-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.held_for_more_evidence,
            status,
            prompt: "Held prompt",
            updatedAt,
          };
        }
        if (where.id === "expired-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.expired,
            status,
            prompt: "Expired prompt",
            updatedAt,
          };
        }
        if (where.id === "superseded-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.superseded,
            status,
            prompt: "Superseded prompt",
            updatedAt,
          };
        }
        if (where.id === "visible-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: FieldworkAssignmentVisibility.user_visible,
            candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
            status,
            prompt: "Visible prompt",
            updatedAt,
          };
        }
        if (where.id === "concurrent-race-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: FieldworkAssignmentVisibility.internal_only,
            candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
            status,
            prompt: "Race prompt",
            updatedAt,
          };
        }
        return {
          id: where.id,
          userId: where.userId,
          visibility,
          candidateLifecycleStatus: lifecycleStatus,
          status,
          prompt: "Notice when I shut down in conflict",
          updatedAt,
        };
      }
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          id: string;
          userId: string;
          visibility: FieldworkAssignmentVisibility;
          candidateLifecycleStatus: string;
        };
        data: {
          visibility: FieldworkAssignmentVisibility;
          updatedAt: Date;
        };
      }) => {
        if (where.id === "concurrent-race-id") {
          if (concurrentPublishClaimed) {
            return { count: 0 };
          }
          concurrentPublishClaimed = true;
          visibility = data.visibility;
          updatedAt = data.updatedAt;
          return { count: 1 };
        }

        const matches =
          where.visibility === FieldworkAssignmentVisibility.internal_only &&
          where.candidateLifecycleStatus === "promoted" &&
          visibility === FieldworkAssignmentVisibility.internal_only &&
          lifecycleStatus === CandidateLifecycleStatus.promoted;

        if (!matches) {
          return { count: 0 };
        }

        visibility = data.visibility;
        updatedAt = data.updatedAt;
        return { count: 1 };
      }
    ),
  };

  const modelUpdate = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `model-update-${modelUpdates.length + 1}`,
        ...data,
        createdAt: FIXED_TIME,
      };
      modelUpdates.push(row);
      return row;
    }),
  };

  const tx = {
    fieldworkAssignment,
    modelUpdate,
  };

  const db = {
    fieldworkAssignment,
    modelUpdate,
    modelUpdates,
    getVisibility: () => visibility,
    getLifecycleStatus: () => lifecycleStatus,
    getStatus: () => status,
    $transaction: vi.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) => {
        const snapshotVisibility = visibility;
        const snapshotUpdatedAt = updatedAt;
        try {
          return await callback(tx);
        } catch (error) {
          visibility = snapshotVisibility;
          updatedAt = snapshotUpdatedAt;
          throw error;
        }
      }
    ),
  };

  return db;
}

describe("publishFieldworkCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes promoted + internal_only Fieldwork and creates fieldwork_assigned ModelUpdate", async () => {
    const db = makePublishDbMock();

    const result = await publishFieldworkCandidate("user-1", "fw-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(result).toEqual({
      id: "fw-1",
      userId: "user-1",
      previousVisibility: FieldworkAssignmentVisibility.internal_only,
      newVisibility: FieldworkAssignmentVisibility.user_visible,
      updatedAt: FIXED_TIME,
    });

    expect(db.modelUpdate.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        updateType: ModelUpdateType.fieldwork_assigned,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.fieldwork_assignment,
        affectedObjectId: "fw-1",
        userFacingSummary: "New watch-for prompt: Notice when I shut down in conflict",
        isMeaningful: true,
        sourceRunId: null,
        internalNotes: "Published via internal Fieldwork candidate publish action.",
      },
    });
    expect(db.getVisibility()).toBe(FieldworkAssignmentVisibility.user_visible);
    expect(db.getLifecycleStatus()).toBe(CandidateLifecycleStatus.promoted);
    expect(db.getStatus()).toBe(FieldworkStatus.assigned);
  });

  it("runs publish visibility update and ModelUpdate creation in one transaction", async () => {
    const db = makePublishDbMock();

    await publishFieldworkCandidate("user-1", "fw-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.fieldworkAssignment.updateMany).toHaveBeenCalledTimes(1);
    expect(db.modelUpdate.create).toHaveBeenCalledTimes(1);
  });

  it("rolls back visibility when ModelUpdate creation fails", async () => {
    const db = makePublishDbMock();
    db.modelUpdate.create.mockRejectedValueOnce(new Error("ModelUpdate insert failed"));

    await expect(
      publishFieldworkCandidate("user-1", "fw-1", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toThrow("ModelUpdate insert failed");

    expect(db.getVisibility()).toBe(FieldworkAssignmentVisibility.internal_only);
    expect(db.modelUpdates).toHaveLength(0);
  });

  it("does not create ModelUpdate when conditional update affects 0 rows", async () => {
    const db = makePublishDbMock();
    db.fieldworkAssignment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      publishFieldworkCandidate("user-1", "fw-1", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toMatchObject({ code: "ALREADY_VISIBLE" });

    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("rejects proposed, rejected, held, expired, and superseded rows", async () => {
    const db = makePublishDbMock();

    for (const id of ["proposed-id", "rejected-id", "held-id", "expired-id", "superseded-id"]) {
      await expect(
        publishFieldworkCandidate("user-1", id, { db: db as never })
      ).rejects.toMatchObject({ code: "NOT_PROMOTED" });
    }

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects already user_visible rows", async () => {
    const db = makePublishDbMock();

    await expect(
      publishFieldworkCandidate("user-1", "visible-id", { db: db as never })
    ).rejects.toMatchObject({ code: "ALREADY_VISIBLE" });
  });

  it("rejects missing and null lifecycle rows", async () => {
    const db = makePublishDbMock();

    await expect(
      publishFieldworkCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toMatchObject({ code: "FIELDWORK_NOT_FOUND" });

    await expect(
      publishFieldworkCandidate("user-1", "legacy-id", { db: db as never })
    ).rejects.toMatchObject({ code: "NULL_LIFECYCLE_STATUS" });
  });

  it("does not produce duplicate ModelUpdates under concurrent publish simulation", async () => {
    const db = makePublishDbMock();

    const results = await Promise.allSettled([
      publishFieldworkCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
      publishFieldworkCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(db.modelUpdates).toHaveLength(1);
  });

  it("throws PublishFieldworkCandidateError for precondition failures", async () => {
    const db = makePublishDbMock();

    await expect(
      publishFieldworkCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toBeInstanceOf(PublishFieldworkCandidateError);
  });
});
