/**
 * Pattern Batch Orchestrator (P3-01)
 *
 * Orchestrates a full batch pattern detection pass for a user.
 * Builds on the Slice 1 executor (P5-09) — does NOT create a parallel path.
 *
 * Responsibilities:
 *  1. Synthesize the user's normalized history (P3-02 substrate)
 *  2. Extract batch metadata (messageCount, sessionCount, windowStart/End)
 *  3. Invoke the canonical pattern detection executor with batch metadata
 *
 * The orchestrator is injectable for testing: pass mock `db` and `detect`.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";
import {
  createPatternDetectionExecutor,
  type PatternDetectionTrigger,
  type PatternDetector,
} from "./pattern-detection-executor";
import {
  synthesizeHistory,
  extractMessageIds,
  extractSessionCount,
  extractWindowBounds,
  type HistorySynthesisOptions,
} from "./history-synthesis";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BatchOrchestrationInput = {
  userId: string;
  trigger: PatternDetectionTrigger;
  /** Optional window bounds — defaults to full history if omitted */
  windowStart?: Date;
  windowEnd?: Date;
};

export type BatchOrchestrationResult = {
  runId: string;
  status: "completed" | "failed" | "skipped";
  messageCount: number;
  sessionCount: number;
  claimsCreated: number;
  error?: string;
};

export type PatternBatchOrchestratorOptions = {
  db?: PrismaClient;
  detect?: PatternDetector;
  /** Injectable synthesize function — useful for testing without a real DB */
  synthesize?: (opts: HistorySynthesisOptions) => ReturnType<typeof synthesizeHistory>;
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a batch orchestrator.
 * All dependencies are injectable — pass mocks for testing.
 */
export function createPatternBatchOrchestrator(
  opts: PatternBatchOrchestratorOptions = {}
) {
  const db = opts.db ?? prismadb;
  const synthesizeFn = opts.synthesize ?? synthesizeHistory;
  const executor = createPatternDetectionExecutor({ db, detect: opts.detect });

  /**
   * Run a full batch pass for a user.
   *
   * Returns "skipped" if the user has no messages in the requested window.
   * Never throws — errors are caught and returned in the result.
   */
  async function runForUser(
    input: BatchOrchestrationInput
  ): Promise<BatchOrchestrationResult> {
    const { userId, trigger, windowStart, windowEnd } = input;

    let entries;
    try {
      entries = await synthesizeFn({ userId, windowStart, windowEnd, db });
    } catch (err) {
      return {
        runId: "",
        status: "failed",
        messageCount: 0,
        sessionCount: 0,
        claimsCreated: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Nothing to process — skip without creating a DerivationRun
    if (entries.length === 0) {
      return {
        runId: "",
        status: "skipped",
        messageCount: 0,
        sessionCount: 0,
        claimsCreated: 0,
      };
    }

    const messageIds = extractMessageIds(entries);
    const sessionCount = extractSessionCount(entries);
    const bounds = extractWindowBounds(entries);

    const result = await executor.run({
      userId,
      trigger,
      messageIds,
      batchMeta: {
        messageCount: messageIds.length,
        sessionCount,
        windowStart: bounds.windowStart ?? undefined,
        windowEnd: bounds.windowEnd ?? undefined,
      },
    });

    return {
      runId: result.runId,
      status: result.status,
      messageCount: messageIds.length,
      sessionCount,
      claimsCreated: result.claimsCreated,
      error: result.error,
    };
  }

  return { runForUser };
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Uses patternDetectorV1 (P3-04 + P3-05 + P3-06) as the default detector.
// Import is deferred to avoid circular dependency at module load time.
import { patternDetectorV1 } from "./pattern-detector-v1";
export const patternBatchOrchestrator = createPatternBatchOrchestrator({
  detect: patternDetectorV1,
});
