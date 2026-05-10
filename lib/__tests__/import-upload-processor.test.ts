import { Readable } from "node:stream";
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  calculateProcessingProgress,
  processChatImportSession,
  shouldSkipConversationByCheckpoint,
} from "../import-upload-processor";

describe("import upload processor checkpoint behavior", () => {
  it("skips conversations below checkpoint", () => {
    expect(shouldSkipConversationByCheckpoint(0, 2)).toBe(true);
    expect(shouldSkipConversationByCheckpoint(1, 2)).toBe(true);
    expect(shouldSkipConversationByCheckpoint(2, 2)).toBe(false);
  });

  it("progress reaches 100 when work is complete", () => {
    expect(calculateProcessingProgress(20, true)).toBeGreaterThanOrEqual(30);
    expect(calculateProcessingProgress(20, true)).toBeLessThanOrEqual(95);
    expect(calculateProcessingProgress(20, false)).toBe(100);
  });
});

// ── onImportComplete hook behavior ────────────────────────────────────────────

function makeJsonReadable(json: string): Readable {
  return new Readable({
    read() {
      this.push(Buffer.from(json));
      this.push(null);
    },
  });
}

const BASE_SESSION = {
  id: "session-1",
  userId: "user-1",
  filename: "conversations.json",
  contentType: "application/json",
  status: "uploaded",
  totalChunks: 1,
  processedConversations: 0,
  processedMessages: 0,
  sessionsCreated: 0,
  messagesCreated: 0,
  contradictionsCreated: 0,
  processingProgress: 5,
  startedAt: null,
  finishedAt: null,
  error: null,
  resultErrors: [],
  chunks: [{ chunkIndex: 0 }],
};

function buildMinimalDb(sessionOverrides: Partial<typeof BASE_SESSION> = {}) {
  return {
    importUploadSession: {
      findUnique: vi.fn().mockResolvedValue({ ...BASE_SESSION, ...sessionOverrides }),
      update: vi.fn().mockResolvedValue({}),
    },
    contradictionNode: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function buildMinimalStorage() {
  return {
    getChunkStream: vi.fn().mockResolvedValue(makeJsonReadable("[]")),
    deleteChunks: vi.fn().mockResolvedValue(undefined),
  };
}

describe("processChatImportSession — onImportComplete hook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onImportComplete exactly once after successful import", async () => {
    const db = buildMinimalDb();
    const storage = buildMinimalStorage();
    const onImportComplete = vi.fn().mockResolvedValue(undefined);

    await processChatImportSession({
      sessionId: "session-1",
      db: db as never,
      storage: storage as never,
      onImportComplete,
    });

    expect(onImportComplete).toHaveBeenCalledOnce();
    expect(onImportComplete).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("import resolves even if onImportComplete throws", async () => {
    const db = buildMinimalDb();
    const storage = buildMinimalStorage();
    const onImportComplete = vi.fn().mockRejectedValue(new Error("Pattern detection failed"));

    await expect(
      processChatImportSession({
        sessionId: "session-1",
        db: db as never,
        storage: storage as never,
        onImportComplete,
      })
    ).resolves.toBeUndefined();

    // Import was still marked complete despite hook failure
    const updateCalls = db.importUploadSession.update.mock.calls as Array<[{ data: { status?: string } }]>;
    const completeCall = updateCalls.find((c) => c[0].data.status === "complete");
    expect(completeCall).toBeDefined();
  });

  it("does not call onImportComplete if session is already complete", async () => {
    const db = buildMinimalDb({ status: "complete" });
    const storage = buildMinimalStorage();
    const onImportComplete = vi.fn().mockResolvedValue(undefined);

    await processChatImportSession({
      sessionId: "session-1",
      db: db as never,
      storage: storage as never,
      onImportComplete,
    });

    expect(onImportComplete).not.toHaveBeenCalled();
    // No stream work — storage.getChunkStream not touched
    expect(storage.getChunkStream).not.toHaveBeenCalled();
  });

  it("does not call onImportComplete if import processing fails", async () => {
    const db = buildMinimalDb();
    db.importUploadSession.findUnique = vi.fn().mockResolvedValue(null);
    const storage = buildMinimalStorage();
    const onImportComplete = vi.fn().mockResolvedValue(undefined);

    await expect(
      processChatImportSession({
        sessionId: "session-1",
        db: db as never,
        storage: storage as never,
        onImportComplete,
      })
    ).rejects.toThrow("Import upload session not found");

    expect(onImportComplete).not.toHaveBeenCalled();
  });

  it("does not call onImportComplete per conversation — only once total", async () => {
    // Provide two conversations in the JSON; hook should still be called once.
    const conversations = JSON.stringify([
      {
        id: "c1",
        title: "Conv 1",
        mapping: {
          a: { message: { author: { role: "user" }, create_time: 1_700_000_000, content: { parts: ["Hello"] } } },
        },
      },
      {
        id: "c2",
        title: "Conv 2",
        mapping: {
          b: { message: { author: { role: "user" }, create_time: 1_700_000_001, content: { parts: ["Hi"] } } },
        },
      },
    ]);

    const db = {
      importUploadSession: {
        findUnique: vi.fn().mockResolvedValue({ ...BASE_SESSION }),
        update: vi.fn().mockResolvedValue({}),
      },
      contradictionNode: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      // importExtractedConversations needs these — return stubs so it skips
      session: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "s-new" }),
      },
      message: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db)),
    };

    const storage = {
      getChunkStream: vi.fn().mockResolvedValue(makeJsonReadable(conversations)),
      deleteChunks: vi.fn().mockResolvedValue(undefined),
    };

    const onImportComplete = vi.fn().mockResolvedValue(undefined);

    await processChatImportSession({
      sessionId: "session-1",
      db: db as never,
      storage: storage as never,
      onImportComplete,
    });

    // Regardless of how many conversations were processed, hook fires once
    expect(onImportComplete).toHaveBeenCalledOnce();
  });
});
