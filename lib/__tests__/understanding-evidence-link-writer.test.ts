import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  UnderstandingEvidenceLinkDuplicateError,
  createUnderstandingEvidenceLinkForUser,
  type UnderstandingEvidenceLinkWriterDb,
} from "../understanding-evidence-link-writer";

function createWriterDbMock(): UnderstandingEvidenceLinkWriterDb {
  return {
    userMapConclusion: { findFirst: vi.fn() },
    investigation: { findFirst: vi.fn() },
    modelUpdate: { findFirst: vi.fn() },
    fieldworkAssignment: { findFirst: vi.fn() },
    surfacedAction: { findFirst: vi.fn() },
    patternClaim: { findFirst: vi.fn() },
    contradictionNode: { findFirst: vi.fn() },
    patternClaimEvidence: { findFirst: vi.fn() },
    contradictionEvidence: { findFirst: vi.fn() },
    profileArtifact: { findFirst: vi.fn() },
    evidenceSpan: { findFirst: vi.fn() },
    referenceItem: { findFirst: vi.fn() },
    quickCheckIn: { findFirst: vi.fn() },
    journalEntry: { findFirst: vi.fn() },
    session: { findFirst: vi.fn() },
    message: { findFirst: vi.fn() },
    importUploadSession: { findFirst: vi.fn() },
    importUploadChunk: { findFirst: vi.fn() },
    understandingEvidenceLink: { create: vi.fn() },
  } as unknown as UnderstandingEvidenceLinkWriterDb;
}

describe("understanding-evidence-link-writer", () => {
  it("accepts valid owned source/target combination and creates link", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });
    db.patternClaim.findFirst = vi.fn().mockResolvedValue({ id: "claim-1" });
    db.understandingEvidenceLink.create = vi
      .fn()
      .mockResolvedValue({ id: "link-1", userId: "user-1" });

    const created = await createUnderstandingEvidenceLinkForUser({
      userId: "user-1",
      input: {
        targetType: "usermap_conclusion",
        targetId: "umc-1",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "supports",
      },
      db,
    });

    expect(created).toMatchObject({ id: "link-1", userId: "user-1" });
    expect(db.understandingEvidenceLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          targetType: "usermap_conclusion",
          sourceType: "pattern_claim",
        }),
      })
    );
  });

  it("rejects target not owned by authenticated user", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "other-user-target",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        },
        db,
      })
    ).rejects.toMatchObject({
      field: "targetId",
      message: "Target not found for authenticated user",
    });

    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects source not owned by authenticated user", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });
    db.patternClaim.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "pattern_claim",
          sourceId: "other-user-source",
          role: "supports",
        },
        db,
      })
    ).rejects.toMatchObject({
      field: "sourceId",
      message:
        "Source not found for authenticated user or source type is not verifiable in Phase 1B",
    });

    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects timeline_aggregation source type", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "timeline_aggregation",
          sourceId: "agg-1",
          role: "context",
        },
        db,
      })
    ).rejects.toMatchObject({
      field: "sourceId",
    });

    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects user_correction source type", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "user_correction",
          sourceId: "corr-1",
          role: "correction",
        },
        db,
      })
    ).rejects.toMatchObject({
      field: "sourceId",
    });

    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("resolves import_record ownership from chunk fallback", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });
    db.importUploadSession.findFirst = vi.fn().mockResolvedValue(null);
    db.importUploadChunk.findFirst = vi.fn().mockResolvedValue({ id: "chunk-1" });
    db.understandingEvidenceLink.create = vi
      .fn()
      .mockResolvedValue({ id: "link-import-1" });

    await createUnderstandingEvidenceLinkForUser({
      userId: "user-1",
      input: {
        targetType: "usermap_conclusion",
        targetId: "umc-1",
        sourceType: "import_record",
        sourceId: "chunk-1",
        role: "derived_from",
      },
      db,
    });

    expect(db.understandingEvidenceLink.create).toHaveBeenCalledTimes(1);
  });

  it("preserves duplicate conflict behavior", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });
    db.patternClaim.findFirst = vi.fn().mockResolvedValue({ id: "claim-1" });
    db.understandingEvidenceLink.create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        },
        db,
      })
    ).rejects.toBeInstanceOf(UnderstandingEvidenceLinkDuplicateError);
  });
});
