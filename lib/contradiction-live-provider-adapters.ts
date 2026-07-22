/**
 * CEQR-011 — live OpenAI / AI-SDK adapters for contradiction adjudicator
 * and independent Objectivity Referee.
 *
 * Provider path is repository-sanctioned: `@ai-sdk/openai` +
 * `createAiSdkStructuredModelRunner`. Does not wire production ingestion.
 * Credentials are never logged or returned.
 */

import { z } from "zod";

import {
  abstentionTransportSchema,
  classifiedNonClearTransportSchema,
  clearContradictionTransportSchema,
} from "./orvek-intelligence-kernel/structured-output";
import {
  createAiSdkStructuredModelRunner,
  type StructuredModelRunner,
  type StructuredModelRunnerRequest,
  type StructuredModelRunnerResult,
} from "./orvek-intelligence-kernel/model-runner";
import {
  OBJECTIVITY_REFEREE_OUTCOMES,
  type ObjectivityReferee,
  type ObjectivityRefereeEvaluation,
  type ObjectivityRefereeInput,
} from "./orvek-intelligence-kernel/objectivity-referee";

export const CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV =
  "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF" as const;

export const CONTRADICTION_LIVE_PROVIDER_ID = "openai" as const;

export const CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL =
  "gpt-4o-mini" as const;
export const CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL =
  "gpt-4o-mini" as const;

/** Hard ceiling on total live provider calls for one proof invocation. */
export const CONTRADICTION_LIVE_MAX_TOTAL_CALLS = 8 as const;

/** Suggested per-case ceiling (adjudicator + referee). */
export const CONTRADICTION_LIVE_MAX_CALLS_PER_CASE = 2 as const;

export const CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS = 45_000 as const;

/** Live proof disables SDK retries so one runner invocation = one provider attempt. */
export const CONTRADICTION_LIVE_MAX_RETRIES = 0 as const;

export const OBJECTIVITY_REFEREE_LIVE_PROMPT_VERSION =
  "objectivity-referee-live-prompt-v1" as const;

/**
 * Live adjudicator system-addendum identity (CEQR-016 deterministic evidence
 * authority). Describes the addendum; must not be injected into the provider
 * prompt. Historical CEQR-011…015 receipts retain v1/v2 and must not be rewritten.
 */
export const CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION =
  "contradiction-live-adjudicator-prompt-addendum-v3" as const;

/** Historical identity used by CEQR-011 through CEQR-013 live runs. */
export const CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1 =
  "contradiction-live-adjudicator-prompt-addendum-v1" as const;

/** Historical identity used by CEQR-014 / CEQR-015 live evidence prompt repair. */
export const CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2 =
  "contradiction-live-adjudicator-prompt-addendum-v2" as const;

export type ContradictionLiveIndependenceLevel =
  | "separate_call_same_provider_same_model"
  | "separate_call_same_provider_different_model";

export type ContradictionLiveProviderConfig = {
  providerId: typeof CONTRADICTION_LIVE_PROVIDER_ID;
  adjudicatorModelId: string;
  refereeModelId: string;
  timeoutMs: number;
  /** Always 0 for CEQR-011 — retries cannot be enabled. */
  maxRetries: typeof CONTRADICTION_LIVE_MAX_RETRIES;
  maxTotalCalls: number;
  independenceLevel: ContradictionLiveIndependenceLevel;
  /** True when OPENAI_API_KEY is a non-empty string. Value never returned. */
  credentialsPresent: boolean;
};

export type ContradictionLiveProviderConfigFailure = {
  ok: false;
  errorCode:
    | "missing_credential"
    | "invalid_timeout"
    | "invalid_call_budget";
  message: string;
};

export type ContradictionLiveProviderConfigSuccess = {
  ok: true;
  config: ContradictionLiveProviderConfig;
};

export type ContradictionLiveAdapterBundle = {
  adjudicatorRunner: StructuredModelRunner;
  refereeRunner: StructuredModelRunner;
  objectivityReferee: ObjectivityReferee;
  providerId: typeof CONTRADICTION_LIVE_PROVIDER_ID;
  adjudicatorModelId: string;
  refereeModelId: string;
  independenceLevel: ContradictionLiveIndependenceLevel;
  /** Native AI SDK timeout applied to both roles. */
  timeoutMs: number;
  /** Always 0 — one runner invocation equals one provider attempt. */
  maxRetries: typeof CONTRADICTION_LIVE_MAX_RETRIES;
  /**
   * True when maxRetries is 0, so callBudget totals are exact provider-attempt
   * counts (not merely runner invocations that could hide SDK retries).
   */
  providerAttemptCountExact: true;
  /**
   * Identity of the live system addendum applied by the adjudicator wrapper.
   * Not injected into the provider prompt text.
   */
  adjudicatorPromptAddendumVersion: typeof CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION;
  /** Shared call counter across both roles. */
  callBudget: LiveCallBudget;
};

export type LiveCallBudget = {
  adjudicatorCalls: () => number;
  refereeCalls: () => number;
  totalCalls: () => number;
  maxTotalCalls: number;
  remaining: () => number;
  recordAdjudicatorCall: () => void;
  recordRefereeCall: () => void;
};

export const objectivityRefereeModelResultSchema = z.object({
  outcome: z.enum(OBJECTIVITY_REFEREE_OUTCOMES),
  rationale: z.string().min(1),
  adjustedConfidence: z.number().min(0).max(1).optional(),
  routedObjectType: z.string().min(1).optional(),
});

/**
 * OpenAI structured-output envelope key (CEQR-018).
 *
 * OpenAI strict JSON Schema forbids root-level `anyOf`/`oneOf`. The
 * classification-discriminated transport union is nested under this single
 * required property so the provider-facing schema remains a root object with
 * nested `anyOf` (and `const: false` on clear_contradiction flags).
 */
export const CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY = "adjudication" as const;

function withOpenAiRequiredNullableProposedObjectType<
  T extends z.ZodObject<z.ZodRawShape>,
>(schema: T) {
  return schema.omit({ proposedObjectType: true }).extend({
    proposedObjectType: z.string().nullable(),
  });
}

/**
 * Flat OpenAI-strict transport union (CEQR-018).
 * Emits JSON Schema `anyOf` with clear_contradiction flags as `const: false`.
 * Not used as the root schema — see contradictionModelResultOpenAiStrictSchema.
 */
export const contradictionModelTransportOpenAiStrictUnionSchema = z.union([
  withOpenAiRequiredNullableProposedObjectType(clearContradictionTransportSchema),
  withOpenAiRequiredNullableProposedObjectType(classifiedNonClearTransportSchema),
  withOpenAiRequiredNullableProposedObjectType(abstentionTransportSchema),
]);

/**
 * OpenAI structured-output transport schema (CEQR-018).
 *
 * Root object + nested `adjudication` anyOf — OpenAI-compatible expression of
 * the classification-discriminated transport contract. Domain evidence claims
 * remain assembled after deterministic binding. The live OpenAI runner wrapper
 * unwraps `adjudication` before returning to the adjudicator so transport/domain
 * parsers continue to see the flat transport object.
 */
export const contradictionModelResultOpenAiStrictSchema = z.object({
  [CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY]:
    contradictionModelTransportOpenAiStrictUnionSchema,
});

export const objectivityRefereeModelResultOpenAiStrictSchema = z.object({
  outcome: z.enum(OBJECTIVITY_REFEREE_OUTCOMES),
  rationale: z.string().min(1),
  adjustedConfidence: z.number().min(0).max(1).nullable(),
  routedObjectType: z.string().nullable(),
});

export type ObjectivityRefereeModelResult = z.infer<
  typeof objectivityRefereeModelResultSchema
>;

export type ContradictionOpenAiStrictEnvelope = z.infer<
  typeof contradictionModelResultOpenAiStrictSchema
>;

/**
 * Unwrap the OpenAI-strict envelope to the flat transport object.
 *
 * - If the OpenAI envelope key is present, return its payload (null if missing).
 * - Otherwise return the value unchanged so injected/test runners and
 *   fail-closed malformed objects still reach adjudicator parse.
 */
export function unwrapContradictionOpenAiStrictEnvelope(
  value: unknown,
): unknown | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY in record) {
    const nested = record[CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY];
    return nested === undefined ? null : nested;
  }
  return value;
}

/**
 * Map OpenAI strict nullable fields back to the landed optional evaluation shape.
 */
export function normalizeObjectivityRefereeProviderObject(
  value: unknown,
): unknown {
  if (value == null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {
    outcome: record.outcome,
    rationale: record.rationale,
  };
  if (
    record.adjustedConfidence !== undefined &&
    record.adjustedConfidence !== null
  ) {
    next.adjustedConfidence = record.adjustedConfidence;
  }
  if (
    record.routedObjectType !== undefined &&
    record.routedObjectType !== null &&
    typeof record.routedObjectType === "string" &&
    record.routedObjectType.trim().length > 0
  ) {
    next.routedObjectType = record.routedObjectType;
  }
  return next;
}

/**
 * Substitute OpenAI-strict transport schemas without changing domain contracts.
 * For the adjudicator, unwraps the OpenAI envelope so callers continue to
 * receive the flat transport object (the nested wire object is not mutated).
 */
export function wrapRunnerWithOpenAiStrictSchemas(
  runner: StructuredModelRunner,
  role: "adjudicator" | "referee",
): StructuredModelRunner {
  return {
    async runStructured(request) {
      const schema =
        role === "adjudicator"
          ? contradictionModelResultOpenAiStrictSchema
          : objectivityRefereeModelResultOpenAiStrictSchema;
      const result = await runner.runStructured({
        ...request,
        schema,
      });
      if (!result.ok || role !== "adjudicator") {
        return result;
      }
      const unwrapped = unwrapContradictionOpenAiStrictEnvelope(result.object);
      if (unwrapped == null) {
        return {
          ok: false,
          errorCode: "model_execution_failed",
          message:
            "OpenAI-strict adjudicator envelope missing adjudication payload.",
          providerId: result.providerId,
          modelId: result.modelId,
        };
      }
      return {
        ...result,
        object: unwrapped,
      };
    },
  };
}

/**
 * CEQR-016 live evidence addendum v3 (structural companion to deterministic binding).
 * Instructs the model to author offsets only. Does not alter provider output
 * after generation. sourceId / exactQuote are code-owned in the adjudicator.
 */
const LIVE_ADJUDICATOR_EVIDENCE_ADDENDUM = [
  "",
  "LIVE PROVIDER EVIDENCE HARD RULES (CEQR-016 / addendum-v3):",
  "EVIDENCE TRANSPORT AUTHORITY:",
  "- evidenceClaimA and evidenceClaimB MUST contain ONLY startOffset and endOffset.",
  "- Do NOT author sourceId.",
  "- Do NOT author exactQuote.",
  "- Deterministic code copies sourceId from the authoritative Side A / Side B units.",
  "- Deterministic code derives exactQuote as sourceText.slice(startOffset, endOffset).",
  "- Side A offsets apply only to Side A sourceText; Side B offsets apply only to Side B sourceText.",
  "- Never swap Side A and Side B ordering.",
  "",
  "OFFSETS:",
  "- startOffset/endOffset are zero-based, start inclusive, end exclusive.",
  "- endOffset MUST be greater than startOffset.",
  "- endOffset MUST NOT exceed the corresponding decoded sourceText length.",
  "- Invalid, reversed, negative, non-integer, or out-of-range offsets fail closed.",
  "- Do not rely on clamping, fuzzy matching, substring search, or full-source fallback.",
  "",
  "- qualifications must be a non-empty string; use the literal \"none\" when there are no material qualifiers.",
  "- Never invent wording that does not appear in the sourceText.",
  "",
  "LIVE PROVIDER CONSISTENCY HARD RULES:",
  "- If classification is clear_contradiction, then bothCanSimultaneouslyBeTrue, changedBeliefOverTime, intentionVersusOutcome, and goalVersusObstacle MUST all be false.",
  "- Do not mark changedBeliefOverTime merely because one side mentions a past event; require explicit belief-revision language.",
  "- If the propositions cannot both be true under matching actor/subject/timeframe/scope after preserving qualifiers, choose clear_contradiction with the consistency flags above all false.",
  "- If timeframe/scope qualifiers make both true, choose compatible_states instead of clear_contradiction.",
].join("\n");

/**
 * Live-adjudicator prompt wrapper only.
 * Appends evidence/consistency instructions; returns the provider result object
 * unchanged. Deterministic binding in the adjudicator owns sourceId/exactQuote.
 */
export function wrapAdjudicatorRunnerForLiveEvidence(
  runner: StructuredModelRunner,
): StructuredModelRunner {
  return {
    async runStructured(request) {
      const system = [request.system ?? "", LIVE_ADJUDICATOR_EVIDENCE_ADDENDUM]
        .filter((part) => part.length > 0)
        .join("\n");
      return runner.runStructured({
        ...request,
        system,
      });
    },
  };
}

const SECRET_ENV_NAME_PATTERN =
  /(API_KEY|SECRET|TOKEN|PASSWORD|AUTHORIZATION|CREDENTIAL|PRIVATE_KEY)/i;

/**
 * True only for explicit opt-in values "1" or "true" (case-insensitive).
 */
export function isLiveContradictionProviderProofOptedIn(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV];
  if (typeof raw !== "string") return false;
  const normalised = raw.trim().toLowerCase();
  return normalised === "1" || normalised === "true";
}

export function openaiApiKeyPresent(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const key = env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function resolveModelId(
  envValue: string | undefined,
  fallback: string,
): string {
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return fallback;
}

function resolveTimeoutMs(
  env: Record<string, string | undefined>,
): number | null {
  const raw = env.CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS;
  if (raw == null || raw.trim() === "") {
    return CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 120_000) {
    return null;
  }
  return Math.floor(parsed);
}

function resolveMaxTotalCalls(
  env: Record<string, string | undefined>,
): number | null {
  const raw = env.CONTRADICTION_LIVE_MAX_TOTAL_CALLS;
  if (raw == null || raw.trim() === "") {
    return CONTRADICTION_LIVE_MAX_TOTAL_CALLS;
  }
  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed < 1 ||
    parsed > CONTRADICTION_LIVE_MAX_TOTAL_CALLS
  ) {
    return null;
  }
  return Math.floor(parsed);
}

export function resolveContradictionLiveProviderConfig(
  env: Record<string, string | undefined> = process.env,
): ContradictionLiveProviderConfigSuccess | ContradictionLiveProviderConfigFailure {
  if (!openaiApiKeyPresent(env)) {
    return {
      ok: false,
      errorCode: "missing_credential",
      message:
        "OPENAI_API_KEY is absent or empty; live provider execution cannot start.",
    };
  }

  const timeoutMs = resolveTimeoutMs(env);
  if (timeoutMs == null) {
    return {
      ok: false,
      errorCode: "invalid_timeout",
      message:
        "CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS must be a finite positive number ≤ 120000.",
    };
  }

  const maxTotalCalls = resolveMaxTotalCalls(env);
  if (maxTotalCalls == null) {
    return {
      ok: false,
      errorCode: "invalid_call_budget",
      message: `CONTRADICTION_LIVE_MAX_TOTAL_CALLS must be an integer in [1, ${CONTRADICTION_LIVE_MAX_TOTAL_CALLS}].`,
    };
  }

  const adjudicatorModelId = resolveModelId(
    env.CONTRADICTION_LIVE_ADJUDICATOR_MODEL,
    CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
  );
  const refereeModelId = resolveModelId(
    env.CONTRADICTION_LIVE_REFEREE_MODEL,
    CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
  );

  const independenceLevel: ContradictionLiveIndependenceLevel =
    adjudicatorModelId === refereeModelId
      ? "separate_call_same_provider_same_model"
      : "separate_call_same_provider_different_model";

  return {
    ok: true,
    config: {
      providerId: CONTRADICTION_LIVE_PROVIDER_ID,
      adjudicatorModelId,
      refereeModelId,
      timeoutMs,
      maxRetries: CONTRADICTION_LIVE_MAX_RETRIES,
      maxTotalCalls,
      independenceLevel,
      credentialsPresent: true,
    },
  };
}

/**
 * Redact secret-bearing env keys and credential-shaped substrings from receipt text.
 * Never returns raw credential values.
 */
export function redactSecretsForReceipt(
  value: unknown,
  env: Record<string, string | undefined> = process.env,
): unknown {
  const secretValues = new Set<string>();
  for (const [name, raw] of Object.entries(env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(name)) continue;
    if (typeof raw === "string" && raw.trim().length > 0) {
      secretValues.add(raw.trim());
    }
  }

  const scrubString = (input: string): string => {
    let out = input;
    for (const secret of secretValues) {
      if (secret.length >= 8) {
        out = out.split(secret).join("[REDACTED]");
      }
    }
    out = out.replace(
      /\b(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/g,
      "[REDACTED]",
    );
    return out;
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return scrubString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node != null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(record)) {
        if (SECRET_ENV_NAME_PATTERN.test(key)) {
          next[key] = "[REDACTED]";
          continue;
        }
        next[key] = walk(child);
      }
      return next;
    }
    return node;
  };

  return walk(value);
}

export function createLiveCallBudget(maxTotalCalls: number): LiveCallBudget {
  let adjudicatorCalls = 0;
  let refereeCalls = 0;

  return {
    adjudicatorCalls: () => adjudicatorCalls,
    refereeCalls: () => refereeCalls,
    totalCalls: () => adjudicatorCalls + refereeCalls,
    maxTotalCalls,
    remaining: () =>
      Math.max(0, maxTotalCalls - (adjudicatorCalls + refereeCalls)),
    recordAdjudicatorCall() {
      adjudicatorCalls += 1;
    },
    recordRefereeCall() {
      refereeCalls += 1;
    },
  };
}

export function wrapRunnerWithCallBudget(args: {
  runner: StructuredModelRunner;
  budget: LiveCallBudget;
  role: "adjudicator" | "referee";
}): StructuredModelRunner {
  return {
    async runStructured(request) {
      if (args.budget.totalCalls() >= args.budget.maxTotalCalls) {
        return {
          ok: false,
          errorCode: "model_execution_failed",
          message: `Live call budget exhausted (max ${args.budget.maxTotalCalls} total provider calls).`,
          providerId: CONTRADICTION_LIVE_PROVIDER_ID,
          modelId: null,
        };
      }
      if (args.role === "adjudicator") {
        args.budget.recordAdjudicatorCall();
      } else {
        args.budget.recordRefereeCall();
      }
      return args.runner.runStructured(request);
    },
  };
}

export function mergeAbortSignals(
  primary: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onPrimaryAbort = () => {
    controller.abort();
  };
  if (primary) {
    if (primary.aborted) {
      controller.abort();
    } else {
      primary.addEventListener("abort", onPrimaryAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (primary) {
        primary.removeEventListener("abort", onPrimaryAbort);
      }
    },
  };
}

export function wrapRunnerWithTimeout(args: {
  runner: StructuredModelRunner;
  timeoutMs: number;
}): StructuredModelRunner {
  return {
    async runStructured(request) {
      const { signal, cleanup } = mergeAbortSignals(
        request.abortSignal,
        args.timeoutMs,
      );
      try {
        return await args.runner.runStructured({
          ...request,
          abortSignal: signal,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown model execution error";
        const timedOut =
          (error instanceof Error && error.name === "AbortError") ||
          signal.aborted ||
          /timeout|aborted/i.test(message);
        return {
          ok: false,
          errorCode: timedOut ? "model_timeout" : "model_execution_failed",
          message,
          providerId: CONTRADICTION_LIVE_PROVIDER_ID,
          modelId: null,
        };
      } finally {
        cleanup();
      }
    },
  };
}

/**
 * Build Objectivity Referee system/user prompts from the landed referee input.
 * Separate contract from the contradiction adjudicator prompt.
 */
export function buildObjectivityRefereeLivePrompt(
  input: ObjectivityRefereeInput,
): { system: string; prompt: string } {
  const system = [
    "You are the independent Objectivity Referee for MindLab contradiction proposals.",
    `Prompt version: ${OBJECTIVITY_REFEREE_LIVE_PROMPT_VERSION}`,
    "You do not adjudicate Side A vs Side B from scratch.",
    "You receive a proposed ContradictionNode semantic result that already passed deterministic validation.",
    "Your job: independently judge whether the proposal may continue to a later persistence gate.",
    "You never authorise persistence. PASS only means continuation to a later gate may be considered.",
    "",
    "Authorised outcomes exactly one of:",
    "- PASS",
    "- PASS_WITH_LOWER_CONFIDENCE (requires adjustedConfidence strictly lower than proposed confidence)",
    "- ROUTE_TO_DIFFERENT_OBJECT_TYPE (requires routedObjectType different from ContradictionNode)",
    "- REQUEST_MORE_EVIDENCE",
    "- ABSTAIN",
    "",
    "Fail closed on insufficient evidence, unresolved qualifiers, temporal mismatch, or overclaim.",
    "Return structured JSON only matching the schema.",
  ].join("\n");

  const prompt = [
    `proposedObjectType: ${input.proposedObjectType}`,
    `confidence: ${input.confidence}`,
    `evidenceSummary: ${input.evidenceSummary}`,
    `alternativeInterpretation: ${input.alternativeInterpretation}`,
    `qualificationContext: ${input.qualificationContext}`,
    `validationWarnings: ${JSON.stringify(input.validationWarnings)}`,
    `validatedSemanticResult: ${JSON.stringify(input.validatedSemanticResult)}`,
    "",
    "Evaluate objectivity and return outcome + rationale.",
  ].join("\n");

  return { system, prompt };
}

/**
 * ObjectivityReferee backed by an injected StructuredModelRunner.
 * Separate runner instance from the adjudicator is required by the caller.
 */
export function createStructuredModelObjectivityReferee(args: {
  modelRunner: StructuredModelRunner;
}): ObjectivityReferee {
  return {
    async evaluate(input) {
      const { system, prompt } = buildObjectivityRefereeLivePrompt(input);
      const result = await args.modelRunner.runStructured({
        schema: objectivityRefereeModelResultSchema,
        system,
        prompt,
        schemaName: "ObjectivityRefereeEvaluation",
        schemaDescription:
          "Independent Objectivity Referee evaluation for a proposed ContradictionNode.",
      });

      if (!result.ok) {
        throw new Error(
          `objectivity_referee_model_${result.errorCode}: ${result.message}`,
        );
      }

      const normalised = normalizeObjectivityRefereeProviderObject(result.object);
      const parsed = objectivityRefereeModelResultSchema.safeParse(normalised);
      if (!parsed.success) {
        throw new Error(
          `objectivity_referee_malformed_output: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }

      const evaluation: ObjectivityRefereeEvaluation = {
        outcome: parsed.data.outcome,
        rationale: parsed.data.rationale,
      };
      if (parsed.data.adjustedConfidence !== undefined) {
        evaluation.adjustedConfidence = parsed.data.adjustedConfidence;
      }
      if (parsed.data.routedObjectType !== undefined) {
        evaluation.routedObjectType = parsed.data.routedObjectType;
      }
      return evaluation;
    },
  };
}

export type CreateOpenAiLiveAdapterArgs = {
  adjudicatorModelId: string;
  refereeModelId: string;
  timeoutMs: number;
  maxTotalCalls: number;
  /**
   * Optional injectables for deterministic tests.
   * Production/live path constructs real OpenAI language models.
   */
  createLanguageModel?: (
    modelId: string,
  ) => unknown | Promise<unknown>;
  createRunner?: (args: {
    model: unknown;
    providerId: string;
    modelId: string;
    maxRetries: typeof CONTRADICTION_LIVE_MAX_RETRIES;
    timeoutMs: number;
  }) => StructuredModelRunner;
};

/**
 * Construct separate adjudicator and referee runners plus referee adapter.
 * Uses `@ai-sdk/openai` by default. Never exposes the raw API key.
 *
 * Both roles always receive maxRetries: 0 and the configured native timeoutMs
 * so the shared call budget equals exact provider attempts.
 */
export async function createOpenAiContradictionLiveAdapters(
  args: CreateOpenAiLiveAdapterArgs,
): Promise<ContradictionLiveAdapterBundle> {
  const createLanguageModel =
    args.createLanguageModel ??
    (async (modelId: string) => {
      const { openai } = await import("@ai-sdk/openai");
      return openai(modelId);
    });

  const createRunner =
    args.createRunner ??
    ((opts: {
      model: unknown;
      providerId: string;
      modelId: string;
      maxRetries: typeof CONTRADICTION_LIVE_MAX_RETRIES;
      timeoutMs: number;
    }) =>
      createAiSdkStructuredModelRunner({
        model: opts.model,
        providerId: opts.providerId,
        modelId: opts.modelId,
        temperature: 0,
        maxRetries: opts.maxRetries,
        timeoutMs: opts.timeoutMs,
      }));

  const adjudicatorModel = await Promise.resolve(
    createLanguageModel(args.adjudicatorModelId),
  );
  const refereeModel = await Promise.resolve(
    createLanguageModel(args.refereeModelId),
  );

  // Separate runner instances even when model ids match.
  const baseAdjudicator = createRunner({
    model: adjudicatorModel,
    providerId: CONTRADICTION_LIVE_PROVIDER_ID,
    modelId: args.adjudicatorModelId,
    maxRetries: CONTRADICTION_LIVE_MAX_RETRIES,
    timeoutMs: args.timeoutMs,
  });
  const baseReferee = createRunner({
    model: refereeModel,
    providerId: CONTRADICTION_LIVE_PROVIDER_ID,
    modelId: args.refereeModelId,
    maxRetries: CONTRADICTION_LIVE_MAX_RETRIES,
    timeoutMs: args.timeoutMs,
  });

  const callBudget = createLiveCallBudget(args.maxTotalCalls);

  const adjudicatorRunner = wrapRunnerWithCallBudget({
    runner: wrapRunnerWithTimeout({
      runner: wrapAdjudicatorRunnerForLiveEvidence(
        wrapRunnerWithOpenAiStrictSchemas(baseAdjudicator, "adjudicator"),
      ),
      timeoutMs: args.timeoutMs,
    }),
    budget: callBudget,
    role: "adjudicator",
  });

  const refereeRunner = wrapRunnerWithCallBudget({
    runner: wrapRunnerWithTimeout({
      runner: wrapRunnerWithOpenAiStrictSchemas(baseReferee, "referee"),
      timeoutMs: args.timeoutMs,
    }),
    budget: callBudget,
    role: "referee",
  });

  const objectivityReferee = createStructuredModelObjectivityReferee({
    modelRunner: refereeRunner,
  });

  const independenceLevel: ContradictionLiveIndependenceLevel =
    args.adjudicatorModelId === args.refereeModelId
      ? "separate_call_same_provider_same_model"
      : "separate_call_same_provider_different_model";

  return {
    adjudicatorRunner,
    refereeRunner,
    objectivityReferee,
    providerId: CONTRADICTION_LIVE_PROVIDER_ID,
    adjudicatorModelId: args.adjudicatorModelId,
    refereeModelId: args.refereeModelId,
    independenceLevel,
    timeoutMs: args.timeoutMs,
    maxRetries: CONTRADICTION_LIVE_MAX_RETRIES,
    providerAttemptCountExact: true,
    adjudicatorPromptAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    callBudget,
  };
}

/** Test helper: inspect request construction without a network. */
export function buildAdjudicatorRunnerRequestProbe(
  request: StructuredModelRunnerRequest,
): {
  hasSchema: boolean;
  hasPrompt: boolean;
  schemaName: string | undefined;
  abortSignalPresent: boolean;
} {
  return {
    hasSchema: request.schema != null,
    hasPrompt: typeof request.prompt === "string" && request.prompt.length > 0,
    schemaName: request.schemaName,
    abortSignalPresent: request.abortSignal != null,
  };
}

export type { StructuredModelRunnerResult };
