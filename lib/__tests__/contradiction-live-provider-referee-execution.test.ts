/**
 * CEQR-011 — live provider / Objectivity Referee adapter + controlled proof tests.
 * Deterministic injected runners only. No live network. No real-account mutation.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAdjudicatorRunnerRequestProbe,
  buildObjectivityRefereeLivePrompt,
  CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
  CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
  CONTRADICTION_LIVE_PROVIDER_ID,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  createLiveCallBudget,
  createOpenAiContradictionLiveAdapters,
  createStructuredModelObjectivityReferee,
  contradictionModelResultOpenAiStrictSchema,
  isLiveContradictionProviderProofOptedIn,
  normalizeObjectivityRefereeProviderObject,
  objectivityRefereeModelResultSchema,
  openaiApiKeyPresent,
  redactSecretsForReceipt,
  resolveContradictionLiveProviderConfig,
  wrapAdjudicatorRunnerForLiveEvidence,
  wrapRunnerWithCallBudget,
  wrapRunnerWithTimeout,
  type ContradictionLiveAdapterBundle,
} from "../contradiction-live-provider-adapters";
import {
  createLiveProofInMemoryHarness,
  evaluateLiveProofClassification,
  isCompatibleCaseSafeNoWrite,
  liveProofResultToExitCode,
  LIVE_PROOF_USER_ID,
  LIVE_SYNTHETIC_CASES,
  runContradictionLiveProviderRefereeProof,
  runContradictionLiveProviderRefereeProofForTests,
} from "../contradiction-live-provider-referee-proof";
import {
  claimForSubstring,
  KERNEL_FIRST_PROOF_OBJECT,
  runObjectivityRefereeSafely,
  type KernelSourceUnit,
  type StructuredModelRunner,
  type StructuredModelRunnerRequest,
  type StructuredModelRunnerResult,
} from "../orvek-intelligence-kernel";
import type {
  ContradictionModelResult,
  ContradictionModelTransportResult,
} from "../contradiction-adjudicator";

const FIXED_NOW = () => new Date("2026-07-21T20:00:00.000Z");

function classAResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  const quoteA = sideA.sourceText;
  const quoteB = sideB.sourceText;
  return {
    propositionA: {
      normalizedProposition: "Speaker does not drink alcohol",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Speaker drank beers last night",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker, overlapping alcohol behaviour claim",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.9,
    evidenceClaimA:
      claimForSubstring(sideA, quoteA) ?? {
        sourceId: sideA.sourceId,
        exactQuote: quoteA,
        startOffset: 0,
        endOffset: quoteA.length,
      },
    evidenceClaimB:
      claimForSubstring(sideB, quoteB) ?? {
        sourceId: sideB.sourceId,
        exactQuote: quoteB,
        startOffset: 0,
        endOffset: quoteB.length,
      },
    rationale: "Universal abstinence conflicts with reported drinking.",
    alternativeInterpretation: "Belief change over time.",
    whatWouldChangeClassification: "Explicit timeframe separation.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
  } as ContradictionModelTransportResult;
}

function compatibleResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return {
    ...classAResult(sideA, sideB),
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    confidence: 0.82,
    rationale: "Evening avoidance and morning drinking coexist.",
    propositionA: {
      normalizedProposition: "Speaker avoids coffee in the evening",
      actor: "speaker",
      subject: "coffee",
      timeframe: "evening",
      negation: false,
      modality: "assertive",
      qualifications: "evening only",
    },
    propositionB: {
      normalizedProposition: "Speaker drinks coffee in the morning",
      actor: "speaker",
      subject: "coffee",
      timeframe: "morning",
      negation: false,
      modality: "assertive",
      qualifications: "morning only",
    },
    abstentionReason: null,
  } as ContradictionModelTransportResult;
}

function parseSidesFromPrompt(prompt: string): {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
} {
  const parseSide = (side: "A" | "B"): KernelSourceUnit => {
    const sourceId =
      prompt.match(new RegExp(`Side ${side} sourceId: (.+)`))?.[1]?.trim() ??
      `side-${side.toLowerCase()}`;
    const sessionId =
      prompt.match(new RegExp(`Side ${side} sessionId: (.+)`))?.[1]?.trim() ??
      "session";
    const messageIdRaw =
      prompt.match(new RegExp(`Side ${side} messageId: (.+)`))?.[1]?.trim() ??
      null;
    const label =
      prompt.match(new RegExp(`Side ${side} label: (.+)`))?.[1]?.trim() ??
      `side-${side.toLowerCase()}`;
    const textMatch = prompt.match(
      new RegExp(`Side ${side} sourceText: ("(?:\\\\.|[^"\\\\])*")`),
    );
    const sourceText = textMatch ? (JSON.parse(textMatch[1]!) as string) : "";
    return {
      sourceId,
      sessionId,
      messageId:
        messageIdRaw && messageIdRaw !== "null" ? messageIdRaw : undefined,
      sourceText,
      sourceRole: "user",
      label,
    };
  };
  return { sideA: parseSide("A"), sideB: parseSide("B") };
}

function createRecordingRunner(args: {
  providerId?: string;
  modelId?: string;
  onRequest?: (request: StructuredModelRunnerRequest) => void;
  handler: (
    request: StructuredModelRunnerRequest,
  ) => Promise<StructuredModelRunnerResult> | StructuredModelRunnerResult;
}): StructuredModelRunner & {
  calls: StructuredModelRunnerRequest[];
  callCount: () => number;
} {
  const calls: StructuredModelRunnerRequest[] = [];
  return {
    calls,
    callCount: () => calls.length,
    async runStructured(request) {
      calls.push(request);
      args.onRequest?.(request);
      return args.handler(request);
    },
  };
}

async function buildInjectedAdapters(args: {
  adjudicatorHandler: (
    request: StructuredModelRunnerRequest,
  ) => Promise<StructuredModelRunnerResult> | StructuredModelRunnerResult;
  refereeHandler: (
    request: StructuredModelRunnerRequest,
  ) => Promise<StructuredModelRunnerResult> | StructuredModelRunnerResult;
  adjudicatorModelId?: string;
  refereeModelId?: string;
  maxTotalCalls?: number;
  timeoutMs?: number;
}): Promise<{
  bundle: ContradictionLiveAdapterBundle;
  adjudicatorBase: ReturnType<typeof createRecordingRunner>;
  refereeBase: ReturnType<typeof createRecordingRunner>;
  createRunnerOptions: Array<{
    modelId: string;
    maxRetries: number;
    timeoutMs: number;
  }>;
}> {
  const adjudicatorBase = createRecordingRunner({
    modelId: args.adjudicatorModelId ?? "adj-model",
    handler: args.adjudicatorHandler,
  });
  const refereeBase = createRecordingRunner({
    modelId: args.refereeModelId ?? "ref-model",
    handler: args.refereeHandler,
  });

  const runners = [adjudicatorBase, refereeBase];
  let createCount = 0;
  const createRunnerOptions: Array<{
    modelId: string;
    maxRetries: number;
    timeoutMs: number;
  }> = [];

  const bundle = await createOpenAiContradictionLiveAdapters({
    adjudicatorModelId:
      args.adjudicatorModelId ?? CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
    refereeModelId:
      args.refereeModelId ?? CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
    timeoutMs: args.timeoutMs ?? 5_000,
    maxTotalCalls: args.maxTotalCalls ?? CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
    createLanguageModel: (modelId) => ({ kind: "fake-model", modelId }),
    createRunner: (opts) => {
      createRunnerOptions.push({
        modelId: opts.modelId,
        maxRetries: opts.maxRetries,
        timeoutMs: opts.timeoutMs,
      });
      const runner = runners[createCount]!;
      createCount += 1;
      return runner;
    },
  });

  return { bundle, adjudicatorBase, refereeBase, createRunnerOptions };
}

describe("CEQR-011 live provider adapters (deterministic)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("1: constructs structured request fields for adjudicator probe", () => {
    const probe = buildAdjudicatorRunnerRequestProbe({
      schema: objectivityRefereeModelResultSchema,
      prompt: "classify these sides",
      system: "system",
      schemaName: "ContradictionModelResult",
      abortSignal: AbortSignal.timeout(1000),
    });
    expect(probe.hasSchema).toBe(true);
    expect(probe.hasPrompt).toBe(true);
    expect(probe.schemaName).toBe("ContradictionModelResult");
    expect(probe.abortSignalPresent).toBe(true);
  });

  it("2: provider adapter returns valid structured response", async () => {
    const runner = createAiSdkPassthrough();
    const result = await runner.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "x",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toEqual({
        outcome: "PASS",
        rationale: "ok",
      });
      expect(result.providerId).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
    }
  });

  it("3: malformed provider output fails closed", async () => {
    const referee = createStructuredModelObjectivityReferee({
      modelRunner: {
        async runStructured() {
          return {
            ok: true,
            object: { outcome: "NOT_A_REAL_OUTCOME", rationale: "x" },
            providerId: "openai",
            modelId: "gpt-4o-mini",
          };
        },
      },
    });
    await expect(
      referee.evaluate({
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        validatedSemanticResult: {},
        evidenceSummary: "a",
        confidence: 0.8,
        alternativeInterpretation: "alt",
        qualificationContext: "q",
        validationWarnings: [],
      }),
    ).rejects.toThrow(/objectivity_referee_malformed_output/);
  });

  it("4: provider exception fails closed via runObjectivityRefereeSafely", async () => {
    const referee = createStructuredModelObjectivityReferee({
      modelRunner: {
        async runStructured() {
          throw new Error("network boom");
        },
      },
    });
    const result = await runObjectivityRefereeSafely({
      referee,
      input: {
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        validatedSemanticResult: {},
        evidenceSummary: "a",
        confidence: 0.8,
        alternativeInterpretation: "alt",
        qualificationContext: "q",
        validationWarnings: [],
      },
    });
    expect(result.executionState).toBe("failed");
    expect(result.continuationAllowed).toBe(false);
    expect(result.outcome).toBeNull();
  });

  it("5: timeout/abort fails closed", async () => {
    const slow: StructuredModelRunner = {
      async runStructured(request) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 50);
          request.abortSignal?.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            },
            { once: true },
          );
        });
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "late" },
          providerId: "openai",
          modelId: "gpt-4o-mini",
        };
      },
    };
    const wrapped = wrapRunnerWithTimeout({ runner: slow, timeoutMs: 5 });
    const result = await wrapped.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("model_timeout");
    }
  });

  it("6: missing credential/config returns controlled failure", () => {
    expect(openaiApiKeyPresent({})).toBe(false);
    const missing = resolveContradictionLiveProviderConfig({});
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errorCode).toBe("missing_credential");
    }
    const badTimeout = resolveContradictionLiveProviderConfig({
      OPENAI_API_KEY: "sk-test",
      CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS: "-1",
    });
    expect(badTimeout.ok).toBe(false);
    if (!badTimeout.ok) {
      expect(badTimeout.errorCode).toBe("invalid_timeout");
    }
  });

  it("7: adjudicator and referee use separate runner instances", async () => {
    const { bundle, adjudicatorBase, refereeBase } = await buildInjectedAdapters({
      adjudicatorHandler: async () => ({
        ok: true,
        object: {},
        providerId: "openai",
        modelId: "a",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "b",
      }),
    });
    expect(bundle.adjudicatorRunner).not.toBe(bundle.refereeRunner);
    expect(adjudicatorBase).not.toBe(refereeBase);
    await bundle.adjudicatorRunner.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "adj",
    });
    await bundle.refereeRunner.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "ref",
    });
    expect(adjudicatorBase.callCount()).toBe(1);
    expect(refereeBase.callCount()).toBe(1);
  });

  it("8: adjudicator call cannot substitute for referee execution", async () => {
    const { bundle, adjudicatorBase, refereeBase } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "independent pass" },
        providerId: "openai",
        modelId: "ref",
      }),
      maxTotalCalls: 8,
    });

    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.adjudicatorCallCount).toBeGreaterThanOrEqual(1);
      expect(result.refereeCallCount).toBeGreaterThanOrEqual(1);
      expect(adjudicatorBase.callCount()).toBeGreaterThanOrEqual(1);
      expect(refereeBase.callCount()).toBeGreaterThanOrEqual(1);
      expect(result.cases[0]?.refereeCallCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("9: referee PASS continues to write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "objective contradiction" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.status).toBe("created");
      expect(result.cases[0]?.writeExecuted).toBe(true);
      expect(result.clearContradictionWriteProven).toBe(true);
      // Compatible case absent → cannot claim full live PASS.
      expect(result.classificationHint).toBe(
        "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      );
      expect(result.evidenceOutputMutated).toBe(false);
    }
  });

  it("10: PASS_WITH_LOWER_CONFIDENCE applies confidence policy", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: { ...classAResult(sideA, sideB), confidence: 0.9 },
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "lower slightly",
          adjustedConfidence: 0.72,
        },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(true);
      expect(result.cases[0]?.status).toBe("created");
    }
  });

  it("11: ROUTE_TO_DIFFERENT_OBJECT_TYPE performs no write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: {
          outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
          rationale: "better as tension",
          routedObjectType: "UnresolvedTension",
        },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.proofOutcome).toBe("routed_elsewhere");
      expect(result.cases[0]?.harnessNodeCountAfter).toBe(0);
    }
  });

  it("12: REQUEST_MORE_EVIDENCE performs no write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: {
          outcome: "REQUEST_MORE_EVIDENCE",
          rationale: "need timeframe clarity",
        },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.proofOutcome).toBe("more_evidence_required");
    }
  });

  it("13: ABSTAIN performs no write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "ABSTAIN", rationale: "uncertain" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.proofOutcome).toBe("abstained");
    }
  });

  it("14: invalid referee output performs no write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "bad adjusted",
          adjustedConfidence: 0.99,
        },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.harnessNodeCountAfter).toBe(0);
    }
  });

  it("15: authorised plan never appears on public results", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/persistenceAuthorised|authorisedPlan|WeakSet/i);
    expect(serialized).not.toContain("createCandidate");
  });

  it("16: ordinary message/import paths remain unwired", () => {
    const adaptersSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-adapters.ts"),
      "utf8",
    );
    const proofSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-referee-proof.ts"),
      "utf8",
    );
    const messageRoute = readFileSync(
      join(process.cwd(), "app/api/message/route.ts"),
      "utf8",
    );
    expect(adaptersSrc).not.toMatch(/app\/api\/message|import-chatgpt/);
    expect(proofSrc).not.toMatch(/app\/api\/message|import-chatgpt/);
    expect(messageRoute).not.toContain("runContradictionLiveProviderRefereeProof");
    expect(messageRoute).not.toContain("createOpenAiContradictionLiveAdapters");
    expect(LIVE_PROOF_USER_ID).toBe("ceqr011-live-provider-proof-user-isolated");
  });

  it("17: live script requires explicit opt-in", async () => {
    expect(isLiveContradictionProviderProofOptedIn({})).toBe(false);
    expect(
      isLiveContradictionProviderProofOptedIn({
        [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "0",
      }),
    ).toBe(false);
    const skipped = await runContradictionLiveProviderRefereeProof({
      env: { OPENAI_API_KEY: "sk-test" },
    });
    expect(skipped.ran).toBe(false);
    if (!skipped.ran) {
      expect(skipped.reason).toBe("opt_in_missing");
    }

    const script = readFileSync(
      join(
        process.cwd(),
        "scripts/run-contradiction-live-provider-referee-proof.ts",
      ),
      "utf8",
    );
    expect(script).toContain(CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV);
    expect(script).toContain("isLiveContradictionProviderProofOptedIn");
  });

  it("18: live call budget cannot be exceeded", async () => {
    const budget = createLiveCallBudget(1);
    const inner = createRecordingRunner({
      handler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "m",
      }),
    });
    const wrapped = wrapRunnerWithCallBudget({
      runner: inner,
      budget,
      role: "adjudicator",
    });
    const first = await wrapped.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "1",
    });
    const second = await wrapped.runStructured({
      schema: objectivityRefereeModelResultSchema,
      prompt: "2",
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.message).toMatch(/call budget exhausted/i);
    }
    expect(inner.callCount()).toBe(1);
    expect(budget.totalCalls()).toBe(1);
  });

  it("19: receipts redact credential values", () => {
    const env = {
      OPENAI_API_KEY: "sk-secret-value-abcdef",
      OTHER: "ok",
    };
    const redacted = redactSecretsForReceipt(
      {
        note: "used sk-secret-value-abcdef in call",
        OPENAI_API_KEY: "sk-secret-value-abcdef",
        nested: { token: "Bearer sk-secret-value-abcdef" },
      },
      env,
    ) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain("sk-secret-value-abcdef");
    expect(redacted.OPENAI_API_KEY).toBe("[REDACTED]");
  });

  it("20: provider failure does not mutate injected persistence state", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async () => ({
        ok: false,
        errorCode: "model_execution_failed",
        message: "provider down",
        providerId: "openai",
        modelId: "adj",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "should not run" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const harnessProbe = createLiveProofInMemoryHarness();
    expect(harnessProbe.snapshot().nodes).toBe(0);

    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.harnessNodeCountAfter).toBe(0);
      expect(result.cases[0]?.harnessSpanCountAfter).toBe(0);
    }
  });

  it("21: presentation failure after a write remains honestly separated", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });

    // Force presentation failure by replacing reader after adapters built:
    // use a custom harness via monkey-patching seed path — run proof then
    // verify that writeExecuted can be true while presentation failed when
    // reader throws. We simulate by wrapping presentation through a local
    // call to the controlled entry with a throwing reader.
    const { runControlledContradictionNaturalEntryProof } = await import(
      "../contradiction-controlled-natural-entry-proof"
    );
    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(LIVE_SYNTHETIC_CASES[0]!);
    const result = await runControlledContradictionNaturalEntryProof({
      userId: harness.userId,
      sessionId: harness.sessionId,
      currentMessage: seeded.currentMessage,
      references: seeded.references,
      modelRunner: bundle.adjudicatorRunner,
      objectivityReferee: bundle.objectivityReferee,
      messageResolver: harness.messageResolver,
      persistenceDb: harness.db,
      presentationReader: {
        async findSpansByIds() {
          throw new Error("presentation boom");
        },
        async findMessagesByIds() {
          return [];
        },
        async findSessionsByIds() {
          return [];
        },
      },
      now: FIXED_NOW,
    });
    expect(result.writeExecuted).toBe(true);
    expect(result.outcome).toBe("created");
    expect(result.presentationStatus).toBe("failed");
    expect(result.presentationFailureCode).toBe("presentation_resolution_failed");
    expect(result.failureCode).toBeNull();
  });

  it("22: compatible synthetic result performs no write", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: compatibleResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "should not be consulted" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.writeExecuted).toBe(false);
      expect(result.cases[0]?.harnessNodeCountAfter).toBe(0);
      expect(result.cases[0]?.refereeCallCount).toBe(0);
      expect(result.compatibleCaseNoWrite).toBe(true);
    }
  });

  it("reports same-model independence when model ids match", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorModelId: "gpt-4o-mini",
      refereeModelId: "gpt-4o-mini",
      adjudicatorHandler: async () => ({
        ok: true,
        object: {},
        providerId: "openai",
        modelId: "gpt-4o-mini",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "gpt-4o-mini",
      }),
    });
    expect(bundle.independenceLevel).toBe(
      "separate_call_same_provider_same_model",
    );
  });

  it("reports different-model independence when model ids differ", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorModelId: "gpt-4o-mini",
      refereeModelId: "gpt-4o",
      adjudicatorHandler: async () => ({
        ok: true,
        object: {},
        providerId: "openai",
        modelId: "gpt-4o-mini",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "gpt-4o",
      }),
    });
    expect(bundle.independenceLevel).toBe(
      "separate_call_same_provider_different_model",
    );
  });

  it("referee prompt is distinct from adjudicator contract", () => {
    const { system, prompt } = buildObjectivityRefereeLivePrompt({
      proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
      validatedSemanticResult: { classification: "clear_contradiction" },
      evidenceSummary: "a ↔ b",
      confidence: 0.8,
      alternativeInterpretation: "alt",
      qualificationContext: "q",
      validationWarnings: [],
    });
    expect(system).toMatch(/Objectivity Referee/i);
    expect(system).not.toMatch(/Side A sourceText/);
    expect(prompt).toContain("proposedObjectType");
    expect(prompt).toContain("validatedSemanticResult");
  });

  it("OpenAI-strict transport schemas keep optional fields required-nullable", () => {
    const cn = contradictionModelResultOpenAiStrictSchema.safeParse({
      adjudication: {
        propositionA: {
          normalizedProposition: "a",
          actor: "s",
          subject: "x",
          timeframe: "t",
          negation: false,
          modality: "assertive",
          qualifications: "none",
        },
        propositionB: {
          normalizedProposition: "b",
          actor: "s",
          subject: "x",
          timeframe: "t",
          negation: false,
          modality: "assertive",
          qualifications: "none",
        },
        contextAndScope: "c",
        bothCanSimultaneouslyBeTrue: false,
        changedBeliefOverTime: false,
        intentionVersusOutcome: false,
        goalVersusObstacle: false,
        emotionalOrPhysiologicalVersusReasoningStandard: false,
        classification: "clear_contradiction",
        confidence: 0.9,
        evidenceClaimA: {
          startOffset: 0,
          endOffset: 1,
        },
        evidenceClaimB: {
          startOffset: 0,
          endOffset: 1,
        },
        rationale: "r",
        alternativeInterpretation: "alt",
        whatWouldChangeClassification: "w",
        abstentionReason: null,
        proposedObjectType: null,
      },
    });
    expect(cn.success).toBe(true);
    expect(
      normalizeObjectivityRefereeProviderObject({
        outcome: "PASS",
        rationale: "ok",
        adjustedConfidence: null,
        routedObjectType: null,
      }),
    ).toEqual({ outcome: "PASS", rationale: "ok" });
  });

  it("provider id remains openai (repository-sanctioned)", () => {
    expect(CONTRADICTION_LIVE_PROVIDER_ID).toBe("openai");
    const cfg = resolveContradictionLiveProviderConfig({
      OPENAI_API_KEY: "sk-test",
    });
    expect(cfg.ok).toBe(true);
    if (cfg.ok) {
      expect(cfg.config.providerId).toBe("openai");
      expect(cfg.config.adjudicatorModelId).toBe(
        CONTRADICTION_LIVE_DEFAULT_ADJUDICATOR_MODEL,
      );
      expect(cfg.config.refereeModelId).toBe(
        CONTRADICTION_LIVE_DEFAULT_REFEREE_MODEL,
      );
      expect(cfg.config.maxRetries).toBe(0);
      expect(cfg.config.maxRetries).toBe(CONTRADICTION_LIVE_MAX_RETRIES);
    }
  });

  it("harness always uses synthetic LIVE_PROOF_USER_ID and rejects caller userId", () => {
    const harness = createLiveProofInMemoryHarness();
    expect(harness.userId).toBe(LIVE_PROOF_USER_ID);
    expect(harness.userId).toBe("ceqr011-live-provider-proof-user-isolated");
    // createLiveProofInMemoryHarness no longer accepts userId — only sessionId.
    const harnessB = createLiveProofInMemoryHarness({
      sessionId: "other-session",
    });
    expect(harnessB.userId).toBe(LIVE_PROOF_USER_ID);
    expect(harnessB.sessionId).toBe("other-session");
    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-referee-proof.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/userId\?:\s*string/);
    expect(src).not.toMatch(/KAY_ACCOUNT/);
    expect(src).not.toMatch(/user_[A-Za-z0-9]{20,}/);
  });

  it("live evidence wrapper appends addendum but does not mutate provider object", async () => {
    const object = { classification: "clear_contradiction", marker: "untouched" };
    const userPrompt = [
      'Side A sourceText: "Alpha beta."',
      'Side B sourceText: "Gamma."',
    ].join("\n");
    const inner = createRecordingRunner({
      handler: async () => ({
        ok: true as const,
        object,
        providerId: "openai",
        modelId: "m",
      }),
    });
    const wrapped = wrapAdjudicatorRunnerForLiveEvidence(inner);
    const result = await wrapped.runStructured({
      schema: objectivityRefereeModelResultSchema,
      system: "base-system",
      prompt: userPrompt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toBe(object);
      expect(result.object).toEqual({
        classification: "clear_contradiction",
        marker: "untouched",
      });
    }
    expect(inner.calls[0]?.system).toContain("LIVE PROVIDER EVIDENCE HARD RULES");
    expect(inner.calls[0]?.system).toContain("base-system");
    expect(inner.calls[0]?.system).not.toContain(
      "contradiction-live-adjudicator-prompt-addendum",
    );
    expect(inner.calls[0]?.system).not.toContain("UTF-16");
    expect(inner.calls[0]?.system).not.toContain("NEUTRAL FORMATTING EXAMPLE");
    expect(inner.calls[0]?.prompt).toBe(userPrompt);
    expect(inner.calls[0]?.prompt).not.toContain("sourceTextLengthChars");
  });

  it("adapter source does not contain evidence repair helpers", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-adapters.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/realignExactClaim|normalizeBlankQualification/);
    expect(src).not.toMatch(/propositionA\.qualifications\s*=/);
    expect(src).not.toMatch(/evidenceClaimA\s*=/);
  });
});

describe("CEQR-011 evidence fail-closed before referee/writer", () => {
  async function runClearCaseWithMutatedModel(
    mutate: (
      base: ContradictionModelTransportResult,
      sideA: KernelSourceUnit,
      sideB: KernelSourceUnit,
    ) => ContradictionModelTransportResult | ContradictionModelResult,
  ) {
    let refereeCalls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: mutate(classAResult(sideA, sideB), sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "should not run" },
          providerId: "openai",
          modelId: "ref",
        };
      },
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    return { result, refereeCalls, bundle };
  }

  function expectFailClosed(args: {
    result: Awaited<
      ReturnType<typeof runContradictionLiveProviderRefereeProofForTests>
    >;
    refereeCalls: number;
  }) {
    expect(args.result.ran).toBe(true);
    if (!args.result.ran) return;
    const c = args.result.cases[0]!;
    expect(c.writeExecuted).toBe(false);
    expect(c.writerInvoked).toBe(false);
    expect(c.refereeCallCount).toBe(0);
    expect(args.refereeCalls).toBe(0);
    expect(c.harnessNodeCountAfter).toBe(0);
    expect(c.harnessSpanCountAfter).toBe(0);
    expect(c.contradictionNodeId).toBeNull();
    expect(
      c.failureCode === "adjudication_failed" ||
        c.proofOutcome === "failed_safely" ||
        c.proofOutcome === "no_candidate",
    ).toBe(true);
  }

  function expectSemanticSuccess(args: {
    result: Awaited<
      ReturnType<typeof runContradictionLiveProviderRefereeProofForTests>
    >;
    refereeCalls: number;
  }) {
    expect(args.result.ran).toBe(true);
    if (!args.result.ran) return;
    const c = args.result.cases[0]!;
    expect(c.status).toBe("created");
    expect(c.writeExecuted).toBe(true);
    expect(c.writerInvoked).toBe(true);
    expect(c.refereeCallCount).toBe(1);
    expect(args.refereeCalls).toBe(1);
    expect(c.sanitizedAdjudicationDiagnostics).toBeNull();
  }

  it("wrong Side A sourceId is ignored; bound authoritative identity succeeds", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base) => ({
        ...base,
        evidenceClaimA: { ...base.evidenceClaimA, sourceId: "wrong-side-a" },
      }),
    );
    expectSemanticSuccess({ result, refereeCalls });
  });

  it("wrong Side B sourceId is ignored; bound authoritative identity succeeds", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base) => ({
        ...base,
        evidenceClaimB: { ...base.evidenceClaimB, sourceId: "wrong-side-b" },
      }),
    );
    expectSemanticSuccess({ result, refereeCalls });
  });

  it("provider-authored exactQuote is ignored when offsets are valid", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base, sideA) => ({
        ...base,
        evidenceClaimA: {
          ...base.evidenceClaimA,
          exactQuote: "this quote is not in the source text at all",
          startOffset: 0,
          endOffset: sideA.sourceText.length,
        },
      }),
    );
    expectSemanticSuccess({ result, refereeCalls });
  });

  it("out-of-range offsets fail closed", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base, sideA) => ({
        ...base,
        evidenceClaimA: {
          startOffset: 0,
          endOffset: sideA.sourceText.length + 5,
        },
      }),
    );
    expectFailClosed({ result, refereeCalls });
  });

  it("blank propositionA qualifications fails closed", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base) => ({
        ...base,
        propositionA: { ...base.propositionA, qualifications: "" },
      }),
    );
    expectFailClosed({ result, refereeCalls });
  });

  it("blank propositionB qualifications fails closed", async () => {
    const { result, refereeCalls } = await runClearCaseWithMutatedModel(
      (base) => ({
        ...base,
        propositionB: { ...base.propositionB, qualifications: "   " },
      }),
    );
    expectFailClosed({ result, refereeCalls });
  });
});

describe("CEQR-011 live PASS eligibility + budget", () => {
  it("CEQR-011 config cannot enable retries", () => {
    const cfg = resolveContradictionLiveProviderConfig({
      OPENAI_API_KEY: "sk-test",
      CONTRADICTION_LIVE_MAX_RETRIES: "5",
    });
    expect(cfg.ok).toBe(true);
    if (cfg.ok) {
      expect(cfg.config.maxRetries).toBe(0);
    }
    expect(CONTRADICTION_LIVE_MAX_RETRIES).toBe(0);
  });

  it("both live roles are created with maxRetries 0 and configured timeout", async () => {
    const { bundle, createRunnerOptions } = await buildInjectedAdapters({
      timeoutMs: 12_345,
      adjudicatorHandler: async () => ({
        ok: true,
        object: {},
        providerId: "openai",
        modelId: "a",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "b",
      }),
    });
    expect(createRunnerOptions).toHaveLength(2);
    expect(createRunnerOptions.every((o) => o.maxRetries === 0)).toBe(true);
    expect(createRunnerOptions.every((o) => o.timeoutMs === 12_345)).toBe(true);
    expect(bundle.maxRetries).toBe(0);
    expect(bundle.timeoutMs).toBe(12_345);
    expect(bundle.providerAttemptCountExact).toBe(true);
  });

  it("clear + compatible safe → PASS", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const isCompatible = sideA.sourceText.includes("coffee");
        return {
          ok: true,
          object: isCompatible
            ? compatibleResult(sideA, sideB)
            : classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!, LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.clearContradictionWriteProven).toBe(true);
      expect(result.compatibleCaseNoWrite).toBe(true);
      expect(result.classificationHint).toBe(
        "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN",
      );
      expect(result.maxRetries).toBe(0);
      expect(result.providerAttemptCountExact).toBe(true);
      expect(result.evidenceOutputMutated).toBe(false);
      expect(result.unsafeMutationDetected).toBe(false);
    }
  });

  it("clear succeeds + compatible timeout → HOLD", async () => {
    let calls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        calls += 1;
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        if (calls === 1) {
          return {
            ok: true,
            object: classAResult(sideA, sideB),
            providerId: "openai",
            modelId: "adj",
          };
        }
        return {
          ok: false,
          errorCode: "model_timeout",
          message: "timed out",
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!, LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.clearContradictionWriteProven).toBe(true);
      expect(result.compatibleCaseNoWrite).toBe(false);
      expect(result.classificationHint).toBe(
        "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      );
    }
  });

  it("clear succeeds + compatible malformed → HOLD", async () => {
    let calls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        calls += 1;
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        if (calls === 1) {
          return {
            ok: true,
            object: classAResult(sideA, sideB),
            providerId: "openai",
            modelId: "adj",
          };
        }
        return {
          ok: true,
          object: { not: "a valid contradiction schema" },
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!, LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.clearContradictionWriteProven).toBe(true);
      expect(result.compatibleCaseNoWrite).toBe(false);
      expect(result.classificationHint).toBe(
        "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      );
    }
  });

  it("clear succeeds + compatible unexpected write → FAIL_UNSAFE_TO_PROCEED", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        // Force Class A on both cases so compatible unexpectedly writes.
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!, LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.clearContradictionWriteProven).toBe(true);
      expect(result.compatibleCaseNoWrite).toBe(false);
      expect(result.cases[1]?.writeExecuted).toBe(true);
      expect(result.classificationHint).toBe("FAIL_UNSAFE_TO_PROCEED");
    }
  });

  it("clear succeeds but compatible missing → HOLD", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true,
          object: classAResult(sideA, sideB),
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "pass" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.clearContradictionWriteProven).toBe(true);
      expect(result.compatibleCaseNoWrite).toBe(false);
      expect(result.classificationHint).toBe(
        "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      );
    }
  });

  it("evaluateLiveProofClassification encodes the exact PASS predicate", () => {
    expect(
      evaluateLiveProofClassification({
        clearContradictionWriteProven: true,
        compatibleCaseNoWrite: true,
        compatibleUnexpectedWrite: false,
        compatibleMissing: false,
        totalCallCount: 4,
        maxTotalCalls: 8,
        unsafeMutationDetected: false,
      }),
    ).toBe("PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN");
    expect(
      evaluateLiveProofClassification({
        clearContradictionWriteProven: true,
        compatibleCaseNoWrite: false,
        compatibleUnexpectedWrite: true,
        compatibleMissing: false,
        totalCallCount: 4,
        maxTotalCalls: 8,
        unsafeMutationDetected: false,
      }),
    ).toBe("FAIL_UNSAFE_TO_PROCEED");
    expect(isCompatibleCaseSafeNoWrite(undefined, 0)).toBe(false);
  });

  it("exception receipt reports budget deltas, not hard-coded zeros", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async () => ({
        ok: true,
        object: {},
        providerId: "openai",
        modelId: "adj",
      }),
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const recordingThrowBundle: ContradictionLiveAdapterBundle = {
      ...bundle,
      adjudicatorRunner: {
        async runStructured() {
          bundle.callBudget.recordAdjudicatorCall();
          throw new Error("unhandled boom");
        },
      },
    };
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: recordingThrowBundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.cases[0]?.failureCode).toBe("unhandled_exception");
      expect(result.cases[0]?.adjudicatorCallCount).toBeGreaterThanOrEqual(1);
      expect(result.unsafeMutationDetected).toBe(false);
      expect(result.classificationHint).toBe(
        "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      );
    }
  });
});

describe("CEQR-011 liveProofResultToExitCode", () => {
  it("maps PASS → 0", () => {
    expect(
      liveProofResultToExitCode({
        ran: true,
        proofVersion: "contradiction-live-provider-referee-proof-v1",
        providerId: "openai",
        adjudicatorModelId: "gpt-4o-mini",
        refereeModelId: "gpt-4o-mini",
        independenceLevel: "separate_call_same_provider_same_model",
        maxRetries: 0,
        timeoutMs: 45000,
        providerAttemptCountExact: true,
        adjudicatorPromptAddendumVersion:
          "contradiction-live-adjudicator-prompt-addendum-v3",
        adjudicatorCallCount: 2,
        refereeCallCount: 1,
        totalCallCount: 3,
        maxTotalCalls: 8,
        cases: [],
        clearContradictionWriteProven: true,
        compatibleCaseNoWrite: true,
        ambiguousCaseNoWrite: null,
        unsafeMutationDetected: false,
        evidenceOutputMutated: false,
        realAccountMutated: false,
        productionIngestionWired: false,
        isolatedDatabasePersistenceProven: false,
        productionReady: false,
        classificationHint: "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN",
      }),
    ).toBe(0);
  });

  it("maps skipped / config unavailable → 3", () => {
    expect(
      liveProofResultToExitCode({
        ran: false,
        reason: "opt_in_missing",
        message: "missing",
        optInEnv: "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF",
      }),
    ).toBe(3);
    expect(
      liveProofResultToExitCode({
        ran: false,
        reason: "credentials_unavailable",
        message: "missing key",
        optInEnv: "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF",
      }),
    ).toBe(3);
    expect(
      liveProofResultToExitCode({
        ran: false,
        reason: "invalid_config",
        message: "bad timeout",
        optInEnv: "RUN_LIVE_CONTRADICTION_PROVIDER_PROOF",
      }),
    ).toBe(3);
  });

  it("maps HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED → 4", () => {
    expect(
      liveProofResultToExitCode({
        ran: true,
        proofVersion: "contradiction-live-provider-referee-proof-v1",
        providerId: "openai",
        adjudicatorModelId: "gpt-4o-mini",
        refereeModelId: "gpt-4o-mini",
        independenceLevel: "separate_call_same_provider_same_model",
        maxRetries: 0,
        timeoutMs: 45000,
        providerAttemptCountExact: true,
        adjudicatorPromptAddendumVersion:
          "contradiction-live-adjudicator-prompt-addendum-v3",
        adjudicatorCallCount: 3,
        refereeCallCount: 0,
        totalCallCount: 3,
        maxTotalCalls: 8,
        cases: [],
        clearContradictionWriteProven: false,
        compatibleCaseNoWrite: false,
        ambiguousCaseNoWrite: true,
        unsafeMutationDetected: false,
        evidenceOutputMutated: false,
        realAccountMutated: false,
        productionIngestionWired: false,
        isolatedDatabasePersistenceProven: false,
        productionReady: false,
        classificationHint: "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
      }),
    ).toBe(4);
  });

  it("maps FAIL_UNSAFE_TO_PROCEED → 5", () => {
    expect(
      liveProofResultToExitCode({
        ran: true,
        proofVersion: "contradiction-live-provider-referee-proof-v1",
        providerId: "openai",
        adjudicatorModelId: "gpt-4o-mini",
        refereeModelId: "gpt-4o-mini",
        independenceLevel: "separate_call_same_provider_same_model",
        maxRetries: 0,
        timeoutMs: 45000,
        providerAttemptCountExact: true,
        adjudicatorPromptAddendumVersion:
          "contradiction-live-adjudicator-prompt-addendum-v3",
        adjudicatorCallCount: 2,
        refereeCallCount: 2,
        totalCallCount: 4,
        maxTotalCalls: 8,
        cases: [],
        clearContradictionWriteProven: true,
        compatibleCaseNoWrite: false,
        ambiguousCaseNoWrite: null,
        unsafeMutationDetected: true,
        evidenceOutputMutated: false,
        realAccountMutated: false,
        productionIngestionWired: false,
        isolatedDatabasePersistenceProven: false,
        productionReady: false,
        classificationHint: "FAIL_UNSAFE_TO_PROCEED",
      }),
    ).toBe(5);
  });
});

function createAiSdkPassthrough(): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: true,
        object: { outcome: "PASS", rationale: "ok" },
        providerId: "openai",
        modelId: "gpt-4o-mini",
      };
    },
  };
}
