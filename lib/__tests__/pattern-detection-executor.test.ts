/**
 * Pattern Detection Executor tests (P5-09)
 *
 * Verifies:
 *  - DerivationRun lifecycle: created → running → completed | failed
 *  - All three trigger modes route to correct DerivationRun scope
 *  - Injected detector errors produce "failed" result without throwing
 *  - Factory is fully injectable (no real DB or network)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createPatternDetectionExecutor,
  type PatternDetector,
} from "../pattern-detection-executor";
import {
  normalizePatternLlmLfArtifactPayload,
  runPatternLlmLfShadowPass,
} from "../pattern-llm-labeling-function";

// ── Mock DB factory ───────────────────────────────────────────────────────────

type RunRow = {
  id: string;
  userId: string;
  scope: string;
  processorVersion: string;
  inputMessageSetHash: string;
  status: string;
  createdAt: Date;
};

type ArtifactRow = {
  id: string;
  userId: string;
  runId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  confidenceScore: number | null;
};

type MessageRow = {
  id: string;
  userId: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
};

let idSeq = 0;
const nextId = () => `run_${++idSeq}`;

function makeMockDb(opts: { createFails?: boolean; messages?: MessageRow[] } = {}) {
  const runs: RunRow[] = [];
  const artifacts: ArtifactRow[] = [];
  const messages = opts.messages ?? [];

  const db = {
    derivationRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.createFails) throw new Error("DB create failed");
        const row: RunRow = {
          id: nextId(),
          userId: data.userId as string,
          scope: data.scope as string,
          processorVersion: data.processorVersion as string,
          inputMessageSetHash: data.inputMessageSetHash as string,
          status: (data.status as string) ?? "created",
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
    derivationArtifact: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: ArtifactRow = {
          id: `artifact_${artifacts.length + 1}`,
          userId: data.userId as string,
          runId: data.runId as string,
          type: data.type as string,
          status: (data.status as string) ?? "candidate",
          payload: (data.payload as Record<string, unknown>) ?? {},
          confidenceScore: (data.confidenceScore as number | null) ?? null,
        };
        artifacts.push(row);
        return row;
      },
      findFirst: async () => null,
      update: async () => {
        throw new Error("not implemented");
      },
    },
    message: {
      findMany: async () => messages,
    },
    _runs: runs,
    _artifacts: artifacts,
  };

  return db as unknown as PrismaClient & {
    _runs: RunRow[];
    _artifacts: ArtifactRow[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const throwingDetector: PatternDetector = async () => {
  throw new Error("detector exploded");
};

const successDetector: (n: number) => PatternDetector =
  (n) => async () => n;

// ── Lifecycle tests ───────────────────────────────────────────────────────────

describe("createPatternDetectionExecutor — happy path", () => {
  it("returns completed status and claimsCreated from detector", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({
      db,
      detect: successDetector(3),
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1", "m2"],
    });

    expect(result.status).toBe("completed");
    expect(result.claimsCreated).toBe(3);
    expect(result.runId).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it("can run a shadow LLM LF without changing detector authority", async () => {
    const db = makeMockDb();
    let llmShadowCalls = 0;
    const executor = createPatternDetectionExecutor({
      db,
      detect: successDetector(2),
      llmShadow: async () => {
        llmShadowCalls++;
      },
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1", "m2"],
    });

    expect(llmShadowCalls).toBe(1);
    expect(result.status).toBe("completed");
    expect(result.claimsCreated).toBe(2);
  });

  it("canonical executor path can write a shadow artifact without changing canonical result", async () => {
    const db = makeMockDb({
      messages: [
        {
          id: "m1",
          userId: "u1",
          sessionId: "s1",
          role: "user",
          content: "I always start appeasing people when they seem upset with me.",
          createdAt: new Date("2026-03-16T10:00:00.000Z"),
        },
      ],
    });
    const executor = createPatternDetectionExecutor({
      db,
      detect: successDetector(2),
      llmShadow: async ({ userId, messageIds, runId, db }) => {
        await runPatternLlmLfShadowPass({
          userId,
          messageIds,
          runId,
          db,
          invoker: async () => ({
            rawOutput:
              '{"label":"trigger_condition","abstain":false,"confidence":0.82,"rationale":"Repeated trigger-response wording."}',
          }),
        });
      },
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1"],
    });

    expect(result.status).toBe("completed");
    expect(result.claimsCreated).toBe(2);
    const normalized = normalizePatternLlmLfArtifactPayload(
      db._artifacts[0]?.payload
    );
    expect(normalized).toMatchObject({
      entryId: "m1",
      label: "trigger_condition",
      shadowMode: true,
      usedForProductDecision: false,
    });
  });

  it("transitions run through created → running → completed", async () => {
    const db = makeMockDb();
    const statusSnapshots: string[] = [];

    // Wrap detect to capture status at detection time
    const spyDetector: PatternDetector = async ({ runId }) => {
      const run = db._runs.find((r) => r.id === runId);
      if (run) statusSnapshots.push(run.status);
      return 0;
    };

    const executor = createPatternDetectionExecutor({ db, detect: spyDetector });
    const result = await executor.run({
      userId: "u1",
      trigger: "import",
      messageIds: ["m1"],
    });

    expect(result.status).toBe("completed");
    // During detection the run was "running"
    expect(statusSnapshots[0]).toBe("running");
    // After completion the run is "completed"
    const finalRun = db._runs.find((r) => r.id === result.runId);
    expect(finalRun?.status).toBe("completed");
  });
});

// ── Trigger → scope mapping ───────────────────────────────────────────────────

describe("trigger → DerivationRun scope mapping", () => {
  it("import trigger → scope=import", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({ db, detect: successDetector(0) });

    await executor.run({ userId: "u1", trigger: "import", messageIds: [] });

    expect(db._runs[0]?.scope).toBe("import");
  });

  it("threshold trigger → scope=native", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({ db, detect: successDetector(0) });

    await executor.run({ userId: "u1", trigger: "threshold", messageIds: [] });

    expect(db._runs[0]?.scope).toBe("native");
  });

  it("manual trigger → scope=native", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({ db, detect: successDetector(0) });

    await executor.run({ userId: "u1", trigger: "manual", messageIds: [] });

    expect(db._runs[0]?.scope).toBe("native");
  });
});

// ── Failure handling ──────────────────────────────────────────────────────────

describe("createPatternDetectionExecutor — failure paths", () => {
  it("detector error → status=failed, does not throw", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({
      db,
      detect: throwingDetector,
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1"],
    });

    expect(result.status).toBe("failed");
    expect(result.claimsCreated).toBe(0);
    expect(result.error).toContain("detector exploded");
  });

  it("detector error → run transitions to failed in DB", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({
      db,
      detect: throwingDetector,
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1"],
    });

    const finalRun = db._runs.find((r) => r.id === result.runId);
    expect(finalRun?.status).toBe("failed");
  });

  it("shadow LLM LF failure does not fail the canonical run", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({
      db,
      detect: successDetector(1),
      llmShadow: async () => {
        throw new Error("shadow LLM LF failed");
      },
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: ["m1"],
    });

    expect(result.status).toBe("completed");
    expect(result.claimsCreated).toBe(1);
  });

  it("DB create failure → status=failed with empty runId, does not throw", async () => {
    const db = makeMockDb({ createFails: true });
    const executor = createPatternDetectionExecutor({
      db,
      detect: successDetector(0),
    });

    const result = await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: [],
    });

    expect(result.status).toBe("failed");
    expect(result.runId).toBe("");
    expect(result.error).toContain("DB create failed");
  });
});

// ── processorVersion ──────────────────────────────────────────────────────────

describe("processorVersion", () => {
  it("defaults to 'pattern-v1'", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({ db, detect: successDetector(0) });

    await executor.run({ userId: "u1", trigger: "manual", messageIds: [] });

    expect(db._runs[0]?.processorVersion).toBe("pattern-v1");
  });

  it("accepts a custom processorVersion", async () => {
    const db = makeMockDb();
    const executor = createPatternDetectionExecutor({ db, detect: successDetector(0) });

    await executor.run({
      userId: "u1",
      trigger: "manual",
      messageIds: [],
      processorVersion: "pattern-v2-test",
    });

    expect(db._runs[0]?.processorVersion).toBe("pattern-v2-test");
  });
});

// ── Singleton smoke ───────────────────────────────────────────────────────────

describe("patternDetectionExecutor singleton", () => {
  it("exports a singleton with a run method", async () => {
    const { patternDetectionExecutor } = await import(
      "../pattern-detection-executor"
    );
    expect(typeof patternDetectionExecutor.run).toBe("function");
  });
});
