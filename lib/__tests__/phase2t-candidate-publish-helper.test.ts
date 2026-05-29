import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import {
  PublishCandidateError,
  publishCandidate,
} from "../candidate-publish-helper";

const FIXED_TIME = new Date("2026-05-29T12:00:00.000Z");

function makePublishDbMock() {
  let visibility: UserMapConclusionVisibility =
    UserMapConclusionVisibility.internal_only;
  const lifecycleStatus: string | null = "promoted";
  let updatedAt = FIXED_TIME;
  let concurrentPublishClaimed = false;
  const modelUpdates: Array<Record<string, unknown>> = [];

  const userMapConclusion = {
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { id: string; userId: string };
      }) => {
        if (where.id === "missing-id") {
          return null;
        }
        if (where.id === "legacy-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: null,
            title: "Legacy title",
            updatedAt,
          };
        }
        if (where.id === "rejected-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: "rejected",
            title: "Rejected title",
            updatedAt,
          };
        }
        if (where.id === "visible-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: UserMapConclusionVisibility.user_visible,
            candidateLifecycleStatus: "promoted",
            title: "Visible title",
            updatedAt,
          };
        }
        if (where.id === "concurrent-race-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: UserMapConclusionVisibility.internal_only,
            candidateLifecycleStatus: "promoted",
            title: "Race title",
            updatedAt,
          };
        }
        return {
          id: where.id,
          userId: where.userId,
          visibility,
          candidateLifecycleStatus: lifecycleStatus,
          title: "I value autonomy over stability",
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
          visibility: UserMapConclusionVisibility;
          candidateLifecycleStatus: string;
        };
        data: {
          visibility: UserMapConclusionVisibility;
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
          where.id &&
          where.userId &&
          where.visibility === UserMapConclusionVisibility.internal_only &&
          where.candidateLifecycleStatus === "promoted" &&
          visibility === UserMapConclusionVisibility.internal_only &&
          lifecycleStatus === "promoted";

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
    userMapConclusion,
    modelUpdate,
  };

  const db = {
    userMapConclusion,
    modelUpdate,
    modelUpdates,
    getVisibility: () => visibility,
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

describe("Phase 2T candidate publish helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ModelUpdate on successful publish", async () => {
    const db = makePublishDbMock();

    const result = await publishCandidate("user-1", "candidate-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(result).toEqual({
      id: "candidate-1",
      userId: "user-1",
      previousVisibility: UserMapConclusionVisibility.internal_only,
      newVisibility: UserMapConclusionVisibility.user_visible,
      updatedAt: FIXED_TIME,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.userMapConclusion.updateMany).toHaveBeenCalledWith({
      where: {
        id: "candidate-1",
        userId: "user-1",
        visibility: UserMapConclusionVisibility.internal_only,
        candidateLifecycleStatus: "promoted",
      },
      data: {
        visibility: UserMapConclusionVisibility.user_visible,
        updatedAt: FIXED_TIME,
      },
    });
    expect(db.modelUpdate.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        updateType: ModelUpdateType.conclusion_added,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "candidate-1",
        userFacingSummary: "New conclusion: I value autonomy over stability",
        isMeaningful: true,
      },
    });
    expect(db.modelUpdates).toHaveLength(1);
    expect(db.getVisibility()).toBe(UserMapConclusionVisibility.user_visible);
  });

  it("creates ModelUpdate only after the conditional visibility update succeeds", async () => {
    const db = makePublishDbMock();
    const callOrder: string[] = [];
    const originalUpdateMany = db.userMapConclusion.updateMany.getMockImplementation()!;
    const originalCreate = db.modelUpdate.create.getMockImplementation()!;

    db.userMapConclusion.updateMany.mockImplementation(async (args) => {
      callOrder.push("updateMany");
      return originalUpdateMany(args);
    });
    db.modelUpdate.create.mockImplementation(async (args) => {
      callOrder.push("create");
      return originalCreate(args);
    });

    await publishCandidate("user-1", "candidate-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(callOrder).toEqual(["updateMany", "create"]);
  });

  it("runs conditional visibility update and ModelUpdate creation in one transaction", async () => {
    const db = makePublishDbMock();

    await publishCandidate("user-1", "candidate-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof db.$transaction.mock.calls[0]?.[0]).toBe("function");
    expect(db.userMapConclusion.updateMany).toHaveBeenCalledTimes(1);
    expect(db.modelUpdate.create).toHaveBeenCalledTimes(1);
  });

  it("does not create a ModelUpdate when the conditional update affects 0 rows", async () => {
    const db = makePublishDbMock();
    db.userMapConclusion.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      publishCandidate("user-1", "candidate-1", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toMatchObject({
      code: "ALREADY_VISIBLE",
    });

    expect(db.modelUpdate.create).not.toHaveBeenCalled();
    expect(db.modelUpdates).toHaveLength(0);
    expect(db.getVisibility()).toBe(UserMapConclusionVisibility.internal_only);
  });

  it("does not change visibility when ModelUpdate creation fails", async () => {
    const db = makePublishDbMock();
    db.modelUpdate.create.mockRejectedValueOnce(new Error("ModelUpdate insert failed"));

    await expect(
      publishCandidate("user-1", "candidate-1", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toThrow("ModelUpdate insert failed");

    expect(db.getVisibility()).toBe(UserMapConclusionVisibility.internal_only);
    expect(db.modelUpdates).toHaveLength(0);
  });

  it("does not create a ModelUpdate when the candidate is already visible", async () => {
    const db = makePublishDbMock();

    await expect(
      publishCandidate("user-1", "visible-id", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toMatchObject({
      code: "ALREADY_VISIBLE",
    });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
    expect(db.modelUpdates).toHaveLength(0);
  });

  it("does not produce duplicate ModelUpdates under concurrent publish simulation", async () => {
    const db = makePublishDbMock();

    const results = await Promise.allSettled([
      publishCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
      publishCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "ALREADY_VISIBLE",
    });
    expect(db.modelUpdates).toHaveLength(1);
    expect(db.userMapConclusion.updateMany).toHaveBeenCalledTimes(2);
    expect(db.modelUpdate.create).toHaveBeenCalledTimes(1);
  });

  it("accepts an optional userFacingSummary override", async () => {
    const db = makePublishDbMock();

    await publishCandidate("user-1", "candidate-1", {
      db: db as never,
      now: FIXED_TIME,
      userFacingSummary: "Custom publish summary",
    });

    expect(db.modelUpdate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userFacingSummary: "Custom publish summary",
      }),
    });
  });

  it("preserves existing precondition errors", async () => {
    const db = makePublishDbMock();

    await expect(
      publishCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toMatchObject({ code: "CONCLUSION_NOT_FOUND" });

    await expect(
      publishCandidate("user-1", "legacy-id", { db: db as never })
    ).rejects.toMatchObject({ code: "NULL_LIFECYCLE_STATUS" });

    await expect(
      publishCandidate("user-1", "rejected-id", { db: db as never })
    ).rejects.toMatchObject({ code: "NOT_PROMOTED" });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("throws PublishCandidateError for precondition failures", async () => {
    const db = makePublishDbMock();

    await expect(
      publishCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toBeInstanceOf(PublishCandidateError);
  });
});
