import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnderstandingLinkSourceType } from "@prisma/client";

import { assembleEvidencePacketV1 } from "../understanding-dark-engine/evidence-packet";

function createDbMock() {
  return {
    patternClaim: { findMany: vi.fn() },
    patternClaimEvidence: { findMany: vi.fn() },
    contradictionNode: { findMany: vi.fn() },
    contradictionEvidence: { findMany: vi.fn() },
    profileArtifact: { findMany: vi.fn() },
    evidenceSpan: { findMany: vi.fn() },
    referenceItem: { findMany: vi.fn() },
    surfacedAction: { findMany: vi.fn() },
    quickCheckIn: { findMany: vi.fn() },
    journalEntry: { findMany: vi.fn() },
    session: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    importUploadSession: { findMany: vi.fn() },
    importUploadChunk: { findMany: vi.fn() },
    modelUpdate: { findMany: vi.fn() },
    userMapConclusion: { findMany: vi.fn() },
  };
}

describe("Phase 2 dark engine EvidencePacket assembly", () => {
  const db = createDbMock();

  beforeEach(() => {
    vi.clearAllMocks();

    db.patternClaim.findMany.mockResolvedValue([
      {
        id: "pc-1",
        summary: "I avoid difficult conversations",
        status: "active",
        sourceRunId: "run-1",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        updatedAt: new Date("2026-05-10T10:00:00.000Z"),
      },
    ]);

    db.patternClaimEvidence.findMany.mockResolvedValue([
      {
        id: "pce-1",
        claimId: "pc-1",
        source: "derivation",
        sessionId: "s-app-1",
        messageId: "m-app-1",
        journalEntryId: null,
        quote: "I keep avoiding this because I panic when conflict starts.",
        createdAt: new Date("2026-05-10T11:00:00.000Z"),
      },
    ]);

    db.contradictionNode.findMany.mockResolvedValue([
      {
        id: "cn-1",
        title: "Goal behavior gap",
        sideA: "Wants stability",
        sideB: "Avoids hard planning",
        status: "open",
        sourceSessionId: "s-app-1",
        sourceMessageId: "m-app-1",
        createdAt: new Date("2026-05-09T10:00:00.000Z"),
        lastTouchedAt: new Date("2026-05-10T12:00:00.000Z"),
        lastEvidenceAt: new Date("2026-05-10T12:00:00.000Z"),
      },
    ]);

    db.contradictionEvidence.findMany.mockResolvedValue([]);

    db.profileArtifact.findMany.mockResolvedValue([
      {
        id: "pa-1",
        type: "FEAR",
        claim: "I fear rejection in conflict",
        confidence: 0.7,
        status: "candidate",
        firstSeenAt: new Date("2026-05-02T10:00:00.000Z"),
        lastSeenAt: new Date("2026-05-10T10:00:00.000Z"),
      },
    ]);

    db.evidenceSpan.findMany.mockResolvedValue([
      {
        id: "es-1",
        messageId: "m-app-1",
        charStart: 0,
        charEnd: 48,
        createdAt: new Date("2026-05-10T11:30:00.000Z"),
        message: {
          content: "I panic quickly and shut down when conflict appears.",
          session: {
            origin: "APP",
          },
        },
      },
    ]);

    db.referenceItem.findMany.mockResolvedValue([]);
    db.surfacedAction.findMany.mockResolvedValue([]);

    db.quickCheckIn.findMany.mockResolvedValue([
      {
        id: "qc-1",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "I felt panicked today",
        createdAt: new Date("2026-05-10T13:00:00.000Z"),
      },
    ]);

    db.journalEntry.findMany.mockResolvedValue([]);

    db.session.findMany.mockResolvedValue([
      {
        id: "s-app-1",
        origin: "APP",
        startedAt: new Date("2026-05-10T10:00:00.000Z"),
        createdAt: new Date("2026-05-10T10:00:00.000Z"),
        label: "Morning session",
      },
      {
        id: "s-import-1",
        origin: "IMPORTED_ARCHIVE",
        startedAt: new Date("2026-05-05T10:00:00.000Z"),
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
        label: "Imported session",
      },
    ]);

    db.message.findMany
      .mockResolvedValueOnce([
        {
          id: "m-app-1",
          sessionId: "s-app-1",
          role: "user",
          content: "I panic and avoid conflict.",
          createdAt: new Date("2026-05-10T10:05:00.000Z"),
          session: {
            origin: "APP",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "m-app-1",
          sessionId: "s-app-1",
          session: {
            origin: "APP",
          },
        },
      ]);

    db.importUploadSession.findMany.mockResolvedValue([
      {
        id: "imp-1",
        status: "complete",
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
        startedAt: new Date("2026-05-05T10:01:00.000Z"),
        finishedAt: new Date("2026-05-05T10:02:00.000Z"),
        processedConversations: 3,
        processedMessages: 40,
      },
    ]);

    db.importUploadChunk.findMany.mockResolvedValue([
      {
        id: "imp-chunk-1",
        sessionId: "imp-1",
        sizeBytes: 4096,
        createdAt: new Date("2026-05-05T10:01:30.000Z"),
      },
    ]);

    db.modelUpdate.findMany.mockResolvedValue([
      {
        id: "mu-correction-1",
        userFacingSummary: "User corrected prior framing",
        createdAt: new Date("2026-05-10T14:00:00.000Z"),
      },
    ]);

    db.userMapConclusion.findMany.mockResolvedValue([
      {
        id: "umc-1",
        lastUserCorrectionAt: new Date("2026-05-10T14:30:00.000Z"),
        lastUserCorrectionLabel: "Partly right",
      },
    ]);
  });

  it("assembles typed packet items and metrics across source families", async () => {
    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      db,
    });

    expect(packet.userId).toBe("user-1");
    expect(packet.items.length).toBeGreaterThan(0);

    const sourceTypes = new Set(packet.items.map((item) => item.sourceType));

    expect(sourceTypes.has(UnderstandingLinkSourceType.pattern_claim)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.pattern_claim_evidence)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.profile_artifact)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.quick_check_in)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.timeline_aggregation)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.user_correction)).toBe(true);

    expect(packet.metrics.sourceDiversity).toBeGreaterThanOrEqual(6);
    expect(packet.metrics.sourceCounts.pattern_claim).toBe(1);
    expect(packet.metrics.highEmotionItemCount).toBeGreaterThan(0);
    expect(packet.metrics.importedCount).toBeGreaterThan(0);
  });

  it("treats timeline_aggregation and user_correction as non-linkable context sources", async () => {
    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      db,
    });

    const contextItems = packet.items.filter(
      (item) =>
        item.sourceType === UnderstandingLinkSourceType.timeline_aggregation ||
        item.sourceType === UnderstandingLinkSourceType.user_correction
    );

    expect(contextItems.length).toBeGreaterThan(0);
    for (const item of contextItems) {
      expect(item.linkable).toBe(false);
      expect(item.ownershipResolvable).toBe(false);
      expect(item.qualityFlags).toContain("NON_LINKABLE_CONTEXT");
    }

    expect(packet.metrics.nonLinkableContextItems).toBeGreaterThanOrEqual(contextItems.length);
  });

  it("applies low-to-moderate profile artifact contribution class and bounded signal semantics", async () => {
    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      db,
    });

    const profileItems = packet.items.filter(
      (item) => item.sourceType === UnderstandingLinkSourceType.profile_artifact
    );

    expect(profileItems.length).toBeGreaterThan(0);
    for (const item of profileItems) {
      expect(item.weightClass).toBe("low_to_moderate");
      expect(item.linkable).toBe(true);
    }
  });
});
