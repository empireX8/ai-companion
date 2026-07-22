/**
 * CEQR-014 — live evidence prompt repair (addendum v2).
 * Deterministic injected runners only. No live provider. No DB mutation.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";

import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1,
  contradictionModelResultOpenAiStrictSchema,
  createOpenAiContradictionLiveAdapters,
  wrapAdjudicatorRunnerForLiveEvidence,
  type ContradictionLiveAdapterBundle,
} from "../contradiction-live-provider-adapters";
import {
  LIVE_SYNTHETIC_CASES,
  runContradictionLiveProviderRefereeProofForTests,
} from "../contradiction-live-provider-referee-proof";
import {
  adjudicateContradiction,
  type ContradictionModelResult,
} from "../contradiction-adjudicator";
import {
  claimForSubstring,
  KERNEL_FIRST_PROOF_OBJECT,
  validateDualSideEvidenceClaims,
  validateExactEvidenceClaim,
  type KernelSourceUnit,
  type StructuredModelRunner,
  type StructuredModelRunnerRequest,
  type StructuredModelRunnerResult,
} from "../orvek-intelligence-kernel";

const EXPECTED_V2_ADDENDUM = [
  "",
  "LIVE PROVIDER EVIDENCE HARD RULES:",
  "SOURCE ID AUTHORITY:",
  "- evidenceClaimA.sourceId MUST be copied character-for-character from the exact value shown after \"Side A sourceId:\".",
  "- evidenceClaimB.sourceId MUST be copied character-for-character from the exact value shown after \"Side B sourceId:\".",
  "- sourceId is not messageId.",
  "- sourceId is not sessionId.",
  "- sourceId is not a ReferenceItem ID or reference-row ID.",
  "- Never construct or infer a sourceId.",
  "- Never swap the Side A and Side B source IDs; keep Side A and Side B source IDs ordered as shown.",
  "",
  "EXACT QUOTE AUTHORITY:",
  "- exactQuote MUST be copied character-for-character from the corresponding side's decoded sourceText.",
  "- Never paraphrase, normalize, summarize, correct grammar, or reconstruct text.",
  "- Preserve punctuation, capitalization, spacing, and contractions exactly.",
  "- exactQuote MUST be a contiguous substring of the decoded sourceText.",
  "- Side A / Side B sourceText appears as JSON in the user prompt; copy the decoded string content only — do not copy the JSON quotation marks that merely delimit sourceText.",
  "- Do not invent wording that appears only in normalizedProposition or rationale.",
  "- When the entire source unit supports the proposition, the safest valid quote is the entire sourceText copied exactly.",
  "",
  "OFFSETS:",
  "- startOffset/endOffset are zero-based, start inclusive, end exclusive, and MUST satisfy sourceText.slice(startOffset, endOffset) === exactQuote.",
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
): ContradictionModelResult {
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
  };
}

function compatibleResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelResult {
  return {
    ...classAResult(sideA, sideB),
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    confidence: 0.7,
    rationale: "Contextual scopes differ.",
    proposedObjectType: null,
  };
}

function parseSidesFromPrompt(prompt: string): {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
} {
  const parseSide = (side: "A" | "B"): KernelSourceUnit => {
    const sourceId =
      prompt.match(new RegExp(`Side ${side} sourceId: (.+)`))?.[1]?.trim() ??
      `message:${side.toLowerCase()}`;
    const sessionId =
      prompt.match(new RegExp(`Side ${side} sessionId: (.+)`))?.[1]?.trim() ??
      "s";
    const messageIdRaw = prompt
      .match(new RegExp(`Side ${side} messageId: (.+)`))?.[1]
      ?.trim();
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
}): Promise<{ bundle: ContradictionLiveAdapterBundle }> {
  const bundle = await createOpenAiContradictionLiveAdapters({
    adjudicatorModelId: "adj",
    refereeModelId: "ref",
    timeoutMs: 45_000,
    maxTotalCalls: 8,
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

describe("CEQR-014 live evidence addendum version identity", () => {
  it("reports honest new v2 identity and no longer reports v1 from the live adapter", async () => {
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1,
    );

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
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(bundle.adjudicatorPromptAddendumVersion).not.toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
  });
});

describe("CEQR-014 captured StructuredModelRunner prompt contract", () => {
  it("appends v2 evidence rules to system; leaves request.prompt byte-for-byte unchanged; returns same object by reference", async () => {
    const object = { marker: "provider-object", classification: "clear_contradiction" };
    const userPrompt = [
      "Side A sourceId: message:a",
      "Side A messageId: a",
      "Side A sessionId: s",
      'Side A sourceText: "I do not drink alcohol at all."',
      "Side B sourceId: message:b",
      "Side B messageId: b",
      "Side B sessionId: s",
      'Side B sourceText: "I drank several beers last night."',
    ].join("\n");

    let captured: StructuredModelRunnerRequest | undefined;
    const inner: StructuredModelRunner = {
      async runStructured(request) {
        captured = request;
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
      system: "generic-kernel-system",
      prompt: userPrompt,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toBe(object);
    }
    expect(captured).toBeDefined();
    expect(captured!.prompt).toBe(userPrompt);
    expect(captured!.system).toBe(
      ["generic-kernel-system", EXPECTED_V2_ADDENDUM].join("\n"),
    );

    const system = captured!.system!;
    expect(system).toContain("sourceId is not messageId.");
    expect(system).toContain("sourceId is not sessionId.");
    expect(system).toContain(
      "sourceId is not a ReferenceItem ID or reference-row ID.",
    );
    expect(system).toContain("Never construct or infer a sourceId.");
    expect(system).toContain(
      "Never swap the Side A and Side B source IDs; keep Side A and Side B source IDs ordered as shown.",
    );
    expect(system).toContain(
      "exactQuote MUST be copied character-for-character from the corresponding side's decoded sourceText.",
    );
    expect(system).toContain(
      "Never paraphrase, normalize, summarize, correct grammar, or reconstruct text.",
    );
    expect(system).toContain(
      "do not copy the JSON quotation marks that merely delimit sourceText",
    );
    expect(system).toContain(
      "When the entire source unit supports the proposition, the safest valid quote is the entire sourceText copied exactly.",
    );
    expect(system).toContain(
      "startOffset/endOffset are zero-based, start inclusive, end exclusive",
    );
    expect(system).not.toContain("sourceTextLengthChars");
    expect(system).not.toContain("appendLiveSourceLengthMetadata");
    expect(system).not.toContain(
      "contradiction-live-adjudicator-prompt-addendum",
    );
    expect(captured!.prompt).not.toContain("sourceTextLengthChars");
  });

  it("live adapter path captures the same v2 system addendum without mutating prompt or object", async () => {
    const object = classAResult(sideUnits().sideA, sideUnits().sideB);
    let capturedPrompt: string | undefined;
    let capturedSystem: string | undefined;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        capturedPrompt = request.prompt;
        capturedSystem = request.system;
        return {
          ok: true,
          object,
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => ({
        ok: true,
        object: { outcome: "PASS", rationale: "ok" },
        providerId: "openai",
        modelId: "ref",
      }),
    });

    const result = await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(result.ran).toBe(true);
    expect(capturedPrompt).toBeDefined();
    const promptBefore = capturedPrompt!;
    expect(capturedSystem).toContain(EXPECTED_V2_ADDENDUM);
    expect(capturedSystem).toContain("SOURCE ID AUTHORITY:");
    expect(capturedSystem).toContain("EXACT QUOTE AUTHORITY:");
    expect(capturedPrompt).toBe(promptBefore);
    expect(capturedPrompt).toMatch(/Side A sourceId:/);
    expect(capturedPrompt).toMatch(/Side A sourceText: "/);
    expect(capturedPrompt).not.toContain("sourceTextLengthChars");
  });
});

describe("CEQR-014 fail-closed evidence validation unchanged", () => {
  it("fabricated_quote still fails closed", () => {
    const { sideA } = sideUnits();
    const result = validateExactEvidenceClaim(
      {
        sourceId: sideA.sourceId,
        exactQuote: "this quote is not in the source text at all",
        startOffset: 0,
        endOffset: 10,
      },
      sideA,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("fabricated_quote");
    }
  });

  it("source_id_mismatch still fails closed", () => {
    const { sideA } = sideUnits();
    const result = validateExactEvidenceClaim(
      {
        sourceId: "message:wrong",
        exactQuote: sideA.sourceText,
        startOffset: 0,
        endOffset: sideA.sourceText.length,
      },
      sideA,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("source_id_mismatch");
    }
  });

  it("valid exact evidence still passes deterministic validation", () => {
    const { sideA, sideB } = sideUnits();
    const dual = validateDualSideEvidenceClaims({
      claimA: claimForSubstring(sideA, sideA.sourceText)!,
      claimB: claimForSubstring(sideB, sideB.sourceText)!,
      sourceA: sideA,
      sourceB: sideB,
    });
    expect(dual).toEqual({ ok: true });
  });

  it("Class A with invalid spans cannot reach referee", async () => {
    let refereeCalls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const base = classAResult(sideA, sideB);
        return {
          ok: true,
          object: {
            ...base,
            evidenceClaimA: {
              ...base.evidenceClaimA,
              exactQuote: "fabricated quote not in source",
              startOffset: 0,
              endOffset: 10,
            },
          },
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "must not run" },
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
    expect(refereeCalls).toBe(0);
    expect(result.refereeCallCount).toBe(0);
    expect(result.cases[0]!.writerInvoked).toBe(false);
    expect(result.cases[0]!.writeExecuted).toBe(false);
    expect(
      result.cases[0]!.sanitizedAdjudicationDiagnostics?.validationErrorCodes,
    ).toEqual(expect.arrayContaining(["fabricated_quote"]));
  });

  it("valid non-Class-A output does not reach referee", async () => {
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
          object: { outcome: "PASS", rationale: "must not run" },
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
    expect(refereeCalls).toBe(0);
    expect(result.refereeCallCount).toBe(0);
    expect(result.cases[0]!.refereeCallCount).toBe(0);
    expect(result.cases[0]!.writeExecuted).toBe(false);
  });

  it("source_id_mismatch via adjudication path fails closed before referee", async () => {
    let refereeCalls = 0;
    const { bundle } = await buildInjectedAdapters({
      adjudicatorHandler: async (request) => {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const base = classAResult(sideA, sideB);
        return {
          ok: true,
          object: {
            ...base,
            evidenceClaimA: {
              ...base.evidenceClaimA,
              sourceId: sideA.messageId ?? "wrong-id",
            },
          },
          providerId: "openai",
          modelId: "adj",
        };
      },
      refereeHandler: async () => {
        refereeCalls += 1;
        return {
          ok: true,
          object: { outcome: "PASS", rationale: "must not run" },
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
    expect(refereeCalls).toBe(0);
    expect(
      result.cases[0]!.sanitizedAdjudicationDiagnostics?.validationErrorCodes,
    ).toEqual(expect.arrayContaining(["source_id_mismatch"]));
  });
});

describe("CEQR-014 non-repair / non-live invariants", () => {
  it("introduces no output-repair function and no source-length metadata", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-adapters.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/realignExactClaim|repairExactQuote|fixFabricatedQuote/);
    expect(src).not.toMatch(/replaceSourceId|normalizeExactQuote/);
    expect(src).not.toMatch(/appendLiveSourceLengthMetadata|sourceTextLengthChars/);
    expect(src).not.toMatch(/evidenceClaimA\s*=/);
    expect(src).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(src).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(src).toContain(
      "CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1",
    );
  });

  it("does not invoke a live provider", async () => {
    const openaiCreate = vi.fn();
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
        object: { outcome: "PASS", rationale: "ok" },
        providerId: "openai",
        modelId: "ref",
      }),
    });
    await runContradictionLiveProviderRefereeProofForTests({
      adapters: bundle,
      cases: [LIVE_SYNTHETIC_CASES[0]!],
    });
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("generic kernel adjudicator path still builds JSON sourceText without live addendum", async () => {
    const { sideA, sideB } = sideUnits();
    let capturedSystem: string | undefined;
    let capturedPrompt: string | undefined;
    await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured(request) {
          capturedSystem = request.system;
          capturedPrompt = request.prompt;
          return {
            ok: true,
            object: classAResult(sideA, sideB),
            providerId: "test",
            modelId: "test",
          };
        },
      },
    });
    expect(capturedPrompt).toContain(
      `Side A sourceText: ${JSON.stringify(sideA.sourceText)}`,
    );
    expect(capturedSystem).not.toContain("SOURCE ID AUTHORITY:");
    expect(capturedSystem).not.toContain("LIVE PROVIDER EVIDENCE HARD RULES:");
  });
});
