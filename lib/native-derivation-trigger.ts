/**
 * Native Derivation Trigger
 *
 * Fires native pattern derivation after a user message is saved, reusing the
 * existing batch orchestrator + executor path.
 *
 * Semantics:
 *  - First message triggers an immediate native run.
 *  - Additional user messages during the suppression window do NOT spawn
 *    duplicate immediate runs; they mark one trailing follow-up as pending.
 *  - When the window expires, exactly one trailing rerun executes on the
 *    latest substrate.
 *  - Failed or skipped runs do NOT keep the cooldown active.
 *
 * Design rules:
 *  - Injectable db and orchestrator — no direct prismadb/singleton import here,
 *    so unit tests can run without real DB or network.
 *  - Uses trigger "threshold" (automatic, not user-initiated) which routes to
 *    scope "native" in the executor.
 */

import type { PrismaClient } from "@prisma/client";

import type {
  BatchOrchestrationInput,
  BatchOrchestrationResult,
} from "./pattern-batch-orchestrator";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Suppression window for automatic native derivation.
 *
 * Messages that arrive inside this window do not spawn duplicate immediate
 * runs. Instead they set a single pending follow-up so one trailing rerun can
 * execute on the latest substrate when suppression expires.
 */
export const NATIVE_DERIVATION_COOLDOWN_MS = 30 * 1000; // 30 seconds

// ── Types ─────────────────────────────────────────────────────────────────────

type MinimalOrchestrator = {
  runForUser: (
    input: BatchOrchestrationInput
  ) => Promise<BatchOrchestrationResult>;
};

export type TriggerNativeDerivationResult = {
  triggered: boolean;
  runId?: string;
};

type TriggerState = {
  queue: Promise<void>;
  inFlight: boolean;
  pending: boolean;
  cooldownUntil: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type TriggerDecision =
  | { kind: "suppressed" }
  | { kind: "run" };

const triggerStates = new Map<string, TriggerState>();

function getTriggerState(userId: string): TriggerState {
  let state = triggerStates.get(userId);
  if (!state) {
    state = {
      queue: Promise.resolve(),
      inFlight: false,
      pending: false,
      cooldownUntil: 0,
      timeoutId: null,
    };
    triggerStates.set(userId, state);
  }

  return state;
}

async function withTriggerState<T>(
  userId: string,
  fn: (state: TriggerState) => Promise<T> | T
): Promise<T> {
  const state = getTriggerState(userId);
  const prior = state.queue;
  let release!: () => void;
  state.queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prior;

  try {
    return await fn(state);
  } finally {
    release();
  }
}

function clearTrailingTimeout(state: TriggerState): void {
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
}

function markRunStarted(state: TriggerState, startedAtMs: number): void {
  clearTrailingTimeout(state);
  state.inFlight = true;
  state.pending = false;
  state.cooldownUntil = startedAtMs + NATIVE_DERIVATION_COOLDOWN_MS;
}

function ensureTrailingRunScheduled(
  userId: string,
  state: TriggerState,
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): void {
  if (state.timeoutId || !state.pending) {
    return;
  }

  const delayMs = Math.max(state.cooldownUntil - Date.now(), 0);
  state.timeoutId = setTimeout(() => {
    void runTrailingNativeDerivation(userId, db, orchestrator);
  }, delayMs);
}

async function runOrScheduleFollowUp(
  userId: string,
  state: TriggerState,
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): Promise<TriggerDecision> {
  if (!state.pending) {
    return { kind: "suppressed" };
  }

  const now = new Date();
  if (state.cooldownUntil > now.getTime()) {
    ensureTrailingRunScheduled(userId, state, db, orchestrator);
    return { kind: "suppressed" };
  }

  markRunStarted(state, now.getTime());
  return { kind: "run" };
}

function runDetachedNativeDerivation(
  userId: string,
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): void {
  void executeNativeDerivationRun({ userId }, db, orchestrator).catch((error) => {
    console.error("[NATIVE_DERIVATION_TRIGGER_ERROR]", userId, error);
  });
}

async function finalizeRun(
  userId: string,
  result: BatchOrchestrationResult,
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): Promise<void> {
  const followUp = await withTriggerState(userId, async (state) => {
    state.inFlight = false;

    if (result.status !== "completed") {
      state.cooldownUntil = 0;
      clearTrailingTimeout(state);
    }

    return runOrScheduleFollowUp(userId, state, db, orchestrator);
  });

  if (followUp.kind === "run") {
    runDetachedNativeDerivation(userId, db, orchestrator);
  }
}

async function executeNativeDerivationRun(
  { userId }: { userId: string },
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): Promise<TriggerNativeDerivationResult> {
  try {
    const result = await orchestrator.runForUser({ userId, trigger: "threshold" });
    await finalizeRun(userId, result, db, orchestrator);

    return {
      triggered: true,
      runId: result.runId || undefined,
    };
  } catch (error) {
    await finalizeRun(
      userId,
      {
        runId: "",
        status: "failed",
        messageCount: 0,
        sessionCount: 0,
        claimsCreated: 0,
        error: error instanceof Error ? error.message : String(error),
      },
      db,
      orchestrator
    );
    throw error;
  }
}

async function runTrailingNativeDerivation(
  userId: string,
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): Promise<void> {
  const decision = await withTriggerState(userId, async (state) => {
    state.timeoutId = null;

    if (state.inFlight) {
      return { kind: "suppressed" } as const;
    }

    return runOrScheduleFollowUp(userId, state, db, orchestrator);
  });

  if (decision.kind !== "run") {
    return;
  }

  runDetachedNativeDerivation(userId, db, orchestrator);
}

export function resetNativeDerivationTriggerStateForTests(): void {
  for (const state of triggerStates.values()) {
    clearTrailingTimeout(state);
  }
  triggerStates.clear();
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Trigger an automatic native derivation pass for the user.
 *
 * If a native run is already in flight or still inside the suppression window,
 * the helper records that one trailing follow-up is due instead of starting a
 * duplicate immediate run.
 *
 * Intended for the post-message fire-and-forget path in the chat route.
 */
export async function triggerNativeDerivationIfDue(
  {
    userId,
    now = new Date(),
  }: {
    userId: string;
    now?: Date;
  },
  db: PrismaClient,
  orchestrator: MinimalOrchestrator
): Promise<TriggerNativeDerivationResult> {
  const decision = await withTriggerState(userId, async (state) => {
    const nowMs = now.getTime();

    if (!state.inFlight && state.pending && state.cooldownUntil <= nowMs) {
      markRunStarted(state, nowMs);
      return { kind: "run" } as const;
    }

    if (state.inFlight || state.cooldownUntil > nowMs) {
      state.pending = true;
      ensureTrailingRunScheduled(userId, state, db, orchestrator);
      return { kind: "suppressed" } as const;
    }

    const cutoff = new Date(nowMs - NATIVE_DERIVATION_COOLDOWN_MS);
    const recentRun = await db.derivationRun.findFirst({
      where: {
        userId,
        scope: "native",
        status: { not: "failed" },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (recentRun) {
      state.cooldownUntil =
        recentRun.createdAt.getTime() + NATIVE_DERIVATION_COOLDOWN_MS;
      state.pending = true;
      ensureTrailingRunScheduled(userId, state, db, orchestrator);
      return { kind: "suppressed" } as const;
    }

    markRunStarted(state, nowMs);
    return { kind: "run" } as const;
  });

  if (decision.kind !== "run") {
    return { triggered: false };
  }

  return executeNativeDerivationRun(
    { userId },
    db,
    orchestrator
  );
}
