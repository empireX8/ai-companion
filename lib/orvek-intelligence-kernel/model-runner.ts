/**
 * Provider-agnostic structured model-runner boundary (CEQR-001).
 *
 * Domain code depends on StructuredModelRunner only.
 * Concrete providers are injected by the caller via an adapter.
 */

import type { z } from "zod";

export type StructuredModelRunnerRequest = {
  /** Zod schema used for structured output (provider adapter maps to AI SDK Output.object). */
  schema: z.ZodType;
  system?: string;
  prompt: string;
  schemaName?: string;
  schemaDescription?: string;
  /** Optional abort / timeout signal supplied by the caller. */
  abortSignal?: AbortSignal;
};

export type StructuredModelRunnerSuccess = {
  ok: true;
  /** Structured object as returned by the runner; domain code re-validates with Zod. */
  object: unknown;
  providerId: string;
  modelId: string;
  rawText?: string | null;
};

export type StructuredModelRunnerFailure = {
  ok: false;
  errorCode: "model_execution_failed" | "model_timeout" | "unsupported";
  message: string;
  providerId: string | null;
  modelId: string | null;
};

export type StructuredModelRunnerResult =
  | StructuredModelRunnerSuccess
  | StructuredModelRunnerFailure;

/**
 * Injectable model runner. Implementations must not hard-code a model name
 * into the domain contract; the caller supplies provider/model identity.
 */
export interface StructuredModelRunner {
  runStructured(
    request: StructuredModelRunnerRequest,
  ): Promise<StructuredModelRunnerResult>;
}

export type LanguageModelLike = unknown;

export type AiSdkStructuredRunnerOptions = {
  /** Injected language model instance (provider-agnostic at this boundary). */
  model: LanguageModelLike;
  providerId: string;
  modelId: string;
  temperature?: number;
};

/**
 * Production adapter using the installed AI SDK (`generateText` + `Output.object`).
 * Unused by automated tests. Model is injected by the caller — no hard-coded name.
 */
export function createAiSdkStructuredModelRunner(
  options: AiSdkStructuredRunnerOptions,
): StructuredModelRunner {
  return {
    async runStructured(request) {
      try {
        const { generateText, Output } = await import("ai");

        if (request.abortSignal?.aborted) {
          return {
            ok: false,
            errorCode: "model_timeout",
            message: "Model run aborted before start.",
            providerId: options.providerId,
            modelId: options.modelId,
          };
        }

        const result = await generateText({
          model: options.model as Parameters<typeof generateText>[0]["model"],
          system: request.system,
          prompt: request.prompt,
          temperature: options.temperature ?? 0,
          abortSignal: request.abortSignal,
          output: Output.object({
            schema: request.schema,
            name: request.schemaName,
            description: request.schemaDescription,
          }),
        });

        if (result.output == null) {
          return {
            ok: false,
            errorCode: "model_execution_failed",
            message: "Model returned no structured output.",
            providerId: options.providerId,
            modelId: options.modelId,
          };
        }

        return {
          ok: true,
          object: result.output,
          providerId: options.providerId,
          modelId: options.modelId,
          rawText: result.text ?? null,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown model execution error";
        const timedOut =
          (error instanceof Error && error.name === "AbortError") ||
          /timeout|aborted/i.test(message);

        return {
          ok: false,
          errorCode: timedOut ? "model_timeout" : "model_execution_failed",
          message,
          providerId: options.providerId,
          modelId: options.modelId,
        };
      }
    },
  };
}
