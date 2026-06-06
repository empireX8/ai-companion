import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CandidateLifecycleStatus,
  InvestigationStatus,
  InvestigationVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  PublishInvestigationCandidateError,
  isPublishableInvestigationStatus,
  publishInvestigationCandidate,
} from "../investigation-publish-helper";
import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "../public-intelligence-safe-slice";

const FIXED_TIME = new Date("2026-06-05T12:00:00.000Z");

function makePublishDbMock(
  statusById: Partial<Record<string, InvestigationStatus>> = {}
) {
  let visibility: InvestigationVisibility = InvestigationVisibility.internal_only;
  const lifecycleStatus: CandidateLifecycleStatus | null = CandidateLifecycleStatus.promoted;

  const resolveStatus = (id: string): InvestigationStatus =>
    statusById[id] ?? InvestigationStatus.open;
  let updatedAt = FIXED_TIME;
  let concurrentPublishClaimed = false;
  const modelUpdates: Array<Record<string, unknown>> = [];

  const investigation = {
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
            status: resolveStatus(where.id),
            title: "Legacy title",
            updatedAt,
          };
        }
        if (where.id === "proposed-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
            status: resolveStatus(where.id),
            title: "Proposed title",
            updatedAt,
          };
        }
        if (where.id === "rejected-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
            status: resolveStatus(where.id),
            title: "Rejected title",
            updatedAt,
          };
        }
        if (where.id === "held-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.held_for_more_evidence,
            status: resolveStatus(where.id),
            title: "Held title",
            updatedAt,
          };
        }
        if (where.id === "expired-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.expired,
            status: resolveStatus(where.id),
            title: "Expired title",
            updatedAt,
          };
        }
        if (where.id === "superseded-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility,
            candidateLifecycleStatus: CandidateLifecycleStatus.superseded,
            status: resolveStatus(where.id),
            title: "Superseded title",
            updatedAt,
          };
        }
        if (where.id === "visible-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: InvestigationVisibility.user_visible,
            candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
            status: resolveStatus(where.id),
            title: "Visible title",
            updatedAt,
          };
        }
        if (where.id === "concurrent-race-id") {
          return {
            id: where.id,
            userId: where.userId,
            visibility: InvestigationVisibility.internal_only,
            candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
            status: resolveStatus(where.id),
            title: "Race title",
            updatedAt,
          };
        }
        return {
          id: where.id,
          userId: where.userId,
          visibility,
          candidateLifecycleStatus: lifecycleStatus,
          status: resolveStatus(where.id),
          title: "Why do I avoid conflict?",
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
          visibility: InvestigationVisibility;
          candidateLifecycleStatus: string;
          status?: { in: InvestigationStatus[] };
        };
        data: {
          visibility: InvestigationVisibility;
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

        const currentStatus = resolveStatus(where.id);
        const statusAllowed =
          !where.status?.in || where.status.in.includes(currentStatus);

        const matches =
          where.visibility === InvestigationVisibility.internal_only &&
          where.candidateLifecycleStatus === "promoted" &&
          visibility === InvestigationVisibility.internal_only &&
          lifecycleStatus === CandidateLifecycleStatus.promoted &&
          statusAllowed;

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
    investigation,
    modelUpdate,
  };

  const db = {
    investigation,
    modelUpdate,
    modelUpdates,
    getVisibility: () => visibility,
    getLifecycleStatus: () => lifecycleStatus,
    getStatus: (id = "inv-1") => resolveStatus(id),
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

describe("publishInvestigationCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes promoted + internal_only Investigation and creates investigation_opened ModelUpdate", async () => {
    const db = makePublishDbMock();

    const result = await publishInvestigationCandidate("user-1", "inv-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(result).toEqual({
      id: "inv-1",
      userId: "user-1",
      previousVisibility: InvestigationVisibility.internal_only,
      newVisibility: InvestigationVisibility.user_visible,
      updatedAt: FIXED_TIME,
    });

    expect(db.modelUpdate.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        updateType: ModelUpdateType.investigation_opened,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.investigation,
        affectedObjectId: "inv-1",
        userFacingSummary: "New active question: Why do I avoid conflict?",
        isMeaningful: true,
        sourceRunId: null,
        internalNotes: "Published via internal Investigation candidate publish action.",
      },
    });
    expect(db.getVisibility()).toBe(InvestigationVisibility.user_visible);
    expect(db.getLifecycleStatus()).toBe(CandidateLifecycleStatus.promoted);
    expect(db.getStatus()).toBe(InvestigationStatus.open);
  });

  it("runs publish visibility update and ModelUpdate creation in one transaction", async () => {
    const db = makePublishDbMock();

    await publishInvestigationCandidate("user-1", "inv-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.investigation.updateMany).toHaveBeenCalledTimes(1);
    expect(db.modelUpdate.create).toHaveBeenCalledTimes(1);
  });

  it("rolls back visibility when ModelUpdate creation fails", async () => {
    const db = makePublishDbMock();
    db.modelUpdate.create.mockRejectedValueOnce(new Error("ModelUpdate insert failed"));

    await expect(
      publishInvestigationCandidate("user-1", "inv-1", {
        db: db as never,
        now: FIXED_TIME,
      })
    ).rejects.toThrow("ModelUpdate insert failed");

    expect(db.getVisibility()).toBe(InvestigationVisibility.internal_only);
    expect(db.modelUpdates).toHaveLength(0);
  });

  it("does not create ModelUpdate when conditional update affects 0 rows", async () => {
    const db = makePublishDbMock();
    db.investigation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      publishInvestigationCandidate("user-1", "inv-1", {
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
        publishInvestigationCandidate("user-1", id, { db: db as never })
      ).rejects.toMatchObject({ code: "NOT_PROMOTED" });
    }

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects already user_visible rows", async () => {
    const db = makePublishDbMock();

    await expect(
      publishInvestigationCandidate("user-1", "visible-id", { db: db as never })
    ).rejects.toMatchObject({ code: "ALREADY_VISIBLE" });
  });

  it("rejects missing and null lifecycle rows", async () => {
    const db = makePublishDbMock();

    await expect(
      publishInvestigationCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toMatchObject({ code: "INVESTIGATION_NOT_FOUND" });

    await expect(
      publishInvestigationCandidate("user-1", "legacy-id", { db: db as never })
    ).rejects.toMatchObject({ code: "NULL_LIFECYCLE_STATUS" });
  });

  it("does not produce duplicate ModelUpdates under concurrent publish simulation", async () => {
    const db = makePublishDbMock();

    const results = await Promise.allSettled([
      publishInvestigationCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
      publishInvestigationCandidate("user-1", "concurrent-race-id", {
        db: db as never,
        now: FIXED_TIME,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(db.modelUpdates).toHaveLength(1);
  });

  it("throws PublishInvestigationCandidateError for precondition failures", async () => {
    const db = makePublishDbMock();

    await expect(
      publishInvestigationCandidate("user-1", "missing-id", { db: db as never })
    ).rejects.toBeInstanceOf(PublishInvestigationCandidateError);
  });

  it("publishes promoted internal_only rows for every Active Questions visible status", async () => {
    for (const status of ACTIVE_QUESTION_VISIBLE_STATUSES) {
      const db = makePublishDbMock({ "inv-1": status });

      const result = await publishInvestigationCandidate("user-1", "inv-1", {
        db: db as never,
        now: FIXED_TIME,
      });

      expect(result.newVisibility).toBe(InvestigationVisibility.user_visible);
      expect(db.modelUpdates).toHaveLength(1);
      db.modelUpdates.length = 0;
    }
  });

  it("rejects promoted internal_only rows with non-public Investigation statuses", async () => {
    for (const status of [InvestigationStatus.resolved, InvestigationStatus.abandoned]) {
      const db = makePublishDbMock({ "inv-1": status });

      await expect(
        publishInvestigationCandidate("user-1", "inv-1", { db: db as never })
      ).rejects.toMatchObject({ code: "INVESTIGATION_STATUS_NOT_PUBLISHABLE" });

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.modelUpdate.create).not.toHaveBeenCalled();
      expect(db.getVisibility()).toBe(InvestigationVisibility.internal_only);
      expect(db.getStatus("inv-1")).toBe(status);
    }
  });

  it("does not create ModelUpdate when rejected lifecycle row has a public status", async () => {
    const db = makePublishDbMock({
      "rejected-id": InvestigationStatus.open,
    });

    await expect(
      publishInvestigationCandidate("user-1", "rejected-id", { db: db as never })
    ).rejects.toMatchObject({ code: "NOT_PROMOTED" });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("includes Active Questions visible statuses in conditional publish update", async () => {
    const db = makePublishDbMock();

    await publishInvestigationCandidate("user-1", "inv-1", {
      db: db as never,
      now: FIXED_TIME,
    });

    expect(db.investigation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ACTIVE_QUESTION_VISIBLE_STATUSES },
        }),
      })
    );
  });

  it("matches isPublishableInvestigationStatus to Active Questions visibility", () => {
    for (const status of ACTIVE_QUESTION_VISIBLE_STATUSES) {
      expect(isPublishableInvestigationStatus(status)).toBe(true);
    }

    expect(isPublishableInvestigationStatus(InvestigationStatus.resolved)).toBe(false);
    expect(isPublishableInvestigationStatus(InvestigationStatus.abandoned)).toBe(false);
  });
});
