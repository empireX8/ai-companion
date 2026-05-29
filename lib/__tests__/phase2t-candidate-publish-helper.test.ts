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
  let visibility: UserMapConclusionVisibility = UserMapConclusionVisibility.internal_only;
  const modelUpdates: Array<Record<string, unknown>> = [];

  const userMapConclusion = {
    findFirst: vi.fn(async ({
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
        };
      }
      if (where.id === "rejected-id") {
        return {
          id: where.id,
          userId: where.userId,
          visibility,
          candidateLifecycleStatus: "rejected",
          title: "Rejected title",
        };
      }
      if (where.id === "visible-id") {
        return {
          id: where.id,
          userId: where.userId,
          visibility: UserMapConclusionVisibility.user_visible,
          candidateLifecycleStatus: "promoted",
          title: "Visible title",
        };
      }
      return {
        id: where.id,
        userId: where.userId,
        visibility,
        candidateLifecycleStatus: "promoted",
        title: "I value autonomy over stability",
      };
    }),
    update: vi.fn(
      async ({
        data,
      }: {
        data: {
          visibility: UserMapConclusionVisibility;
          updatedAt: Date;
        };
      }) => ({
        id: "candidate-1",
        userId: "user-1",
        visibility: data.visibility,
        updatedAt: data.updatedAt,
      })
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

  const db = {
    userMapConclusion,
    modelUpdate,
    modelUpdates,
    getVisibility: () => visibility,
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => {
      try {
        const results = await Promise.all(ops);
        visibility = (results[0] as { visibility: UserMapConclusionVisibility })
          .visibility;
        return results;
      } catch (error) {
        throw error;
      }
    }),
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
    expect(db.userMapConclusion.update).toHaveBeenCalledWith({
      where: { id: "candidate-1" },
      data: {
        visibility: UserMapConclusionVisibility.user_visible,
        updatedAt: FIXED_TIME,
      },
      select: {
        id: true,
        userId: true,
        visibility: true,
        updatedAt: true,
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

  it("runs visibility update and ModelUpdate creation in one transaction", async () => {
    const db = makePublishDbMock();

    await publishCandidate("user-1", "candidate-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const transactionArg = db.$transaction.mock.calls[0]?.[0] as Promise<unknown>[];
    expect(transactionArg).toHaveLength(2);
    expect(db.userMapConclusion.update).toHaveBeenCalledTimes(1);
    expect(db.modelUpdate.create).toHaveBeenCalledTimes(1);
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
