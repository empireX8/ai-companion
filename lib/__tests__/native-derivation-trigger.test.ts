/**
 * Native Derivation Trigger tests
 *
 * Covers:
 *  1. Immediate-or-scheduled native trigger semantics
 *  2. Trailing rerun behavior for same-session accumulation
 *  3. Integration: automatic native path → orchestrator → executor → PatternClaim
 *  4. Regression: manual rerun path stays unchanged
 */

import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  triggerNativeDerivationIfDue,
  NATIVE_DERIVATION_COOLDOWN_MS,
  resetNativeDerivationTriggerStateForTests,
} from "../native-derivation-trigger";
import { createPatternBatchOrchestrator } from "../pattern-batch-orchestrator";
import { createPatternDetectionExecutor } from "../pattern-detection-executor";
import { upsertPatternClaimFromClue } from "../pattern-claim-lifecycle";
import type { NormalizedHistoryEntry } from "../history-synthesis";

type RunRow = {
  id: string;
  userId: string;
  scope: string;
  processorVersion: string;
  inputMessageSetHash: string;
  status: string;
  createdAt: Date;
  messageCount: number | null;
  sessionCount: number | null;
  windowStart: Date | null;
  windowEnd: Date | null;
};

type ClaimRow = {
  id: string;
  userId: string;
  patternType: string;
  summaryNorm: string;
  summary: string;
  status: string;
  strengthLevel: string;
  sourceRunId: string | null;
};

let idSeq = 0;
const nextId = () => `id_${++idSeq}`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function projectSelectedFields<T extends Record<string, unknown>>(
  row: T | null,
  select?: Record<string, boolean>
) {
  if (!row || !select) {
    return row;
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, row[key]])
  );
}

function makeMockDb(opts: {
  existingRunCreatedAt?: Date;
  existingRunStatus?: string;
} = {}) {
  const runs: RunRow[] = [];
  const claims: ClaimRow[] = [];
  const evidence: Array<{
    id: string;
    claimId: string;
    sessionId: string | null;
    messageId: string | null;
  }> = [];

  if (opts.existingRunCreatedAt) {
    runs.push({
      id: "seed_run",
      userId: "u1",
      scope: "native",
      processorVersion: "pattern-v1",
      inputMessageSetHash: "seed_hash",
      status: opts.existingRunStatus ?? "completed",
      createdAt: opts.existingRunCreatedAt,
      messageCount: null,
      sessionCount: null,
      windowStart: null,
      windowEnd: null,
    });
  }

  const db = {
    derivationRun: {
      findFirst: async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        if (typeof where.id === "string") {
          return (
            projectSelectedFields(
              runs.find((run) => run.id === where.id) ?? null,
              select
            ) ?? null
          );
        }

        const matchingRuns = runs
          .filter((run) => {
            if (where.userId && run.userId !== where.userId) return false;
            if (where.scope && run.scope !== where.scope) return false;

            const notStatus = (where.status as Record<string, string> | undefined)?.not;
            if (notStatus && run.status === notStatus) return false;

            const gte = (where.createdAt as Record<string, Date> | undefined)?.gte;
            if (gte && run.createdAt < gte) return false;

            return true;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return projectSelectedFields(matchingRuns[0] ?? null, select) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: RunRow = {
          id: nextId(),
          userId: data.userId as string,
          scope: data.scope as string,
          processorVersion: data.processorVersion as string,
          inputMessageSetHash: data.inputMessageSetHash as string,
          status: (data.status as string) ?? "created",
          createdAt: new Date(),
          messageCount: (data.messageCount as number | null) ?? null,
          sessionCount: (data.sessionCount as number | null) ?? null,
          windowStart: (data.windowStart as Date | null) ?? null,
          windowEnd: (data.windowEnd as Date | null) ?? null,
        };
        runs.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const index = runs.findIndex((run) => run.id === where.id);
        if (index === -1) {
          throw new Error(`run not found: ${where.id}`);
        }
        runs[index] = { ...runs[index]!, ...data } as RunRow;
        return runs[index]!;
      },
    },
    patternClaim: {
      findUnique: async ({
        where,
      }: {
        where: Record<string, unknown>;
      }) => {
        const key = where.userId_patternType_summaryNorm as Record<string, string>;
        return (
          claims.find(
            (claim) =>
              claim.userId === key.userId &&
              claim.patternType === key.patternType &&
              claim.summaryNorm === key.summaryNorm
          ) ?? null
        );
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        claims.find((claim) => claim.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: ClaimRow = {
          id: nextId(),
          userId: data.userId as string,
          patternType: data.patternType as string,
          summaryNorm: data.summaryNorm as string,
          summary: data.summary as string,
          status: (data.status as string) ?? "candidate",
          strengthLevel: (data.strengthLevel as string) ?? "tentative",
          sourceRunId: (data.sourceRunId as string | null) ?? null,
        };
        claims.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const index = claims.findIndex((claim) => claim.id === where.id);
        if (index === -1) {
          throw new Error(`claim not found: ${where.id}`);
        }
        claims[index] = { ...claims[index]!, ...data } as ClaimRow;
        return claims[index]!;
      },
    },
    patternClaimEvidence: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextId(),
          claimId: data.claimId as string,
          sessionId: (data.sessionId as string | null) ?? null,
          messageId: (data.messageId as string | null) ?? null,
        };
        evidence.push(row);
        return row;
      },
      count: async ({ where }: { where: { claimId?: string } }) =>
        evidence.filter((row) => !where.claimId || row.claimId === where.claimId).length,
      groupBy: async ({ where }: { where: { claimId?: string } }) => {
        const filtered = evidence.filter(
          (row) => !where.claimId || row.claimId === where.claimId
        );
        const sessionIds = new Set(
          filtered.map((row) => row.sessionId).filter((row): row is string => row !== null)
        );

        return Array.from(sessionIds).map((sessionId) => ({
          sessionId,
          _count: 1,
        }));
      },
    },
    _runs: runs,
    _claims: claims,
    _evidence: evidence,
  };

  return db as unknown as PrismaClient & {
    _runs: RunRow[];
    _claims: ClaimRow[];
    _evidence: Array<{
      id: string;
      claimId: string;
      sessionId: string | null;
      messageId: string | null;
    }>;
  };
}

function makeTriggerEntry(
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  return {
    messageId: nextId(),
    sessionId: "sess1",
    sessionOrigin: "APP",
    sessionStartedAt: new Date("2024-01-01"),
    role: "user",
    content: "whenever I get feedback, I tend to shut down and stop engaging",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

async function advanceAndFlush(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

beforeEach(() => {
  idSeq = 0;
  resetNativeDerivationTriggerStateForTests();
});

afterEach(() => {
  resetNativeDerivationTriggerStateForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("triggerNativeDerivationIfDue — suppression semantics", () => {
  it("triggers immediately when no recent native run exists", async () => {
    const db = makeMockDb();
    const runForUser = vi.fn(async () => ({
      runId: "r1",
      status: "completed" as const,
      messageCount: 1,
      sessionCount: 1,
      claimsCreated: 0,
    }));

    const result = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date("2026-04-10T10:00:00.000Z") },
      db,
      { runForUser }
    );

    expect(result).toEqual({ triggered: true, runId: "r1" });
    expect(runForUser).toHaveBeenCalledTimes(1);
    expect(runForUser).toHaveBeenNthCalledWith(1, {
      userId: "u1",
      trigger: "threshold",
    });
  });

  it("suppresses against a recent completed native run and fires one trailing rerun at expiry", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb({
      existingRunCreatedAt: new Date(
        now.getTime() - (NATIVE_DERIVATION_COOLDOWN_MS - 5_000)
      ),
      existingRunStatus: "completed",
    });
    const runForUser = vi.fn(async () => ({
      runId: "trailing_run",
      status: "completed" as const,
      messageCount: 3,
      sessionCount: 1,
      claimsCreated: 1,
    }));

    const result = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });

    expect(result).toEqual({ triggered: false });
    expect(runForUser).not.toHaveBeenCalled();

    await advanceAndFlush(4_999);
    expect(runForUser).not.toHaveBeenCalled();

    await advanceAndFlush(1);
    expect(runForUser).toHaveBeenCalledTimes(1);
    expect(runForUser).toHaveBeenNthCalledWith(1, {
      userId: "u1",
      trigger: "threshold",
    });
  });

  it("suppresses against a recent running native run and fires one trailing rerun at expiry", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb({
      existingRunCreatedAt: new Date(
        now.getTime() - (NATIVE_DERIVATION_COOLDOWN_MS - 2_000)
      ),
      existingRunStatus: "running",
    });
    const runForUser = vi.fn(async () => ({
      runId: "r_after_running",
      status: "completed" as const,
      messageCount: 2,
      sessionCount: 1,
      claimsCreated: 0,
    }));

    const result = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });

    expect(result).toEqual({ triggered: false });
    expect(runForUser).not.toHaveBeenCalled();

    await advanceAndFlush(2_000);
    expect(runForUser).toHaveBeenCalledTimes(1);
  });

  it("does not suppress when the only recent run has status=failed", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb({
      existingRunCreatedAt: new Date(now.getTime() - 5_000),
      existingRunStatus: "failed",
    });
    const runForUser = vi.fn(async () => ({
      runId: "r1",
      status: "completed" as const,
      messageCount: 1,
      sessionCount: 1,
      claimsCreated: 0,
    }));

    const result = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });

    expect(result).toEqual({ triggered: true, runId: "r1" });
    expect(runForUser).toHaveBeenCalledTimes(1);
  });

  it("does not suppress when the only native run is outside the cooldown window", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb({
      existingRunCreatedAt: new Date(
        now.getTime() - NATIVE_DERIVATION_COOLDOWN_MS - 1_000
      ),
      existingRunStatus: "completed",
    });
    const runForUser = vi.fn(async () => ({
      runId: "r_outside_window",
      status: "completed" as const,
      messageCount: 1,
      sessionCount: 1,
      claimsCreated: 0,
    }));

    const result = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });

    expect(result).toEqual({ triggered: true, runId: "r_outside_window" });
    expect(runForUser).toHaveBeenCalledTimes(1);
  });

  it("does not spawn duplicate immediate runs when more messages arrive during suppression and collapses them into one trailing rerun", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb();
    const firstRun = deferred<{
      runId: string;
      status: "completed";
      messageCount: number;
      sessionCount: number;
      claimsCreated: number;
    }>();
    const runForUser = vi
      .fn()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementation(async () => ({
        runId: "trailing_run",
        status: "completed" as const,
        messageCount: 3,
        sessionCount: 1,
        claimsCreated: 1,
      }));

    const firstTrigger = triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });

    const secondResult = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date(now.getTime() + 5_000) },
      db,
      { runForUser }
    );
    const thirdResult = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date(now.getTime() + 10_000) },
      db,
      { runForUser }
    );

    expect(secondResult).toEqual({ triggered: false });
    expect(thirdResult).toEqual({ triggered: false });
    expect(runForUser).toHaveBeenCalledTimes(1);

    firstRun.resolve({
      runId: "immediate_run",
      status: "completed",
      messageCount: 1,
      sessionCount: 1,
      claimsCreated: 0,
    });

    await firstTrigger;
    expect(runForUser).toHaveBeenCalledTimes(1);

    await advanceAndFlush(NATIVE_DERIVATION_COOLDOWN_MS - 1);
    expect(runForUser).toHaveBeenCalledTimes(1);

    await advanceAndFlush(1);
    expect(runForUser).toHaveBeenCalledTimes(2);
    expect(runForUser).toHaveBeenNthCalledWith(1, {
      userId: "u1",
      trigger: "threshold",
    });
    expect(runForUser).toHaveBeenNthCalledWith(2, {
      userId: "u1",
      trigger: "threshold",
    });
  });

  it("does not keep suppression active after a failed automatic run", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb();
    const runForUser = vi
      .fn()
      .mockResolvedValueOnce({
        runId: "failed_run",
        status: "failed" as const,
        messageCount: 1,
        sessionCount: 1,
        claimsCreated: 0,
        error: "boom",
      })
      .mockResolvedValueOnce({
        runId: "retry_run",
        status: "completed" as const,
        messageCount: 2,
        sessionCount: 1,
        claimsCreated: 0,
      });

    const firstResult = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, {
      runForUser,
    });
    const secondResult = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date(now.getTime() + 5_000) },
      db,
      { runForUser }
    );

    expect(firstResult).toEqual({ triggered: true, runId: "failed_run" });
    expect(secondResult).toEqual({ triggered: true, runId: "retry_run" });
    expect(runForUser).toHaveBeenCalledTimes(2);
  });
});

describe("native derivation integration — automatic PatternClaim creation", () => {
  it("triggerNativeDerivationIfDue reuses the canonical orchestrator/executor path", async () => {
    const db = makeMockDb();
    const triggerEntries = [
      makeTriggerEntry({ messageId: "m1" }),
      makeTriggerEntry({ messageId: "m2" }),
      makeTriggerEntry({ messageId: "m3" }),
    ];

    const orchestrator = createPatternBatchOrchestrator({
      db,
      detect: async ({ userId, runId, db }) => {
        await upsertPatternClaimFromClue({
          clue: {
            userId,
            patternType: "trigger_condition",
            summary: "User defaults to shutting down when receiving feedback",
            sourceRunId: runId,
          },
          db,
        });
        return 1;
      },
      synthesize: async () => triggerEntries,
    });

    const result = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date("2026-04-10T10:00:00.000Z") },
      db,
      orchestrator
    );

    expect(result.triggered).toBe(true);
    expect(result.runId).toBeTruthy();

    const run = db._runs.find((row) => row.id === result.runId);
    expect(run?.scope).toBe("native");
    expect(run?.status).toBe("completed");

    expect(db._claims).toHaveLength(1);
    expect(db._claims[0]?.patternType).toBe("trigger_condition");
    expect(db._claims[0]?.sourceRunId).toBe(result.runId);
  });

  it("same-session buildup inside the suppression window reaches persisted claim output without a manual rerun", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-10T10:00:00.000Z");
    vi.setSystemTime(now);

    const db = makeMockDb();
    const entries: NormalizedHistoryEntry[] = [];

    const orchestrator = createPatternBatchOrchestrator({
      db,
      detect: async ({ userId, messageIds, runId, db }) => {
        if (messageIds.length < 3) {
          return 0;
        }

        await upsertPatternClaimFromClue({
          clue: {
            userId,
            patternType: "trigger_condition",
            summary: "User defaults to shutting down when receiving feedback",
            sourceRunId: runId,
          },
          db,
        });
        return 1;
      },
      synthesize: async () => entries.slice(),
    });

    entries.push(makeTriggerEntry({ messageId: "m1", createdAt: now }));
    const firstResult = await triggerNativeDerivationIfDue({ userId: "u1", now }, db, orchestrator);

    entries.push(
      makeTriggerEntry({
        messageId: "m2",
        createdAt: new Date(now.getTime() + 5_000),
      })
    );
    const secondResult = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date(now.getTime() + 5_000) },
      db,
      orchestrator
    );

    entries.push(
      makeTriggerEntry({
        messageId: "m3",
        createdAt: new Date(now.getTime() + 10_000),
      })
    );
    const thirdResult = await triggerNativeDerivationIfDue(
      { userId: "u1", now: new Date(now.getTime() + 10_000) },
      db,
      orchestrator
    );

    expect(firstResult.triggered).toBe(true);
    expect(secondResult).toEqual({ triggered: false });
    expect(thirdResult).toEqual({ triggered: false });

    expect(db._claims).toHaveLength(0);
    expect(db._runs.filter((row) => row.scope === "native")).toHaveLength(1);

    await advanceAndFlush(NATIVE_DERIVATION_COOLDOWN_MS);

    expect(db._runs.filter((row) => row.scope === "native")).toHaveLength(2);
    expect(db._claims).toHaveLength(1);
    expect(db._claims[0]?.patternType).toBe("trigger_condition");
    expect(db._claims[0]?.sourceRunId).toBe(db._runs[1]?.id ?? null);
  });
});

describe("manual rerun path regression", () => {
  it("patternBatchOrchestrator.runForUser with trigger=manual still creates scope=native run", async () => {
    const db = makeMockDb();
    let capturedRunId = "";

    const orchestrator = createPatternBatchOrchestrator({
      db,
      detect: async ({ userId, runId, db }) => {
        capturedRunId = runId;
        await upsertPatternClaimFromClue({
          clue: {
            userId,
            patternType: "trigger_condition",
            summary: "Manual rerun: user defaults to avoidance",
            sourceRunId: runId,
          },
          db,
        });
        return 1;
      },
      synthesize: async () => [makeTriggerEntry({ messageId: "m1" })],
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "manual" });

    expect(result.status).toBe("completed");
    expect(result.claimsCreated).toBe(1);

    const run = db._runs.find((row) => row.id === result.runId);
    expect(run?.scope).toBe("native");

    expect(capturedRunId).toBe(result.runId);
    expect(db._claims).toHaveLength(1);
  });

  it("executor.run with trigger=threshold still produces scope=native", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({
      db,
      detect: async () => 0,
      llmShadow: async () => {},
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "threshold",
      messageIds: ["m1", "m2"],
    });

    expect(result.status).toBe("completed");
    const run = db._runs.find((row) => row.id === result.runId);
    expect(run?.scope).toBe("native");
  });
});
