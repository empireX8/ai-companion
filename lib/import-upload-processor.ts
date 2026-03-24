import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import type { ImportUploadSession, PrismaClient } from "@prisma/client";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import yauzl from "yauzl";

import { getChunkStorage, type ChunkStorage } from "./import-chunk-storage";
import {
  importExtractedConversations,
  parseConversationForImport,
  type ExtractedConversation,
} from "./import-chatgpt";
import { reconcileImportedStructureForUser } from "./import-reconcile";
import prismadb from "./prismadb";

const BATCH_SIZE = 100;

type ProcessImportParams = {
  sessionId: string;
  db?: PrismaClient;
  storage?: ChunkStorage;
  /**
   * Optional hook called after import completes successfully (status="complete").
   * Receives the userId so callers can trigger downstream processing (e.g.
   * pattern detection). Errors in this hook are logged but do not fail the import.
   */
  onImportComplete?: (userId: string) => void | Promise<void>;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

async function pipeStreamToOutput(source: Readable, output: PassThrough) {
  for await (const chunk of source) {
    if (!output.write(chunk)) {
      await once(output, "drain");
    }
  }
}

function createConcatenatedChunkStream(
  storage: ChunkStorage,
  sessionId: string,
  startChunk: number,
  totalChunks: number
): Readable {
  const output = new PassThrough();

  void (async () => {
    try {
      for (let chunkIndex = startChunk; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunkStream = await storage.getChunkStream(sessionId, chunkIndex);
        await pipeStreamToOutput(chunkStream, output);
      }
      output.end();
    } catch (error) {
      output.destroy(error as Error);
    }
  })();

  return output;
}

async function writeStreamToFile(input: Readable, targetPath: string) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const writeStream = createWriteStream(targetPath, { flags: "w" });

  await new Promise<void>((resolve, reject) => {
    input.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => resolve());
    input.pipe(writeStream);
  });
}

async function openConversationsJsonEntry(zipFilePath: string): Promise<Readable> {
  const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true, autoClose: true }, (error, file) => {
      if (error || !file) {
        reject(error ?? new Error("Unable to open ZIP archive"));
        return;
      }
      resolve(file);
    });
  });

  return new Promise<Readable>((resolve, reject) => {
    let resolved = false;

    zipFile.on("error", (error) => {
      if (!resolved) {
        reject(error);
      }
    });

    zipFile.on("entry", (entry) => {
      const entryName = entry.fileName.toLowerCase();
      if (!entryName.endsWith("conversations.json")) {
        zipFile.readEntry();
        return;
      }

      zipFile.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          reject(error ?? new Error("Failed to read conversations.json from ZIP"));
          return;
        }

        resolved = true;
        resolve(readStream);
      });
    });

    zipFile.on("end", () => {
      if (!resolved) {
        reject(new Error("Zip missing conversations.json"));
      }
    });

    zipFile.readEntry();
  });
}

export function calculateProcessingProgress(processedConversations: number, hasMoreWork: boolean) {
  if (!hasMoreWork) {
    return 100;
  }

  const progress = 30 + Math.floor((processedConversations / (processedConversations + 20)) * 65);
  return Math.max(30, Math.min(95, progress));
}

export function shouldSkipConversationByCheckpoint(index: number, checkpoint: number) {
  return index < checkpoint;
}

async function ingestBatch({
  db,
  userId,
  session,
  batch,
  errors,
}: {
  db: PrismaClient;
  userId: string;
  session: ImportUploadSession;
  batch: ExtractedConversation[];
  errors: string[];
}) {
  if (batch.length === 0) {
    return;
  }

  const imported = await importExtractedConversations({
    userId,
    conversations: batch,
    db,
  });

  const batchErrors = [...errors, ...imported.errors];
  await db.importUploadSession.update({
    where: { id: session.id },
    data: {
      processedConversations: { increment: batch.length },
      processedMessages: { increment: imported.messagesCreated },
      sessionsCreated: { increment: imported.sessionsCreated },
      messagesCreated: { increment: imported.messagesCreated },
      contradictionsCreated: { increment: imported.contradictionsCreated },
      processingProgress: calculateProcessingProgress(
        session.processedConversations + batch.length,
        true
      ),
      resultErrors: batchErrors,
      updatedAt: new Date(),
    },
  });

  session.processedConversations += batch.length;
  session.processedMessages += imported.messagesCreated;
}

export async function processChatImportSession({
  sessionId,
  db = prismadb,
  storage = getChunkStorage(),
  onImportComplete,
}: ProcessImportParams): Promise<void> {
  const session = await db.importUploadSession.findUnique({
    where: { id: sessionId },
    include: {
      chunks: {
        select: { chunkIndex: true },
        orderBy: { chunkIndex: "asc" },
      },
    },
  });

  if (!session) {
    throw new Error(`Import upload session not found: ${sessionId}`);
  }

  if (session.status === "complete") {
    return;
  }

  const missing = new Set<number>();
  for (let index = 0; index < session.totalChunks; index += 1) {
    missing.add(index);
  }
  for (const chunk of session.chunks) {
    missing.delete(chunk.chunkIndex);
  }
  if (missing.size > 0) {
    throw new Error(`Cannot process upload with missing chunks (${Array.from(missing).join(",")})`);
  }

  await db.importUploadSession.update({
    where: { id: session.id },
    data: {
      status: "processing",
      startedAt: session.startedAt ?? new Date(),
      error: null,
      processingProgress: Math.max(5, session.processingProgress),
    },
  });

  const parseErrors: string[] = [...session.resultErrors];
  let batch: ExtractedConversation[] = [];
  let seenConversations = 0;
  const checkpoint = session.processedConversations;
  const isZip = session.filename.toLowerCase().endsWith(".zip") ||
    session.contentType.toLowerCase().includes("zip");

  const processingFilePath = path.join(process.cwd(), ".tmp", "import-processing", `${session.id}.zip`);

  const flushBatch = async () => {
    await ingestBatch({
      db,
      userId: session.userId,
      session,
      batch,
      errors: parseErrors,
    });
    batch = [];
  };

  try {
    let conversationsStream: Readable;

    if (isZip) {
      const zippedStream = createConcatenatedChunkStream(storage, session.id, 0, session.totalChunks);
      await writeStreamToFile(zippedStream, processingFilePath);
      conversationsStream = await openConversationsJsonEntry(processingFilePath);
    } else {
      conversationsStream = createConcatenatedChunkStream(storage, session.id, 0, session.totalChunks);
    }

    const pipeline = conversationsStream.pipe(parser()).pipe(streamArray());

    for await (const item of pipeline) {
      const index = seenConversations;
      seenConversations += 1;

      if (shouldSkipConversationByCheckpoint(index, checkpoint)) {
        continue;
      }

      const parsed = parseConversationForImport(item.value, index);
      if (parsed.error) {
        parseErrors.push(parsed.error);
        continue;
      }

      if (parsed.conversation) {
        batch.push(parsed.conversation);
      }

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    if (batch.length > 0) {
      await flushBatch();
    }

    await db.importUploadSession.update({
      where: { id: session.id },
      data: {
        status: "complete",
        processingProgress: 100,
        resultErrors: parseErrors,
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      await reconcileImportedStructureForUser({ userId: session.userId, db });
    } catch (reconcileError) {
      const msg = reconcileError instanceof Error ? reconcileError.message : "Unknown error";
      await db.importUploadSession.update({
        where: { id: session.id },
        data: { resultErrors: [...parseErrors, `reconcile: failed (${msg})`] },
      });
    }

    // P3-03: fire the post-import hook (e.g. pattern detection) non-blocking.
    // Import is already marked complete — hook failure must not affect that status.
    if (onImportComplete) {
      void Promise.resolve(onImportComplete(session.userId)).catch((hookError) => {
        console.error("[IMPORT_COMPLETE_HOOK_ERROR]", session.id, hookError);
      });
    }

    await storage.deleteChunks(session.id);
  } catch (error) {
    await db.importUploadSession.update({
      where: { id: session.id },
      data: {
        status: "failed",
        error: toErrorMessage(error),
        resultErrors: parseErrors,
      },
    });

    throw error;
  } finally {
    await rm(processingFilePath, { force: true });
  }
}

export async function resumeSessionFromCheckpoint({
  sessionId,
  db = prismadb,
  storage = getChunkStorage(),
}: ProcessImportParams) {
  await processChatImportSession({ sessionId, db, storage });
}
