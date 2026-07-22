/**
 * CEQR-018 — offline semantic-consistency + lexical boundary repair.
 * Injected runners only. No live provider. No DB / account mutation.
 */

import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { Output } from "ai";

import {
  adjudicateContradiction,
  collectSemanticConsistencyErrors,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V2,
} from "../contradiction-adjudicator";
import { runControlledContradictionNaturalEntryProof } from "../contradiction-controlled-natural-entry-proof";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY,
  contradictionModelResultOpenAiStrictSchema,
  contradictionModelTransportOpenAiStrictUnionSchema,
  unwrapContradictionOpenAiStrictEnvelope,
  wrapRunnerWithOpenAiStrictSchemas,
} from "../contradiction-live-provider-adapters";
import type { ContradictionRepairedPersistenceDb } from "../contradiction-repaired-persistence";
import {
  createLiveProofInMemoryHarness,
  LIVE_SYNTHETIC_CASES,
} from "../contradiction-live-provider-referee-proof";
import {
  bindExactEvidenceClaimFromOffsets,
  isOffsetInsideSurrogatePair,
  isUnicodeAlphanumericWordChar,
  parseContradictionModelTransportResult,
  validateLexicalBoundaryIntegrity,
  type ContradictionModelResult,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import {
  abstentionTransportSchema,
  clearContradictionTransportSchema,
  contradictionModelTransportResultSchema,
  evidenceSpanSelectionSchema,
} from "../orvek-intelligence-kernel/structured-output";

const FIXED_NOW = () => new Date("2026-07-22T12:00:00.000Z");

const CEQR017_RECEIPT_DIR = join(
  process.cwd(),
  "docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001",
);

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

function proposition(normalized: string) {
  return {
    normalizedProposition: normalized,
    actor: "speaker",
    subject: "topic",
    timeframe: "general",
    negation: false,
    modality: "assertive",
    qualifications: "none",
  };
}

function baseClearTransport(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    propositionA: proposition("A"),
    propositionB: proposition("B"),
    contextAndScope: "same speaker",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.9,
    evidenceClaimA: {
      startOffset: 0,
      endOffset: sideA.sourceText.length,
    },
    evidenceClaimB: {
      startOffset: 0,
      endOffset: sideB.sourceText.length,
    },
    rationale: "Opposed under matching scope.",
    alternativeInterpretation: "none",
    whatWouldChangeClassification: "qualifier change",
    abstentionReason: null,
    proposedObjectType: null,
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

describe("CEQR-018 provider transport semantic consistency", () => {
  const sideA = source({
    sourceId: "a",
    sourceText: "I do not drink alcohol at all.",
    label: "A",
  });
  const sideB = source({
    sourceId: "b",
    sourceText: "I drank several beers last night.",
    label: "B",
  });

  const compatibilityFlags = [
    "bothCanSimultaneouslyBeTrue",
    "changedBeliefOverTime",
    "intentionVersusOutcome",
    "goalVersusObstacle",
    "emotionalOrPhysiologicalVersusReasoningStandard",
  ] as const;

  it("1. clear_contradiction + changedBeliefOverTime true fails transport parse", () => {
    const parsed = parseContradictionModelTransportResult(
      baseClearTransport(sideA, sideB, { changedBeliefOverTime: true }),
    );
    expect(parsed.success).toBe(false);
  });

  it("2. clear_contradiction + each other compatibility flag true fails", () => {
    for (const flag of compatibilityFlags) {
      if (flag === "changedBeliefOverTime") continue;
      const parsed = parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, { [flag]: true }),
      );
      expect(parsed.success).toBe(false);
    }
  });

  it("3. clear_contradiction with all compatibility flags false passes transport", () => {
    const parsed = parseContradictionModelTransportResult(
      baseClearTransport(sideA, sideB),
    );
    expect(parsed.success).toBe(true);
  });

  it("4–6. valid compatible / tension / insufficient results pass transport", () => {
    for (const classification of [
      "compatible_states",
      "plausible_unresolved_tension",
      "insufficient_or_misaligned_context",
    ] as const) {
      const parsed = parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          classification,
          bothCanSimultaneouslyBeTrue: classification === "compatible_states",
          abstentionReason: null,
        }),
      );
      expect(parsed.success).toBe(true);
    }
  });

  it("7. classification null with blank/null abstention fails", () => {
    expect(
      parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: null,
        }),
      ).success,
    ).toBe(false);
    expect(
      parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: "",
        }),
      ).success,
    ).toBe(false);
    expect(
      parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: "   ",
        }),
      ).success,
    ).toBe(false);
    // Local abstentionTransportSchema: null / empty / whitespace fail; nonblank passes.
    expect(
      abstentionTransportSchema.safeParse(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: null,
          proposedObjectType: null,
        }),
      ).success,
    ).toBe(false);
    expect(
      abstentionTransportSchema.safeParse(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: "",
          proposedObjectType: null,
        }),
      ).success,
    ).toBe(false);
    expect(
      abstentionTransportSchema.safeParse(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: "   ",
          proposedObjectType: null,
        }),
      ).success,
    ).toBe(false);
    expect(
      abstentionTransportSchema.safeParse(
        baseClearTransport(sideA, sideB, {
          classification: null,
          abstentionReason: "insufficient evidence to adjudicate",
          proposedObjectType: null,
        }),
      ).success,
    ).toBe(true);
  });

  it("8. classified result with affirmative abstentionReason fails", () => {
    expect(
      parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          abstentionReason: "should not accompany classification",
        }),
      ).success,
    ).toBe(false);
    expect(
      parseContradictionModelTransportResult(
        baseClearTransport(sideA, sideB, {
          classification: "compatible_states",
          abstentionReason: "nope",
        }),
      ).success,
    ).toBe(false);
  });

  it("9. deterministic validator independently rejects inconsistent domain object", () => {
    const domain: ContradictionModelResult = {
      ...(baseClearTransport(sideA, sideB, {
        changedBeliefOverTime: true,
      }) as unknown as ContradictionModelResult),
      evidenceClaimA: {
        sourceId: sideA.sourceId,
        exactQuote: sideA.sourceText,
        startOffset: 0,
        endOffset: sideA.sourceText.length,
      },
      evidenceClaimB: {
        sourceId: sideB.sourceId,
        exactQuote: sideB.sourceText,
        startOffset: 0,
        endOffset: sideB.sourceText.length,
      },
    };
    const errors = collectSemanticConsistencyErrors(domain);
    expect(errors.some((e) => e.includes("changedBeliefOverTime"))).toBe(true);
  });

  it("10. raw provider output remains deep-equal before and after processing", async () => {
    const providerObject = baseClearTransport(sideA, sideB);
    const snapshot = structuredClone(providerObject);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(providerObject),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(providerObject).toEqual(snapshot);
  });

  it("11–12. sourceId/exactQuote absent from transport authority; forged fields non-authoritative", async () => {
    expect(Object.keys(evidenceSpanSelectionSchema.shape).sort()).toEqual([
      "endOffset",
      "startOffset",
    ]);
    expect(clearContradictionTransportSchema.shape.evidenceClaimA.shape).not.toHaveProperty(
      "sourceId",
    );
    expect(clearContradictionTransportSchema.shape.evidenceClaimA.shape).not.toHaveProperty(
      "exactQuote",
    );

    const forged = baseClearTransport(sideA, sideB, {
      evidenceClaimA: {
        startOffset: 0,
        endOffset: sideA.sourceText.length,
        sourceId: "forged-a",
        exactQuote: "FORGED A",
      },
      evidenceClaimB: {
        startOffset: 0,
        endOffset: sideB.sourceText.length,
        sourceId: "forged-b",
        exactQuote: "FORGED B",
      },
    });
    const snap = structuredClone(forged);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(forged),
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("semantic_accepted");
    expect(forged).toEqual(snap);
    expect(result.semantic?.evidenceClaimA.sourceId).toBe(sideA.sourceId);
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(result.semantic?.evidenceClaimA.exactQuote).not.toBe("FORGED A");
  });
});

describe("CEQR-018 lexical boundary integrity", () => {
  it("13. offsets ending inside morning fail lexical boundary integrity", () => {
    const text = "I drink coffee in the morning.";
    const endInside = 27; // "...morni" — observed CEQR-017 compatible truncation
    expect(text.slice(0, endInside)).toBe("I drink coffee in the morni");
    const result = validateLexicalBoundaryIntegrity(text, 0, endInside);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("lexical_boundary_integrity");
      expect(result.message).toContain("mid-word truncation");
      expect(result.message).toContain("not complete semantic");
    }
    const bound = bindExactEvidenceClaimFromOffsets(
      source({ sourceId: "b", sourceText: text, label: "B" }),
      { startOffset: 0, endOffset: endInside },
    );
    expect(bound.ok).toBe(false);
    if (!bound.ok) expect(bound.code).toBe("lexical_boundary_integrity");
  });

  it("14. offsets starting inside a word fail lexical boundary integrity", () => {
    const text = "I drink coffee in the morning.";
    // "I drink..." → indices: 0=I, 1=space, 2=d, 3=r, 4=i, 5=n, 6=k
    const startInside = 4;
    expect(text[startInside]).toBe("i");
    const result = validateLexicalBoundaryIntegrity(text, startInside, text.length);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("lexical_boundary_integrity");
      expect(result.message).toContain("mid-word start");
    }
  });

  it("15. whole-word and punctuation/source-edge spans pass", () => {
    const text = "I drink coffee in the morning.";
    expect(validateLexicalBoundaryIntegrity(text, 0, text.length).ok).toBe(true);
    expect(validateLexicalBoundaryIntegrity(text, 0, 1).ok).toBe(true); // "I"
    expect(validateLexicalBoundaryIntegrity(text, 2, 7).ok).toBe(true); // "drink"
    expect(validateLexicalBoundaryIntegrity(text, 8, 14).ok).toBe(true); // "coffee"
    // trailing punctuation edge
    expect(
      validateLexicalBoundaryIntegrity(text, text.length - 1, text.length).ok,
    ).toBe(true); // "."
  });

  it("16. Unicode BMP word-boundary cases remain covered", () => {
    const text = "café naïve 日本語 123.";
    // full source
    expect(validateLexicalBoundaryIntegrity(text, 0, text.length).ok).toBe(true);
    // whole token "café"
    const cafeEnd = text.indexOf(" ");
    expect(validateLexicalBoundaryIntegrity(text, 0, cafeEnd).ok).toBe(true);
    // mid-word inside café (after 'c')
    expect(validateLexicalBoundaryIntegrity(text, 1, cafeEnd).ok).toBe(false);
    // Japanese letters are word chars
    const jpStart = text.indexOf("日");
    const jpEnd = jpStart + "日本語".length;
    expect(validateLexicalBoundaryIntegrity(text, jpStart, jpEnd).ok).toBe(true);
    expect(validateLexicalBoundaryIntegrity(text, jpStart + 1, jpEnd).ok).toBe(
      false,
    );
    // digits are word chars
    const digitStart = text.indexOf("1");
    expect(
      validateLexicalBoundaryIntegrity(text, digitStart, digitStart + 3).ok,
    ).toBe(true);
    expect(
      validateLexicalBoundaryIntegrity(text, digitStart + 1, digitStart + 3).ok,
    ).toBe(false);
  });

  it("16b. astral-plane letter sequences use complete code points", () => {
    // Mathematical bold small "hello" — five astral letters, each 2 UTF-16 units.
    const H = "\u{1D421}";
    const E = "\u{1D41E}";
    const L = "\u{1D425}";
    const O = "\u{1D428}";
    const astralWord = `${H}${E}${L}${L}${O}`;
    expect(astralWord.length).toBe(10); // 5 code points × 2 UTF-16 units
    expect(isUnicodeAlphanumericWordChar(H)).toBe(true);
    expect(isOffsetInsideSurrogatePair(astralWord, 1)).toBe(true);

    // Whole astral-plane word span passes.
    expect(validateLexicalBoundaryIntegrity(astralWord, 0, astralWord.length).ok).toBe(
      true,
    );

    // Mid-word boundary between first and second astral letters (offset 2) fails.
    const midWord = validateLexicalBoundaryIntegrity(astralWord, 0, 2);
    expect(midWord.ok).toBe(false);
    if (!midWord.ok) {
      expect(midWord.message).toContain("mid-word truncation");
    }

    // Boundary inside a surrogate pair fails closed.
    const insidePair = validateLexicalBoundaryIntegrity(astralWord, 0, 1);
    expect(insidePair.ok).toBe(false);
    if (!insidePair.ok) {
      expect(insidePair.message).toContain("surrogate pair");
    }
    const startInsidePair = validateLexicalBoundaryIntegrity(
      astralWord,
      1,
      astralWord.length,
    );
    expect(startInsidePair.ok).toBe(false);
    if (!startInsidePair.ok) {
      expect(startInsidePair.message).toContain("surrogate pair");
    }

    // exactQuote remains slice-derived for a valid whole-word bind.
    const bound = bindExactEvidenceClaimFromOffsets(
      source({ sourceId: "astral", sourceText: astralWord, label: "A" }),
      { startOffset: 0, endOffset: astralWord.length },
    );
    expect(bound.ok).toBe(true);
    if (bound.ok) {
      expect(bound.claim.exactQuote).toBe(astralWord);
      expect(bound.claim.exactQuote).toBe(astralWord.slice(0, astralWord.length));
    }
  });

  it("16c. combining-mark attachment policy", () => {
    // NFD "café" = c a f e + combining acute
    const acute = "\u0301";
    const decomposedCafe = `cafe${acute}`;
    expect(decomposedCafe.normalize("NFC")).toBe("café");

    // Full decomposed word span passes.
    expect(
      validateLexicalBoundaryIntegrity(decomposedCafe, 0, decomposedCafe.length)
        .ok,
    ).toBe(true);

    // Boundary between Latin base 'e' and combining acute fails.
    const betweenBaseAndMark = validateLexicalBoundaryIntegrity(
      decomposedCafe,
      0,
      4, // ends after 'e', before acute
    );
    expect(betweenBaseAndMark.ok).toBe(false);
    if (!betweenBaseAndMark.ok) {
      expect(betweenBaseAndMark.message).toContain("combining mark");
    }

    // Multiple combining marks on one base: a + acute + circumflex
    const circumflex = "\u0302";
    const multi = `a${acute}${circumflex}`;
    expect(validateLexicalBoundaryIntegrity(multi, 0, multi.length).ok).toBe(
      true,
    );
    const insideMarks = validateLexicalBoundaryIntegrity(multi, 0, 2); // after acute, before circumflex
    expect(insideMarks.ok).toBe(false);
    if (!insideMarks.ok) {
      expect(insideMarks.message).toContain("combining-mark sequence");
    }

    // Punctuation / source-edge still pass beside combining tokens.
    const withPunct = `${decomposedCafe}.`;
    expect(
      validateLexicalBoundaryIntegrity(withPunct, 0, withPunct.length).ok,
    ).toBe(true);
    expect(
      validateLexicalBoundaryIntegrity(
        withPunct,
        decomposedCafe.length,
        withPunct.length,
      ).ok,
    ).toBe(true); // "."
  });

  it("empty, reversed, fractional, negative, out-of-range remain invalid_offsets", () => {
    const side = source({
      sourceId: "s",
      sourceText: "I drink coffee in the morning.",
      label: "S",
    });
    expect(
      bindExactEvidenceClaimFromOffsets(side, { startOffset: 0, endOffset: 0 })
        .ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, { startOffset: 5, endOffset: 2 })
        .ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 1.5,
        endOffset: 4,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: -1,
        endOffset: 4,
      }).ok,
    ).toBe(false);
    expect(
      bindExactEvidenceClaimFromOffsets(side, {
        startOffset: 0,
        endOffset: 999,
      }).ok,
    ).toBe(false);
  });
});

describe("CEQR-018 compatible case / no candidate / writer-block proof", () => {
  it("17. compatible case produces no candidate (adjudication path)", async () => {
    const sideA = source({
      sourceId: "a",
      sourceText: "I avoid coffee in the evening.",
      label: "A",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: "I drink coffee in the morning.",
      label: "B",
    });

    let refereeCalls = 0;
    const referee: ObjectivityReferee = {
      async evaluate() {
        refereeCalls += 1;
        return {
          outcome: "PASS",
          rationale: "should not run",
        };
      },
    };

    const compatible = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseClearTransport(sideA, sideB, {
          classification: "compatible_states",
          bothCanSimultaneouslyBeTrue: true,
          confidence: 0.9,
        }),
      ),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(compatible.outcome).toBe("semantic_accepted");
    expect(compatible.semantic?.classification).toBe("compatible_states");
    expect(compatible.persistenceDecision).toBeNull();
    expect(compatible.createCandidate).toBeUndefined();
    expect(refereeCalls).toBe(0);
    expect(compatible.referee.executionState).toBe("not_run");
  });

  it("18. CEQR-017 truncated Side-B span blocks writer via controlled natural entry", async () => {
    // Exact CEQR-017 compatible Side-B text; offsets 0–27 truncate inside "morning".
    const compatibleCase = LIVE_SYNTHETIC_CASES[1]!;
    expect(compatibleCase.id).toBe("compatible_contextual");
    expect(compatibleCase.sideBText).toBe("I drink coffee in the morning.");
    expect(compatibleCase.sideBText.slice(0, 27)).toBe(
      "I drink coffee in the morni",
    );

    const harness = createLiveProofInMemoryHarness();
    const seeded = harness.seedCase(compatibleCase);
    const before = harness.snapshot();

    let refereeCalls = 0;
    const mutationCounters = {
      transactionCalls: 0,
      evidenceSpanCreateCalls: 0,
      contradictionNodeCreateCalls: 0,
      evidenceSpanFindUniqueCalls: 0,
      contradictionNodeFindFirstCalls: 0,
      messageFindUniqueCalls: 0,
    };

    const countingDb: ContradictionRepairedPersistenceDb = {
      message: {
        findUnique: async (args) => {
          mutationCounters.messageFindUniqueCalls += 1;
          return harness.db.message.findUnique(args);
        },
      },
      evidenceSpan: {
        findUnique: async (args) => {
          mutationCounters.evidenceSpanFindUniqueCalls += 1;
          return harness.db.evidenceSpan.findUnique(args);
        },
        create: async (args) => {
          mutationCounters.evidenceSpanCreateCalls += 1;
          return harness.db.evidenceSpan.create(args);
        },
      },
      contradictionNode: {
        findFirst: async (args) => {
          mutationCounters.contradictionNodeFindFirstCalls += 1;
          return harness.db.contradictionNode.findFirst(args);
        },
        create: async (args) => {
          mutationCounters.contradictionNodeCreateCalls += 1;
          return harness.db.contradictionNode.create(args);
        },
      },
      $transaction: async (fn) => {
        mutationCounters.transactionCalls += 1;
        return harness.db.$transaction(async (tx) => {
          const wrappedTx = {
            ...tx,
            evidenceSpan: {
              ...tx.evidenceSpan,
              create: async (
                args: Parameters<typeof tx.evidenceSpan.create>[0],
              ) => {
                mutationCounters.evidenceSpanCreateCalls += 1;
                return tx.evidenceSpan.create(args);
              },
            },
            contradictionNode: {
              ...tx.contradictionNode,
              create: async (
                args: Parameters<typeof tx.contradictionNode.create>[0],
              ) => {
                mutationCounters.contradictionNodeCreateCalls += 1;
                return tx.contradictionNode.create(args);
              },
            },
          };
          return fn(wrappedTx);
        });
      },
    };

    const modelRunner: StructuredModelRunner = {
      async runStructured(request) {
        const sideAMatch = request.prompt.match(
          /Side A sourceText: ("(?:\\.|[^"\\])*")/,
        );
        const sideBMatch = request.prompt.match(
          /Side B sourceText: ("(?:\\.|[^"\\])*")/,
        );
        const sideAText = sideAMatch
          ? (JSON.parse(sideAMatch[1]!) as string)
          : compatibleCase.sideAText;
        const sideBText = sideBMatch
          ? (JSON.parse(sideBMatch[1]!) as string)
          : compatibleCase.sideBText;
        const sideA = source({
          sourceId: "prompt-a",
          sourceText: sideAText,
          label: "A",
        });
        const sideB = source({
          sourceId: "prompt-b",
          sourceText: sideBText,
          label: "B",
        });
        return {
          ok: true as const,
          object: baseClearTransport(sideA, sideB, {
            classification: "clear_contradiction",
            evidenceClaimA: {
              startOffset: 0,
              endOffset: sideAText.length,
            },
            evidenceClaimB: {
              startOffset: 0,
              endOffset: 27,
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
      persistenceDb: countingDb,
      now: FIXED_NOW,
    });

    expect(["failed_safely", "no_candidate"]).toContain(result.outcome);
    expect(result.gateStoppedAt).toBe("selection");
    expect(result.writerInvoked).toBe(false);
    expect(result.writeExecuted).toBe(false);
    expect(result.persistenceResult).toBeNull();
    expect(result.refereeCallCount).toBe(0);
    expect(refereeCalls).toBe(0);
    expect(mutationCounters.transactionCalls).toBe(0);
    expect(mutationCounters.evidenceSpanCreateCalls).toBe(0);
    expect(mutationCounters.contradictionNodeCreateCalls).toBe(0);
    expect(mutationCounters.evidenceSpanFindUniqueCalls).toBe(0);
    expect(mutationCounters.contradictionNodeFindFirstCalls).toBe(0);
    expect(mutationCounters.messageFindUniqueCalls).toBe(0);
    expect(harness.nodes).toHaveLength(0);
    expect(harness.spans).toHaveLength(0);
    expect(harness.snapshot()).toEqual(before);
  });
});

describe("CEQR-018 provider-facing schema fidelity", () => {
  it("provider-facing OpenAI schema nests anyOf with const:false under root object", async () => {
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v3",
    );
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION_V2).toBe(
      "contradiction-adjudication-schema-v2",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );

    const out = Output.object({
      schema: contradictionModelResultOpenAiStrictSchema,
      name: "ContradictionAdjudication",
    });
    const rf = await Promise.resolve(out.responseFormat);
    if (rf == null || rf.type !== "json" || rf.schema == null) {
      throw new Error("expected json responseFormat with schema");
    }
    const schema = rf.schema as {
      type?: string;
      anyOf?: unknown;
      oneOf?: unknown;
      properties?: Record<string, { anyOf?: Array<Record<string, unknown>> }>;
      required?: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.anyOf).toBeUndefined();
    expect(schema.oneOf).toBeUndefined();
    expect(schema.required).toEqual([CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY]);
    const nested = schema.properties?.[CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY];
    expect(nested?.anyOf?.length).toBe(3);
    const clearBranch = nested!.anyOf!.find((branch) => {
      const classification = (branch.properties as Record<string, unknown>)
        ?.classification as { const?: string } | undefined;
      return classification?.const === "clear_contradiction";
    });
    expect(clearBranch).toBeDefined();
    const flags = clearBranch!.properties as Record<
      string,
      { const?: boolean }
    >;
    expect(flags.changedBeliefOverTime?.const).toBe(false);
    expect(flags.bothCanSimultaneouslyBeTrue?.const).toBe(false);
    expect(flags.intentionVersusOutcome?.const).toBe(false);
    expect(flags.goalVersusObstacle?.const).toBe(false);
    expect(
      flags.emotionalOrPhysiologicalVersusReasoningStandard?.const,
    ).toBe(false);

    const abstentionBranch = nested!.anyOf!.find((branch) => {
      const classification = (branch.properties as Record<string, unknown>)
        ?.classification as { type?: string | string[]; const?: unknown } | undefined;
      if (!classification) return false;
      // Zod null → JSON Schema null type (or type: "null")
      if (classification.const === null) return true;
      if (classification.type === "null") return true;
      if (Array.isArray(classification.type) && classification.type.includes("null")) {
        return true;
      }
      return false;
    });
    expect(abstentionBranch).toBeDefined();
    const abstentionReasonSchema = (
      abstentionBranch!.properties as Record<string, { pattern?: string; type?: string }>
    ).abstentionReason;
    expect(abstentionReasonSchema).toBeDefined();
    expect(abstentionReasonSchema.pattern).toBe("\\S");
    // Non-redundant nonblank contract: pattern alone rejects empty/whitespace.

    // Flat transport union (local parse path) also rejects inconsistent clear.
    expect(
      contradictionModelTransportResultSchema.safeParse(
        baseClearTransport(
          source({ sourceId: "a", sourceText: "aa", label: "A" }),
          source({ sourceId: "b", sourceText: "bb", label: "B" }),
          { changedBeliefOverTime: true },
        ),
      ).success,
    ).toBe(false);

    expect(
      contradictionModelTransportOpenAiStrictUnionSchema.safeParse(
        baseClearTransport(
          source({ sourceId: "a", sourceText: "aa", label: "A" }),
          source({ sourceId: "b", sourceText: "bb", label: "B" }),
          { changedBeliefOverTime: true, proposedObjectType: null },
        ),
      ).success,
    ).toBe(false);
  });

  it("OpenAI-strict wrapper unwraps envelope without mutating nested transport", async () => {
    const transport = baseClearTransport(
      source({ sourceId: "a", sourceText: "hello", label: "A" }),
      source({ sourceId: "b", sourceText: "world", label: "B" }),
      { proposedObjectType: null },
    );
    const envelope = {
      [CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY]: transport,
    };
    const snap = structuredClone(envelope);
    const inner: StructuredModelRunner = {
      async runStructured() {
        return {
          ok: true,
          object: envelope,
          providerId: "openai",
          modelId: "m",
          rawText: null,
        };
      },
    };
    const wrapped = wrapRunnerWithOpenAiStrictSchemas(inner, "adjudicator");
    const result = await wrapped.runStructured({
      schema: contradictionModelResultOpenAiStrictSchema,
      prompt: "p",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toBe(transport);
      expect(result.object).toEqual(
        unwrapContradictionOpenAiStrictEnvelope(envelope),
      );
    }
    expect(envelope).toEqual(snap);
  });
});

describe("CEQR-018 historical receipt nonmutation", () => {
  it("19–20. CEQR-016 tests remain separately green; CEQR-017 receipts byte-stable", () => {
    expect(existsSync(CEQR017_RECEIPT_DIR)).toBe(true);
    const files = listFilesRecursive(CEQR017_RECEIPT_DIR).sort();
    expect(files.length).toBeGreaterThan(5);
    const hashes = files.map((f) => {
      const buf = readFileSync(f);
      return {
        rel: f.slice(CEQR017_RECEIPT_DIR.length + 1),
        sha256: createHash("sha256").update(buf).digest("hex"),
        bytes: buf.byteLength,
      };
    });
    // Stable presence of canonical claim + live receipt identities.
    const names = new Set(hashes.map((h) => h.rel));
    expect(names.has("phase2-live-run-claim.json")).toBe(true);
    expect(names.has("live-execution-receipt.json")).toBe(true);
    expect(names.has("account-gate-before.json")).toBe(true);
    expect(names.has("account-gate-after.json")).toBe(true);

    const claimPath = join(CEQR017_RECEIPT_DIR, "phase2-live-run-claim.json");
    const livePath = join(CEQR017_RECEIPT_DIR, "live-execution-receipt.json");
    const claimHash = createHash("sha256")
      .update(readFileSync(claimPath))
      .digest("hex");
    const liveHash = createHash("sha256")
      .update(readFileSync(livePath))
      .digest("hex");
    expect(liveHash).toBe(
      "b620aa7f718d4ace768a9a518a4d8cb32ca1b54662291280b3f6545fb5514fdd",
    );
    expect(claimHash).toBe(
      "f313cbafb264f84d158a8aee20ca2276520fbf85940be7f910b87bead2c5cef0",
    );
    const claim = JSON.parse(readFileSync(claimPath, "utf8"));
    expect(claim.campaignSlice).toBe("CEQR-017");
    expect(claim.neverAutoDelete).toBe(true);
    const live = JSON.parse(readFileSync(livePath, "utf8"));
    // Historical CEQR-017 runtime identity remains schema-v2 in live receipts.
    expect(live.expectedRuntimeIdentities.schemaVersion).toBe(
      "contradiction-adjudication-schema-v2",
    );
  });
});
