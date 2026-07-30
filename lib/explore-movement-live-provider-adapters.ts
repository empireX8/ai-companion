/**
 * Explore movement live provider adapters (DEL-001B).
 *
 * Repository-sanctioned AI SDK / OpenAI structured model runner.
 * Does not import contradiction-specific prompts or transport schemas.
 * Production feature gate defaults OFF. Live provider calls during this task: 0.
 */

import { z } from "zod";

import { isCanonicalModelAuthorityEnabledForUser } from "./canonical-model-authority-flag";
import {
  EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY,
  EXPLORE_MOVEMENT_REFEREE_OUTCOMES,
  exploreMovementSemanticOpenAiStrictEnvelopeSchema,
  normalizeExploreMovementProviderObject,
  unwrapExploreMovementOpenAiStrictEnvelope,
} from "./explore-movement-semantic-contract";
import {
  createAiSdkStructuredModelRunner,
  type StructuredModelRunner,
  type StructuredModelRunnerRequest,
} from "./orvek-intelligence-kernel/model-runner";
import {
  type ObjectivityReferee,
  type ObjectivityRefereeEvaluation,
  type ObjectivityRefereeInput,
} from "./orvek-intelligence-kernel/objectivity-referee";

/** Local nullable→optional normalisation for referee OpenAI strict schema. */
function normalizeObjectivityRefereeProviderObject(value: unknown): unknown {
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

export const ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED_ENV =
  "ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED" as const;
export const ORVEK_EXPLORE_MOVEMENT_ADJUDICATOR_MODEL_ENV =
  "ORVEK_EXPLORE_MOVEMENT_ADJUDICATOR_MODEL" as const;
export const ORVEK_EXPLORE_MOVEMENT_REFEREE_MODEL_ENV =
  "ORVEK_EXPLORE_MOVEMENT_REFEREE_MODEL" as const;
export const ORVEK_EXPLORE_MOVEMENT_PROVIDER_TIMEOUT_MS_ENV =
  "ORVEK_EXPLORE_MOVEMENT_PROVIDER_TIMEOUT_MS" as const;

export const EXPLORE_MOVEMENT_PROVIDER_ID = "openai" as const;
export const EXPLORE_MOVEMENT_DEFAULT_ADJUDICATOR_MODEL =
  "gpt-4o-mini" as const;
export const EXPLORE_MOVEMENT_DEFAULT_REFEREE_MODEL = "gpt-4o-mini" as const;

/** Hard budget per eligible Explore reply: adjudicator + referee. */
export const EXPLORE_MOVEMENT_MAX_ADJUDICATOR_CALLS = 1 as const;
export const EXPLORE_MOVEMENT_MAX_REFEREE_CALLS = 1 as const;
export const EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS = 2 as const;
export const EXPLORE_MOVEMENT_MAX_RETRIES = 0 as const;
export const EXPLORE_MOVEMENT_DEFAULT_TIMEOUT_MS = 45_000 as const;

export const EXPLORE_MOVEMENT_ADJUDICATOR_PROMPT_VERSION =
  "explore-movement-adjudicator-prompt-v1" as const;
export const EXPLORE_MOVEMENT_REFEREE_PROMPT_VERSION =
  "explore-movement-referee-prompt-v1" as const;

export type ExploreMovementCallBudget = {
  adjudicatorCalls: () => number;
  refereeCalls: () => number;
  totalCalls: () => number;
  maxTotalCalls: number;
  remaining: () => number;
  recordAdjudicatorCall: () => void;
  recordRefereeCall: () => void;
};

export type ExploreMovementProviderConfig = {
  providerId: typeof EXPLORE_MOVEMENT_PROVIDER_ID;
  adjudicatorModelId: string;
  refereeModelId: string;
  timeoutMs: number;
  maxRetries: typeof EXPLORE_MOVEMENT_MAX_RETRIES;
  maxTotalCalls: typeof EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS;
  credentialsPresent: boolean;
};

export type ExploreMovementProviderConfigFailure = {
  ok: false;
  errorCode:
    | "feature_disabled"
    | "missing_credential"
    | "invalid_timeout"
    | "invalid_call_budget";
  message: string;
};

export type ExploreMovementProviderConfigSuccess = {
  ok: true;
  config: ExploreMovementProviderConfig;
};

export type ExploreMovementAdapterBundle = {
  adjudicatorRunner: StructuredModelRunner;
  refereeRunner: StructuredModelRunner;
  objectivityReferee: ObjectivityReferee;
  providerId: typeof EXPLORE_MOVEMENT_PROVIDER_ID;
  adjudicatorModelId: string;
  refereeModelId: string;
  timeoutMs: number;
  maxRetries: typeof EXPLORE_MOVEMENT_MAX_RETRIES;
  providerAttemptCountExact: true;
  callBudget: ExploreMovementCallBudget;
};

export const objectivityRefereeExploreModelResultSchema = z.object({
  outcome: z.enum(EXPLORE_MOVEMENT_REFEREE_OUTCOMES),
  rationale: z.string().min(1),
  adjustedConfidence: z.number().min(0).max(1).optional(),
  routedObjectType: z.string().min(1).optional(),
});

export const objectivityRefereeExploreModelResultOpenAiStrictSchema = z.object({
  outcome: z.enum(EXPLORE_MOVEMENT_REFEREE_OUTCOMES),
  rationale: z.string().min(1),
  adjustedConfidence: z.number().min(0).max(1).nullable(),
  routedObjectType: z.string().nullable(),
});

/**
 * Production feature gate defaults OFF.
 * Enabled only for explicit "1" or "true" (case-insensitive).
 */
export function isExploreMovementSemanticEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env[ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED_ENV];
  if (typeof raw !== "string") return false;
  const normalised = raw.trim().toLowerCase();
  return normalised === "1" || normalised === "true";
}

/**
 * Live Explore semantic adjudication runs when the global semantic flag is on,
 * or when Canonical Model Authority V1 is enabled for this exact user.
 * Gate-off / non-allowlisted users keep the previous fail-closed default.
 */
export function isExploreMovementSemanticEnabledForUser(
  userId: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (isExploreMovementSemanticEnabled(env)) {
    return true;
  }

  // Lazy import path avoided: keep this module free of circular deps by
  // accepting the canonical gate check via a tiny local re-export surface.
  return isCanonicalModelAuthorityEnabledForUser(userId, env);
}

export function openaiApiKeyPresent(
  env: Record<string, string | undefined> = process.env
): boolean {
  const key = env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function resolveModelId(envValue: string | undefined, fallback: string): string {
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return fallback;
}

function resolveTimeoutMs(
  env: Record<string, string | undefined>
): number | null {
  const raw = env[ORVEK_EXPLORE_MOVEMENT_PROVIDER_TIMEOUT_MS_ENV];
  if (raw == null || raw.trim() === "") {
    return EXPLORE_MOVEMENT_DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 120_000) {
    return null;
  }
  return Math.floor(parsed);
}

/**
 * Resolve provider config only when the feature gate is on and credentials exist.
 * Does not construct runners.
 *
 * `forceEnabled` is used after a caller already decided semantic movement should
 * run (global flag or canonical allowlisted user).
 */
export function resolveExploreMovementProviderConfig(
  env: Record<string, string | undefined> = process.env,
  options?: { forceEnabled?: boolean },
): ExploreMovementProviderConfigSuccess | ExploreMovementProviderConfigFailure {
  if (!options?.forceEnabled && !isExploreMovementSemanticEnabled(env)) {
    return {
      ok: false,
      errorCode: "feature_disabled",
      message:
        "ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED is off; Explore semantic movement providers are not constructed.",
    };
  }

  if (!openaiApiKeyPresent(env)) {
    return {
      ok: false,
      errorCode: "missing_credential",
      message:
        "OPENAI_API_KEY is absent or empty; Explore movement semantic providers cannot start.",
    };
  }

  const timeoutMs = resolveTimeoutMs(env);
  if (timeoutMs == null) {
    return {
      ok: false,
      errorCode: "invalid_timeout",
      message:
        "ORVEK_EXPLORE_MOVEMENT_PROVIDER_TIMEOUT_MS must be a finite positive number ≤ 120000.",
    };
  }

  return {
    ok: true,
    config: {
      providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
      adjudicatorModelId: resolveModelId(
        env[ORVEK_EXPLORE_MOVEMENT_ADJUDICATOR_MODEL_ENV],
        EXPLORE_MOVEMENT_DEFAULT_ADJUDICATOR_MODEL
      ),
      refereeModelId: resolveModelId(
        env[ORVEK_EXPLORE_MOVEMENT_REFEREE_MODEL_ENV],
        EXPLORE_MOVEMENT_DEFAULT_REFEREE_MODEL
      ),
      timeoutMs,
      maxRetries: EXPLORE_MOVEMENT_MAX_RETRIES,
      maxTotalCalls: EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS,
      credentialsPresent: true,
    },
  };
}

export function createExploreMovementCallBudget(
  maxTotalCalls: number = EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS
): ExploreMovementCallBudget {
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

export function wrapExploreRunnerWithCallBudget(args: {
  runner: StructuredModelRunner;
  budget: ExploreMovementCallBudget;
  role: "adjudicator" | "referee";
}): StructuredModelRunner {
  return {
    async runStructured(request) {
      if (args.budget.totalCalls() >= args.budget.maxTotalCalls) {
        return {
          ok: false,
          errorCode: "model_execution_failed",
          message: `Explore movement call budget exhausted (max ${args.budget.maxTotalCalls} total provider attempts).`,
          providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
          modelId: null,
        };
      }
      if (args.role === "adjudicator") {
        if (args.budget.adjudicatorCalls() >= EXPLORE_MOVEMENT_MAX_ADJUDICATOR_CALLS) {
          return {
            ok: false,
            errorCode: "model_execution_failed",
            message: "Explore movement adjudicator call budget exhausted.",
            providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
            modelId: null,
          };
        }
        args.budget.recordAdjudicatorCall();
      } else {
        if (args.budget.refereeCalls() >= EXPLORE_MOVEMENT_MAX_REFEREE_CALLS) {
          return {
            ok: false,
            errorCode: "model_execution_failed",
            message: "Explore movement referee call budget exhausted.",
            providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
            modelId: null,
          };
        }
        args.budget.recordRefereeCall();
      }
      return args.runner.runStructured(request);
    },
  };
}

function mergeAbortSignals(
  primary: AbortSignal | undefined,
  timeoutMs: number
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

export function wrapExploreRunnerWithTimeout(args: {
  runner: StructuredModelRunner;
  timeoutMs: number;
}): StructuredModelRunner {
  return {
    async runStructured(request) {
      const { signal, cleanup } = mergeAbortSignals(
        request.abortSignal,
        args.timeoutMs
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
          providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
          modelId: null,
        };
      } finally {
        cleanup();
      }
    },
  };
}

/**
 * Substitute OpenAI-strict schemas. Adjudicator unwraps envelope before return.
 */
export function wrapExploreRunnerWithOpenAiStrictSchemas(
  runner: StructuredModelRunner,
  role: "adjudicator" | "referee"
): StructuredModelRunner {
  return {
    async runStructured(request) {
      const schema =
        role === "adjudicator"
          ? exploreMovementSemanticOpenAiStrictEnvelopeSchema
          : objectivityRefereeExploreModelResultOpenAiStrictSchema;
      const result = await runner.runStructured({
        ...request,
        schema,
      });
      if (!result.ok) return result;
      if (role === "adjudicator") {
        const unwrapped = unwrapExploreMovementOpenAiStrictEnvelope(result.object);
        if (unwrapped == null) {
          return {
            ok: false,
            errorCode: "model_execution_failed",
            message: `OpenAI-strict Explore adjudicator envelope missing ${EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY} payload.`,
            providerId: result.providerId,
            modelId: result.modelId,
          };
        }
        return {
          ...result,
          object: normalizeExploreMovementProviderObject({
            [EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY]: unwrapped,
          }),
        };
      }
      return {
        ...result,
        object: normalizeObjectivityRefereeProviderObject(result.object),
      };
    },
  };
}

export function buildExploreMovementRefereePrompt(
  input: ObjectivityRefereeInput
): { system: string; prompt: string } {
  const system = [
    "You are the independent Objectivity Referee for MindLab Explore movement proposals.",
    `Prompt version: ${EXPLORE_MOVEMENT_REFEREE_PROMPT_VERSION}`,
    "You do not re-adjudicate the conversation from scratch.",
    "You receive a proposed UserMapConclusion strengthening that already passed deterministic validation.",
    "Your job: independently judge whether the proposal may continue to a later persistence gate.",
    "You never authorise persistence. PASS only means continuation to a later gate may be considered.",
    "",
    "Authorised outcomes exactly one of:",
    "- PASS",
    "- PASS_WITH_LOWER_CONFIDENCE (requires adjustedConfidence strictly lower than proposed confidence)",
    "- ROUTE_TO_DIFFERENT_OBJECT_TYPE (requires routedObjectType different from UserMapConclusion)",
    "- REQUEST_MORE_EVIDENCE",
    "- ABSTAIN",
    "",
    "Fail closed on insufficient evidence, subject replacement, or overclaim.",
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

export function createExploreMovementObjectivityReferee(args: {
  modelRunner: StructuredModelRunner;
}): ObjectivityReferee {
  return {
    async evaluate(input) {
      const { system, prompt } = buildExploreMovementRefereePrompt(input);
      const result = await args.modelRunner.runStructured({
        schema: objectivityRefereeExploreModelResultSchema,
        system,
        prompt,
        schemaName: "ExploreMovementObjectivityRefereeEvaluation",
        schemaDescription:
          "Independent Objectivity Referee evaluation for a proposed UserMapConclusion strengthening.",
      });

      if (!result.ok) {
        throw new Error(
          `explore_movement_referee_model_${result.errorCode}: ${result.message}`
        );
      }

      const normalised = normalizeObjectivityRefereeProviderObject(result.object);
      const parsed =
        objectivityRefereeExploreModelResultSchema.safeParse(normalised);
      if (!parsed.success) {
        throw new Error(
          `explore_movement_referee_malformed_output: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
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

export type CreateExploreMovementAdapterArgs = {
  adjudicatorModelId: string;
  refereeModelId: string;
  timeoutMs: number;
  maxTotalCalls?: number;
  createLanguageModel?: (modelId: string) => unknown | Promise<unknown>;
  createRunner?: (args: {
    model: unknown;
    providerId: string;
    modelId: string;
    maxRetries: typeof EXPLORE_MOVEMENT_MAX_RETRIES;
    timeoutMs: number;
  }) => StructuredModelRunner;
};

/**
 * Construct separate adjudicator and referee runners.
 * Call only when feature gate is on and credentials are present.
 * Never logs API keys, prompts with user evidence, or full provider responses.
 */
export async function createExploreMovementLiveAdapters(
  args: CreateExploreMovementAdapterArgs
): Promise<ExploreMovementAdapterBundle> {
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
      maxRetries: typeof EXPLORE_MOVEMENT_MAX_RETRIES;
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
    createLanguageModel(args.adjudicatorModelId)
  );
  const refereeModel = await Promise.resolve(
    createLanguageModel(args.refereeModelId)
  );

  const baseAdjudicator = createRunner({
    model: adjudicatorModel,
    providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
    modelId: args.adjudicatorModelId,
    maxRetries: EXPLORE_MOVEMENT_MAX_RETRIES,
    timeoutMs: args.timeoutMs,
  });
  const baseReferee = createRunner({
    model: refereeModel,
    providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
    modelId: args.refereeModelId,
    maxRetries: EXPLORE_MOVEMENT_MAX_RETRIES,
    timeoutMs: args.timeoutMs,
  });

  const callBudget = createExploreMovementCallBudget(
    args.maxTotalCalls ?? EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS
  );

  const adjudicatorRunner = wrapExploreRunnerWithCallBudget({
    runner: wrapExploreRunnerWithTimeout({
      runner: wrapExploreRunnerWithOpenAiStrictSchemas(
        baseAdjudicator,
        "adjudicator"
      ),
      timeoutMs: args.timeoutMs,
    }),
    budget: callBudget,
    role: "adjudicator",
  });

  const refereeRunner = wrapExploreRunnerWithCallBudget({
    runner: wrapExploreRunnerWithTimeout({
      runner: wrapExploreRunnerWithOpenAiStrictSchemas(baseReferee, "referee"),
      timeoutMs: args.timeoutMs,
    }),
    budget: callBudget,
    role: "referee",
  });

  return {
    adjudicatorRunner,
    refereeRunner,
    objectivityReferee: createExploreMovementObjectivityReferee({
      modelRunner: refereeRunner,
    }),
    providerId: EXPLORE_MOVEMENT_PROVIDER_ID,
    adjudicatorModelId: args.adjudicatorModelId,
    refereeModelId: args.refereeModelId,
    timeoutMs: args.timeoutMs,
    maxRetries: EXPLORE_MOVEMENT_MAX_RETRIES,
    providerAttemptCountExact: true,
    callBudget,
  };
}

/** Test helper: inspect request construction without a network. */
export function buildExploreAdjudicatorRunnerRequestProbe(
  request: StructuredModelRunnerRequest
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
