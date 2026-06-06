import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  modelUpdate: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  derivationArtifact: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

import { listInternalModelUpdateReviewCandidates } from "../internal-model-update-review-candidates";

describe("internal model update review candidates loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.derivationArtifact.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns only internal_only isMeaningful false rows for the current user", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "conclusion_strengthened",
        userFacingSummary: "Confidence increased on operating logic",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        beforeSummary: "Emerging pattern",
        afterSummary: "Supported pattern",
        confidenceDelta: 0.15,
        visibility: "internal_only",
        isMeaningful: false,
        sourceRunId: "run-1",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const items = await listInternalModelUpdateReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
          isMeaningful: false,
        }),
      })
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "mu-1",
      updateType: "conclusion_strengthened",
      userFacingSummary: "Confidence increased on operating logic",
      affectedObjectType: "usermap_conclusion",
      affectedObjectId: "umc-1",
      visibility: "internal_only",
      isMeaningful: false,
    });
  });

  it("excludes isMeaningful true rows even if query regresses", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-meaningful",
        updateType: "conclusion_added",
        userFacingSummary: "Already meaningful",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-2",
        beforeSummary: null,
        afterSummary: null,
        confidenceDelta: null,
        visibility: "internal_only",
        isMeaningful: true,
        sourceRunId: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const items = await listInternalModelUpdateReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(items).toEqual([]);
  });

  it("does not return user_visible rows from loader query scope", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([]);

    await listInternalModelUpdateReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "internal_only",
          isMeaningful: false,
        }),
      })
    );
  });

  it("aggregates evidence with source IDs and safety levels only", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "investigation_opened",
        userFacingSummary: "New investigation opened",
        affectedObjectType: "investigation",
        affectedObjectId: "inv-1",
        beforeSummary: null,
        afterSummary: null,
        confidenceDelta: null,
        visibility: "internal_only",
        isMeaningful: false,
        sourceRunId: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "mu-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: { publicSafetyLevel: "internal_only" },
      },
      {
        targetId: "mu-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        meta: { publicSafetyLevel: "safe_summary" },
      },
    ]);

    const items = await listInternalModelUpdateReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          targetType: "model_update",
          targetId: { in: ["mu-1"] },
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
      linkCount: 2,
      sourceTypes: { message: 1, pattern_claim: 1 },
      safetyLevels: { internal_only: 1, safe_summary: 1 },
      linkedSources: [
        {
          sourceType: "message",
          sourceId: "msg-1",
          safetyLevel: "internal_only",
        },
        {
          sourceType: "pattern_claim",
          sourceId: "pc-1",
          safetyLevel: "safe_summary",
        },
      ],
    });
  });

  it("serialized output excludes snippet, quote, summary, internalNotes, and raw text fields", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "fieldwork_assigned",
        userFacingSummary: "Safe user-facing summary only",
        affectedObjectType: "fieldwork_assignment",
        affectedObjectId: "fw-1",
        beforeSummary: null,
        afterSummary: null,
        confidenceDelta: null,
        visibility: "internal_only",
        isMeaningful: false,
        sourceRunId: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const items = await listInternalModelUpdateReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    const serialized = JSON.stringify(items[0]);
    expect(serialized).not.toContain("snippet");
    expect(serialized).not.toContain("quote");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("RAW MESSAGE BODY");
    expect(serialized).not.toContain("journal body");
    expect(serialized).not.toContain("evidence-link summary");
  });
});
