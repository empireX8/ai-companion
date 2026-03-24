/**
 * Pattern Batch Orchestrator tests (P3-01)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createPatternBatchOrchestrator,
} from "../pattern-batch-orchestrator";
import type { NormalizedHistoryEntry } from "../history-synthesis";

// ── Helpers ───────────────────────────────────────────────────────────────────

type RunRow = {
  id: string;
  userId: string;
  scope: string;
  processorVersion: string;
  inputMessageSetHash: string;
  status: string;
  messageCount: number | null;
  sessionCount: number | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  createdAt: Date;
};

let idSeq = 0;
const nextId = () => `run_${++idSeq}`;

function makeMockDb() {
  const runs: RunRow[] = [];

  const db = {
    derivationRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: RunRow = {
          id: nextId(),
          userId: data.userId as string,
          scope: data.scope as string,
          processorVersion: data.processorVersion as string,
          inputMessageSetHash: data.inputMessageSetHash as string,
          status: "created",
          messageCount: (data.messageCount as number | null) ?? null,
          sessionCount: (data.sessionCount as number | null) ?? null,
          windowStart: (data.windowStart as Date | null) ?? null,
          windowEnd: (data.windowEnd as Date | null) ?? null,
          createdAt: new Date(),
        };
        runs.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        runs.find((r) => r.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const idx = runs.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("run not found");
        runs[idx] = { ...runs[idx]!, ...data } as RunRow;
        return runs[idx]!;
      },
    },
    _runs: runs,
  };

  return db as unknown as PrismaClient & { _runs: RunRow[] };
}

const makeEntry = (
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry => ({
  messageId: "msg1",
  sessionId: "sess1",
  sessionOrigin: "APP",
  sessionStartedAt: new Date("2024-01-01"),
  role: "user",
  content: "hello",
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

// ── Skip when no history ──────────────────────────────────────────────────────

describe("createPatternBatchOrchestrator — empty history", () => {
  it("returns status=skipped when synthesize returns no entries", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => [],
    });

    const result = await orchestrator.runForUser({
      userId: "u1",
      trigger: "import",
    });

    expect(result.status).toBe("skipped");
    expect(result.messageCount).toBe(0);
    expect(result.sessionCount).toBe(0);
    expect(result.runId).toBe("");
    // No DerivationRun should be created
    expect(db._runs).toHaveLength(0);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("createPatternBatchOrchestrator — with history", () => {
  it("creates a DerivationRun and returns completed", async () => {
    const db = makeMockDb();
    const entries = [
      makeEntry({ messageId: "m1", sessionId: "s1", createdAt: new Date("2024-01-01") }),
      makeEntry({ messageId: "m2", sessionId: "s1", createdAt: new Date("2024-01-02") }),
      makeEntry({ messageId: "m3", sessionId: "s2", createdAt: new Date("2024-01-03") }),
    ];

    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => entries,
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "import" });

    expect(result.status).toBe("completed");
    expect(result.messageCount).toBe(3);
    expect(result.sessionCount).toBe(2);
    expect(result.runId).toBeTruthy();
  });

  it("writes batch metadata to DerivationRun", async () => {
    const db = makeMockDb();
    const t1 = new Date("2024-01-01T10:00:00Z");
    const t2 = new Date("2024-01-05T10:00:00Z");
    const entries = [
      makeEntry({ messageId: "m1", sessionId: "s1", createdAt: t1 }),
      makeEntry({ messageId: "m2", sessionId: "s2", createdAt: t2 }),
    ];

    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => entries,
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "threshold" });

    expect(result.status).toBe("completed");
    const run = db._runs.find((r) => r.id === result.runId);
    expect(run?.messageCount).toBe(2);
    expect(run?.sessionCount).toBe(2);
    expect(run?.windowStart?.getTime()).toBe(t1.getTime());
    expect(run?.windowEnd?.getTime()).toBe(t2.getTime());
  });

  it("import trigger → scope=import on the DerivationRun", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => [makeEntry({ messageId: "m1" })],
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "import" });

    const run = db._runs.find((r) => r.id === result.runId);
    expect(run?.scope).toBe("import");
  });

  it("manual trigger → scope=native on the DerivationRun", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => [makeEntry({ messageId: "m1" })],
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "manual" });

    const run = db._runs.find((r) => r.id === result.runId);
    expect(run?.scope).toBe("native");
  });
});

// ── Failure handling ──────────────────────────────────────────────────────────

describe("createPatternBatchOrchestrator — failure paths", () => {
  it("synthesize failure → status=failed, does not throw", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => { throw new Error("DB down"); },
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "import" });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("DB down");
    // No run should be created
    expect(db._runs).toHaveLength(0);
  });

  it("detector failure → status=failed on result", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => [makeEntry({ messageId: "m1" })],
      detect: async () => { throw new Error("detector failed"); },
    });

    const result = await orchestrator.runForUser({ userId: "u1", trigger: "manual" });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("detector failed");
  });
});

// ── Singleton smoke ───────────────────────────────────────────────────────────

describe("patternBatchOrchestrator singleton", () => {
  it("exports a singleton with a runForUser method", async () => {
    const { patternBatchOrchestrator } = await import(
      "../pattern-batch-orchestrator"
    );
    expect(typeof patternBatchOrchestrator.runForUser).toBe("function");
  });
});

// ── DerivationRun remains canonical path ──────────────────────────────────────

describe("canonical path assertion", () => {
  it("the orchestrator uses the executor (no parallel path) — only one DerivationRun per runForUser call", async () => {
    const db = makeMockDb();
    const orchestrator = createPatternBatchOrchestrator({
      db,
      synthesize: async () => [
        makeEntry({ messageId: "m1" }),
        makeEntry({ messageId: "m2" }),
      ],
    });

    await orchestrator.runForUser({ userId: "u1", trigger: "manual" });

    // Exactly one DerivationRun should be created per runForUser call
    expect(db._runs).toHaveLength(1);
  });
});
