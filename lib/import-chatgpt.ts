import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

import { detectContradictions } from "./contradiction-detection";
import { detectReferenceIntentType, pickBestPreferenceMatch } from "./memory-governance";
import prismadb from "./prismadb";

type SupportedRole = "user" | "assistant";

type ExtractedMessage = {
  role: SupportedRole;
  content: string;
  createdAt: Date | null;
};

export type ExtractedConversation = {
  title: string | null;
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
  db = prismadb,
}: {
  userId: string;
  jsonBytes: Buffer;
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
  jsonImporter?: (params: { userId: string; jsonBytes: Buffer; db?: PrismaClient }) => Promise<{
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
    return jsonImporter({ userId, jsonBytes, db });
  }

  return jsonImporter({ userId, jsonBytes: bytes, db });
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
      status: "active",
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
  db = prismadb,
}: {
  userId: string;
  conversations: ExtractedConversation[];
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
        const session = await tx.session.create({
          data: {
            userId,
            label: conversation.title ?? `Imported conversation ${conversationIndex + 1}`,
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

      sessionsCreated += 1;
      messagesCreated += created.importedMessageCount;

      for (const importedMessage of created.userMessagesForDetection) {
        try {
          await extractReferenceFromImportedMessage({
            userId,
            message: importedMessage,
            sessionId: created.sessionId,
            db,
            refCache,
          });
        } catch (error) {
          errors.push(
            `Conversation ${conversationIndex + 1} message ${importedMessage.id}: reference extraction failed (${toErrorMessage(error)})`
          );
        }

        try {
          const detections = await detectContradictions({
            userId,
            messageContent: importedMessage.content,
          });
          if (detections.length === 0) {
            continue;
          }

          const now = new Date();
          await db.$transaction(async (tx) => {
            for (const detection of detections.slice(0, 2)) {
              if (detection.existingNodeId) {
                const existingNode = await tx.contradictionNode.findFirst({
                  where: {
                    id: detection.existingNodeId,
                    userId,
                    status: { in: ["open", "explored"] },
                  },
                  select: { id: true },
                });

                if (!existingNode) {
                  continue;
                }

                await tx.contradictionEvidence.create({
                  data: {
                    nodeId: existingNode.id,
                    sessionId: created.sessionId,
                    messageId: importedMessage.id,
                    quote: importedMessage.content,
                  },
                });
                await tx.contradictionNode.update({
                  where: { id: existingNode.id },
                  data: {
                    evidenceCount: { increment: 1 },
                    lastEvidenceAt: now,
                    lastTouchedAt: now,
                  },
                });
                continue;
              }

              const createdNode = await tx.contradictionNode.create({
                data: {
                  userId,
                  title: detection.title,
                  sideA: detection.sideA,
                  sideB: detection.sideB,
                  type: detection.type,
                  confidence: detection.confidence,
                  status: "open",
                  sourceSessionId: created.sessionId,
                  sourceMessageId: importedMessage.id,
                  evidenceCount: 1,
                  lastEvidenceAt: now,
                  recommendedRung: "rung1_gentle_mirror",
                  escalationLevel: 0,
                },
                select: { id: true },
              });

              await tx.contradictionEvidence.create({
                data: {
                  nodeId: createdNode.id,
                  sessionId: created.sessionId,
                  messageId: importedMessage.id,
                  quote: importedMessage.content,
                },
              });

              contradictionsCreated += 1;
            }
          });
        } catch (error) {
          errors.push(
            `Conversation ${conversationIndex + 1} message ${importedMessage.id}: contradiction detection failed (${toErrorMessage(
              error
            )})`
          );
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
