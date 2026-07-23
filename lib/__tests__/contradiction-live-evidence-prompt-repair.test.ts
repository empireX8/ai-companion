/**
 * CEQR-014 / CEQR-016 — live evidence prompt repair (addendum v3 current).
 * Deterministic injected runners only. No live provider. No DB mutation.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2,
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

import {
  transportSelectionForFullSource,
} from "./helpers/ceqr020-transport-selection";

/** Frozen historical v2 addendum marker retained for identity documentation only. */
const HISTORICAL_V2_ADDENDUM_SNIPPET = "SOURCE ID AUTHORITY:";

const EXPECTED_V3_ADDENDUM = [
  "",
  "LIVE PROVIDER EVIDENCE HARD RULES (CEQR-020 / addendum-v4):",
  "EVIDENCE TRANSPORT AUTHORITY:",
  "- evidenceClaimA and evidenceClaimB MUST contain ONLY startBoundaryIndex and endBoundaryIndex.",
  "- Do NOT author sourceId.",
  "- Do NOT author exactQuote.",
  "- Do NOT author raw startOffset/endOffset character counts.",
  "- Deterministic code copies sourceId from the authoritative Side A / Side B units.",
  "- Deterministic code maps boundary indices to UTF-16 offsets via the code-owned catalog.",
  "- Deterministic code derives exactQuote as sourceText.slice(startOffset, endOffset).",
  "- Side A indices apply only to Side A catalog; Side B indices apply only to Side B catalog.",
  "- Never swap Side A and Side B ordering.",
  "",
  "BOUNDARY INDICES:",
  "- startBoundaryIndex/endBoundaryIndex are zero-based positions in the printed Boundary N list for that side.",
  "- They are NOT character offsets. Do not return UTF-16 offsets, string lengths, or slice endpoints as indices.",
  "- Valid values are integers from 0 to catalogLength-1 inclusive; endBoundaryIndex must reference a listed Boundary N.",
  "- Because the catalog is ordered by increasing UTF-16 offset, endBoundaryIndex MUST be greater than startBoundaryIndex.",
  "- The resolved endOffset MUST be greater than the resolved startOffset.",
  "- Out-of-range, reversed, negative, or non-integer indices fail closed.",
  "- Mid-word character cuts are structurally absent from the catalog.",
  "- Do not rely on clamping, fuzzy matching, substring search, or full-source fallback.",
  "- Sources that exceed the code-owned catalog length/entry bounds fail closed before provider invocation.",
  "",
  "- qualifications must be a non-empty string; use the literal \"none\" when there are no material qualifiers.",
  "- Never invent wording that does not appear in the sourceText.",
  "",
  "LIVE PROVIDER CONSISTENCY HARD RULES:",
  "- If classification is clear_contradiction, then bothCanSimultaneouslyBeTrue, changedBeliefOverTime, intentionVersusOutcome, and goalVersusObstacle MUST all be false.",
  "- Do not mark changedBeliefOverTime merely because one side mentions a past event; require explicit belief-revision language.",
  "- If the propositions cannot both be true under matching actor/subject/timeframe/scope after preserving qualifiers, choose clear_contradiction with the consistency flags above all false.",
  "- If timeframe/scope qualifiers make both true, choose compatible_states instead of clear_contradiction.",
  "- compatible_states requires concrete, comparable propositions with an explicit preserved qualifier explaining coexistence.",
  "- Do not choose compatible_states for vague topical overlap or soft non-contradiction dumping.",
  "- insufficient_or_misaligned_context: use when evidence is sufficient to determine the pair is non-comparable, mispaired, unrelated, or materially underspecified as a contradiction pair (abstentionReason must be null).",
  "- null classification + non-blank abstentionReason: use ONLY when evidence is insufficient to safely choose any taxonomy classification.",
].join("\n");

function classAResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): Record<string, unknown> {
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
    evidenceClaimA: transportSelectionForFullSource(sideA.sourceText),
    evidenceClaimB: transportSelectionForFullSource(sideB.sourceText),
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
): Record<string, unknown> {
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

describe("CEQR-014 / CEQR-016 live evidence addendum version identity", () => {
  it("reports honest new v3 identity and retains historical v1/v2 identities", async () => {
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v4",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1,
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2,
    );
    expect(HISTORICAL_V2_ADDENDUM_SNIPPET).toBe("SOURCE ID AUTHORITY:");

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
      "contradiction-live-adjudicator-prompt-addendum-v4",
    );
    expect(bundle.adjudicatorPromptAddendumVersion).not.toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(bundle.adjudicatorPromptAddendumVersion).not.toBe(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
  });
});

describe("CEQR-014 / CEQR-016 captured StructuredModelRunner prompt contract", () => {
  it("appends v4 evidence rules to system; leaves request.prompt byte-for-byte unchanged; returns same object by reference", async () => {
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
      ["generic-kernel-system", EXPECTED_V3_ADDENDUM].join("\n"),
    );

    const system = captured!.system!;
    expect(system).toContain("EVIDENCE TRANSPORT AUTHORITY:");
    expect(system).toContain("Do NOT author sourceId.");
    expect(system).toContain("Do NOT author exactQuote.");
    expect(system).toContain(
      "evidenceClaimA and evidenceClaimB MUST contain ONLY startBoundaryIndex and endBoundaryIndex.",
    );
    expect(system).toContain(
      "Deterministic code derives exactQuote as sourceText.slice(startOffset, endOffset).",
    );
    expect(system).toContain(
      "startBoundaryIndex/endBoundaryIndex are zero-based positions in the printed Boundary N list for that side.",
    );
    expect(system).not.toContain(HISTORICAL_V2_ADDENDUM_SNIPPET);
    expect(system).not.toContain("EXACT QUOTE AUTHORITY:");
    expect(system).not.toContain("sourceTextLengthChars");
    expect(system).not.toContain("appendLiveSourceLengthMetadata");
    expect(system).not.toContain(
      "contradiction-live-adjudicator-prompt-addendum",
    );
    expect(captured!.prompt).not.toContain("sourceTextLengthChars");
  });

  it("live adapter path captures the same v3 system addendum without mutating prompt or object", async () => {
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
    expect(capturedSystem).toContain(EXPECTED_V3_ADDENDUM);
    expect(capturedSystem).toContain("EVIDENCE TRANSPORT AUTHORITY:");
    expect(capturedSystem).not.toContain(HISTORICAL_V2_ADDENDUM_SNIPPET);
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

  it("Class A with invalid offsets cannot reach referee", async () => {
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
              startBoundaryIndex: 0,
              endBoundaryIndex: 999,
              // Provider-authored exactQuote is ignored; invalid offsets fail closed.
              exactQuote: "fabricated quote not in source",
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
    ).toEqual(
      expect.arrayContaining([
        "validation_failed",
        "clear_contradiction_requires_valid_spans",
      ]),
    );
    expect(
      result.cases[0]!.sanitizedAdjudicationDiagnostics?.sideOffsetDiagnostics
        ?.sideA?.validationCode,
    ).toBe("invalid_boundary_index");
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

  it("provider-authored wrong sourceId via adjudication path is ignored; bound authoritative sourceId succeeds", async () => {
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
              ...(base.evidenceClaimA as Record<string, unknown>),
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
          object: { outcome: "PASS", rationale: "must run" },
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
    expect(result.cases[0]!.status).toBe("created");
    expect(result.cases[0]!.writeExecuted).toBe(true);
    expect(result.cases[0]!.sanitizedAdjudicationDiagnostics).toBeNull();
    expect(result.cases[0]!.sideAQuote).toBeTruthy();
  });
});

describe("CEQR-014 / CEQR-016 non-repair / non-live invariants", () => {
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
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(src).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(src).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
    expect(src).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v4",
    );
    expect(src).toContain(
      "CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1",
    );
    expect(src).toContain(
      "CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2",
    );
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
    expect(capturedSystem).not.toContain("EVIDENCE TRANSPORT AUTHORITY:");
    expect(capturedSystem).not.toContain("LIVE PROVIDER EVIDENCE HARD RULES:");
  });
});
