/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../import-upload-queue", () => ({
  enqueueImportProcessing: vi.fn(),
}));

import {
  ImportUploadValidationError,
  finalizeUploadSession,
  getUploadSessionStatus,
  initUploadSession,
  upsertUploadChunk,
} from "../import-upload-service";
import {
  combineResultErrorsWithDiagnostics,
  createEmptyImportRunDiagnostics,
} from "../import-diagnostics";
import { enqueueImportProcessing } from "../import-upload-queue";

const buildMockDb = () => {
  const sessions = new Map<string, any>();
  const chunks = new Map<string, any>();

  let seq = 1;
  const getSessionChunks = (sessionId: string) =>
    Array.from(chunks.values()).filter((chunk) => chunk.sessionId === sessionId);

  return {
    sessions,
    chunks,
    db: {
      importUploadSession: {
        create: async ({ data }: any) => {
          const id = `session_${seq++}`;
          const record = {
            id,
            ...data,
            processedConversations: 0,
            processedMessages: 0,
            sessionsCreated: 0,
            messagesCreated: 0,
            contradictionsCreated: 0,
            processingProgress: 0,
            error: null,
            startedAt: null,
            finishedAt: null,
            status: data.status ?? "pending",
            resultErrors: data.resultErrors ?? [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          sessions.set(id, record);
          return { id };
        },
        findUnique: async ({ where, include, select }: any) => {
          const found = sessions.get(where.id);
          if (!found) {
            return null;
          }

          const withChunks = include?.chunks ? { chunks: getSessionChunks(where.id) } : {};
          if (select) {
            const selected: Record<string, unknown> = {};
            for (const key of Object.keys(select)) {
              selected[key] = found[key];
            }
            return selected;
          }

          return {
            ...found,
            ...withChunks,
          };
        },
        update: async ({ where, data }: any) => {
          const found = sessions.get(where.id);
          if (!found) {
            throw new Error("not found");
          }

          const updated = {
            ...found,
            ...data,
            updatedAt: new Date(),
          };
          sessions.set(where.id, updated);
          return updated;
        },
      },
      importUploadChunk: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.sessionId_chunkIndex.sessionId}:${where.sessionId_chunkIndex.chunkIndex}`;
          const existing = chunks.get(key);
          const value = existing ? { ...existing, ...update } : { id: key, ...create };
          chunks.set(key, value);
          return value;
        },
      },
    },
  };
};

describe("import upload service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates upload session with validated input", async () => {
    const mock = buildMockDb();

    const result = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.zip",
        contentType: "application/zip",
        bytesTotal: (1024 * 1024 * 3) + 21,
        chunkSize: 1024 * 1024,
        totalChunks: 4,
      },
      db: mock.db as any,
    });

    expect(result.sessionId).toMatch(/^session_/);
    expect(mock.sessions.size).toBe(1);
  });

  it("upserts chunks idempotently", async () => {
    const mock = buildMockDb();
    const { sessionId } = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.json",
        contentType: "application/json",
        bytesTotal: 2 * 1024 * 1024,
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      },
      db: mock.db as any,
    });

    const storage = {
      putChunk: vi.fn(async () => undefined),
      getChunkStream: vi.fn(),
      deleteChunks: vi.fn(),
    };

    await upsertUploadChunk({
      userId: "user_1",
      sessionId,
      chunkIndex: 0,
      chunkBytes: Buffer.alloc(1024 * 1024, 1),
      db: mock.db as any,
      storage,
    });

    await upsertUploadChunk({
      userId: "user_1",
      sessionId,
      chunkIndex: 0,
      chunkBytes: Buffer.alloc(1024 * 1024, 1),
      db: mock.db as any,
      storage,
    });

    expect(mock.chunks.size).toBe(1);
    expect(storage.putChunk).toHaveBeenCalledTimes(2);
  });

  it("fails finalize when chunks are missing", async () => {
    const mock = buildMockDb();
    const { sessionId } = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.json",
        contentType: "application/json",
        bytesTotal: 2 * 1024 * 1024,
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      },
      db: mock.db as any,
    });

    await mock.db.importUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: 0 } },
      create: { sessionId, chunkIndex: 0, sizeBytes: 1024 * 1024 },
      update: {},
    });

    await expect(
      finalizeUploadSession({
        userId: "user_1",
        sessionId,
        db: mock.db as any,
      })
    ).rejects.toBeInstanceOf(ImportUploadValidationError);
  });

  it("returns status with missing chunks", async () => {
    const mock = buildMockDb();
    const { sessionId } = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.json",
        contentType: "application/json",
        bytesTotal: 3 * 1024 * 1024,
        chunkSize: 1024 * 1024,
        totalChunks: 3,
      },
      db: mock.db as any,
    });

    await mock.db.importUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: 0 } },
      create: { sessionId, chunkIndex: 0, sizeBytes: 1024 * 1024 },
      update: {},
    });
    await mock.db.importUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: 2 } },
      create: { sessionId, chunkIndex: 2, sizeBytes: 1024 * 1024 },
      update: {},
    });

    const status = await getUploadSessionStatus({
      userId: "user_1",
      sessionId,
      db: mock.db as any,
    });

    expect(status.missingChunkIndexes).toEqual([1]);
    expect(status.receivedChunks).toBe(2);
    expect(status.totalChunks).toBe(3);
  });

  it("returns parsed diagnostics and excludes diagnostics payload from result errors", async () => {
    const mock = buildMockDb();
    const { sessionId } = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.json",
        contentType: "application/json",
        bytesTotal: 2 * 1024 * 1024,
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      },
      db: mock.db as any,
    });

    const diagnostics = createEmptyImportRunDiagnostics();
    diagnostics.importedConversationCount = 7;
    diagnostics.importedMessageCount = 42;

    await mock.db.importUploadSession.update({
      where: { id: sessionId },
      data: {
        status: "complete",
        resultErrors: combineResultErrorsWithDiagnostics(
          ["Conversation 2: invalid shape"],
          diagnostics
        ),
      },
    });

    const status = await getUploadSessionStatus({
      userId: "user_1",
      sessionId,
      db: mock.db as any,
    });

    expect(status.resultSummary?.errors).toEqual(["Conversation 2: invalid shape"]);
    expect(status.diagnostics?.importedConversationCount).toBe(7);
    expect(status.diagnostics?.importedMessageCount).toBe(42);
  });

  it("finalize enqueues processing when complete", async () => {
    const mock = buildMockDb();
    const { sessionId } = await initUploadSession({
      userId: "user_1",
      input: {
        filename: "chatgpt-export.json",
        contentType: "application/json",
        bytesTotal: 2 * 1024 * 1024,
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      },
      db: mock.db as any,
    });

    await mock.db.importUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: 0 } },
      create: { sessionId, chunkIndex: 0, sizeBytes: 1024 * 1024 },
      update: {},
    });
    await mock.db.importUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: 1 } },
      create: { sessionId, chunkIndex: 1, sizeBytes: 1024 * 1024 },
      update: {},
    });

    const result = await finalizeUploadSession({
      userId: "user_1",
      sessionId,
      db: mock.db as any,
    });

    expect(result.status).toBe("processing");
    expect(enqueueImportProcessing).toHaveBeenCalledWith(sessionId);
  });
});
