import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const {
  updateFieldworkCandidateLifecycleStatusMock,
  publishFieldworkCandidateMock,
} = vi.hoisted(() => ({
  updateFieldworkCandidateLifecycleStatusMock: vi.fn(),
  publishFieldworkCandidateMock: vi.fn(),
}));

vi.mock("../fieldwork-candidate-lifecycle-persistence", () => ({
  updateFieldworkCandidateLifecycleStatus: updateFieldworkCandidateLifecycleStatusMock,
}));

vi.mock("../fieldwork-publish-helper", async () => {
  const actual = await vi.importActual<typeof import("../fieldwork-publish-helper")>(
    "../fieldwork-publish-helper"
  );

  return {
    ...actual,
    publishFieldworkCandidate: publishFieldworkCandidateMock,
  };
});

import {
  parseValidateFieldworkCandidateReviewPublishCliArgs,
  runValidateFieldworkCandidateReviewPublishFlow,
} from "../validate-fieldwork-candidate-review-publish-flow";

const NOW = new Date("2026-06-09T12:00:00.000Z");

const candidateRow = {
  id: "fw-1",
  userId: "user-1",
  prompt: "Notice whether [DEV FIXTURE] energy shifts after meetings.",
  status: "assigned",
  visibility: "internal_only",
  candidateLifecycleStatus: "proposed",
  updatedAt: NOW,
};

function makeDb(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  const defaults = {
    fieldworkAssignment: {
      findFirst: vi.fn().mockResolvedValue(candidateRow),
      count: vi.fn().mockResolvedValue(0),
    },
    understandingEvidenceLink: {
      count: vi.fn().mockResolvedValue(2),
    },
    modelUpdate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return { ...defaults, ...overrides } as unknown as PrismaClient;
}

describe("validate fieldwork candidate review publish flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateFieldworkCandidateLifecycleStatusMock.mockImplementation(
      async (_userId: string, _candidateId: string, newStatus: string) => ({
        id: "fw-1",
        userId: "user-1",
        previousStatus:
          newStatus === "held_for_more_evidence" ? "proposed" : "held_for_more_evidence",
        newStatus,
        updatedAt: NOW,
      })
    );
    publishFieldworkCandidateMock.mockResolvedValue({
      id: "fw-1",
      userId: "user-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: NOW,
    });
  });

  it("parses CLI args and defaults to dry-run", () => {
    expect(parseValidateFieldworkCandidateReviewPublishCliArgs([])).toEqual({
      ok: true,
      args: { userId: undefined, candidateId: undefined, dryRun: true },
    });

    expect(
      parseValidateFieldworkCandidateReviewPublishCliArgs([
        "--candidate-id",
        "fw-1",
        "--execute",
      ])
    ).toEqual({
      ok: true,
      args: { userId: undefined, candidateId: "fw-1", dryRun: false },
    });
  });

  it("dry-run plans hold, promote, and publish without writing", async () => {
    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "fw-1",
      dryRun: true,
      now: NOW,
      db: makeDb(),
    });

    expect(report.found).toBe(true);
    expect(report.plannedActions).toEqual([
      "hold_for_more_evidence",
      "promote",
      "publish",
    ]);
    expect(report.lifecyclePolicy.directProposedToPromotedBlocked).toBe(true);
    expect(report.lifecyclePolicy.holdToPromoteAllowed).toBe(true);
    expect(report.steps.holdForMoreEvidence.attempted).toBe(false);
    expect(report.steps.promote.attempted).toBe(false);
    expect(report.steps.publish.attempted).toBe(false);
    expect(updateFieldworkCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
    expect(report.before.candidate).toEqual(report.after.candidate);
    expect(report.expectedAfterPublish.modelUpdateType).toBe("fieldwork_assigned");
    expect(report.before.publicWatchForVisible).toBe(false);
  });

  it("returns a clear non-mutating result when no candidate is found", async () => {
    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "missing-fw",
      dryRun: true,
      now: NOW,
      db: makeDb({
        fieldworkAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    });

    expect(report.found).toBe(false);
    expect(report.diagnosticMessage).toContain("No internal FieldworkAssignment candidate found");
    expect(report.plannedActions).toEqual([]);
    expect(updateFieldworkCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
  });

  it("treats direct proposed → promoted as blocked in dry-run planning", async () => {
    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "fw-1",
      dryRun: true,
      now: NOW,
      db: makeDb(),
    });

    expect(report.lifecyclePolicy.directProposedToPromotedBlocked).toBe(true);
    expect(report.plannedActions[0]).toBe("hold_for_more_evidence");
    expect(report.plannedActions[1]).toBe("promote");
    expect(report.steps.promote.skippedReason).toContain("Dry-run mode");
  });

  it("plans promote and publish only when candidate is already held", async () => {
    const heldCandidate = {
      ...candidateRow,
      candidateLifecycleStatus: "held_for_more_evidence",
    };

    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "fw-1",
      dryRun: true,
      now: NOW,
      db: makeDb({
        fieldworkAssignment: {
          findFirst: vi.fn().mockResolvedValue(heldCandidate),
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    });

    expect(report.plannedActions).toEqual(["promote", "publish"]);
    expect(report.steps.holdForMoreEvidence.skippedReason).toContain(
      "not in proposed status"
    );
  });

  it("execute path uses existing lifecycle and publish helpers in sequence", async () => {
    const publishedCandidate = {
      ...candidateRow,
      candidateLifecycleStatus: "promoted",
      visibility: "user_visible",
    };

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(candidateRow)
      .mockResolvedValueOnce(candidateRow)
      .mockResolvedValueOnce({ candidateLifecycleStatus: "held_for_more_evidence" })
      .mockResolvedValueOnce({
        candidateLifecycleStatus: "promoted",
        visibility: "internal_only",
        status: "assigned",
      })
      .mockResolvedValueOnce(publishedCandidate);

    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const modelUpdateFindMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "mu-1",
          updateType: "fieldwork_assigned",
          visibility: "user_visible",
          isMeaningful: true,
          createdAt: NOW,
        },
      ]);

    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "fw-1",
      dryRun: false,
      now: NOW,
      db: makeDb({
        fieldworkAssignment: { findFirst, count },
        modelUpdate: { findMany: modelUpdateFindMany },
      }),
    });

    expect(updateFieldworkCandidateLifecycleStatusMock).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "fw-1",
      "held_for_more_evidence",
      expect.objectContaining({ now: NOW })
    );
    expect(updateFieldworkCandidateLifecycleStatusMock).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "fw-1",
      "promoted",
      expect.objectContaining({ now: NOW })
    );
    expect(publishFieldworkCandidateMock).toHaveBeenCalledWith("user-1", "fw-1", {
      db: expect.anything(),
      now: NOW,
    });
    expect(report.after.publicWatchForVisible).toBe(true);
    expect(report.after.candidate?.visibility).toBe("user_visible");
    expect(report.after.candidate?.candidateLifecycleStatus).toBe("promoted");
    expect(report.after.modelUpdates).toEqual([
      {
        id: "mu-1",
        updateType: "fieldwork_assigned",
        visibility: "user_visible",
        isMeaningful: true,
        createdAt: NOW.toISOString(),
      },
    ]);
    expect(report.after.evidenceLinkCount).toBe(2);
    expect(report.after.canPublish).toBe(false);
  });

  it("fails safely on invalid lifecycle state without calling helpers", async () => {
    const rejectedCandidate = {
      ...candidateRow,
      candidateLifecycleStatus: "rejected",
    };

    const report = await runValidateFieldworkCandidateReviewPublishFlow({
      candidateId: "fw-1",
      dryRun: false,
      now: NOW,
      db: makeDb({
        fieldworkAssignment: {
          findFirst: vi.fn().mockResolvedValue(rejectedCandidate),
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    });

    expect(report.plannedActions).toEqual([]);
    expect(report.steps.holdForMoreEvidence.skippedReason).toContain("not in proposed status");
    expect(report.steps.promote.skippedReason).toContain("not an allowed next lifecycle action");
    expect(report.steps.publish.skippedReason).toContain("Publish preconditions are not met");
    expect(updateFieldworkCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
  });
});
