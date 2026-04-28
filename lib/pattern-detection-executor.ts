/**
 * Pattern Detection Executor (P5-09)
 *
 * Named, injectable async execution path for pattern detection.
 * Tied to DerivationRun lifecycle: created → running → completed | failed.
 *
 * Supports three trigger modes:
 *  - "import"    : triggered after a chat import finishes processing
 *  - "threshold" : triggered when a session count threshold is crossed
 *  - "manual"    : triggered by explicit user/admin action
 *
 * The actual pattern detection logic is injected via the `detect` parameter.
 * Pass a mock detector in tests; the production detector (P3) will be wired
 * in a later slice. The default is a no-op scaffold that returns 0 claims.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";
import type { PatternRerunDebugCollector } from "./pattern-rerun-debug";
import {
  createDerivationRun,
  startDerivationRun,
  completeDerivationRun,
  failDerivationRun,
  type DerivationBatchMeta,
} from "./derivation-layer";
import {
  runPatternLlmLfShadowPass,
} from "./pattern-llm-labeling-function";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PatternDetectionTrigger = "import" | "threshold" | "manual";

export type PatternDetectionInput = {
  userId: string;
  trigger: PatternDetectionTrigger;
  messageIds: string[];
  processorVersion?: string;
  batchMeta?: DerivationBatchMeta;
  debugCollector?: PatternRerunDebugCollector;
};

export type PatternDetectionResult = {
  runId: string;
  status: "completed" | "failed";
  claimsCreated: number;
  error?: string;
};

/**
 * Injectable detection function signature.
 * Receives the run context and returns the number of PatternClaims created.
 * Production implementation lives in P3 (pattern-detector.ts).
 */
export type PatternDetector = (ctx: {
  userId: string;
  messageIds: string[];
  runId: string;
  db: PrismaClient;
  debugCollector?: PatternRerunDebugCollector;
}) => Promise<number>;

export type PatternLlmShadowRunner = (ctx: {
  userId: string;
  messageIds: string[];
  runId: string;
  db: PrismaClient;
}) => Promise<void>;

// Default no-op scaffold — replaced by real detector in P3
const noopDetector: PatternDetector = async () => 0;

// ── Factory ───────────────────────────────────────────────────────────────────

export type PatternDetectionExecutorOptions = {
  db?: PrismaClient;
  detect?: PatternDetector;
  llmShadow?: PatternLlmShadowRunner;
};

/**
 * Create a named pattern detection executor.
 * Injectable for testing: pass { db, detect } to override defaults.
 */
export function createPatternDetectionExecutor(
  opts: PatternDetectionExecutorOptions = {}
) {
  const db = opts.db ?? prismadb;
  const detect = opts.detect ?? noopDetector;
  const llmShadow =
    opts.llmShadow ??
    (async ({
      userId,
      messageIds,
      runId,
      db,
    }: {
      userId: string;
      messageIds: string[];
      runId: string;
      db: PrismaClient;
    }) => {
      await runPatternLlmLfShadowPass({ userId, messageIds, runId, db });
    });

  /**
   * Execute one pattern detection pass.
   *
   * Lifecycle:
   *  1. createDerivationRun (scope derived from trigger)
   *  2. startDerivationRun  (created → running)
   *  3. detect(...)         (injectable — runs pattern logic)
   *  4. completeDerivationRun / failDerivationRun
   *
   * Never throws — all errors are caught and returned in the result.
   */
  async function run(
    input: PatternDetectionInput
  ): Promise<PatternDetectionResult> {
    const {
      userId,
      trigger,
      messageIds,
      processorVersion = "pattern-v1",
      batchMeta,
      debugCollector,
    } = input;

    // Map trigger to DerivationRun scope
    const scope = trigger === "import" ? "import" : "native";

    let runId: string;

    try {
      const derivationRun = await createDerivationRun(
        { userId, scope, processorVersion, messageIds, batchMeta },
        db
      );
      runId = derivationRun.id;
    } catch (err) {
      return {
        runId: "",
        status: "failed",
        claimsCreated: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      await startDerivationRun(runId, db);

      try {
        await llmShadow?.({ userId, messageIds, runId, db });
      } catch {
        // Shadow-mode only. Never fail the canonical detection run on LLM LF errors.
      }

      const claimsCreated = await detect({
        userId,
        messageIds,
        runId,
        db,
        debugCollector,
      });

      await completeDerivationRun(runId, db);

      return { runId, status: "completed", claimsCreated };
    } catch (err) {
      await failDerivationRun(runId, db).catch(() => {
        // best-effort — if fail transition itself errors, swallow
      });
      return {
        runId,
        status: "failed",
        claimsCreated: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { run };
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Production singleton — uses real prismadb + no-op scaffold detector (P3 TBD).
export const patternDetectionExecutor = createPatternDetectionExecutor();
