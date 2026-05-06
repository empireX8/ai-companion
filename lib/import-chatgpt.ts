import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

import { detectContradictions } from "./contradiction-detection";
import { materializeContradictions } from "./contradiction-materialization";
import {
  incrementReasonCodeCount,
  pushDiagnosticSample,
  type ImportRunDiagnostics,
} from "./import-diagnostics";
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

export type ImportHumanRelevanceReason =
  | "import_human_relevance_accepted"
  | "technical_or_terminal_noise"
  | "code_or_stacktrace_noise"
  | "project_handoff_noise"
  | "project_task_chatter"
  | "codex_workflow_chatter"
  | "low_context_technical_question"
  | "implementation_debug_chatter"
  | "tutorial_or_setup_chatter";

export type ImportHumanRelevanceResult = {
  eligible: boolean;
  reasons: ImportHumanRelevanceReason[];
};

const FIRST_PERSON_PATTERN = /\b(?:i|me|my|myself)\b/i;
const DURABLE_HUMAN_SIGNAL_PATTERNS = [
  /\b(?:i\s+feel\b|i\s+get\s+(?:frustrated|reactive|anxious|overwhelmed|stressed|upset|angry|sad)|i\s+lose\s+trust\b|i\s+value\b|important\s+to\s+me\b|matters\s+to\s+me\b|i\s+care\s+about\b|i\s+keep\s+\w+ing\b|i\s+tend\s+to\b|i\s+overcomplicat\w*\b|i\s+struggle\s+to\b|i\s+want\s+(?:the\s+)?(?:app|mindlab)\b.*\b(?:reveal|pattern|coherence|truth|insight|understand)\w*)/i,
  /\bi\s+need\s+(?:the\s+)?(?:work|process)\s+to\s+stay\s+sequential\b/i,
  /\bi\s+need\s+sequential\s+reasoning\b/i,
  /\botherwise\s+i\s+(?:cannot|can't)\s+(?:track|follow)\b/i,
  /\bi\s+need\s+control\s+and\s+visibility\b/i,
  /\bi\s+start\s+reacting\s+emotionally\b/i,
  /\bi\s+get\s+confused\s+when\s+tasks?\s+(?:are\s+)?mixed\b/i,
] as const;

const TERMINAL_OR_TECHNICAL_PATTERNS = [
  /(?:^|\n)\s*(?:\w+@[\w.-]+(?:[:~][^\n]*)?[$%#]|[$%#])\s*(?:pip3?|python3?|npm|npx|pnpm|yarn|git|docker|kubectl|brew|uv|poetry)\b/im,
  /\b(?:pip3?\s+install|npm\s+install|npx\s+\w+|pnpm\s+\w+|yarn\s+(?:add|install|run)|brew\s+install)\b/i,
  /(?:^|\n)\s*(?:collecting|installing|requirement already satisfied|successfully installed|added \d+ packages|audited \d+ packages|error:\s+command failed)\b/im,
  /\b(?:telegram|polling|getupdates|webhook|offset=\d+|status code\s*\d{3}|response payload|request id)\b/i,
  /\b(?:azure|msal|oauth|token|redirect_uri|callback|sign[- ]out|logout)\b/i,
] as const;

const CODE_OR_STACKTRACE_PATTERNS = [
  /```/,
  /\b(?:traceback \(most recent call last\)|typeerror|syntaxerror|referenceerror|prismaclient\w*error)\b/i,
  /(?:^|\n)\s*at\s+\S+/m,
  /(?:^|\n)\s*file\s+"[^"]+",\s+line\s+\d+/im,
  /\b(?:import\s+\{?|export\s+(?:default|const|function|class)|const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+\s*\(|class\s+\w+|interface\s+\w+|type\s+\w+\s*=|return\s+<|<nav\b|<\/nav>)\b/i,
  /(?:^|\n)\s*(?:src|app|lib|components|pages|api|prisma|node_modules)\/[^\s]+/m,
] as const;

const PROJECT_HANDOFF_SECTION_PATTERN =
  /(?:^|\n)\s*(?:context|goal|scope|constraints|implementation requirements|required tests|required final output|do not change|verification commands)\s*:/im;
const PROJECT_HANDOFF_INSTRUCTION_PATTERN =
  /\b(?:step\s+\d+[a-z]?\b|required tests?\b|required final output\b|verification commands\b|do not change\b)\b/i;
const PROJECT_HANDOFF_DIRECTIVE_PATTERN =
  /^(?:you are|act as|implement|build|fix|add|update|refactor|debug|ship)\b/i;
const PROJECT_ENGINEERING_TOKENS_PATTERN =
  /\b(?:typescript|javascript|tsx?|python|prisma|next(?:\.js)?|vite|api|schema|migration|repository|repo|pull request|commit|branch|frontend|backend|database|terminal|debug|build|deploy)\b/i;
const TECHNICAL_CONTEXT_TOKENS_PATTERN =
  /\b(?:terminal|finder|vector\s+store|retriever|chatopen\s*ai|chatopenai|form[-\s]?submit|code[-\s]?routing|route|routing|api|endpoint|middleware|schema|migration|db:seed|seed\.cjs|prisma|npm|npx|pnpm|yarn|package(?:\.json)?|build|deploy|debug(?:ging)?|repo|repository)\b/i;
const LOW_CONTEXT_QUESTION_LEAD_PATTERN =
  /^\s*(?:do\s+i\s+need\s+to|dont\s+i\s+need\s+to|don't\s+i\s+need\s+to|is\s+there\s+(?:an?|any)\b|should\s+i\b|can\s+i\b|how\s+do\s+i\b|what\s+do\s+i\s+need\s+to\b)\b/i;
const LOW_CONTEXT_TECHNICAL_QUESTION_PHRASE_PATTERN =
  /\b(?:intermediary|need\s+to\s+connect|need\s+to\s+do\s+this\s+first|turn\s+this\s+into\s+this)\b/i;
const PROJECT_TASK_CHATTER_PATTERN =
  /\b(?:it\s+looks\s+like\s+i\s+need\s+to|need\s+to\s+do\s+this\s+first|turn\s+this\s+into\s+this|implementation\s+planning|project\s+handoff|task\s+coordination|workflow\s+coordination)\b/i;
const CODEX_WORKFLOW_TOKENS_PATTERN = /\bcodex\b/i;
const CODEX_WORKFLOW_CHATTER_PATTERN =
  /\b(?:show\b.*\bresults?\b|needs?\s+to\s+do|do\s+half\s+of\s+this|handoff|workflow|prompt|execute|run)\b/i;
const IMPLEMENTATION_STATUS_PATTERN =
  /\b(?:is\s+complete|completed|hardened|wired\s+up|hooked\s+up|implemented|refactored)\b/i;
const IMPLEMENTATION_OBJECT_PATTERN =
  /\b(?:memory\s+governance|form[-\s]?submit|route|routing|api|schema|migration|retriever|vector\s+store|codex)\b/i;
const IMPLEMENTATION_DEBUG_PATTERN =
  /\b(?:debug(?:ging)?|failing|broken|not\s+working|error)\b/i;
const TUTORIAL_OR_SETUP_PATTERN =
  /\b(?:tutorial|walkthrough|step[-\s]?by[-\s]?step|follow(?:ing)?\s+(?:the\s+)?(?:tutorial|docs?)|setup|set\s+up|configuration|configure|install|seed|db:seed)\b/i;
const OPERATIONAL_TASK_VERBS_PATTERN =
  /\b(?:connect|wire|hook|turn|seed|install|configure|setup|set\s+up|build|ship|deploy|debug|fix|submit|route|run|execute|implement|refactor|harden)\b/i;

function isSourceCodeHeavy(text: string) {
  const lines = text.split("\n");
  const codeLikeLines = lines.filter((line) =>
    /[{}\[\];<>=]/.test(line) &&
    /\b(?:const|let|var|function|import|export|return|class|interface|type|if|for|while|async|await|<\w+)/i.test(
      line
    )
  ).length;

  if (codeLikeLines >= 2) {
    return true;
  }

  const symbolCount = (text.match(/[{}[\];<>]/g) ?? []).length;
  return symbolCount >= 20 && symbolCount / Math.max(text.length, 1) >= 0.07;
}

export function classifyImportHumanRelevance(content: string): ImportHumanRelevanceResult {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const hasFirstPerson = FIRST_PERSON_PATTERN.test(normalized);
  const hasDurableHumanSignal =
    hasFirstPerson &&
    DURABLE_HUMAN_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized));

  const technicalOrTerminalNoise = TERMINAL_OR_TECHNICAL_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
  const codeOrStacktraceNoise =
    CODE_OR_STACKTRACE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    isSourceCodeHeavy(normalized);
  const projectHandoffNoise =
    (PROJECT_HANDOFF_SECTION_PATTERN.test(normalized) ||
      PROJECT_HANDOFF_INSTRUCTION_PATTERN.test(normalized) ||
      PROJECT_HANDOFF_DIRECTIVE_PATTERN.test(normalized)) &&
    PROJECT_ENGINEERING_TOKENS_PATTERN.test(normalized);
  const lowContextTechnicalQuestion =
    (LOW_CONTEXT_QUESTION_LEAD_PATTERN.test(normalized) &&
      (TECHNICAL_CONTEXT_TOKENS_PATTERN.test(normalized) ||
        LOW_CONTEXT_TECHNICAL_QUESTION_PHRASE_PATTERN.test(normalized))) ||
    (normalized.endsWith("?") && TECHNICAL_CONTEXT_TOKENS_PATTERN.test(normalized));
  const codexWorkflowChatter =
    CODEX_WORKFLOW_TOKENS_PATTERN.test(normalized) &&
    (CODEX_WORKFLOW_CHATTER_PATTERN.test(normalized) ||
      OPERATIONAL_TASK_VERBS_PATTERN.test(normalized));
  const projectTaskChatter =
    PROJECT_TASK_CHATTER_PATTERN.test(normalized) ||
    (/\b(?:task|tasks|handoff|workflow)\b/i.test(normalized) &&
      OPERATIONAL_TASK_VERBS_PATTERN.test(normalized));
  const implementationDebugChatter =
    (IMPLEMENTATION_STATUS_PATTERN.test(normalized) &&
      IMPLEMENTATION_OBJECT_PATTERN.test(normalized)) ||
    (IMPLEMENTATION_DEBUG_PATTERN.test(normalized) &&
      TECHNICAL_CONTEXT_TOKENS_PATTERN.test(normalized));
  const tutorialOrSetupChatter =
    TUTORIAL_OR_SETUP_PATTERN.test(normalized) &&
    (TECHNICAL_CONTEXT_TOKENS_PATTERN.test(normalized) ||
      OPERATIONAL_TASK_VERBS_PATTERN.test(normalized));

  if (hasDurableHumanSignal && !technicalOrTerminalNoise && !codeOrStacktraceNoise) {
    return {
      eligible: true,
      reasons: ["import_human_relevance_accepted"],
    };
  }

  const rejectionReasons: ImportHumanRelevanceReason[] = [];
  if (technicalOrTerminalNoise) {
    rejectionReasons.push("technical_or_terminal_noise");
  }
  if (codeOrStacktraceNoise) {
    rejectionReasons.push("code_or_stacktrace_noise");
  }
  if (projectHandoffNoise) {
    rejectionReasons.push("project_handoff_noise");
  }
  if (projectTaskChatter) {
    rejectionReasons.push("project_task_chatter");
  }
  if (codexWorkflowChatter) {
    rejectionReasons.push("codex_workflow_chatter");
  }
  if (lowContextTechnicalQuestion) {
    rejectionReasons.push("low_context_technical_question");
  }
  if (implementationDebugChatter) {
    rejectionReasons.push("implementation_debug_chatter");
  }
  if (tutorialOrSetupChatter) {
    rejectionReasons.push("tutorial_or_setup_chatter");
  }

  if (rejectionReasons.length > 0) {
    return {
      eligible: false,
      reasons: rejectionReasons,
    };
  }

  return {
    eligible: true,
    reasons: ["import_human_relevance_accepted"],
  };
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
  diagnostics,
}: {
  userId: string;
  message: { id: string; content: string };
  sessionId: string;
  db: PrismaClient;
  refCache: ImportRefCache;
  diagnostics?: ImportRunDiagnostics;
}): Promise<boolean> {
  const intentType = detectReferenceIntentType(message.content);
  if (!intentType) {
    if (diagnostics) {
      diagnostics.referenceCandidatesRejected += 1;
    }
    if (diagnostics) {
      incrementReasonCodeCount(diagnostics, "reference_intent_not_detected");
      pushDiagnosticSample(diagnostics, "rejected", {
        reason: "reference_intent_not_detected",
        snippet: message.content,
        sessionId,
        messageId: message.id,
      });
    }
    return false;
  }

  if (intentType === "rule") {
    if (diagnostics) {
      diagnostics.referenceCandidatesRejected += 1;
    }
    if (diagnostics) {
      incrementReasonCodeCount(diagnostics, "reference_rule_intent_skipped");
      pushDiagnosticSample(diagnostics, "rejected", {
        reason: "reference_rule_intent_skipped",
        snippet: message.content,
        sessionId,
        messageId: message.id,
      });
    }
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
      if (diagnostics) {
        diagnostics.referenceCandidatesRejected += 1;
      }
      if (diagnostics) {
        incrementReasonCodeCount(diagnostics, "reference_dedup_overlap");
        pushDiagnosticSample(diagnostics, "rejected", {
          reason: "reference_dedup_overlap",
          snippet: statement,
          sessionId,
          messageId: message.id,
        });
      }
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

  if (diagnostics) {
    diagnostics.referenceCandidatesAccepted += 1;
  }
  if (diagnostics) {
    incrementReasonCodeCount(diagnostics, "accepted_reference_candidate");
    pushDiagnosticSample(diagnostics, "accepted", {
      reason: "accepted_reference_candidate",
      snippet: statement,
      sessionId,
      messageId: message.id,
    });
  }

  cached.push(statement);
  return true;
}

export async function importExtractedConversations({
  userId,
  conversations,
  importedSource = "chatgpt_export_json",
  db = prismadb,
  diagnostics,
}: {
  userId: string;
  conversations: ExtractedConversation[];
  importedSource?: string;
  db?: PrismaClient;
  diagnostics?: ImportRunDiagnostics;
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
          } else if (createdMessage.role === "user") {
            if (diagnostics) {
              diagnostics.userMessagesSkippedForLength += 1;
              incrementReasonCodeCount(diagnostics, "too_short");
              pushDiagnosticSample(diagnostics, "rejected", {
                reason: "too_short",
                snippet: createdMessage.content,
                sessionId: session.id,
                messageId: createdMessage.id,
              });
            }
          } else if (diagnostics) {
            incrementReasonCodeCount(diagnostics, "non_user_role");
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
        const relevance = classifyImportHumanRelevance(importedMessage.content);
        if (!relevance.eligible) {
          if (diagnostics) {
            incrementReasonCodeCount(diagnostics, "import_human_relevance_rejected");
            for (const reason of relevance.reasons) {
              incrementReasonCodeCount(diagnostics, reason);
            }
            pushDiagnosticSample(diagnostics, "rejected", {
              reason: "import_human_relevance_rejected",
              snippet: importedMessage.content,
              sessionId: created.sessionId,
              messageId: importedMessage.id,
            });
          }
          continue;
        }

        if (diagnostics) {
          incrementReasonCodeCount(diagnostics, "import_human_relevance_accepted");
          pushDiagnosticSample(diagnostics, "accepted", {
            reason: "import_human_relevance_accepted",
            snippet: importedMessage.content,
            sessionId: created.sessionId,
            messageId: importedMessage.id,
          });
          diagnostics.candidateMessagesConsideredForReferenceExtraction += 1;
        }
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
            diagnostics,
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
          if (diagnostics) {
            diagnostics.contradictionDetectionAttemptedCount += 1;
          }
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
          if (diagnostics && materialized.nodesCreated > 0) {
            diagnostics.contradictionEvidenceAcceptedCount += materialized.nodesCreated;
            incrementReasonCodeCount(
              diagnostics,
              "accepted_contradiction_evidence",
              materialized.nodesCreated
            );
            incrementReasonCodeCount(
              diagnostics,
              "candidate_contradiction_created",
              materialized.nodesCreated
            );
            pushDiagnosticSample(diagnostics, "accepted", {
              reason: "candidate_contradiction_created",
              snippet: importedMessage.content,
              sessionId: created.sessionId,
              messageId: importedMessage.id,
            });
          }
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
