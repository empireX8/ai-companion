import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

import { detectContradictions } from "./contradiction-detection";
import { materializeContradictions } from "./contradiction-materialization";
import {
  completeDerivationRun,
  createDerivationArtifact,
  createDerivationRun,
} from "./derivation-layer";
import { detectReferenceIntentType, pickBestPreferenceMatch } from "./memory-governance";
import { processMessageForProfile } from "./profile-derivation";
import prismadb from "./prismadb";

type SupportedRole = "user" | "assistant";

type ExtractedMessage = {
  role: SupportedRole;
  content: string;
  createdAt: Date | null;
};

export type ExtractedConversation = {
  title: string | null;
  externalId: string | null;
  messages: ExtractedMessage[];
};

export const MAX_IMPORT_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_EXTRACTED_CONVERSATIONS_JSON_BYTES = 100 * 1024 * 1024;

export class ImportChatGptError extends Error {
  status: number;
  errors: string[];

  constructor(status: number, errors: string[]) {
    super(errors[0] ?? "Import failed");
    this.status = status;
    this.errors = errors;
  }
}

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

const normalizeText = (value: string) => value.replace(/\r\n/g, "\n").trim();

const parseTimestamp = (value: unknown): Date | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
  const parsed = new Date(milliseconds);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const mapRole = (value: unknown): SupportedRole | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("user") || normalized.includes("human")) {
    return "user";
  }

  if (normalized.includes("assistant") || normalized.includes("chatgpt")) {
    return "assistant";
  }

  return null;
};

const extractText = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === "string" ? item : null))
      .filter((item): item is string => Boolean(item))
      .join("\n");
    return extractText(joined);
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.parts)) {
    return extractText(record.parts);
  }

  if (typeof record.text === "string") {
    return extractText(record.text);
  }

  if (typeof record.content === "string") {
    return extractText(record.content);
  }

  return null;
};

const parseMessageLike = (value: unknown): ExtractedMessage | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const author = typeof record.author === "object" && record.author !== null
    ? (record.author as Record<string, unknown>)
    : null;
  const role =
    mapRole(author?.role) ??
    mapRole(author?.name) ??
    mapRole(record.role) ??
    mapRole(record.sender);

  if (!role) {
    return null;
  }

  const content =
    extractText(record.content) ??
    extractText(
      typeof record.message === "object" && record.message !== null
        ? (record.message as Record<string, unknown>).content
        : null
    );

  if (!content) {
    return null;
  }

  return {
    role,
    content,
    createdAt:
      parseTimestamp(record.create_time) ??
      parseTimestamp(record.created_at) ??
      parseTimestamp(record.timestamp),
  };
};

const parseConversationFromMapping = (conversation: Record<string, unknown>): ExtractedMessage[] => {
  const mapping = conversation.mapping;
  if (typeof mapping !== "object" || mapping === null) {
    return [];
  }

  const nodes = Object.values(mapping as Record<string, unknown>);
  const parsed = nodes
    .map((node, index) => {
      if (typeof node !== "object" || node === null) {
        return null;
      }

      const record = node as Record<string, unknown>;
      const message = record.message;
      const parsedMessage = parseMessageLike(message);
      if (!parsedMessage) {
        return null;
      }

      return {
        index,
        message: {
          ...parsedMessage,
          createdAt:
            parsedMessage.createdAt ??
            parseTimestamp(record.create_time) ??
            parseTimestamp(record.update_time),
        },
      };
    })
    .filter(
      (entry): entry is { index: number; message: ExtractedMessage } => Boolean(entry)
    )
    .sort((left, right) => {
      const leftTime = left.message.createdAt?.getTime();
      const rightTime = right.message.createdAt?.getTime();
      if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftTime !== undefined && rightTime === undefined) {
        return -1;
      }
      if (leftTime === undefined && rightTime !== undefined) {
        return 1;
      }
      return left.index - right.index;
    });

  return parsed.map((entry) => entry.message);
};

const parseConversationFromMessagesArray = (
  conversation: Record<string, unknown>
): ExtractedMessage[] => {
  if (!Array.isArray(conversation.messages)) {
    return [];
  }

  return conversation.messages
    .map((message) => parseMessageLike(message))
    .filter((message): message is ExtractedMessage => Boolean(message));
};

const parseConversation = (
  rawConversation: unknown,
  index: number
): { conversation?: ExtractedConversation; error?: string } => {
  if (typeof rawConversation !== "object" || rawConversation === null) {
    return {
      error: `Conversation ${index + 1}: invalid shape`,
    };
  }

  const conversationRecord = rawConversation as Record<string, unknown>;
  const title =
    typeof conversationRecord.title === "string" && conversationRecord.title.trim().length > 0
      ? conversationRecord.title.trim()
      : null;
  const externalId =
    typeof conversationRecord.id === "string" && conversationRecord.id.trim().length > 0
      ? conversationRecord.id.trim()
      : null;

  const fromMapping = parseConversationFromMapping(conversationRecord);
  const fromMessages = parseConversationFromMessagesArray(conversationRecord);
  const messages = (fromMapping.length > 0 ? fromMapping : fromMessages).map((message) => ({
    ...message,
    content: normalizeText(message.content),
  }));

  const filtered = messages.filter((message) => message.content.length > 0);
  if (filtered.length === 0) {
    return {
      error: `Conversation ${index + 1}: no importable user/assistant messages`,
    };
  }

  return {
    conversation: {
      title,
      externalId,
      messages: filtered,
    },
  };
};

export function parseConversationForImport(
  rawConversation: unknown,
  index: number
): { conversation?: ExtractedConversation; error?: string } {
  return parseConversation(rawConversation, index);
}

const getConversationCandidates = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== "object" || raw === null) {
    return [];
  }

  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.conversations)) {
    return record.conversations;
  }

  if (typeof record.mapping === "object" && record.mapping !== null) {
    return [record];
  }

  if (Array.isArray(record.messages)) {
    return [record];
  }

  return [];
};

export function validateImportFile(file: File | null): {
  ok: true;
} | {
  ok: false;
  status: number;
  error: string;
} {
  if (!file) {
    return { ok: false, status: 400, error: "Missing file field `file`" };
  }

  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  const isZip = lowerName.endsWith(".zip") || lowerType.includes("zip");
  const isJson = lowerName.endsWith(".json") || lowerType.includes("json");
  if (!isZip && !isJson) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported file type. Upload a ChatGPT export ZIP or conversations.json.",
    };
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File too large. Maximum size is ${MAX_IMPORT_FILE_BYTES} bytes.`,
    };
  }

  return { ok: true };
}

export function parseJsonSafe(raw: string):
  | { ok: true; value: unknown }
  | { ok: false; error: string } {
  try {
    return {
      ok: true,
      value: JSON.parse(raw),
    };
  } catch {
    return {
      ok: false,
      error: "Invalid JSON file",
    };
  }
}

export async function extractConversationsJsonFromZip(
  zipBytes: Buffer,
  maxExtractedBytes = MAX_EXTRACTED_CONVERSATIONS_JSON_BYTES
): Promise<Buffer> {
  try {
    const archive = await JSZip.loadAsync(zipBytes);
    const entry = Object.entries(archive.files).find(
      ([path, file]) => !file.dir && path.toLowerCase().endsWith("conversations.json")
    );
    if (!entry) {
      throw new ImportChatGptError(400, ["Zip missing conversations.json"]);
    }

    const zippedFile = entry[1];
    const extracted = Buffer.from(await zippedFile.async("uint8array"));
    if (extracted.length > maxExtractedBytes) {
      throw new ImportChatGptError(400, [
        `Extracted conversations.json too large. Maximum size is ${maxExtractedBytes} bytes.`,
      ]);
    }

    return extracted;
  } catch (error) {
    if (error instanceof ImportChatGptError) {
      throw error;
    }

    throw new ImportChatGptError(400, [
      "Invalid or encrypted ZIP archive. Upload a standard ChatGPT export ZIP.",
    ]);
  }
}

export function extractChatGptConversations(raw: unknown): {
  conversations: ExtractedConversation[];
  errors: string[];
} {
  const candidates = getConversationCandidates(raw);
  const conversations: ExtractedConversation[] = [];
  const errors: string[] = [];

  candidates.forEach((candidate, index) => {
    const parsed = parseConversation(candidate, index);
    if (parsed.error) {
      errors.push(parsed.error);
      return;
    }
    if (parsed.conversation) {
      conversations.push(parsed.conversation);
    }
  });

  return { conversations, errors };
}

export async function ingestChatGptConversationsJson({
  userId,
  jsonBytes,
  importedSource = "chatgpt_export_json",
  db = prismadb,
}: {
  userId: string;
  jsonBytes: Buffer;
  importedSource?: string;
  db?: PrismaClient;
}): Promise<{
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
}> {
  const parsedResult = parseJsonSafe(jsonBytes.toString("utf8"));
  if (!parsedResult.ok) {
    throw new ImportChatGptError(400, [parsedResult.error]);
  }

  const extracted = extractChatGptConversations(parsedResult.value);
  if (extracted.conversations.length === 0) {
    throw new ImportChatGptError(400, [...extracted.errors, "No importable conversations found"]);
  }

  const imported = await importExtractedConversations({
    userId,
    conversations: extracted.conversations,
    importedSource,
    db,
  });

  return {
    sessionsCreated: imported.sessionsCreated,
    messagesCreated: imported.messagesCreated,
    contradictionsCreated: imported.contradictionsCreated,
    errors: [...extracted.errors, ...imported.errors],
  };
}

export async function importChatGptExport({
  userId,
  bytes,
  filename,
  contentType,
  db = prismadb,
  maxExtractedBytes = MAX_EXTRACTED_CONVERSATIONS_JSON_BYTES,
  zipExtractor = extractConversationsJsonFromZip,
  jsonImporter = ingestChatGptConversationsJson,
}: {
  userId: string;
  bytes: Buffer;
  filename: string;
  contentType?: string;
  db?: PrismaClient;
  maxExtractedBytes?: number;
  zipExtractor?: (zipBytes: Buffer, maxBytes: number) => Promise<Buffer>;
  jsonImporter?: (params: { userId: string; jsonBytes: Buffer; importedSource?: string; db?: PrismaClient }) => Promise<{
    sessionsCreated: number;
    messagesCreated: number;
    contradictionsCreated: number;
    errors: string[];
  }>;
}): Promise<{
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
}> {
  const lowerName = filename.toLowerCase();
  const lowerType = (contentType ?? "").toLowerCase();
  const isZip = lowerName.endsWith(".zip") || lowerType.includes("zip");
  const isJson = lowerName.endsWith(".json") || lowerType.includes("json");

  if (!isZip && !isJson) {
    throw new ImportChatGptError(400, [
      "Unsupported file type. Upload a ChatGPT export ZIP or conversations.json.",
    ]);
  }

  if (isZip) {
    const jsonBytes = await zipExtractor(bytes, maxExtractedBytes);
    return jsonImporter({ userId, jsonBytes, importedSource: "chatgpt_export_zip", db });
  }

  return jsonImporter({ userId, jsonBytes: bytes, importedSource: "chatgpt_export_json", db });
}

export type GovernedReferenceType = "goal" | "preference" | "constraint";
export type ImportRefCache = Map<GovernedReferenceType, string[]>;

export async function extractReferenceFromImportedMessage({
  userId,
  message,
  sessionId,
  db,
  refCache,
}: {
  userId: string;
  message: { id: string; content: string };
  sessionId: string;
  db: PrismaClient;
  refCache: ImportRefCache;
}): Promise<boolean> {
  const intentType = detectReferenceIntentType(message.content);
  if (!intentType || intentType === "rule") {
    return false;
  }

  const type = intentType as GovernedReferenceType;
  const statement = message.content.replace(/\s+/g, " ").trim();

  if (!refCache.has(type)) {
    const existing = await db.referenceItem.findMany({
      where: { userId, type, status: "active" },
      select: { statement: true },
    });
    refCache.set(type, existing.map((r) => r.statement));
  }

  const cached = refCache.get(type)!;
  if (cached.length > 0) {
    const { score } = pickBestPreferenceMatch(
      cached.map((s, i) => ({ id: String(i), type, statement: s })),
      statement
    );
    if (score >= 2) {
      return false;
    }
  }

  await db.referenceItem.create({
    data: {
      userId,
      type,
      statement,
      confidence: "low",
      status: "candidate",
      sourceSessionId: sessionId,
      sourceMessageId: message.id,
    },
  });

  cached.push(statement);
  return true;
}

export async function importExtractedConversations({
  userId,
  conversations,
  importedSource = "chatgpt_export_json",
  db = prismadb,
}: {
  userId: string;
  conversations: ExtractedConversation[];
  importedSource?: string;
  db?: PrismaClient;
}): Promise<{
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
}> {
  let sessionsCreated = 0;
  let messagesCreated = 0;
  let contradictionsCreated = 0;
  const errors: string[] = [];
  const refCache: ImportRefCache = new Map();

  for (const [conversationIndex, conversation] of conversations.entries()) {
    try {
      const created = await db.$transaction(async (tx) => {
        const startedAt =
          conversation.messages.find((message) => message.createdAt)?.createdAt ?? undefined;

        // Deduplication: skip if this external conversation was already imported.
        if (conversation.externalId) {
          const existing = await tx.session.findUnique({
            where: { userId_importedExternalId: { userId, importedExternalId: conversation.externalId } },
            select: { id: true },
          });
          if (existing) {
            return null;
          }
        }

        const importedAt = new Date();
        const session = await tx.session.create({
          data: {
            userId,
            label: conversation.title ?? `Imported conversation ${conversationIndex + 1}`,
            origin: "IMPORTED_ARCHIVE",
            importedSource,
            importedAt,
            ...(conversation.externalId ? { importedExternalId: conversation.externalId } : {}),
            ...(startedAt ? { startedAt } : {}),
          },
          select: { id: true },
        });

        const createdMessages: Array<{ id: string; content: string }> = [];
        for (const message of conversation.messages) {
          const createdMessage = await tx.message.create({
            data: {
              userId,
              sessionId: session.id,
              role: message.role,
              content: message.content,
              ...(message.createdAt ? { createdAt: message.createdAt } : {}),
            },
            select: { id: true, role: true, content: true },
          });

          if (createdMessage.role === "user" && createdMessage.content.trim().length >= 15) {
            createdMessages.push({
              id: createdMessage.id,
              content: createdMessage.content,
            });
          }
        }

        return {
          sessionId: session.id,
          importedMessageCount: conversation.messages.length,
          userMessagesForDetection: createdMessages,
        };
      });

      if (!created) {
        // Duplicate — already imported under the same externalId; skip silently.
        continue;
      }
      sessionsCreated += 1;
      messagesCreated += created.importedMessageCount;

      // Derivation scaffolding: create a processing run for this conversation.
      let derivationRunId: string | null = null;
      if (created.userMessagesForDetection.length > 0) {
        try {
          const run = await createDerivationRun(
            {
              userId,
              scope: "import",
              processorVersion: "import-chatgpt@1",
              messageIds: created.userMessagesForDetection.map((m) => m.id),
            },
            db
          );
          derivationRunId = run.id;
        } catch {
          // Derivation scaffolding failure — import continues without tracking.
        }
      }

      for (const importedMessage of created.userMessagesForDetection) {
        // Profile derivation: create EvidenceSpan + extract claims (runs independently of
        // the DerivationRun — spans are created even when run scaffolding fails).
        const profileResult = await processMessageForProfile({
          userId,
          messageId: importedMessage.id,
          content: importedMessage.content,
          db,
        });
        const spanId = profileResult?.spanId ?? null;

        try {
          const refCreated = await extractReferenceFromImportedMessage({
            userId,
            message: importedMessage,
            sessionId: created.sessionId,
            db,
            refCache,
          });
          // Derivation scaffolding: store reference candidate artifact.
          if (refCreated && derivationRunId !== null) {
            try {
              await createDerivationArtifact(
                {
                  userId,
                  runId: derivationRunId,
                  type: "reference_candidate",
                  payload: {
                    messageId: importedMessage.id,
                    content: importedMessage.content.slice(0, 500),
                  },
                  spanIds: spanId !== null ? [spanId] : [],
                },
                db
              );
            } catch {
              // scaffolding failure
            }
          }
        } catch (error) {
          errors.push(
            `Conversation ${conversationIndex + 1} message ${importedMessage.id}: reference extraction failed (${toErrorMessage(error)})`
          );
        }

        try {
          const detections = await detectContradictions({
            userId,
            messageContent: importedMessage.content,
            // Include candidate references: every reference extracted during
            // this import run is created as "candidate", never "active". Without
            // this, contradiction detection finds at most the handful of
            // pre-existing active refs and silently returns [] for every message.
            referenceStatuses: ["active", "candidate"],
            db: db as unknown as Parameters<typeof detectContradictions>[0]["db"],
          });
          if (detections.length === 0) {
            continue;
          }

          // Derivation scaffolding: store contradiction candidate artifacts.
          if (derivationRunId !== null) {
            for (const detection of detections.slice(0, 2)) {
              try {
                await createDerivationArtifact(
                  {
                    userId,
                    runId: derivationRunId,
                    type: "contradiction_candidate",
                    payload: {
                      messageId: importedMessage.id,
                      title: detection.title,
                      sideA: detection.sideA,
                      sideB: detection.sideB,
                      type: detection.type,
                    },
                    spanIds: spanId !== null ? [spanId] : [],
                  },
                  db
                );
              } catch {
                // scaffolding failure
              }
            }
          }

          const materialized = await materializeContradictions({
            userId,
            detections,
            sessionId: created.sessionId,
            messageId: importedMessage.id,
            quote: importedMessage.content,
            db: db as unknown as Parameters<typeof materializeContradictions>[0]["db"],
          });

          contradictionsCreated += materialized.nodesCreated;
        } catch (error) {
          errors.push(
            `Conversation ${conversationIndex + 1} message ${importedMessage.id}: contradiction detection failed (${toErrorMessage(
              error
            )})`
          );
        }
      }

      // Derivation scaffolding: mark run complete.
      if (derivationRunId !== null) {
        try {
          await completeDerivationRun(derivationRunId, db);
        } catch {
          // scaffolding failure
        }
      }
    } catch (error) {
      errors.push(
        `Conversation ${conversationIndex + 1}: import failed (${toErrorMessage(error)})`
      );
    }
  }

  return {
    sessionsCreated,
    messagesCreated,
    contradictionsCreated,
    errors,
  };
}
