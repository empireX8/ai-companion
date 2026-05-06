import { beforeEach, describe, expect, it, vi } from "vitest";

type DebugCollectorLike = {
  recordHistory: (entries: unknown[]) => void;
  recordDetectorInputCountsByFamily: (
    counts: Record<string, number | null>
  ) => void;
  recordCluesEmittedByFamily: (counts: Record<string, number>) => void;
  recordClaimUpsert: (event: {
    claimId: string;
    patternType: string;
    created: boolean;
  }) => void;
  recordReceiptMaterialization: (event: {
    created: boolean;
    sourceKind: "chat_message" | "journal_entry" | "unknown";
  }) => void;
  recordLifecycleEvaluation: (event: {
    claimId: string;
    patternType: string;
    advanced: boolean;
    newStatus: "candidate" | "active" | "paused" | "dismissed";
    newStrengthLevel: "tentative" | "developing" | "established";
    evidenceCount: number;
    sessionCount: number;
    journalEvidenceCount: number;
  }) => void;
};

const authMock = vi.fn();
const runForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: {
    runForUser: runForUserMock,
  },
}));

vi.mock("@/lib/contradiction-top", () => ({
  getTopContradictions: vi.fn(),
}));

vi.mock("@/lib/prismadb", () => ({
  default: {
    patternClaim: { findMany: vi.fn() },
    message: { count: vi.fn() },
    session: { count: vi.fn() },
  },
}));

vi.mock("@/lib/pattern-visible-claim", () => ({
  projectVisiblePatternClaim: vi.fn(),
}));

vi.mock("@/lib/patterns-api", () => ({
  PATTERN_FAMILY_SECTIONS: [],
}));

vi.mock("@/lib/pattern-rerun-debug", async () => {
  const actual = await import("../pattern-rerun-debug");
  return actual;
});

describe("POST /api/patterns debug instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "u1" });
    runForUserMock.mockResolvedValue({
      runId: "run-1",
      status: "completed",
      messageCount: 3,
      sessionCount: 2,
      claimsCreated: 1,
    });
  });

  it("keeps the normal response backward-compatible when debug is not requested", async () => {
    const route = await import("../../app/api/patterns/route");
    const response = await route.POST(
      new Request("http://localhost/api/patterns", { method: "POST" })
    );
    const payload = await response.json();

    expect(payload).toEqual({
      status: "completed",
      claimsCreated: 1,
      messageCount: 3,
    });
    expect(runForUserMock).toHaveBeenCalledWith({
      userId: "u1",
      trigger: "manual",
      debugCollector: undefined,
    });
  });

  it("returns downstream debug counters from the same rerun path", async () => {
    runForUserMock.mockImplementation(
      async ({
        debugCollector,
      }: {
        debugCollector: DebugCollectorLike;
      }) => {
        debugCollector.recordHistory([
          {
            sourceKind: "chat_message",
            messageId: "m1",
            sessionId: "s1",
            journalEntryId: null,
            sessionOrigin: "APP",
            sessionStartedAt: new Date("2026-01-01T00:00:00.000Z"),
            role: "user",
            content: "Whenever I'm stressed, I tend to procrastinate.",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            sourceKind: "journal_entry",
            messageId: null,
            sessionId: null,
            journalEntryId: "j1",
            sessionOrigin: null,
            sessionStartedAt: null,
            role: "user",
            content: "I struggle to trust my own judgment when I have to commit.",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ]);

        debugCollector.recordCluesEmittedByFamily({
          trigger_condition: 1,
          inner_critic: 0,
          repetitive_loop: 0,
          contradiction_drift: 2,
          recovery_stabilizer: 0,
        });
        debugCollector.recordDetectorInputCountsByFamily({
          trigger_condition: 2,
          inner_critic: 2,
          repetitive_loop: 2,
          recovery_stabilizer: 2,
          contradiction_drift: null,
        });

        debugCollector.recordClaimUpsert({
          claimId: "claim-new",
          patternType: "trigger_condition",
          created: true,
        });
        debugCollector.recordClaimUpsert({
          claimId: "claim-existing",
          patternType: "inner_critic",
          created: false,
        });

        debugCollector.recordReceiptMaterialization({
          created: true,
          sourceKind: "chat_message",
        });
        debugCollector.recordReceiptMaterialization({
          created: true,
          sourceKind: "journal_entry",
        });
        debugCollector.recordReceiptMaterialization({
          created: false,
          sourceKind: "journal_entry",
        });

        debugCollector.recordLifecycleEvaluation({
          claimId: "claim-new",
          patternType: "trigger_condition",
          advanced: true,
          newStatus: "active",
          newStrengthLevel: "tentative",
          evidenceCount: 3,
          sessionCount: 2,
          journalEvidenceCount: 1,
        });
        debugCollector.recordLifecycleEvaluation({
          claimId: "claim-existing",
          patternType: "inner_critic",
          advanced: false,
          newStatus: "candidate",
          newStrengthLevel: "tentative",
          evidenceCount: 2,
          sessionCount: 0,
          journalEvidenceCount: 2,
        });

        return {
          runId: "run-1",
          status: "completed",
          messageCount: 3,
          sessionCount: 2,
          claimsCreated: 1,
        };
      }
    );

    const route = await import("../../app/api/patterns/route");
    const response = await route.POST(
      new Request("http://localhost/api/patterns?debug=1", { method: "POST" })
    );
    const payload = await response.json();

    expect(payload.status).toBe("completed");
    expect(payload.claimsCreated).toBe(1);
    expect(payload.messageCount).toBe(3);
    expect(payload.debug).toMatchObject({
      historyEntryCount: 2,
      messageEntryCount: 1,
      journalEntryCount: 1,
      cluesEmittedByFamily: {
        trigger_condition: 1,
        inner_critic: 0,
        repetitive_loop: 0,
        contradiction_drift: 2,
        recovery_stabilizer: 0,
      },
      detectorInputCountsByFamily: {
        trigger_condition: 2,
        inner_critic: 2,
        repetitive_loop: 2,
        recovery_stabilizer: 2,
        contradiction_drift: null,
      },
      claimsCreatedByFamily: {
        trigger_condition: 1,
        inner_critic: 0,
        repetitive_loop: 0,
        contradiction_drift: 0,
        recovery_stabilizer: 0,
      },
      claimsMatchedExisting: 1,
      claimsMatchedExistingByFamily: {
        trigger_condition: 0,
        inner_critic: 1,
        repetitive_loop: 0,
        contradiction_drift: 0,
        recovery_stabilizer: 0,
      },
      receiptsCreatedTotal: 2,
      receiptsCreatedMessage: 1,
      receiptsCreatedJournal: 1,
      receiptsSkippedDuplicate: 1,
      lifecycleAdvancedCount: 1,
      touchedClaimIds: ["claim-new", "claim-existing"],
    });
  });

  it("supports debug=true and keeps journal counts separate from messageCount", async () => {
    runForUserMock.mockImplementation(
      async ({
        debugCollector,
      }: {
        debugCollector: DebugCollectorLike;
      }) => {
        debugCollector.recordHistory([
          {
            sourceKind: "chat_message",
            messageId: "m1",
            sessionId: "s1",
            journalEntryId: null,
            sessionOrigin: "APP",
            sessionStartedAt: new Date("2026-01-01T00:00:00.000Z"),
            role: "user",
            content: "I keep avoiding hard tasks.",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            sourceKind: "journal_entry",
            messageId: null,
            sessionId: null,
            journalEntryId: "j1",
            sessionOrigin: null,
            sessionStartedAt: null,
            role: "user",
            content: "I notice the same loop.",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ]);
        debugCollector.recordReceiptMaterialization({
          created: false,
          sourceKind: "chat_message",
        });
        return {
          runId: "run-2",
          status: "completed",
          messageCount: 10,
          sessionCount: 5,
          claimsCreated: 0,
        };
      }
    );

    const route = await import("../../app/api/patterns/route");
    const response = await route.POST(
      new Request("http://localhost/api/patterns?debug=true", { method: "POST" })
    );
    const payload = await response.json();

    expect(payload.messageCount).toBe(10);
    expect(payload.debug.messageEntryCount).toBe(1);
    expect(payload.debug.journalEntryCount).toBe(1);
    expect(payload.debug.journalEntryCount).not.toBe(payload.messageCount);
    expect(payload.debug.receiptsCreatedTotal).toBe(0);
    expect(payload.debug.receiptsSkippedDuplicate).toBe(1);
  });
});
