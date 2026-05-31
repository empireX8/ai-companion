/**
 * import-upload-queue — post-import pattern detection trigger (P3-03)
 *
 * Tests that enqueueImportProcessing wires onImportComplete correctly, that
 * the hook calls no-write trigger eligibility + patternBatchOrchestrator with
 * trigger="import", and that the dedup guard prevents duplicate concurrent
 * processing of the same session.
 *
 * Each test uses a unique sessionId to avoid interference from the module-level
 * runningSessions Set that persists across tests within a file.
 */

import { readFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("../import-upload-processor", () => ({
  processChatImportSession: vi.fn(),
}));

vi.mock("../pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: {
    runForUser: vi.fn().mockResolvedValue({
      status: "completed",
      claimsCreated: 3,
      messageCount: 10,
      sessionCount: 2,
      runId: "run-1",
    }),
  },
}));

vi.mock("../prismadb", () => ({
  default: {
    importUploadSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: "session-1",
        resultErrors: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("../pattern-rerun-debug", () => ({
  createPatternRerunDebugCollector: vi.fn().mockReturnValue({
    recordHistory: vi.fn(),
    buildDiagnostics: vi.fn().mockReturnValue({
      behavioralEntryCount: 5,
      rejectedEntryCount: 2,
      rejectionReasonCounts: {},
    }),
  }),
}));

vi.mock("../import-diagnostics", () => ({
  IMPORT_DIAGNOSTICS_UNAVAILABLE: "UNAVAILABLE",
  combineResultErrorsWithDiagnostics: vi.fn().mockReturnValue([]),
  createEmptyImportRunDiagnostics: vi.fn().mockReturnValue({
    patternDerivationTriggered: false,
    reasonCounts: {},
  }),
  incrementReasonCodeCount: vi.fn(),
  splitResultErrorsAndDiagnostics: vi.fn().mockReturnValue({ errors: [], diagnostics: null }),
  toTopReasonCounts: vi.fn().mockReturnValue([]),
}));

vi.mock("../understanding-dark-engine/import-completion-candidate-bridge", () => ({
  tryCreateInternalUserMapCandidateFromImportCompletion: vi.fn().mockResolvedValue({
    decision: "skipped_ineligible_trigger",
    reason: "Suppressed by no-write trigger cooldown.",
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { processChatImportSession } from "../import-upload-processor";
import { patternBatchOrchestrator } from "../pattern-batch-orchestrator";
import { enqueueImportProcessing } from "../import-upload-queue";
import { tryCreateInternalUserMapCandidateFromImportCompletion } from "../understanding-dark-engine/import-completion-candidate-bridge";

// ── Types ─────────────────────────────────────────────────────────────────────

type OnImportCompleteHook = (args: { sessionId: string; userId: string }) => Promise<void>;

// ── enqueueImportProcessing — hook wiring ─────────────────────────────────────

describe("enqueueImportProcessing — hook wiring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes onImportComplete to processChatImportSession", async () => {
    (processChatImportSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    enqueueImportProcessing("ses-wire-1");
    await vi.runAllTimersAsync();

    expect(processChatImportSession).toHaveBeenCalledOnce();
    expect(processChatImportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "ses-wire-1",
        onImportComplete: expect.any(Function),
      })
    );
  });

  it("deduplicates concurrent runs for the same session", async () => {
    (processChatImportSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // All three calls happen before the setTimeout fires, so the second and
    // third are dropped by the runningSessions dedup guard.
    enqueueImportProcessing("ses-dedup-1");
    enqueueImportProcessing("ses-dedup-1");
    enqueueImportProcessing("ses-dedup-1");

    await vi.runAllTimersAsync();

    expect(processChatImportSession).toHaveBeenCalledTimes(1);
  });

  it("allows re-enqueueing after the first run completes", async () => {
    (processChatImportSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // First run — unique sessionId to avoid interference from other tests
    enqueueImportProcessing("ses-requeue-1");
    await vi.runAllTimersAsync();

    // After the first run's finally block executes, the session is removed from
    // runningSessions, allowing a second enqueue to proceed.
    enqueueImportProcessing("ses-requeue-1");
    await vi.runAllTimersAsync();

    expect(processChatImportSession).toHaveBeenCalledTimes(2);
  });
});

// ── onImportComplete hook — pattern orchestrator call ─────────────────────────

describe("onImportComplete hook — pattern orchestrator call", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function captureHook(sessionId: string): Promise<OnImportCompleteHook | undefined> {
    let captured: OnImportCompleteHook | undefined;
    (processChatImportSession as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ onImportComplete }: { onImportComplete?: OnImportCompleteHook }) => {
        captured = onImportComplete;
      }
    );
    enqueueImportProcessing(sessionId);
    await vi.runAllTimersAsync();
    return captured;
  }

  it("calls patternBatchOrchestrator.runForUser with trigger=import", async () => {
    const hook = await captureHook("ses-orch-1");
    expect(hook).toBeDefined();

    await hook!({ sessionId: "ses-orch-1", userId: "user-1" });

    expect(patternBatchOrchestrator.runForUser).toHaveBeenCalledOnce();
    expect(patternBatchOrchestrator.runForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", trigger: "import" })
    );
  });

  it("calls import completion candidate bridge for completed imports", async () => {
    const hook = await captureHook("ses-elig-1");
    expect(hook).toBeDefined();

    await hook!({ sessionId: "ses-elig-1", userId: "user-1" });

    expect(tryCreateInternalUserMapCandidateFromImportCompletion).toHaveBeenCalledOnce();
    expect(tryCreateInternalUserMapCandidateFromImportCompletion).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "ses-elig-1",
    });
  });

  it("calls patternBatchOrchestrator only once per import completion", async () => {
    const hook = await captureHook("ses-orch-2");
    expect(hook).toBeDefined();

    await hook!({ sessionId: "ses-orch-2", userId: "user-1" });

    // Orchestrator called exactly once — not per-message, not per-conversation
    expect(patternBatchOrchestrator.runForUser).toHaveBeenCalledTimes(1);
  });

  it("uses the userId from the import session", async () => {
    const hook = await captureHook("ses-orch-3");
    expect(hook).toBeDefined();

    await hook!({ sessionId: "ses-orch-3", userId: "user-xyz" });

    expect(patternBatchOrchestrator.runForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-xyz" })
    );
  });

  it("hook propagates orchestrator errors (processor .catch() handles them)", async () => {
    (patternBatchOrchestrator.runForUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("orchestrator crash")
    );

    const hook = await captureHook("ses-orch-4");
    expect(hook).toBeDefined();

    // The hook propagates errors — the processor wraps the hook in void .catch()
    // so the import result is never affected. This test documents that contract.
    await expect(hook!({ sessionId: "ses-orch-4", userId: "user-1" })).rejects.toThrow(
      "orchestrator crash"
    );
  });

  it("fails open when import completion candidate bridge throws", async () => {
    (
      tryCreateInternalUserMapCandidateFromImportCompletion as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("candidate bridge crash"));
    const hook = await captureHook("ses-elig-2");
    expect(hook).toBeDefined();

    await expect(hook!({ sessionId: "ses-elig-2", userId: "user-1" })).resolves.toBeUndefined();
    expect(patternBatchOrchestrator.runForUser).toHaveBeenCalledOnce();
  });

  it("does not wire dark-run orchestrator directly into import completion", async () => {
    const source = await readFile(new URL("../import-upload-queue.ts", import.meta.url), "utf8");
    expect(source).not.toContain("runNoWriteUnderstandingDarkRun");
    expect(source).not.toContain("evaluateNoWriteDarkRunOutput");
    expect(source).toContain("tryCreateInternalUserMapCandidateFromImportCompletion");
  });
});
