/**
 * CEQR-016 — contradiction evidence authority repair.
 * Deterministic injected runners only. No live provider. No DB mutation.
 *
 * Proves: code-owned sourceId, code-derived exactQuote, immutable raw provider
 * output, fail-closed offsets, no fuzzy/search/clamp repair, and real injected
 * writer/lineage under controlled natural entry.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION_V2,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V1,
  type ContradictionModelResult,
} from "../contradiction-adjudicator";
import { runControlledContradictionNaturalEntryProof } from "../contradiction-controlled-natural-entry-proof";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  wrapAdjudicatorRunnerForLiveEvidence,
} from "../contradiction-live-provider-adapters";
import {
  createLiveProofInMemoryHarness,
  LIVE_SYNTHETIC_CASES,
} from "../contradiction-live-provider-referee-proof";
import {
  bindDualSideEvidenceClaims,
  bindExactEvidenceClaimFromOffsets,
  claimForSubstring,
  KERNEL_FIRST_PROOF_OBJECT,
  type EvidenceSpanSelection,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";

const FIXED_NOW = () => new Date("2026-07-22T12:00:00.000Z");

/** Test-local TRANSPORT helper only — not a production binding API. */
function selectionForSubstring(
  source: KernelSourceUnit,
  exactQuote: string,
): EvidenceSpanSelection | null {
  const startOffset = source.sourceText.indexOf(exactQuote);
  if (startOffset < 0) return null;
  return {
    startOffset,
    endOffset: startOffset + exactQuote.length,
  };
}

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? `session-${partial.sourceId}`,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType,
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function transportResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const selA =
    selectionForSubstring(sideA, sideA.sourceText) ?? {
      startOffset: 0,
      endOffset: sideA.sourceText.length,
    };
  const selB =
    selectionForSubstring(sideB, sideB.sourceText) ?? {
      startOffset: 0,
      endOffset: sideB.sourceText.length,
    };
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
    confidence: 0.91,
    evidenceClaimA: selA,
    evidenceClaimB: selB,
    rationale: "Universal abstinence conflicts with reported drinking.",
    alternativeInterpretation: "Belief change over time.",
    whatWouldChangeClassification: "Explicit timeframe separation.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...overrides,
  };
}

function fakeRunner(object: unknown): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: true as const,
        object,
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
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

function sha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

describe("CEQR-016 version identities", () => {
  it("bumps schema/prompt/live-addendum without rewriting historical v1/v2 identities", () => {
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V1).toBe(
      "contradiction-adjudication-schema-v1",
    );
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v2",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION_V2).toBe(
      "contradiction-adjudication-prompt-v2",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION).toBe(
      "contradiction-adjudication-prompt-v3",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
  });
});

describe("CEQR-016 raw provider output immutability", () => {
  it("keeps raw provider object unchanged by reference and value after binding", async () => {
    const sideA = source({
      sourceId: "src-a",
      sourceText: "I never drink alcohol.",
      label: "A",
    });
    const sideB = source({
      sourceId: "src-b",
      sourceText: "I drank wine last night.",
      label: "B",
    });
    const providerObject = transportResult(sideA, sideB, {
      evidenceClaimA: {
        startOffset: 0,
        endOffset: sideA.sourceText.length,
        sourceId: "provider-forged-id",
        exactQuote: "FORGED QUOTE TEXT",
      },
      evidenceClaimB: {
        startOffset: 0,
        endOffset: sideB.sourceText.length,
        sourceId: "other-forged",
        exactQuote: "also forged",
      },
    });
    const snapshot = structuredClone(providerObject);

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(providerObject),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(providerObject).toEqual(snapshot);
    expect(providerObject.evidenceClaimA).toEqual(snapshot.evidenceClaimA);
    expect(
      (providerObject.evidenceClaimA as { exactQuote?: string }).exactQuote,
    ).toBe("FORGED QUOTE TEXT");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(result.semantic?.evidenceClaimA.sourceId).toBe("src-a");
  });
});

describe("CEQR-016 sourceId authority", () => {
  it("copies sourceId only from authoritative Side A / Side B input", async () => {
    const sideA = source({
      sourceId: "authoritative-a",
      messageId: "message-a",
      sessionId: "session-a",
      sourceText: "I never drink.",
      label: "A",
    });
    const sideB = source({
      sourceId: "authoritative-b",
      messageId: "message-b",
      sessionId: "session-b",
      sourceText: "I drank last night.",
      label: "B",
    });

    const forgedIds = [
      "message-a",
      "session-a",
      "ReferenceItem:ref-1",
      "authoritative-b",
      "totally-fabricated",
    ];

    for (const forged of forgedIds) {
      const result = await adjudicateContradiction({
        sideA,
        sideB,
        modelRunner: fakeRunner(
          transportResult(sideA, sideB, {
            evidenceClaimA: {
              startOffset: 0,
              endOffset: sideA.sourceText.length,
              sourceId: forged,
            },
            evidenceClaimB: {
              startOffset: 0,
              endOffset: sideB.sourceText.length,
              sourceId: "message-b",
            },
          }),
        ),
        now: FIXED_NOW,
      });
      expect(result.outcome).toBe("semantic_accepted");
      expect(result.semantic?.evidenceClaimA.sourceId).toBe("authoritative-a");
      expect(result.semantic?.evidenceClaimB.sourceId).toBe("authoritative-b");
      expect(result.semantic?.evidenceClaimA.sourceId).not.toBe(forged);
    }
  });

  it("cannot swap Side A and Side B via provider sourceId fields", async () => {
    const sideA = source({
      sourceId: "side-a",
      sourceText: "alpha text here",
      label: "A",
    });
    const sideB = source({
      sourceId: "side-b",
      sourceText: "beta text here",
      label: "B",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          evidenceClaimA: {
            startOffset: 0,
            endOffset: sideA.sourceText.length,
            sourceId: "side-b",
          },
          evidenceClaimB: {
            startOffset: 0,
            endOffset: sideB.sourceText.length,
            sourceId: "side-a",
          },
        }),
      ),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.sourceId).toBe("side-a");
    expect(result.semantic?.evidenceClaimB.sourceId).toBe("side-b");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(result.semantic?.evidenceClaimB.exactQuote).toBe(sideB.sourceText);
  });
});

describe("CEQR-016 exactQuote authority", () => {
  it("always derives exactQuote as sourceText.slice(startOffset, endOffset)", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "ABCDEFGHIJ",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "1234567890",
      label: "B",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          evidenceClaimA: {
            startOffset: 2,
            endOffset: 6,
            exactQuote: "PROVIDER_LIE",
          },
          evidenceClaimB: {
            startOffset: 1,
            endOffset: 4,
            exactQuote: "NOPE",
          },
        }),
      ),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe("CDEF");
    expect(result.semantic?.evidenceClaimB.exactQuote).toBe("234");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(
      sideA.sourceText.slice(2, 6),
    );
    expect(result.semantic?.evidenceClaimB.exactQuote).toBe(
      sideB.sourceText.slice(1, 4),
    );
  });

  it("provider cannot author independent quote text that survives binding", () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "exact source",
      label: "A",
    });
    const bound = bindExactEvidenceClaimFromOffsets(sideA, {
      startOffset: 0,
      endOffset: 5,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.claim.exactQuote).toBe("exact");
    expect(bound.claim.exactQuote).not.toBe("independent quote");
  });
});

describe("CEQR-016 offset fail-closed boundary", () => {
  const sideA = source({
    sourceId: "a",
    sourceText: "hello world",
    label: "A",
  });

  it("negative start offset fails closed", () => {
    const r = bindExactEvidenceClaimFromOffsets(sideA, {
      startOffset: -1,
      endOffset: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_offsets");
  });

  it("end before or equal to start fails closed", () => {
    expect(
      bindExactEvidenceClaimFromOffsets(sideA, {
        startOffset: 3,
        endOffset: 3,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(sideA, {
        startOffset: 4,
        endOffset: 2,
      }).ok,
    ).toBe(false);
  });

  it("end beyond source length fails closed", () => {
    const r = bindExactEvidenceClaimFromOffsets(sideA, {
      startOffset: 0,
      endOffset: sideA.sourceText.length + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_offsets");
  });

  it("non-integer offsets fail closed", () => {
    expect(
      bindExactEvidenceClaimFromOffsets(sideA, {
        startOffset: 1.5,
        endOffset: 3,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(sideA, {
        startOffset: 0,
        endOffset: 2.2,
      }).ok,
    ).toBe(false);
  });

  it("valid offsets produce the exact authoritative quote", () => {
    const r = bindExactEvidenceClaimFromOffsets(sideA, {
      startOffset: 6,
      endOffset: 11,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.claim.exactQuote).toBe("world");
    expect(r.claim.sourceId).toBe("a");
  });

  it("introduces no clamping, fuzzy match, substring search, or full-source fallback", () => {
    const bindSrc = readFileSync(
      join(process.cwd(), "lib/orvek-intelligence-kernel/evidence-validation.ts"),
      "utf8",
    );
    const adjSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-adjudicator.ts"),
      "utf8",
    );
    for (const src of [bindSrc, adjSrc]) {
      expect(src).not.toMatch(/clampOffset|fuzzyMatch|levenshtein/i);
      expect(src).not.toMatch(/repairExactQuote|fixFabricatedQuote|replaceSourceId/);
      expect(src).not.toMatch(/fullSourceFallback|fallbackToFullSource/i);
      expect(src).not.toMatch(/providerQuote|searchForQuote|findQuoteInSource/i);
    }
    expect(bindSrc).toContain("source.sourceText.slice");
    expect(bindSrc).toContain("sourceId: source.sourceId");
    expect(bindSrc).not.toContain("export function selectionForSubstring");
    const bindFn = bindSrc.slice(
      bindSrc.indexOf("export function bindExactEvidenceClaimFromOffsets"),
      bindSrc.indexOf("export function bindDualSideEvidenceClaims"),
    );
    expect(bindFn).not.toMatch(/indexOf/);
    expect(bindFn).not.toMatch(/includes\(/);
  });
});

describe("CEQR-016 semantic + referee + writer gates", () => {
  it("clear contradiction requires valid bound evidence for both sides", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "never",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "always",
      label: "B",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          evidenceClaimA: { startOffset: 0, endOffset: 99 },
          evidenceClaimB: { startOffset: 0, endOffset: sideB.sourceText.length },
        }),
      ),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("validation_failed");
    expect(result.errorMessage).toMatch(/invalid_offsets|clear_contradiction requires/i);
  });

  it("compatible contextual remains non-Class-A and no-write", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "I drink wine at dinners.",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "I avoid wine at work.",
      label: "B",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          classification: "compatible_states",
          bothCanSimultaneouslyBeTrue: true,
        }),
      ),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.persistenceDecision).toBeNull();
    expect(result.referee.executionState).toBe("not_run");
  });

  it("ambiguous insufficient remains non-Class-A and no-write", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "Something about habits.",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "Unrelated remark.",
      label: "B",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          classification: "insufficient_or_misaligned_context",
          bothCanSimultaneouslyBeTrue: true,
        }),
      ),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe(
      "insufficient_or_misaligned_context",
    );
    expect(result.persistenceDecision).toBeNull();
    expect(result.referee.executionState).toBe("not_run");
  });

  it("Objectivity Referee receives only valid deterministically bound evidence", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "I never drink alcohol.",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "I drank beers last night.",
      label: "B",
    });
    let refereeInput: unknown;
    const referee: ObjectivityReferee = {
      async evaluate(input) {
        refereeInput = input.validatedSemanticResult;
        return { outcome: "PASS", rationale: "bound evidence ok" };
      },
    };
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          evidenceClaimA: {
            startOffset: 0,
            endOffset: sideA.sourceText.length,
            sourceId: "forged",
            exactQuote: "forged quote",
          },
          evidenceClaimB: {
            startOffset: 0,
            endOffset: sideB.sourceText.length,
            sourceId: "forged-b",
            exactQuote: "also forged",
          },
        }),
      ),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.refereeStatus).toBe("PASS");
    const semantic = refereeInput as ContradictionModelResult;
    expect(semantic.evidenceClaimA.sourceId).toBe("a");
    expect(semantic.evidenceClaimB.sourceId).toBe("b");
    expect(semantic.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(semantic.evidenceClaimB.exactQuote).toBe(sideB.sourceText);
  });

  it("writer cannot be invoked when evidence binding fails", async () => {
    const sideA = source({
      sourceId: "message:a",
      messageId: "a",
      sessionId: "s",
      sourceText: "I do not drink alcohol at all.",
      label: "A",
    });
    const sideB = source({
      sourceId: "message:b",
      messageId: "b",
      sessionId: "s",
      sourceText: "I drank several beers last night.",
      label: "B",
    });

    let refereeCalls = 0;
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        transportResult(sideA, sideB, {
          evidenceClaimA: { startOffset: -3, endOffset: 2 },
          evidenceClaimB: {
            startOffset: 0,
            endOffset: sideB.sourceText.length,
          },
        }),
      ),
      objectivityReferee: {
        async evaluate() {
          refereeCalls += 1;
          return { outcome: "PASS", rationale: "must not run" };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    expect(result.persistenceDecision).toBeNull();
    expect(refereeCalls).toBe(0);
    expect(result.referee.executionState).toBe("not_run");
  });
});

describe("CEQR-016 dual bind ordering", () => {
  it("Side A and Side B remain ordered and cannot be swapped by offsets alone", () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "AAA",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "BBB",
      label: "B",
    });
    const bound = bindDualSideEvidenceClaims({
      selectionA: { startOffset: 0, endOffset: 3 },
      selectionB: { startOffset: 0, endOffset: 3 },
      sourceA: sideA,
      sourceB: sideB,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.claimA.sourceId).toBe("a");
    expect(bound.claimB.sourceId).toBe("b");
    expect(bound.claimA.exactQuote).toBe("AAA");
    expect(bound.claimB.exactQuote).toBe("BBB");
  });
});

describe("CEQR-016 injected writer / lineage proof", () => {
  it("controlled natural-entry write uses authoritative slices despite forged provider fields", async () => {
    const clear = LIVE_SYNTHETIC_CASES[0]!;
    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(clear);
    const before = harness.snapshot();

    const modelRunner: StructuredModelRunner = {
      async runStructured(request) {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        const object = transportResult(sideA, sideB, {
          evidenceClaimA: {
            startOffset: 0,
            endOffset: sideA.sourceText.length,
            sourceId: "forged-provider-source-a",
            exactQuote: "FORGED_PROVIDER_QUOTE_A",
          },
          evidenceClaimB: {
            startOffset: 0,
            endOffset: sideB.sourceText.length,
            sourceId: "forged-provider-source-b",
            exactQuote: "FORGED_PROVIDER_QUOTE_B",
          },
        });
        return {
          ok: true as const,
          object,
          providerId: "test-fake",
          modelId: "test-fake-model",
          rawText: null,
        };
      },
    };

    const referee: ObjectivityReferee = {
      async evaluate(input) {
        const semantic = input.validatedSemanticResult as ContradictionModelResult;
        expect(semantic.evidenceClaimA.sourceId).not.toBe(
          "forged-provider-source-a",
        );
        expect(semantic.evidenceClaimB.sourceId).not.toBe(
          "forged-provider-source-b",
        );
        expect(semantic.evidenceClaimA.exactQuote).toBe(clear.sideAText);
        expect(semantic.evidenceClaimB.exactQuote).toBe(clear.sideBText);
        return { outcome: "PASS", rationale: "deterministic injected PASS" };
      },
    };

    const proofSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-referee-proof.ts"),
      "utf8",
    );
    expect(proofSrc).toContain("createLiveProofInMemoryHarness");
    expect(proofSrc).not.toMatch(/new PrismaClient/);

    const result = await runControlledContradictionNaturalEntryProof({
      userId: harness.userId,
      sessionId: harness.sessionId,
      currentMessage: seeded.currentMessage,
      references: seeded.references,
      modelRunner,
      objectivityReferee: referee,
      messageResolver: harness.messageResolver,
      persistenceDb: harness.db,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("created");
    expect(result.writerInvoked).toBe(true);
    expect(result.writeExecuted).toBe(true);
    expect(result.refereeCallCount).toBe(1);
    expect(result.contradictionNodeOutcome).toBe("created");
    expect(result.sideASourceSpanId).toBeTruthy();
    expect(result.sideBSourceSpanId).toBeTruthy();

    expect(harness.nodes).toHaveLength(1);
    expect(harness.spans).toHaveLength(2);

    const spanA = harness.spans.find((s) => s.id === result.sideASourceSpanId)!;
    const spanB = harness.spans.find((s) => s.id === result.sideBSourceSpanId)!;
    expect(spanA).toBeTruthy();
    expect(spanB).toBeTruthy();

    const msgAId = seeded.references[0]!.sourceMessageId!;
    const msgBId = seeded.currentMessage.messageId!;
    expect(spanA.messageId).toBe(msgAId);
    expect(spanB.messageId).toBe(msgBId);

    expect(clear.sideAText.slice(spanA.charStart, spanA.charEnd)).toBe(
      clear.sideAText,
    );
    expect(clear.sideBText.slice(spanB.charStart, spanB.charEnd)).toBe(
      clear.sideBText,
    );
    expect(spanA.contentHash).toBe(sha(clear.sideAText));
    expect(spanB.contentHash).toBe(sha(clear.sideBText));

    const node = harness.nodes[0]!;
    expect(node.sideASourceSpanId).toBe(spanA.id);
    expect(node.sideBSourceSpanId).toBe(spanB.id);
    // Node sideA/sideB store normalized propositions; exact quote authority
    // is proven via EvidenceSpan char bounds + contentHash above.

    const after = harness.snapshot();
    expect(after.nodes).toBe(before.nodes + 1);
    expect(after.spans).toBe(before.spans + 2);
  });

  it("invalid offsets fail closed before referee and injected writer", async () => {
    const clear = LIVE_SYNTHETIC_CASES[0]!;
    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(clear);
    const before = harness.snapshot();

    let refereeCalls = 0;
    const modelRunner: StructuredModelRunner = {
      async runStructured(request) {
        const { sideA, sideB } = parseSidesFromPrompt(request.prompt);
        return {
          ok: true as const,
          object: transportResult(sideA, sideB, {
            evidenceClaimA: { startOffset: -1, endOffset: 4 },
            evidenceClaimB: {
              startOffset: 0,
              endOffset: sideB.sourceText.length,
            },
          }),
          providerId: "test-fake",
          modelId: "test-fake-model",
          rawText: null,
        };
      },
    };

    const result = await runControlledContradictionNaturalEntryProof({
      userId: harness.userId,
      sessionId: harness.sessionId,
      currentMessage: seeded.currentMessage,
      references: seeded.references,
      modelRunner,
      objectivityReferee: {
        async evaluate() {
          refereeCalls += 1;
          return { outcome: "PASS", rationale: "must not run" };
        },
      },
      messageResolver: harness.messageResolver,
      persistenceDb: harness.db,
      now: FIXED_NOW,
    });

    expect(result.writerInvoked).toBe(false);
    expect(result.writeExecuted).toBe(false);
    expect(result.refereeCallCount).toBe(0);
    expect(refereeCalls).toBe(0);
    expect(result.contradictionNodeId).toBeNull();
    expect(result.outcome).not.toBe("created");
    expect(result.outcome).not.toBe("reused");
    expect(harness.nodes).toHaveLength(0);
    expect(harness.spans).toHaveLength(0);
    expect(harness.snapshot()).toEqual(before);
  });
});

describe("CEQR-016 nonmutation / no-live / historical receipt invariants", () => {
  it("does not use a real Prisma transaction and does not opt into live provider", () => {
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).not.toBe(
      "1",
    );
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).not.toBe(
      "true",
    );
    const adjSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-adjudicator.ts"),
      "utf8",
    );
    expect(adjSrc).not.toMatch(/\$transaction/);
    expect(adjSrc).not.toMatch(/prismadb/);
  });

  it("ordinary route files do not invoke the live provider proof executable", () => {
    const routeRoots = [
      join(process.cwd(), "app"),
      join(process.cwd(), "lib/contradiction-detection.ts"),
      join(process.cwd(), "lib/contradiction-materialization.ts"),
    ];
    const files: string[] = [];
    for (const root of routeRoots) {
      if (!existsSync(root)) continue;
      const st = statSync(root);
      if (st.isDirectory()) files.push(...listFilesRecursive(root));
      else files.push(root);
    }
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/runContradictionLiveProviderRefereeProof/);
      expect(src).not.toMatch(/RUN_LIVE_CONTRADICTION_PROVIDER_PROOF\s*=\s*1/);
    }
  });

  it("historical v1/v2 receipt strings remain present for assertions", () => {
    const adapterSrc = readFileSync(
      join(process.cwd(), "lib/contradiction-live-provider-adapters.ts"),
      "utf8",
    );
    expect(adapterSrc).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    expect(adapterSrc).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(adapterSrc).toContain(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
    expect(adapterSrc).not.toMatch(/repairExactQuote|fixFabricatedQuote|replaceSourceId/);
  });

  it("CEQR-016 suite stays on injected runners with live opt-in unset", () => {
    expect(process.env.RUN_LIVE_CONTRADICTION_PROVIDER_PROOF).not.toBe("1");
    expect(process.env.RUN_LIVE_CONTRADICTION_PROVIDER_PROOF).not.toBe("true");
    const suiteSrc = readFileSync(
      join(
        process.cwd(),
        "lib/__tests__/contradiction-evidence-authority-repair.test.ts",
      ),
      "utf8",
    );
    expect(suiteSrc).not.toMatch(/createOpenAiContradictionLiveAdapters\s*\(/);
    expect(suiteSrc).toContain("createLiveProofInMemoryHarness");
    expect(suiteSrc).toContain("fakeRunner");
  });

  it("claimForSubstring helper still builds domain claims for persistence tests", () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "hello world",
      label: "A",
    });
    const claim = claimForSubstring(sideA, "world");
    expect(claim).toEqual({
      sourceId: "a",
      exactQuote: "world",
      startOffset: 6,
      endOffset: 11,
    });
  });
});

describe("CEQR-016 live wrapper immutability", () => {
  it("wrapAdjudicatorRunnerForLiveEvidence returns the same object by reference", async () => {
    const object = {
      marker: "raw",
      evidenceClaimA: { startOffset: 0, endOffset: 1 },
    };
    const inner: StructuredModelRunner = {
      async runStructured() {
        return {
          ok: true,
          object,
          providerId: "openai",
          modelId: "m",
          rawText: null,
        };
      },
    };
    const wrapped = wrapAdjudicatorRunnerForLiveEvidence(inner);
    const result = await wrapped.runStructured({
      schema: {} as never,
      prompt: "p",
      system: "s",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toBe(object);
    }
  });
});

describe("CEQR-016 transport vs domain schema honesty", () => {
  it("keeps distinct transport and domain schemas/types/parsers", async () => {
    const {
      contradictionModelTransportResultSchema,
      contradictionModelResultSchema,
      parseContradictionModelTransportResult,
      parseContradictionModelResult,
      propositionFieldsSchema,
    } = await import("../orvek-intelligence-kernel/structured-output");

    expect(propositionFieldsSchema).toBeDefined();
    expect(contradictionModelTransportResultSchema).not.toBe(
      contradictionModelResultSchema,
    );

    const transportOnly = {
      ...transportResult(
        source({ sourceId: "a", sourceText: "aa", label: "A" }),
        source({ sourceId: "b", sourceText: "bb", label: "B" }),
      ),
    };
    const transportParsed =
      parseContradictionModelTransportResult(transportOnly);
    expect(transportParsed.success).toBe(true);

    const domainParsedFromTransport =
      parseContradictionModelResult(transportOnly);
    expect(domainParsedFromTransport.success).toBe(false);

    const domainValue = {
      ...transportOnly,
      evidenceClaimA: {
        sourceId: "a",
        exactQuote: "aa",
        startOffset: 0,
        endOffset: 2,
      },
      evidenceClaimB: {
        sourceId: "b",
        exactQuote: "bb",
        startOffset: 0,
        endOffset: 2,
      },
    };
    const domainParsed = parseContradictionModelResult(domainValue);
    expect(domainParsed.success).toBe(true);
  });
});
