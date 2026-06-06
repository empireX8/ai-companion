import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  fieldworkAssignment: {
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

import { listInternalFieldworkReviewCandidates } from "../internal-fieldwork-review-candidates";

describe("internal fieldwork review candidates loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns only internal_only lifecycle-managed fieldwork for the current user", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-1",
        prompt: "Watch for tension on Sunday evenings",
        reason: "Weekend pattern may need more signal",
        status: "assigned",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-1",
        expiresAt: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const items = await listInternalFieldworkReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
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
      id: "fw-1",
      prompt: "Watch for tension on Sunday evenings",
      reason: "Weekend pattern may need more signal",
      status: "assigned",
      visibility: "internal_only",
      candidateLifecycleStatus: "proposed",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pc-1",
      expiresAt: null,
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
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-legacy",
        prompt: "Legacy prompt",
        reason: "Legacy reason",
        status: "assigned",
        visibility: "internal_only",
        candidateLifecycleStatus: null,
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-legacy",
        expiresAt: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const items = await listInternalFieldworkReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(items).toEqual([]);
  });

  it("does not return user_visible rows from loader query scope", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([]);

    await listInternalFieldworkReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "internal_only",
        }),
      })
    );
  });

  it("aggregates evidence without snippet, quote, summary, or observation fields", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-1",
        prompt: "Watch prompt",
        reason: "Safe reason text",
        status: "assigned",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-1",
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "fw-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: { publicSafetyLevel: "internal_only" },
      },
    ]);

    const items = await listInternalFieldworkReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          targetType: "fieldwork_assignment",
          targetId: { in: ["fw-1"] },
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
    expect(serialized).not.toContain("observationNote");
    expect(serialized).not.toContain("observationOutcome");
    expect(serialized).not.toContain("RAW MESSAGE BODY");
  });
});
