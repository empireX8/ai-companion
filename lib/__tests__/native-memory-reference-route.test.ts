import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const streamTextMock = vi.fn();
const openaiMock = vi.fn();
const detectContradictionsMock = vi.fn();
const materializeContradictionsMock = vi.fn();
const getTop3WithOptionalSurfacingMock = vi.fn();
const getRelevantReferenceMemoryMock = vi.fn();
const ensureWeeklyAuditForCurrentWeekMock = vi.fn();
const triggerNativeDerivationIfDueMock = vi.fn();
const appendToTranscriptMock = vi.fn();
const upsertVectorMock = vi.fn();
const readTranscriptMock = vi.fn();
const queryRelevantMock = vi.fn();

type SessionRow = {
  id: string;
  userId: string;
  origin: string;
};

type MessageRow = {
  id: string;
  userId: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
};

type ReferenceRow = {
  id: string;
  userId: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  supersedesId: string | null;
};

let idSeq = 0;
let sessions: SessionRow[] = [];
let messages: MessageRow[] = [];
let references: ReferenceRow[] = [];

const nextId = (prefix: string) => `${prefix}_${++idSeq}`;

const selectFields = (
  row: Record<string, unknown> | null,
  select?: Record<string, unknown>
) => {
  if (!row || !select) {
    return row;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) {
      continue;
    }

    if (key === "supersedes" && typeof value === "object") {
      const superseded = references.find((item) => item.id === row.supersedesId) ?? null;
      result.supersedes = selectFields(superseded as unknown as Record<string, unknown> | null, (value as { select?: Record<string, unknown> }).select);
      continue;
    }

    result[key] = row[key];
  }

  return result;
};

const prismaMock = {
  session: {
    findFirst: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const row =
        sessions.find(
          (session) =>
            (!where.id || session.id === where.id) &&
            (!where.userId || session.userId === where.userId)
        ) ?? null;
      return selectFields(row as unknown as Record<string, unknown> | null, select);
    }),
    findMany: vi.fn(async ({ where, select }: { where: { id?: { in?: string[] } }; select?: Record<string, unknown> }) => {
      const sessionIds = where.id?.in ?? [];
      return sessions
        .filter((session) => sessionIds.includes(session.id))
        .map((session) =>
          selectFields(session as unknown as Record<string, unknown>, select)
        );
    }),
  },
  message: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: MessageRow = {
        id: nextId("msg"),
        userId: data.userId as string,
        sessionId: data.sessionId as string,
        role: data.role as string,
        content: data.content as string,
        createdAt: new Date(),
      };
      messages.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return messages
        .filter(
          (message) =>
            (!where.userId || message.userId === where.userId) &&
            (!where.sessionId || message.sessionId === where.sessionId)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
    }),
  },
  referenceItem: {
    findMany: vi.fn(
      async ({
        where,
        take,
        select,
      }: {
        where: Record<string, unknown>;
        take?: number;
        select?: Record<string, unknown>;
      }) => {
        const rawStatus = where.status;
        const statuses: string[] | null =
          rawStatus !== null &&
          typeof rawStatus === "object" &&
          "in" in rawStatus &&
          Array.isArray(rawStatus.in)
            ? rawStatus.in
            : typeof rawStatus === "string"
              ? [rawStatus]
              : null;

        const filtered = references.filter((reference) => {
          if (where.userId && reference.userId !== where.userId) return false;
          if (where.type && reference.type !== where.type) return false;
          if (statuses && !statuses.includes(reference.status)) return false;
          return true;
        });

        const sorted = filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const limited = typeof take === "number" ? sorted.slice(0, take) : sorted;
        return limited.map((reference) =>
          selectFields(reference as unknown as Record<string, unknown>, select)
        );
      }
    ),
    findFirst: vi.fn(
      async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const row =
          references.find((reference) => {
            if (where.id && reference.id !== where.id) return false;
            if (where.userId && reference.userId !== where.userId) return false;
            if (where.type && reference.type !== where.type) return false;
            if (where.statement && reference.statement !== where.statement) return false;
            if (where.status && reference.status !== where.status) return false;
            if (
              Object.prototype.hasOwnProperty.call(where, "sourceSessionId") &&
              reference.sourceSessionId !== where.sourceSessionId
            ) {
              return false;
            }
            if (
              Object.prototype.hasOwnProperty.call(where, "supersedesId") &&
              reference.supersedesId !== where.supersedesId
            ) {
              return false;
            }
            return true;
          }) ?? null;

        return selectFields(row as unknown as Record<string, unknown> | null, select);
      }
    ),
    create: vi.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const now = new Date();
      const row: ReferenceRow = {
        id: nextId("ref"),
        userId: data.userId as string,
        type: data.type as string,
        confidence: data.confidence as string,
        statement: data.statement as string,
        status: data.status as string,
        createdAt: now,
        updatedAt: now,
        sourceSessionId: (data.sourceSessionId as string | null) ?? null,
        sourceMessageId: (data.sourceMessageId as string | null) ?? null,
        supersedesId: (data.supersedesId as string | null) ?? null,
      };
      references.push(row);
      return selectFields(row as unknown as Record<string, unknown>, select) ?? row;
    }),
    update: vi.fn(async ({ where, data, select }: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const index = references.findIndex((reference) => reference.id === where.id);
      if (index === -1) {
        throw new Error(`reference not found: ${where.id}`);
      }

      references[index] = {
        ...references[index]!,
        ...data,
        updatedAt: new Date(),
      } as ReferenceRow;

      return selectFields(references[index]! as unknown as Record<string, unknown>, select) ?? references[index]!;
    }),
  },
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
    return callback(prismaMock);
  }),
};

const sessionMemoryInstance = {
  appendToTranscript: appendToTranscriptMock,
  upsertVector: upsertVectorMock,
  readTranscript: readTranscriptMock,
  queryRelevant: queryRelevantMock,
};

const patternBatchOrchestratorMock = {
  runForUser: vi.fn(),
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("ai", () => ({
  streamText: streamTextMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: openaiMock,
}));

vi.mock("@/lib/contradiction-detection", () => ({
  detectContradictions: detectContradictionsMock,
}));

vi.mock("@/lib/contradiction-materialization", () => ({
  materializeContradictions: materializeContradictionsMock,
}));

vi.mock("@/lib/memory-governance", async () => {
  const actual = await import("../memory-governance");
  return actual;
});

vi.mock("@/lib/contradiction-surface", () => ({
  getTop3WithOptionalSurfacing: getTop3WithOptionalSurfacingMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/reference-memory", () => ({
  getRelevantReferenceMemory: getRelevantReferenceMemoryMock,
}));

vi.mock("@/lib/session-memory", () => ({
  SessionMemoryManager: {
    getInstance: vi.fn(async () => sessionMemoryInstance),
  },
}));

vi.mock("@/lib/assistant/system-prompt", () => ({
  BASE_SYSTEM_PROMPT: "BASE",
  FAST_PATH_SYSTEM_PROMPT: "FAST",
}));

vi.mock("@/lib/reference-enums", async () => {
  const actual = await import("../reference-enums");
  return actual;
});

vi.mock("@/lib/reference-source", async () => {
  const actual = await import("../reference-source");
  return actual;
});

vi.mock("@/lib/weekly-audit", () => ({
  ensureWeeklyAuditForCurrentWeek: ensureWeeklyAuditForCurrentWeekMock,
}));

vi.mock("@/lib/pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: patternBatchOrchestratorMock,
}));

vi.mock("@/lib/native-derivation-trigger", () => ({
  triggerNativeDerivationIfDue: triggerNativeDerivationIfDueMock,
}));

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("native chat memory/reference capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idSeq = 0;
    sessions = [{ id: "sess1", userId: "u1", origin: "APP" }];
    messages = [];
    references = [];

    authMock.mockResolvedValue({ userId: "u1" });
    streamTextMock.mockReturnValue({
      toTextStreamResponse: () => new Response("ok"),
    });
    openaiMock.mockReturnValue({ provider: "openai" });
    detectContradictionsMock.mockResolvedValue([]);
    materializeContradictionsMock.mockResolvedValue({
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 0,
    });
    getTop3WithOptionalSurfacingMock.mockResolvedValue({ items: [] });
    getRelevantReferenceMemoryMock.mockResolvedValue({
      text: "",
      retrieved: 0,
      relevant: 0,
      injected: 0,
      usedFallback: false,
    });
    ensureWeeklyAuditForCurrentWeekMock.mockResolvedValue(undefined);
    triggerNativeDerivationIfDueMock.mockResolvedValue({
      triggered: true,
      runId: "run_native_1",
    });
    appendToTranscriptMock.mockResolvedValue(undefined);
    upsertVectorMock.mockResolvedValue(undefined);
    readTranscriptMock.mockResolvedValue("");
    queryRelevantMock.mockResolvedValue("");
  });

  it("creates a pending preference candidate from an explicit native remember-this message and keeps the pattern trigger path active", async () => {
    const route = await import("../../app/api/message/route");
    const pendingRoute = await import("../../app/api/reference/pending/route");
    const listRoute = await import("../../app/api/reference/list/route");

    const request = new Request("http://localhost/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "native-memory-1",
      },
      body: JSON.stringify({
        sessionId: "sess1",
        content: "Remember this for future chats: I prefer concrete, step-by-step advice.",
      }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    await flushAsyncWork();

    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      userId: "u1",
      type: "preference",
      status: "candidate",
      statement: "I prefer concrete, step-by-step advice.",
      sourceSessionId: "sess1",
      sourceMessageId: "msg_1",
    });

    expect(triggerNativeDerivationIfDueMock).toHaveBeenCalledTimes(1);
    expect(triggerNativeDerivationIfDueMock).toHaveBeenCalledWith(
      { userId: "u1" },
      prismaMock,
      patternBatchOrchestratorMock
    );

    const pendingResponse = await pendingRoute.GET(
      new Request("http://localhost/api/reference/pending?sessionId=sess1")
    );
    const pendingPayload = await pendingResponse.json();

    expect(pendingPayload).toMatchObject({
      type: "preference",
      statement: "I prefer concrete, step-by-step advice.",
      sourceSessionId: "sess1",
      sourceMessageId: "msg_1",
    });

    const listResponse = await listRoute.GET(
      new Request("http://localhost/api/reference/list")
    );
    const listPayload = await listResponse.json();

    expect(listPayload).toHaveLength(1);
    expect(listPayload[0]).toMatchObject({
      type: "preference",
      status: "candidate",
      statement: "I prefer concrete, step-by-step advice.",
    });
  });

  it("captures support-style native remember prompts as pending preferences", async () => {
    const route = await import("../../app/api/message/route");

    const request = new Request("http://localhost/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "native-memory-2",
      },
      body: JSON.stringify({
        sessionId: "sess1",
        content:
          "Please remember that when I\u2019m overwhelmed I do better with calm, direct language.",
      }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    await flushAsyncWork();

    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      type: "preference",
      status: "candidate",
      statement: "when I'm overwhelmed I do better with calm, direct language.",
    });
  });

  it("does not create a memory candidate for plain support-style phrasing without explicit remember intent", async () => {
    const route = await import("../../app/api/message/route");

    const request = new Request("http://localhost/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "native-memory-plain-support-1",
      },
      body: JSON.stringify({
        sessionId: "sess1",
        content: "When I'm overwhelmed I do better with calm, direct language.",
      }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    await flushAsyncWork();

    expect(references).toHaveLength(0);
    expect(triggerNativeDerivationIfDueMock).toHaveBeenCalledTimes(1);
  });

  it("keeps manual memory saving behavior unchanged", async () => {
    const route = await import("../../app/api/reference/route");

    const request = new Request("http://localhost/api/reference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statement: "I prefer quiet mornings.",
        type: "preference",
        confidence: "medium",
      }),
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      type: "preference",
      status: "active",
      statement: "I prefer quiet mornings.",
      confidence: "medium",
    });
    expect(references).toHaveLength(1);
    expect(references[0]?.status).toBe("active");
  });

  // ── Imported-candidate lifecycle regression ───────────────────────────────
  //
  // Imported memories are created with status="candidate" and a sourceSessionId
  // pointing to the imported session. The memory drawer's list route must surface
  // them as candidates, not as "inactive" or "superseded".
  //
  // This test seeds an import-style candidate directly into the mock DB and verifies:
  //  1. The list route returns it with status="candidate".
  //  2. The pending route does NOT surface it for a different (current) session.
  //  3. Status is never "inactive" / "superseded" at creation time.

  it("imported-session candidate surfaces in list with status=candidate and is not silently inactive", async () => {
    const listRoute = await import("../../app/api/reference/list/route");
    const pendingRoute = await import("../../app/api/reference/pending/route");

    // Seed a reference that looks exactly like what extractReferenceFromImportedMessage creates:
    // status=candidate, sourceSessionId pointing to a non-current session.
    const importedSessionId = "sess_import_99";
    sessions.push({ id: importedSessionId, userId: "u1", origin: "IMPORTED_ARCHIVE" });

    references.push({
      id: "ref_imported_1",
      userId: "u1",
      type: "preference",
      confidence: "low",
      statement: "I prefer async communication over meetings.",
      status: "candidate",
      createdAt: new Date("2024-06-01"),
      updatedAt: new Date("2024-06-01"),
      sourceSessionId: importedSessionId,
      sourceMessageId: "msg_imported_99",
      supersedesId: null,
    });

    // The list route must include the candidate (default filter covers active|candidate|inactive).
    const listResponse = await listRoute.GET(
      new Request("http://localhost/api/reference/list")
    );
    const listPayload = (await listResponse.json()) as Array<{
      id: string;
      status: string;
      statement: string;
    }>;

    const importedItem = listPayload.find((item) => item.id === "ref_imported_1");
    expect(importedItem).toBeDefined();
    expect(importedItem!.status).toBe("candidate");
    expect(importedItem!.status).not.toBe("inactive");
    expect(importedItem!.status).not.toBe("superseded");

    // The pending route scoped to the CURRENT session (sess1) must NOT return
    // the import-session candidate — it belongs to a different session.
    const pendingResponse = await pendingRoute.GET(
      new Request("http://localhost/api/reference/pending?sessionId=sess1")
    );
    const pendingPayload = await pendingResponse.json();
    // pendingPayload is either null (no candidate for sess1) or a candidate for sess1,
    // but must never be the imported session's candidate.
    if (pendingPayload !== null) {
      expect((pendingPayload as { id: string }).id).not.toBe("ref_imported_1");
    }
  });

  it("manual save always creates active (not candidate), preserving native memory semantics", async () => {
    const listRoute = await import("../../app/api/reference/list/route");

    const route = await import("../../app/api/reference/route");
    await route.POST(
      new Request("http://localhost/api/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: "I need at least 8 hours of sleep.",
          type: "constraint",
          confidence: "high",
        }),
      })
    );

    const listResponse = await listRoute.GET(
      new Request("http://localhost/api/reference/list")
    );
    const listPayload = (await listResponse.json()) as Array<{
      status: string;
      statement: string;
    }>;
    const saved = listPayload.find(
      (item) => item.statement === "I need at least 8 hours of sleep."
    );
    expect(saved).toBeDefined();
    // Manual saves must always be active — they are NOT candidates.
    expect(saved!.status).toBe("active");
  });
});
