import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { PrismaClient } from "@prisma/client";

import { analyzeBehavioralEligibility } from "./behavioral-filter";
import { createDerivationArtifact } from "./derivation-layer";
import type { LlmLfComparisonInput } from "./eval/eval-types";
import { INNER_CRITIC_MARKERS } from "./inner-critic-adapter";
import { TRIGGER_MARKERS } from "./trigger-condition-detector";

export const PATTERN_LLM_LF_PROMPT_VERSION = "pattern-llm-lf-v1";
export const PATTERN_LLM_LF_DEFAULT_MODEL = "gpt-4o-mini";
export const PATTERN_LLM_LF_MAX_INPUTS_PER_RUN = 24;
export const PATTERN_LLM_LF_SUPPORTED_FAMILIES = [
  "trigger_condition",
  "inner_critic",
] as const;

export type PatternLlmLfFamily =
  (typeof PATTERN_LLM_LF_SUPPORTED_FAMILIES)[number];

export type PatternLlmLfLabel = PatternLlmLfFamily | "abstain";

export type PatternLlmLfParseStatus =
  | "parsed"
  | "malformed_json"
  | "schema_invalid"
  | "request_failed";

export type PatternLlmLfInputUnit = {
  inputUnitId: string;
  messageId: string;
  sessionId: string;
  text: string;
  createdAt: Date;
  heuristicVotes: {
    trigger_condition: boolean;
    inner_critic: boolean;
  };
};

export type PatternLlmLfStoredResult = {
  promptVersion: string;
  modelId: string;
  inputUnitId: string;
  messageId: string;
  sessionId: string;
  label: PatternLlmLfLabel;
  rationale: string;
  confidence: number | null;
  abstain: boolean;
  parseStatus: PatternLlmLfParseStatus;
  parseError: string | null;
  rawOutput: string | null;
  heuristicVotes: PatternLlmLfInputUnit["heuristicVotes"];
  createdAt: string;
  usedForProductDecision: false;
  shadowMode: true;
};

export type PatternLlmLfInvoker = (args: {
  modelId: string;
  prompt: string;
  input: PatternLlmLfInputUnit;
}) => Promise<{ rawOutput: string }>;

export type StoredPatternLlmLfArtifact = {
  artifactId: string;
  result: PatternLlmLfStoredResult;
};

type PatternLlmLfArtifactPayload = PatternLlmLfStoredResult & {
  kind: "pattern_llm_labeling_function";
  lfVersion: string;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateForPrompt(text: string, maxChars = 550): string {
  const normalized = normalizeWhitespace(text);
  return normalized.length <= maxChars
    ? normalized
    : normalized.slice(0, maxChars - 1).trimEnd() + "…";
}

export function shouldRunPatternLlmLfShadow(): boolean {
  const flag = (process.env.MINDLAB_PATTERN_LLM_LF_SHADOW ?? "").toLowerCase();
  return (flag === "1" || flag === "true") && Boolean(process.env.OPENAI_API_KEY);
}

export function buildPatternLlmLfPrompt(input: PatternLlmLfInputUnit): string {
  return [
    "You are one labeling function in a weak-supervision system for behavioral text classification.",
    "Classify exactly one user-authored message.",
    "",
    "Allowed labels:",
    "- trigger_condition",
    "- inner_critic",
    "- abstain",
    "",
    "Use trigger_condition only for a clear first-person trigger/reaction pattern.",
    "Use inner_critic only for direct self-criticism, self-blame, self-dismissal, or self-doubt.",
    "Use abstain for ambiguity, weak evidence, generic discussion, assistant-directed talk, questions, or off-task content.",
    "",
    "Return strict JSON with these fields only:",
    '{"label":"trigger_condition|inner_critic|abstain","abstain":true|false,"confidence":0.0-1.0,"rationale":"short justification"}',
    "",
    "Do not include chain-of-thought.",
    "Do not include markdown fences.",
    "",
    `Message: ${JSON.stringify(truncateForPrompt(input.text))}`,
  ].join("\n");
}

function isValidLabel(value: unknown): value is PatternLlmLfLabel {
  return (
    value === "trigger_condition" ||
    value === "inner_critic" ||
    value === "abstain"
  );
}

function parseRawJsonObject(rawOutput: string): Record<string, unknown> | null {
  const trimmed = rawOutput.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function normalizeRationale(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized.slice(0, 240) : null;
}

export function parsePatternLlmLfOutput(args: {
  rawOutput: string;
  modelId: string;
  input: PatternLlmLfInputUnit;
  promptVersion?: string;
}): PatternLlmLfStoredResult {
  const createdAt = new Date().toISOString();
  const promptVersion = args.promptVersion ?? PATTERN_LLM_LF_PROMPT_VERSION;
  const base = {
    promptVersion,
    modelId: args.modelId,
    inputUnitId: args.input.inputUnitId,
    messageId: args.input.messageId,
    sessionId: args.input.sessionId,
    heuristicVotes: args.input.heuristicVotes,
    createdAt,
    usedForProductDecision: false as const,
    shadowMode: true as const,
  };

  const parsedObject = parseRawJsonObject(args.rawOutput);
  if (!parsedObject) {
    return {
      ...base,
      label: "abstain",
      rationale: "Malformed LLM LF output; shadow-mode abstain.",
      confidence: null,
      abstain: true,
      parseStatus: "malformed_json",
      parseError: "Could not parse JSON object from raw output.",
      rawOutput: args.rawOutput,
    };
  }

  const label = parsedObject["label"];
  const abstain = parsedObject["abstain"];
  const confidence = normalizeConfidence(parsedObject["confidence"]);
  const rationale = normalizeRationale(parsedObject["rationale"]);

  if (!isValidLabel(label) || typeof abstain !== "boolean" || rationale === null) {
    return {
      ...base,
      label: "abstain",
      rationale: "Invalid LLM LF schema; shadow-mode abstain.",
      confidence: null,
      abstain: true,
      parseStatus: "schema_invalid",
      parseError: "Required fields were missing or invalid.",
      rawOutput: args.rawOutput,
    };
  }

  const normalizedAbstain =
    abstain || label === "abstain" || confidence === null;
  const normalizedLabel: PatternLlmLfLabel = normalizedAbstain ? "abstain" : label;

  return {
    ...base,
    label: normalizedLabel,
    rationale,
    confidence,
    abstain: normalizedLabel === "abstain",
    parseStatus: "parsed",
    parseError: null,
    rawOutput: args.rawOutput,
  };
}

export function buildPatternLlmLfRequestFailure(args: {
  error: unknown;
  modelId: string;
  input: PatternLlmLfInputUnit;
  promptVersion?: string;
}): PatternLlmLfStoredResult {
  return {
    promptVersion: args.promptVersion ?? PATTERN_LLM_LF_PROMPT_VERSION,
    modelId: args.modelId,
    inputUnitId: args.input.inputUnitId,
    messageId: args.input.messageId,
    sessionId: args.input.sessionId,
    label: "abstain",
    rationale: "LLM LF request failed; shadow-mode abstain.",
    confidence: null,
    abstain: true,
    parseStatus: "request_failed",
    parseError: args.error instanceof Error ? args.error.message : String(args.error),
    rawOutput: null,
    heuristicVotes: args.input.heuristicVotes,
    createdAt: new Date().toISOString(),
    usedForProductDecision: false,
    shadowMode: true,
  };
}

export async function storePatternLlmLfResult(args: {
  userId: string;
  runId: string;
  result: PatternLlmLfStoredResult;
  db: PrismaClient;
}): Promise<string> {
  return createDerivationArtifact(
    {
      userId: args.userId,
      runId: args.runId,
      type: "pattern_signal",
      confidenceScore: args.result.confidence ?? undefined,
      payload: {
        kind: "pattern_llm_labeling_function",
        lfVersion: "shadow-v1",
        ...args.result,
      },
    },
    args.db
  );
}

export async function persistPatternLlmLfRequestFailure(args: {
  userId: string;
  runId: string;
  input: PatternLlmLfInputUnit;
  modelId: string;
  error: unknown;
  db: PrismaClient;
  promptVersion?: string;
}): Promise<StoredPatternLlmLfArtifact> {
  const result = buildPatternLlmLfRequestFailure(args);
  const artifactId = await storePatternLlmLfResult({
    userId: args.userId,
    runId: args.runId,
    result,
    db: args.db,
  });
  return { artifactId, result };
}

export function normalizePatternLlmLfArtifactPayload(
  payload: unknown
): LlmLfComparisonInput | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = payload as Partial<PatternLlmLfArtifactPayload>;
  if (value.kind !== "pattern_llm_labeling_function") return null;
  if (typeof value.inputUnitId !== "string" || value.inputUnitId.length === 0) return null;
  if (typeof value.modelId !== "string" || value.modelId.length === 0) return null;
  if (typeof value.promptVersion !== "string" || value.promptVersion.length === 0) return null;
  if (
    value.label !== "trigger_condition" &&
    value.label !== "inner_critic" &&
    value.label !== "abstain"
  ) {
    return null;
  }
  if (typeof value.rationale !== "string" || value.rationale.length === 0) return null;
  if (
    value.parseStatus !== "parsed" &&
    value.parseStatus !== "malformed_json" &&
    value.parseStatus !== "schema_invalid" &&
    value.parseStatus !== "request_failed"
  ) {
    return null;
  }
  if (typeof value.abstain !== "boolean") return null;
  if (typeof value.shadowMode !== "boolean") return null;
  if (typeof value.usedForProductDecision !== "boolean") return null;
  if (value.confidence !== null && typeof value.confidence !== "number") return null;

  return {
    entryId: value.inputUnitId,
    modelId: value.modelId,
    promptVersion: value.promptVersion,
    label: value.label,
    rationale: value.rationale,
    confidence: value.confidence ?? null,
    abstain: value.abstain,
    parseStatus: value.parseStatus,
    shadowMode: value.shadowMode,
    usedForProductDecision: value.usedForProductDecision,
    rawOutput: value.rawOutput ?? null,
    parseError: value.parseError ?? null,
  };
}

function computeHeuristicVotes(text: string) {
  return {
    trigger_condition: TRIGGER_MARKERS.some((pattern) => pattern.test(text)),
    inner_critic: INNER_CRITIC_MARKERS.some((pattern) => pattern.test(text)),
  };
}

export function selectPatternLlmLfInputUnits(
  messages: Array<{
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: Date;
  }>
): PatternLlmLfInputUnit[] {
  return messages
    .filter((message) => message.role === "user")
    .filter((message) => analyzeBehavioralEligibility(message.content).eligible)
    .map((message) => ({
      inputUnitId: message.id,
      messageId: message.id,
      sessionId: message.sessionId,
      text: message.content,
      createdAt: message.createdAt,
      heuristicVotes: computeHeuristicVotes(message.content),
    }))
    .slice(-PATTERN_LLM_LF_MAX_INPUTS_PER_RUN);
}

export async function defaultPatternLlmLfInvoker(args: {
  modelId: string;
  prompt: string;
}): Promise<{ rawOutput: string }> {
  const response = await generateText({
    model: openai(args.modelId),
    prompt: args.prompt,
    temperature: 0,
    maxOutputTokens: 140,
  });
  return { rawOutput: response.text };
}

export async function runPatternLlmLfShadowPass(args: {
  userId: string;
  runId: string;
  messageIds: string[];
  db: PrismaClient;
  modelId?: string;
  promptVersion?: string;
  invoker?: PatternLlmLfInvoker;
}): Promise<StoredPatternLlmLfArtifact[]> {
  const invoker = args.invoker;
  if (!invoker && !shouldRunPatternLlmLfShadow()) {
    return [];
  }

  const modelId =
    args.modelId ??
    process.env.MINDLAB_PATTERN_LLM_LF_MODEL ??
    PATTERN_LLM_LF_DEFAULT_MODEL;

  const messages = await args.db.message.findMany({
    where: {
      userId: args.userId,
      id: { in: args.messageIds },
    },
    select: {
      id: true,
      sessionId: true,
      role: true,
      content: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const inputs = selectPatternLlmLfInputUnits(messages);
  const stored: StoredPatternLlmLfArtifact[] = [];

  for (const input of inputs) {
    const prompt = buildPatternLlmLfPrompt(input);

    try {
      const raw = await (invoker ?? defaultPatternLlmLfInvoker)({
        modelId,
        prompt,
        input,
      });
      const result = parsePatternLlmLfOutput({
        rawOutput: raw.rawOutput,
        modelId,
        input,
        promptVersion: args.promptVersion,
      });
      const artifactId = await storePatternLlmLfResult({
        userId: args.userId,
        runId: args.runId,
        result,
        db: args.db,
      });
      stored.push({ artifactId, result });
    } catch (error) {
      stored.push(
        await persistPatternLlmLfRequestFailure({
          userId: args.userId,
          runId: args.runId,
          input,
          modelId,
          error,
          db: args.db,
          promptVersion: args.promptVersion,
        })
      );
    }
  }

  return stored;
}
