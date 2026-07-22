/**
 * CEQR-012 — deterministic semantic-output compatibility + sanitized diagnostics.
 * Independent-review correction: observability only; CEQR-011 prompt unchanged.
 * No live provider calls. Injected runners only.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";

import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  contradictionModelResultOpenAiStrictSchema,
  createOpenAiContradictionLiveAdapters,
  isLiveContradictionProviderProofOptedIn,
  wrapAdjudicatorRunnerForLiveEvidence,
  type ContradictionLiveAdapterBundle,
} from "../contradiction-live-provider-adapters";
import {
  buildSanitizedAdjudicationDiagnostics,
  resolveEvidenceFailureSide,
} from "../contradiction-live-sanitized-diagnostics";
import {
  LIVE_PROOF_USER_ID,
  LIVE_SYNTHETIC_CASES,
  runContradictionLiveProviderRefereeProof,
  runContradictionLiveProviderRefereeProofForTests,
} from "../contradiction-live-provider-referee-proof";
import {
  adjudicateContradiction,
  type ContradictionModelResult,
  type ContradictionModelTransportResult,
} from "../contradiction-adjudicator";
import { notRunObjectivityRefereeResult } from "../orvek-intelligence-kernel/objectivity-referee";
import {
  claimForSubstring,
  KERNEL_FIRST_PROOF_OBJECT,
  type KernelSourceUnit,
  type StructuredModelRunner,
  type StructuredModelRunnerRequest,
  type StructuredModelRunnerResult,
} from "../orvek-intelligence-kernel";

const LANDED_CEQR016_ADDENDUM = [
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

async function buildInjectedAdapters(args: {
  adjudicatorHandler: (
    request: StructuredModelRunnerRequest,
  ) => Promise<StructuredModelRunnerResult> | StructuredModelRunnerResult;
  refereeHandler: (
    request: StructuredModelRunnerRequest,
  ) => Promise<StructuredModelRunnerResult> | StructuredModelRunnerResult;
  maxTotalCalls?: number;
}): Promise<{ bundle: ContradictionLiveAdapterBundle }> {
  const bundle = await createOpenAiContradictionLiveAdapters({
    adjudicatorModelId: "adj",
    refereeModelId: "ref",
    timeoutMs: 45_000,
    maxTotalCalls: args.maxTotalCalls ?? 8,
    createLanguageModel: async (modelId) => ({ id: modelId }),
    createRunner: (opts) => ({
      async runStructured(request) {
        if (opts.modelId === "adj") {
          return args.adjudicatorHandler(request);
        }
        return args.refereeHandler(request);
      },
    }),
  });
  return { bundle };
}

function sideUnits(): { sideA: KernelSourceUnit; sideB: KernelSourceUnit } {
  return {
    sideA: {
      sourceId: "message:a",
      sessionId: "s",
      messageId: "a",
      sourceText: "I do not drink alcohol at all.",
      sourceRole: "user",
      label: "A",
    },
    sideB: {
      sourceId: "message:b",
      sessionId: "s",
      messageId: "b",
      sourceText: "I drank several beers last night.",
      sourceRole: "user",
      label: "B",
    },
  };
}

describe("CEQR-012 corrected live failure shape (coarse, receipt-faithful)", () => {
  it("reproduces landed adjudication_failed / no referee / no write for all three synthetic cases", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const base = classAResult(sideA, sideB);
        return {
          ok: true,
          object: {
            ...base,
            propositionA: { ...base.propositionA, qualifications: "" },
          },
          providerId: "openai",
          modelId: "gpt-4o-mini",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "must not run" },
        providerId: "openai",
        modelId: "gpt-4o-mini",
      }),
    });

    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [...LIVE_SYNTHETIC_CASES],
    });

    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(result.adjudicatorCallCount).toBe(3);
    expect(result.refereeCallCount).toBe(0);
    expect(result.adjudicatorPromptAddendumVersion).toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    );
    expect(result.clearContradictionWriteProven).toBe(false);
    expect(result.compatibleCaseNoWrite).toBe(false);
    expect(result.evidenceOutputMutated).toBe(false);
    expect(result.classificationHint).toBe(
      "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED",
    );

    for (const c of result.cases) {
      expect(c.failureCode).toBe("adjudication_failed");
      expect(c.writeExecuted).toBe(false);
      expect(c.writerInvoked).toBe(false);
      expect(c.refereeCallCount).toBe(0);
      expect(c.contradictionNodeId).toBeNull();
      expect(c.gateStoppedAt).toBe("selection");
      expect(c.sanitizedAdjudicationDiagnostics).not.toBeNull();
      expect(
        c.sanitizedAdjudicationDiagnostics?.earliestGate,
      ).toBe("deterministic_validation");
      expect(
        c.sanitizedAdjudicationDiagnostics?.validationErrorCodes,
      ).toContain("blank_required_qualifications");
      expect(c.sanitizedAdjudicationDiagnostics).not.toHaveProperty(
        "livePromptAddendumVersion",
      );
    }
  });
});

describe("CEQR-012 prompt provenance (live addendum identity)", () => {
  it("generic diagnostics contain no live-addendum provenance claim", async () => {
    const { sideA, sideB } = sideUnits();
    const adjudication = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true,
            object: {
              ...classAResult(sideA, sideB),
              propositionA: {
                ...classAResult(sideA, sideB).propositionA,
                qualifications: "",
              },
            },
            providerId: "openai",
            modelId: "gpt-4o-mini",
          };
        },
      },
    });
    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication,
      sideA,
      sideB,
    });
    expect(diag).not.toHaveProperty("livePromptAddendumVersion");
    expect(JSON.stringify(diag)).not.toContain(
      "contradiction-live-adjudicator-prompt-addendum",
    );
  });

  it("live adapter bundle reports current v3 addendum version", async () => {
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
    expect(bundle.adjudicatorPromptAddendumVersion).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
  });

  it("provider system prompt is the CEQR-016 v3 addendum; user prompt and object unchanged", async () => {
    const object = { keep: "me" };
    const userPrompt = 'Side A sourceText: "x"\nSide B sourceText: "y"';
    let capturedSystem: string | undefined;
    let capturedPrompt: string | undefined;
    const inner: StructuredModelRunner = {
      async runStructured(request) {
        capturedSystem = request.system;
        capturedPrompt = request.prompt;
        return {
          ok: true,
          object,
          providerId: "openai",
          modelId: "m",
        };
      },
    };
    const wrapped = wrapAdjudicatorRunnerForLiveEvidence(inner);
    const result = await wrapped.runStructured({
      schema: contradictionModelResultOpenAiStrictSchema,
      system: "base",
      prompt: userPrompt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toBe(object);
    }
    expect(capturedPrompt).toBe(userPrompt);
    expect(capturedSystem).toBe(["base", LANDED_CEQR016_ADDENDUM].join("\n"));
    expect(capturedSystem).not.toContain("UTF-16");
    expect(capturedSystem).not.toContain("sourceTextLengthChars");
    expect(capturedSystem).not.toContain("NEUTRAL FORMATTING EXAMPLE");
    expect(capturedSystem).not.toContain("SOURCE ID AUTHORITY:");
    expect(capturedSystem).toContain("EVIDENCE TRANSPORT AUTHORITY:");
    expect(capturedSystem).not.toContain(
      "contradiction-live-adjudicator-prompt-addendum",
    );
  });
});

describe("CEQR-012 side attribution honesty", () => {
  it("unlabelled fabricated_quote does not invent Side A or Side B attribution", () => {
    const error =
      "fabricated_quote: Exact quote does not equal sourceText.slice(startOffset, endOffset); quote appears fabricated or mismatched.";
    expect(resolveEvidenceFailureSide(error)).toBe("unknown");
  });

  it("provider-authored fabricated exactQuote with valid offsets is ignored", async () => {
    const { sideA, sideB } = sideUnits();
    const adjudication = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          const base = classAResult(sideA, sideB);
          return {
            ok: true,
            object: {
              ...base,
              evidenceClaimB: {
                sourceId: sideB.sourceId,
                exactQuote: "not in source at all",
                startOffset: 0,
                endOffset: sideB.sourceText.length,
              },
            },
            providerId: "openai",
            modelId: "m",
          };
        },
      },
    });
    expect(adjudication.outcome).toBe("semantic_accepted");
    expect(adjudication.semantic?.evidenceClaimB.exactQuote).toBe(
      sideB.sourceText,
    );
    expect(adjudication.semantic?.evidenceClaimB.exactQuote).not.toBe(
      "not in source at all",
    );
  });

  it("unlabelled Side B invalid offset → no false Side A attribution", async () => {
    const { sideA, sideB } = sideUnits();
    const adjudication = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          const base = classAResult(sideA, sideB);
          return {
            ok: true,
            object: {
              ...base,
              evidenceClaimB: {
                startOffset: 1,
                endOffset: sideB.sourceText.length + 5,
              },
            },
            providerId: "openai",
            modelId: "m",
          };
        },
      },
    });
    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication,
      sideA,
      sideB,
    });
    expect(diag.validationErrorCodes).toContain("invalid_offsets");
    expect(diag.exactQuoteMatched.sideA).toBeNull();
    expect(diag.offsetsMatched.sideA).toBeNull();
    expect(diag.evidenceFailureSide).toBe("unknown");
    expect(diag.failingFieldPaths).not.toContain("evidenceClaimA");
  });

  it("explicitly labelled cross-side error → correct field path", () => {
    const sideAError =
      "cross_side_source: Side A evidence claim must not point at the Side B source.";
    const sideBError =
      "cross_side_source: Side B evidence claim must not point at the Side A source.";
    expect(resolveEvidenceFailureSide(sideAError)).toBe("sideA");
    expect(resolveEvidenceFailureSide(sideBError)).toBe("sideB");
  });

  it("unknown match state remains null, not false or true", () => {
    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication: {
        outcome: "validation_failed",
        semantic: null,
        validation: {
          status: "invalid",
          errors: [
            "fabricated_quote: Exact quote does not equal sourceText.slice(startOffset, endOffset); quote appears fabricated or mismatched.",
          ],
          warnings: [],
        },
        refereeStatus: "not_run",
        referee: notRunObjectivityRefereeResult(),
        audit: {
          processorVersion: "orvek-intelligence-kernel-v1",
          kernelContractVersion: "orvek-intelligence-kernel-v1",
          schemaVersion: "contradiction-adjudication-schema-v1",
          promptVersion: "contradiction-adjudication-prompt-v2",
          providerId: "openai",
          modelId: "m",
          sourceIds: ["a", "b"],
          executedAt: "2026-07-22T00:00:00.000Z",
          parseValidationOutcome: "invalid",
          semanticClassification: null,
          abstentionOrErrorCode: "validation_failed",
          refereeStatus: "not_run",
        },
        abstentionReason: null,
        errorCode: "validation_failed",
        errorMessage: "fabricated_quote: …",
        persistenceDecision: null,
        createCandidate: undefined,
      },
    });
    expect(diag.exactQuoteMatched).toEqual({ sideA: null, sideB: null });
    expect(diag.offsetsMatched).toEqual({ sideA: null, sideB: null });
    expect(diag.evidenceFailureSide).toBe("unknown");
  });
});

describe("CEQR-012 gateStoppedAt honesty", () => {
  it("budget skip reports null", async () => {
    const { bundle } = await buildInjectedAdapters({
      maxTotalCalls: 1,
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
    // Exhaust budget on first case (adj + ref = 2 > 1 remaining after first adj?).
    // Force remaining 0 before any case by recording calls.
    bundle.callBudget.recordAdjudicatorCall();
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(result.cases[0]?.status).toBe("skipped_budget");
    expect(result.cases[0]?.gateStoppedAt).toBeNull();
  });

  it("pre-result exception reports null", async () => {
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
    // Throw from the outer adjudicatorRunner so controlled-entry never returns.
    const throwingBundle: ContradictionLiveAdapterBundle = {
      ...bundle,
      adjudicatorRunner: {
        async runStructured() {
          throw new Error("boom before result");
        },
      },
    };
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: throwingBundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(result.cases[0]?.failureCode).toBe("unhandled_exception");
    expect(result.cases[0]?.gateStoppedAt).toBeNull();
  });

  it("validation rejection reports selection", async () => {
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const base = classAResult(sideA, sideB);
        return {
          ok: true,
          object: {
            ...base,
            propositionA: { ...base.propositionA, qualifications: "" },
          },
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "x" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(result.cases[0]?.gateStoppedAt).toBe("selection");
  });

  it("successful created case uses the landed success value (null)", async () => {
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
    if (!result.ran) return;
    expect(result.cases[0]?.status).toBe("created");
    expect(result.cases[0]?.gateStoppedAt).toBeNull();
  });
});

describe("CEQR-012 fail-closed shapes still fail", () => {
  async function runMutated(
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
          object: { outcome: "PASS", rationale: "no" },
          providerId: "openai",
          modelId: "ref",
        };
      },
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    return { result, refereeCalls };
  }

  function expectInvalid(args: {
    result: Awaited<
      ReturnType<typeof runContradictionLiveProviderRefereeProofForTests>
    >;
    refereeCalls: number;
    code?: string;
  }) {
    expect(args.result.ran).toBe(true);
    if (!args.result.ran) return;
    const c = args.result.cases[0]!;
    expect(c.writeExecuted).toBe(false);
    expect(c.writerInvoked).toBe(false);
    expect(c.refereeCallCount).toBe(0);
    expect(args.refereeCalls).toBe(0);
    expect(c.contradictionNodeId).toBeNull();
    expect(c.harnessNodeCountAfter).toBe(0);
    if (args.code) {
      expect(
        c.sanitizedAdjudicationDiagnostics?.validationErrorCodes,
      ).toContain(args.code);
    }
  }

  function expectSuccess(args: {
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

  it("wrong sourceId is ignored; bound authoritative identity succeeds", async () => {
    const { result, refereeCalls } = await runMutated((base) => ({
      ...base,
      evidenceClaimA: { ...base.evidenceClaimA, sourceId: "wrong" },
    }));
    expectSuccess({ result, refereeCalls });
  });

  it("invented quote with valid offsets is ignored; derived quote succeeds", async () => {
    const { result, refereeCalls } = await runMutated((base, sideA) => ({
      ...base,
      evidenceClaimA: {
        ...base.evidenceClaimA,
        exactQuote: "not in source",
        startOffset: 0,
        endOffset: sideA.sourceText.length,
      },
    }));
    expectSuccess({ result, refereeCalls });
  });

  it("out-of-range offset still fails closed", async () => {
    const { result, refereeCalls } = await runMutated((base, sideA) => ({
      ...base,
      evidenceClaimA: {
        startOffset: 0,
        endOffset: sideA.sourceText.length + 5,
      },
    }));
    expectInvalid({ result, refereeCalls, code: "invalid_offsets" });
  });

  it("blank required proposition field still fails", async () => {
    const { result, refereeCalls } = await runMutated((base) => ({
      ...base,
      propositionB: { ...base.propositionB, actor: "" },
    }));
    expectInvalid({ result, refereeCalls, code: "blank_required_actor" });
  });

  it("inconsistent clear-contradiction flags still fail", async () => {
    const { result, refereeCalls } = await runMutated((base) => ({
      ...base,
      bothCanSimultaneouslyBeTrue: true,
    }));
    expectInvalid({ result, refereeCalls, code: "schema_parse_failed" });
  });

  it("malformed transport output still fails", async () => {
    let refereeCalls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async () => ({
        ok: true,
        object: { not: "a valid contradiction model result" },
        providerId: "openai",
        modelId: "adj",
      }),
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "no" },
          providerId: "openai",
          modelId: "ref",
        };
      },
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expectInvalid({ result, refereeCalls, code: "schema_parse_failed" });
  });

  it("abstention remains abstention (no write, no referee)", async () => {
    const { result, refereeCalls } = await runMutated((base) => ({
      ...base,
      classification: null,
      abstentionReason: "Insufficient shared timeframe.",
      proposedObjectType: null,
    }));
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    const c = result.cases[0]!;
    expect(c.writeExecuted).toBe(false);
    expect(c.writerInvoked).toBe(false);
    expect(c.refereeCallCount).toBe(0);
    expect(refereeCalls).toBe(0);
    expect(c.contradictionNodeId).toBeNull();
    expect(
      c.failureCode === "no_semantic_match" ||
        c.proofOutcome === "no_candidate",
    ).toBe(true);
  });
});

describe("CEQR-012 compatible vs clear referee eligibility", () => {
  it("compatible semantic output cannot reach the referee", async () => {
    let refereeCalls = 0;
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
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "no" },
          providerId: "openai",
          modelId: "ref",
        };
      },
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[1]!],
    });
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(result.cases[0]?.refereeCallCount).toBe(0);
    expect(refereeCalls).toBe(0);
    expect(result.cases[0]?.writeExecuted).toBe(false);
  });

  it("only valid clear contradiction semantics may reach referee + writer + presentation", async () => {
    let refereeCalls = 0;
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
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "independent pass" },
          providerId: "openai",
          modelId: "ref",
        };
      },
    });
    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    if (!result.ran) return;
    expect(refereeCalls).toBe(1);
    expect(result.cases[0]?.refereeCallCount).toBe(1);
    expect(result.cases[0]?.writeExecuted).toBe(true);
    expect(result.cases[0]?.writerInvoked).toBe(true);
    expect(result.cases[0]?.presentationStatus).toBe("resolved");
    expect(result.clearContradictionWriteProven).toBe(true);
  });
});

describe("CEQR-012 invariants: opt-in, retries, wiring, privacy, no network", () => {
  it("maxRetries remains 0", () => {
    expect(CONTRADICTION_LIVE_MAX_RETRIES).toBe(0);
  });

  it("live proof remains explicit opt-in", () => {
    expect(
      isLiveContradictionProviderProofOptedIn({
        [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: undefined,
      }),
    ).toBe(false);
  });

  it("opt-in missing does not invoke adapters", async () => {
    const spy = vi.fn();
    const result = await runContradictionLiveProviderRefereeProof({
      env: {
        [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: undefined,
        OPENAI_API_KEY: "test-key-not-a-real-credential",
      },
      adapters: {
        adjudicatorRunner: {
          runStructured: async () => {
            spy();
            return {
              ok: false,
              errorCode: "model_execution_failed",
              message: "no",
              providerId: null,
              modelId: null,
            };
          },
        },
        refereeRunner: {
          runStructured: async () => {
            spy();
            return {
              ok: false,
              errorCode: "model_execution_failed",
              message: "no",
              providerId: null,
              modelId: null,
            };
          },
        },
        objectivityReferee: {
          evaluate: async () => {
            spy();
            return { outcome: "ABSTAIN" as const, rationale: "no" };
          },
        },
        providerId: "openai",
        adjudicatorModelId: "x",
        refereeModelId: "y",
        independenceLevel: "separate_call_same_provider_same_model",
        timeoutMs: 1,
        maxRetries: 0,
        providerAttemptCountExact: true,
        adjudicatorPromptAddendumVersion:
          CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
        callBudget: {
          adjudicatorCalls: () => 0,
          refereeCalls: () => 0,
          totalCalls: () => 0,
          maxTotalCalls: 8,
          remaining: () => 8,
          recordAdjudicatorCall: () => undefined,
          recordRefereeCall: () => undefined,
        },
      },
    });
    expect(result.ran).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("ordinary message/import paths remain unwired", () => {
    const adapterSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-adapters.ts"),
      "utf8",
    );
    const proofSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-referee-proof.ts"),
      "utf8",
    );
    expect(adapterSrc).not.toMatch(/app\/api\/message/);
    expect(proofSrc).not.toMatch(/app\/api\/message/);
    expect(adapterSrc).not.toMatch(/appendLiveSourceLengthMetadata/);
    expect(adapterSrc).not.toMatch(/sourceTextLengthChars/);
  });

  it("no real account identifier appears in live proof user id", () => {
    expect(LIVE_PROOF_USER_ID).toBe(
      "ceqr011-live-provider-proof-user-isolated",
    );
  });

  it("same-session selection does not import live addendum version", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-same-session-selection.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM/);
    expect(src).not.toMatch(/livePromptAddendumVersion/);
  });
});
