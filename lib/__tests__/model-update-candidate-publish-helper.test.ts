import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  PublishModelUpdateCandidateError,
  publishModelUpdateCandidate,
} from "../model-update-candidate-publish-helper";

type InMemoryModelUpdate = {
  id: string;
  userId: string;
  updateType: ModelUpdateType;
  visibility: ModelUpdateVisibility;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  isMeaningful: boolean;
  beforeSummary: string | null;
  afterSummary: string | null;
  confidenceDelta: number | null;
  meaningfulDeltaScore: number | null;
  sourceRunId: string | null;
  internalNotes: string | null;
};

function buildCandidateRow(
  overrides?: Partial<InMemoryModelUpdate>
): InMemoryModelUpdate {
  return {
    id: "mu-candidate-1",
    userId: "user-1",
    updateType: ModelUpdateType.link_detected,
    visibility: ModelUpdateVisibility.internal_only,
    affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: "pc-safe",
    userFacingSummary: "Energy drops after meetings.",
    isMeaningful: false,
    beforeSummary: "Before summary",
    afterSummary: "After summary",
    confidenceDelta: 0.12,
    meaningfulDeltaScore: 0.34,
    sourceRunId: "run-1",
    internalNotes: "candidateLane:internal_only;processorVersion:v1",
    ...overrides,
  };
}

function makePublishDbMock(seed?: InMemoryModelUpdate[]) {
  const rows: InMemoryModelUpdate[] = [...(seed ?? [buildCandidateRow()])];
  let concurrentPublishClaimed = false;
  let failUpdateAfterApply = false;

  const modelUpdate = {
    findFirst: vi.fn(
      async ({ where }: { where: { id?: string; userId?: string } }) => {
        const row = rows.find(
          (candidate) =>
            (!where.id || candidate.id === where.id) &&
            (!where.userId || candidate.userId === where.userId)
        );
        return row ?? null;
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
          visibility: ModelUpdateVisibility;
          isMeaningful: boolean;
        };
        data: {
          visibility: ModelUpdateVisibility;
          isMeaningful: boolean;
        };
      }) => {
        if (where.id === "concurrent-race-id") {
          if (concurrentPublishClaimed) {
            return { count: 0 };
          }
          concurrentPublishClaimed = true;
        }

        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.userId === where.userId &&
            candidate.visibility === where.visibility &&
            candidate.isMeaningful === where.isMeaningful
        );

        if (!row) {
          return { count: 0 };
        }

        row.visibility = data.visibility;
        row.isMeaningful = data.isMeaningful;

        if (failUpdateAfterApply) {
          throw new Error("ModelUpdate update failed");
        }

        return { count: 1 };
      }
    ),
    create: vi.fn(),
  };

  const tx = { modelUpdate };
  const db = {
    modelUpdate,
    rows,
    setFailUpdateAfterApply: (value: boolean) => {
      failUpdateAfterApply = value;
    },
    $transaction: vi.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) => {
        const snapshot = rows.map((row) => ({ ...row }));
        try {
          return await callback(tx);
        } catch (error) {
          rows.splice(0, rows.length, ...snapshot);
          throw error;
        }
      }
    ),
  };

  return db;
}

describe("ModelUpdate candidate publish helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing row", async () => {
    const db = makePublishDbMock([]);

    await expect(
      publishModelUpdateCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toMatchObject({ code: "MODEL_UPDATE_NOT_FOUND" });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("rejects wrong user", async () => {
    const db = makePublishDbMock();

    await expect(
      publishModelUpdateCandidate("other-user", "mu-candidate-1", {
        db: db as never,
      })
    ).rejects.toMatchObject({ code: "MODEL_UPDATE_NOT_FOUND" });

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("publishes internal_only + isMeaningful false rows", async () => {
    const db = makePublishDbMock();

    const result = await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: db as never,
    });

    expect(result).toEqual({
      id: "mu-candidate-1",
      userId: "user-1",
      previousVisibility: ModelUpdateVisibility.internal_only,
      newVisibility: ModelUpdateVisibility.user_visible,
      previousIsMeaningful: false,
      newIsMeaningful: true,
    });
    expect(db.rows[0]).toMatchObject({
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    });
  });

  it("sets visibility to user_visible", async () => {
    const db = makePublishDbMock();

    await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: db as never,
    });

    expect(db.rows[0]?.visibility).toBe(ModelUpdateVisibility.user_visible);
  });

  it("sets isMeaningful to true", async () => {
    const db = makePublishDbMock();

    await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: db as never,
    });

    expect(db.rows[0]?.isMeaningful).toBe(true);
  });

  it("preserves updateType, affected object, and summaries", async () => {
    const seed = buildCandidateRow();
    const db = makePublishDbMock([seed]);

    await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: db as never,
    });

    expect(db.rows[0]).toMatchObject({
      updateType: ModelUpdateType.link_detected,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: "pc-safe",
      userFacingSummary: "Energy drops after meetings.",
      beforeSummary: "Before summary",
      afterSummary: "After summary",
      confidenceDelta: 0.12,
      meaningfulDeltaScore: 0.34,
      sourceRunId: "run-1",
      internalNotes: "candidateLane:internal_only;processorVersion:v1",
    });
  });

  it("rejects already user_visible rows", async () => {
    const db = makePublishDbMock([
      buildCandidateRow({
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      }),
    ]);

    await expect(
      publishModelUpdateCandidate("user-1", "mu-candidate-1", {
        db: db as never,
      })
    ).rejects.toMatchObject({ code: "ALREADY_VISIBLE" });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("rejects candidate visibility rows", async () => {
    const db = makePublishDbMock([
      buildCandidateRow({
        visibility: ModelUpdateVisibility.candidate,
      }),
    ]);

    await expect(
      publishModelUpdateCandidate("user-1", "mu-candidate-1", {
        db: db as never,
      })
    ).rejects.toMatchObject({ code: "ALREADY_VISIBLE" });
  });

  it("rejects isMeaningful true rows", async () => {
    const db = makePublishDbMock([
      buildCandidateRow({
        isMeaningful: true,
      }),
    ]);

    await expect(
      publishModelUpdateCandidate("user-1", "mu-candidate-1", {
        db: db as never,
      })
    ).rejects.toMatchObject({ code: "ALREADY_MEANINGFUL" });

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not create another ModelUpdate", async () => {
    const db = makePublishDbMock();

    await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: db as never,
    });

    expect(db.modelUpdate.create).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(1);
  });

  it("rolls back on update failure", async () => {
    const db = makePublishDbMock();
    db.setFailUpdateAfterApply(true);

    await expect(
      publishModelUpdateCandidate("user-1", "mu-candidate-1", {
        db: db as never,
      })
    ).rejects.toThrow("ModelUpdate update failed");

    expect(db.rows[0]).toMatchObject({
      visibility: ModelUpdateVisibility.internal_only,
      isMeaningful: false,
    });
  });

  it("rejects concurrent publish races", async () => {
    const db = makePublishDbMock([
      buildCandidateRow({ id: "concurrent-race-id" }),
    ]);

    const results = await Promise.allSettled([
      publishModelUpdateCandidate("user-1", "concurrent-race-id", {
        db: db as never,
      }),
      publishModelUpdateCandidate("user-1", "concurrent-race-id", {
        db: db as never,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "ALREADY_VISIBLE",
    });
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.visibility).toBe(ModelUpdateVisibility.user_visible);
    expect(db.rows[0]?.isMeaningful).toBe(true);
  });

  it("throws PublishModelUpdateCandidateError for precondition failures", async () => {
    const db = makePublishDbMock([]);

    await expect(
      publishModelUpdateCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toBeInstanceOf(PublishModelUpdateCandidateError);
  });
});
