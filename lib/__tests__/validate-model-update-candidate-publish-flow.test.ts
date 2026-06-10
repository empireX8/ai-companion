import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const {
  publishModelUpdateCandidateMock,
  updateInvestigationCandidateLifecycleStatusMock,
  updateFieldworkCandidateLifecycleStatusMock,
  publishInvestigationCandidateMock,
  publishFieldworkCandidateMock,
} = vi.hoisted(() => ({
  publishModelUpdateCandidateMock: vi.fn(),
  updateInvestigationCandidateLifecycleStatusMock: vi.fn(),
  updateFieldworkCandidateLifecycleStatusMock: vi.fn(),
  publishInvestigationCandidateMock: vi.fn(),
  publishFieldworkCandidateMock: vi.fn(),
}));

vi.mock("../model-update-candidate-publish-helper", () => ({
  publishModelUpdateCandidate: publishModelUpdateCandidateMock,
}));

vi.mock("../investigation-candidate-lifecycle-persistence", () => ({
  updateInvestigationCandidateLifecycleStatus:
    updateInvestigationCandidateLifecycleStatusMock,
}));

vi.mock("../fieldwork-candidate-lifecycle-persistence", () => ({
  updateFieldworkCandidateLifecycleStatus: updateFieldworkCandidateLifecycleStatusMock,
}));

vi.mock("../investigation-publish-helper", () => ({
  publishInvestigationCandidate: publishInvestigationCandidateMock,
}));

vi.mock("../fieldwork-publish-helper", () => ({
  publishFieldworkCandidate: publishFieldworkCandidateMock,
}));

import {
  parseValidateModelUpdateCandidatePublishCliArgs,
  runValidateModelUpdateCandidatePublishFlow,
} from "../validate-model-update-candidate-publish-flow";

const NOW = new Date("2026-06-09T12:00:00.000Z");

const candidateRow = {
  id: "mu-1",
  userId: "user-1",
  updateType: "link_detected",
  userFacingSummary: "[DEV FIXTURE] A new link was detected in your understanding map.",
  visibility: "internal_only",
  isMeaningful: false,
  createdAt: NOW,
};

function makeDb(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  const defaults = {
    modelUpdate: {
      findFirst: vi.fn().mockResolvedValue(candidateRow),
      count: vi.fn().mockResolvedValue(0),
    },
    understandingEvidenceLink: {
      count: vi.fn().mockResolvedValue(2),
    },
  };

  return { ...defaults, ...overrides } as unknown as PrismaClient;
}

describe("validate model update candidate publish flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishModelUpdateCandidateMock.mockResolvedValue({
      id: "mu-1",
      userId: "user-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      previousIsMeaningful: false,
      newIsMeaningful: true,
    });
  });

  it("parses CLI args and defaults to dry-run", () => {
    expect(parseValidateModelUpdateCandidatePublishCliArgs([])).toEqual({
      ok: true,
      args: { userId: undefined, candidateId: undefined, dryRun: true },
    });

    expect(
      parseValidateModelUpdateCandidatePublishCliArgs([
        "--candidate-id",
        "mu-1",
        "--execute",
      ])
    ).toEqual({
      ok: true,
      args: { userId: undefined, candidateId: "mu-1", dryRun: false },
    });
  });

  it("dry-run plans publish without writing", async () => {
    const report = await runValidateModelUpdateCandidatePublishFlow({
      candidateId: "mu-1",
      dryRun: true,
      now: NOW,
      db: makeDb(),
    });

    expect(report.found).toBe(true);
    expect(report.plannedActions).toEqual(["publish"]);
    expect(report.publishPreconditions.canPublish).toBe(true);
    expect(report.publishPreconditions.updateTypePublishable).toBe(true);
    expect(report.steps.publish.attempted).toBe(false);
    expect(report.steps.publish.skippedReason).toContain("Dry-run mode");
    expect(report.steps.publish.newVisibility).toBe("user_visible");
    expect(report.steps.publish.newIsMeaningful).toBe(true);
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(updateFieldworkCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishInvestigationCandidateMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
    expect(report.before.candidate).toEqual(report.after.candidate);
    expect(report.before.publicWhatChangedVisible).toBe(false);
    expect(report.expectedAfterPublish.visibility).toBe("user_visible");
    expect(report.expectedAfterPublish.isMeaningful).toBe(true);
  });

  it("returns a clear non-mutating result when no candidate is found", async () => {
    const report = await runValidateModelUpdateCandidatePublishFlow({
      candidateId: "missing-mu",
      dryRun: true,
      now: NOW,
      db: makeDb({
        modelUpdate: {
          findFirst: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    });

    expect(report.found).toBe(false);
    expect(report.diagnosticMessage).toContain("No internal ModelUpdate candidate found");
    expect(report.plannedActions).toEqual([]);
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
  });

  it("blocks publish safely for invalid candidate state", async () => {
    const visibleCandidate = {
      ...candidateRow,
      visibility: "user_visible",
      isMeaningful: true,
    };

    const report = await runValidateModelUpdateCandidatePublishFlow({
      candidateId: "mu-1",
      dryRun: false,
      now: NOW,
      db: makeDb({
        modelUpdate: {
          findFirst: vi.fn().mockResolvedValue(visibleCandidate),
          count: vi.fn().mockResolvedValue(1),
        },
      }),
    });

    expect(report.plannedActions).toEqual([]);
    expect(report.steps.publish.skippedReason).toContain("not internal_only");
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
  });

  it("execute calls publishModelUpdateCandidate and flips visibility/isMeaningful", async () => {
    const publishedCandidate = {
      ...candidateRow,
      visibility: "user_visible",
      isMeaningful: true,
    };

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(candidateRow)
      .mockResolvedValueOnce(candidateRow)
      .mockResolvedValueOnce(publishedCandidate);

    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const report = await runValidateModelUpdateCandidatePublishFlow({
      candidateId: "mu-1",
      dryRun: false,
      now: NOW,
      db: makeDb({
        modelUpdate: { findFirst, count },
      }),
    });

    expect(publishModelUpdateCandidateMock).toHaveBeenCalledWith("user-1", "mu-1", {
      db: expect.anything(),
    });
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(updateFieldworkCandidateLifecycleStatusMock).not.toHaveBeenCalled();
    expect(publishInvestigationCandidateMock).not.toHaveBeenCalled();
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
    expect(report.after.candidate?.visibility).toBe("user_visible");
    expect(report.after.candidate?.isMeaningful).toBe(true);
    expect(report.after.publicWhatChangedVisible).toBe(true);
    expect(report.after.evidenceLinkCount).toBe(2);
    expect(report.after.canPublish).toBe(false);
    expect(report.steps.publish.attempted).toBe(true);
  });

  it("blocks publish when evidence links are missing", async () => {
    const report = await runValidateModelUpdateCandidatePublishFlow({
      candidateId: "mu-1",
      dryRun: true,
      now: NOW,
      db: makeDb({
        understandingEvidenceLink: {
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    });

    expect(report.plannedActions).toEqual([]);
    expect(report.publishPreconditions.requiresEvidenceLink).toBe(false);
    expect(report.steps.publish.skippedReason).toContain("no linked evidence");
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
  });
});
