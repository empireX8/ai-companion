import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  investigation: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

import {
  listInternalInvestigationReviewCandidates,
  resolveInvestigationReviewSummary,
} from "../internal-investigation-review-candidates";

describe("internal investigation review candidates loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns only internal_only lifecycle-managed investigations for the current user", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        title: "Investigation title",
        organizingQuestion: "What is happening?",
        evidenceNeeded: ["Need more signal on weekends"],
        status: "open",
        seedType: "pattern",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const items = await listInternalInvestigationReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
          candidateLifecycleStatus: { not: null },
        }),
      })
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "inv-1",
      title: "Investigation title",
      organizingQuestion: "What is happening?",
      summary: "Need more signal on weekends",
      visibility: "internal_only",
      candidateLifecycleStatus: "proposed",
    });
    expect(items[0]?.diagnostics).toEqual({
      latestRunId: null,
      latestArtifactId: null,
      latestArtifactType: null,
      processorVersion: null,
      blockedWriteReasons: [],
      warnings: [],
    });
  });

  it("excludes null lifecycle rows even if query regresses", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-legacy",
        title: "Legacy",
        organizingQuestion: "Legacy question",
        evidenceNeeded: [],
        status: "open",
        seedType: "pattern",
        visibility: "internal_only",
        candidateLifecycleStatus: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const items = await listInternalInvestigationReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(items).toEqual([]);
  });

  it("aggregates evidence without snippet or quote fields", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        title: "Investigation title",
        organizingQuestion: "What is happening?",
        evidenceNeeded: [],
        status: "open",
        seedType: "pattern",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "inv-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: { publicSafetyLevel: "internal_only" },
      },
    ]);

    const items = await listInternalInvestigationReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          targetType: "investigation",
          targetId: { in: ["inv-1"] },
        }),
        select: {
          targetId: true,
          sourceType: true,
          sourceId: true,
          meta: true,
        },
      })
    );

    expect(items[0]?.evidence).toEqual({
      linkCount: 1,
      sourceTypes: { message: 1 },
      safetyLevels: { internal_only: 1 },
      linkedSources: [
        {
          sourceType: "message",
          sourceId: "msg-1",
          safetyLevel: "internal_only",
        },
      ],
    });

    const serialized = JSON.stringify(items[0]);
    expect(serialized).not.toContain("snippet");
    expect(serialized).not.toContain("quote");
  });

  it("falls back to organizingQuestion when evidenceNeeded is empty", () => {
    expect(resolveInvestigationReviewSummary([], "Organizing question")).toBe(
      "Organizing question"
    );
    expect(
      resolveInvestigationReviewSummary(["  "], "Organizing question")
    ).toBe("Organizing question");
    expect(
      resolveInvestigationReviewSummary(["Evidence gap"], "Organizing question")
    ).toBe("Evidence gap");
  });
});
