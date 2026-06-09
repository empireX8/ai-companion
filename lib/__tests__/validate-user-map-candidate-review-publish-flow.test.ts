import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const { updateCandidateLifecycleStatusMock, publishCandidateMock } = vi.hoisted(() => ({
  updateCandidateLifecycleStatusMock: vi.fn(),
  publishCandidateMock: vi.fn(),
}));

vi.mock("../candidate-lifecycle-persistence", () => ({
  updateCandidateLifecycleStatus: updateCandidateLifecycleStatusMock,
}));

vi.mock("../candidate-publish-helper", () => ({
  publishCandidate: publishCandidateMock,
}));

import {
  parseValidateUserMapCandidateReviewPublishCliArgs,
  runValidateUserMapCandidateReviewPublishFlow,
} from "../validate-user-map-candidate-review-publish-flow";

const NOW = new Date("2026-06-09T12:00:00.000Z");

const candidateRow = {
  id: "candidate-1",
  userId: "user-1",
  area: "operating_logic",
  status: "emerging",
  visibility: "internal_only",
  candidateLifecycleStatus: "proposed",
  confidenceLevel: "medium",
  evidenceCount: 3,
  sourceDiversity: 2,
  updatedAt: NOW,
};

function makeDb(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  const defaults = {
    userMapConclusion: {
      findFirst: vi.fn().mockResolvedValue(candidateRow),
      count: vi.fn().mockResolvedValue(0),
    },
    understandingEvidenceLink: {
      count: vi.fn().mockResolvedValue(3),
    },
    modelUpdate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return { ...defaults, ...overrides } as unknown as PrismaClient;
}

describe("validate user map candidate review publish flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCandidateLifecycleStatusMock.mockImplementation(
      async (_userId: string, _candidateId: string, newStatus: string) => ({
        id: "candidate-1",
        userId: "user-1",
        previousStatus:
          newStatus === "held_for_more_evidence" ? "proposed" : "held_for_more_evidence",
        newStatus,
        updatedAt: NOW,
      })
    );
    publishCandidateMock.mockResolvedValue({
      id: "candidate-1",
      userId: "user-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: NOW,
    });
  });

  it("parses required CLI args and defaults to dry-run", () => {
    expect(parseValidateUserMapCandidateReviewPublishCliArgs([])).toEqual({
      ok: false,
      message: "Missing required --user-id argument.",
    });

    expect(
      parseValidateUserMapCandidateReviewPublishCliArgs(["--user-id", "user-1"])
    ).toEqual({
      ok: false,
      message: "Missing required --candidate-id argument.",
    });

    expect(
      parseValidateUserMapCandidateReviewPublishCliArgs([
        "--user-id",
        "user-1",
        "--candidate-id",
        "candidate-1",
      ])
    ).toEqual({
      ok: true,
      args: { userId: "user-1", candidateId: "candidate-1", dryRun: true },
    });
  });

  it("dry-run plans promote and publish without writing", async () => {
    const report = await runValidateUserMapCandidateReviewPublishFlow({
      userId: "user-1",
      candidateId: "candidate-1",
      dryRun: true,
      now: NOW,
      db: makeDb(),
    });

    expect(report.plannedActions).toEqual([
      "hold_for_more_evidence",
      "promote",
      "publish",
    ]);
    expect(report.steps.promote.attempted).toBe(false);
    expect(report.steps.publish.attempted).toBe(false);
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishCandidateMock).not.toHaveBeenCalled();
    expect(report.before.candidate).toEqual(report.after.candidate);
  });

  it("execute path uses existing lifecycle and publish helpers", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(candidateRow)
      .mockResolvedValueOnce({ candidateLifecycleStatus: "held_for_more_evidence" })
      .mockResolvedValueOnce({
        candidateLifecycleStatus: "promoted",
        visibility: "internal_only",
      })
      .mockResolvedValueOnce({
        ...candidateRow,
        candidateLifecycleStatus: "promoted",
        visibility: "user_visible",
      });

    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const modelUpdateFindMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "mu-1",
          updateType: "conclusion_added",
          visibility: "user_visible",
          isMeaningful: true,
          createdAt: NOW,
        },
      ]);

    const report = await runValidateUserMapCandidateReviewPublishFlow({
      userId: "user-1",
      candidateId: "candidate-1",
      dryRun: false,
      now: NOW,
      db: makeDb({
        userMapConclusion: { findFirst, count },
        modelUpdate: { findMany: modelUpdateFindMany },
      }),
    });

    expect(updateCandidateLifecycleStatusMock).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "candidate-1",
      "held_for_more_evidence",
      expect.objectContaining({ now: NOW })
    );
    expect(updateCandidateLifecycleStatusMock).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "candidate-1",
      "promoted",
      expect.objectContaining({ now: NOW })
    );
    expect(publishCandidateMock).toHaveBeenCalledWith("user-1", "candidate-1", {
      db: expect.anything(),
      now: NOW,
    });
    expect(report.after.publicYourMapVisible).toBe(true);
    expect(report.after.modelUpdates).toEqual([
      {
        id: "mu-1",
        updateType: "conclusion_added",
        visibility: "user_visible",
        isMeaningful: true,
        createdAt: NOW.toISOString(),
      },
    ]);
    expect(report.after.evidenceLinkCount).toBe(3);
  });

  it("does not expose raw evidence or message text in report output", async () => {
    const report = await runValidateUserMapCandidateReviewPublishFlow({
      userId: "user-1",
      candidateId: "candidate-1",
      dryRun: true,
      now: NOW,
      db: makeDb(),
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("SECRET_EVIDENCE");
    expect(serialized).not.toContain("message body");
    expect(report.before.candidate?.evidenceCount).toBe(3);
  });
});
