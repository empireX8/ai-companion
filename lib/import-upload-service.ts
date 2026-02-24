import { createHash } from "node:crypto";

import type { ImportUploadSession, PrismaClient } from "@prisma/client";

import { getChunkStorage, type ChunkStorage } from "./import-chunk-storage";
import { enqueueImportProcessing } from "./import-upload-queue";
import prismadb from "./prismadb";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const MIN_CHUNK_BYTES = 1 * 1024 * 1024;
const MAX_CHUNK_BYTES = 25 * 1024 * 1024;

const toStringError = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

// Prisma infrastructure error codes (P10xx = connection/reachability failures)
const isPrismaConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^P10\d\d$/.test(code);
};

const isValidFileType = (filename: string, contentType: string) => {
  const lowerName = filename.toLowerCase();
  const lowerType = contentType.toLowerCase();
  return (
    lowerName.endsWith(".zip") ||
    lowerName.endsWith(".json") ||
    lowerType.includes("zip") ||
    lowerType.includes("json")
  );
};

export class ImportUploadValidationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type InitUploadInput = {
  filename: string;
  contentType: string;
  bytesTotal: number;
  chunkSize: number;
  totalChunks: number;
};

export async function initUploadSession({
  userId,
  input,
  db = prismadb,
}: {
  userId: string;
  input: InitUploadInput;
  db?: PrismaClient;
}): Promise<{ sessionId: string }> {
  if (!input.filename || !input.contentType) {
    throw new ImportUploadValidationError(400, "filename and contentType are required");
  }

  if (!isValidFileType(input.filename, input.contentType)) {
    throw new ImportUploadValidationError(
      400,
      "Unsupported file type. Upload a ChatGPT export ZIP or conversations.json."
    );
  }

  if (!Number.isFinite(input.bytesTotal) || input.bytesTotal <= 0) {
    throw new ImportUploadValidationError(400, "bytesTotal must be a positive number");
  }

  if (input.bytesTotal > MAX_UPLOAD_BYTES) {
    throw new ImportUploadValidationError(413, "File exceeds current upload limit");
  }

  if (!Number.isInteger(input.chunkSize) || input.chunkSize < MIN_CHUNK_BYTES || input.chunkSize > MAX_CHUNK_BYTES) {
    throw new ImportUploadValidationError(
      400,
      `chunkSize must be between ${MIN_CHUNK_BYTES} and ${MAX_CHUNK_BYTES} bytes`
    );
  }

  const expectedChunks = Math.ceil(input.bytesTotal / input.chunkSize);
  if (!Number.isInteger(input.totalChunks) || input.totalChunks !== expectedChunks) {
    throw new ImportUploadValidationError(400, "totalChunks does not match file size and chunkSize");
  }

  const created = await db.importUploadSession.create({
    data: {
      userId,
      filename: input.filename,
      contentType: input.contentType,
      bytesTotal: BigInt(input.bytesTotal),
      chunkSize: input.chunkSize,
      totalChunks: input.totalChunks,
      status: "pending",
      resultErrors: [],
    },
    select: { id: true },
  });

  return { sessionId: created.id };
}

export async function upsertUploadChunk({
  userId,
  sessionId,
  chunkIndex,
  chunkBytes,
  checksum,
  db = prismadb,
  storage = getChunkStorage(),
}: {
  userId: string;
  sessionId: string;
  chunkIndex: number;
  chunkBytes: Buffer;
  checksum?: string | null;
  db?: PrismaClient;
  storage?: ChunkStorage;
}) {
  const session = await db.importUploadSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      totalChunks: true,
      chunkSize: true,
      bytesTotal: true,
      filename: true,
    },
  });

  if (!session || session.userId !== userId) {
    throw new ImportUploadValidationError(404, "Upload session not found");
  }

  if (["uploaded", "processing", "complete", "expired"].includes(session.status)) {
    throw new ImportUploadValidationError(409, "Upload session no longer accepts chunks");
  }

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw new ImportUploadValidationError(400, "chunkIndex out of bounds");
  }

  const isLastChunk = chunkIndex === session.totalChunks - 1;
  const expectedChunkSize = isLastChunk
    ? Number(session.bytesTotal - BigInt(session.chunkSize * (session.totalChunks - 1)))
    : session.chunkSize;

  if (chunkBytes.length <= 0 || chunkBytes.length > session.chunkSize || (!isLastChunk && chunkBytes.length !== expectedChunkSize)) {
    throw new ImportUploadValidationError(400, "Chunk size is invalid for this chunk index");
  }

  if (checksum) {
    const actual = createHash("sha256").update(chunkBytes).digest("hex");
    if (actual !== checksum.toLowerCase()) {
      throw new ImportUploadValidationError(400, "Chunk checksum mismatch");
    }
  }

  await storage.putChunk({
    sessionId,
    chunkIndex,
    bytes: chunkBytes,
  });

  await db.importUploadChunk.upsert({
    where: {
      sessionId_chunkIndex: {
        sessionId,
        chunkIndex,
      },
    },
    create: {
      sessionId,
      chunkIndex,
      sizeBytes: chunkBytes.length,
      checksum: checksum ?? null,
    },
    update: {
      sizeBytes: chunkBytes.length,
      checksum: checksum ?? null,
    },
  });

  if (session.status === "pending") {
    await db.importUploadSession.update({
      where: { id: sessionId },
      data: { status: "uploading" },
    });
  }

  return { ok: true };
}

export async function finalizeUploadSession({
  userId,
  sessionId,
  db = prismadb,
}: {
  userId: string;
  sessionId: string;
  db?: PrismaClient;
}): Promise<{ status: "processing" }> {
  const session = await db.importUploadSession.findUnique({
    where: { id: sessionId },
    include: {
      chunks: {
        select: { chunkIndex: true },
      },
    },
  });

  if (!session || session.userId !== userId) {
    throw new ImportUploadValidationError(404, "Upload session not found");
  }

  if (session.status === "complete") {
    return { status: "processing" };
  }

  const receivedChunkIndexes = new Set(session.chunks.map((chunk) => chunk.chunkIndex));
  const missingChunkIndexes: number[] = [];
  for (let i = 0; i < session.totalChunks; i += 1) {
    if (!receivedChunkIndexes.has(i)) {
      missingChunkIndexes.push(i);
    }
  }

  if (missingChunkIndexes.length > 0) {
    throw new ImportUploadValidationError(
      409,
      `Missing chunks: ${missingChunkIndexes.slice(0, 20).join(",")}${missingChunkIndexes.length > 20 ? "..." : ""}`
    );
  }

  await db.importUploadSession.update({
    where: { id: sessionId },
    data: {
      status: "uploaded",
      processingProgress: Math.max(5, session.processingProgress),
      error: null,
      updatedAt: new Date(),
    },
  });

  enqueueImportProcessing(sessionId);
  return { status: "processing" };
}

export type UploadSessionStatusResponse = {
  status: ImportUploadSession["status"];
  receivedChunks: number;
  totalChunks: number;
  processingProgress: number;
  processedConversations: number;
  processedMessages: number;
  resultSummary: {
    sessionsCreated: number;
    messagesCreated: number;
    contradictionsCreated: number;
    errors: string[];
  } | null;
  missingChunkIndexes: number[];
  error: string | null;
};

export async function getUploadSessionStatus({
  userId,
  sessionId,
  db = prismadb,
}: {
  userId: string;
  sessionId: string;
  db?: PrismaClient;
}): Promise<UploadSessionStatusResponse> {
  const session = await db.importUploadSession.findUnique({
    where: { id: sessionId },
    include: {
      chunks: {
        select: { chunkIndex: true },
      },
    },
  });

  if (!session || session.userId !== userId) {
    throw new ImportUploadValidationError(404, "Upload session not found");
  }

  const receivedChunkIndexes = new Set(session.chunks.map((chunk) => chunk.chunkIndex));
  const missingChunkIndexes: number[] = [];
  for (let i = 0; i < session.totalChunks; i += 1) {
    if (!receivedChunkIndexes.has(i)) {
      missingChunkIndexes.push(i);
    }
  }

  return {
    status: session.status,
    receivedChunks: session.chunks.length,
    totalChunks: session.totalChunks,
    processingProgress: session.processingProgress,
    processedConversations: session.processedConversations,
    processedMessages: session.processedMessages,
    resultSummary:
      session.status === "complete" || session.status === "failed"
        ? {
            sessionsCreated: session.sessionsCreated,
            messagesCreated: session.messagesCreated,
            contradictionsCreated: session.contradictionsCreated,
            errors: session.resultErrors,
          }
        : null,
    missingChunkIndexes,
    error: session.error,
  };
}

export function toHttpErrorPayload(error: unknown) {
  if (error instanceof ImportUploadValidationError) {
    return {
      status: error.status,
      body: { error: error.message },
    };
  }

  if (isPrismaConnectionError(error)) {
    return {
      status: 503,
      body: { error: "Database is unavailable. Please try again shortly." },
    };
  }

  return {
    status: 500,
    body: { error: toStringError(error) },
  };
}
