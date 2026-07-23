/**
 * Narrow regression: live models returned character offsets as boundary indices.
 * Catalog presentation must enumerate ordinal Boundary N entries; validators
 * must fail closed on character-style out-of-range values (no offset reinterpret).
 */

import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  buildContradictionAdjudicationPrompt,
} from "../contradiction-adjudicator";
import {
  checkLexicalBoundaryCatalogLimits,
  enumerateValidLexicalBoundaries,
  formatLexicalBoundaryCatalogForPrompt,
  resolveBoundaryIndexSelection,
} from "../orvek-intelligence-kernel/lexical-boundary-catalog";
import { KERNEL_FIRST_PROOF_OBJECT } from "../orvek-intelligence-kernel/contracts";
import type { KernelSourceUnit } from "../orvek-intelligence-kernel/types";
import type { ContradictionModelTransportResult } from "../orvek-intelligence-kernel/structured-output";
import { transportSelectionForFullSource } from "./helpers/ceqr020-transport-selection";

const FIXED_NOW = () => new Date("2026-07-23T21:00:00.000Z");

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

function schemaValidTransport(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  evidenceClaimA: { startBoundaryIndex: number; endBoundaryIndex: number },
  evidenceClaimB: { startBoundaryIndex: number; endBoundaryIndex: number },
): ContradictionModelTransportResult {
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
    contextAndScope: "same speaker alcohol claim",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.9,
    evidenceClaimA,
    evidenceClaimB,
    rationale: "Universal abstinence conflicts with reported drinking.",
    alternativeInterpretation: "Belief change over time.",
    whatWouldChangeClassification: "Explicit timeframe separation.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
  };
}

function parseOrdinalCatalogFromPrompt(
  prompt: string,
  side: "A" | "B",
): { catalogLength: number; boundaries: Array<{ index: number; offset: number }> } {
  const header = `Side ${side} lexical boundary catalog`;
  const start = prompt.indexOf(header);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextSide = prompt.indexOf(
    side === "A" ? "Side B lexical boundary catalog" : "\n\nAdjudicate",
    start + 1,
  );
  const block =
    nextSide >= 0 ? prompt.slice(start, nextSide) : prompt.slice(start);
  const lengthMatch = block.match(/catalogLength=(\d+)/);
  expect(lengthMatch).not.toBeNull();
  const catalogLength = Number(lengthMatch![1]);
  const boundaries = [...block.matchAll(/Boundary (\d+): offset (\d+)/g)].map(
    (m) => ({ index: Number(m[1]), offset: Number(m[2]) }),
  );
  return { catalogLength, boundaries };
}

describe("boundary catalog ordinal prompt presentation", () => {
  it("presents enumerated Boundary N entries and rejects character-offset misuse in copy", () => {
    const text = "I never drink alcohol.";
    const catalog = enumerateValidLexicalBoundaries(text);
    const formatted = formatLexicalBoundaryCatalogForPrompt("A", text, catalog);

    expect(formatted).toContain(`catalogLength=${catalog.length}`);
    expect(formatted).toContain(
      `validOrdinalIndexRange=0..${catalog.length - 1}`,
    );
    expect(formatted).toContain(
      "startBoundaryIndex and endBoundaryIndex are positions in this numbered list.",
    );
    expect(formatted).toContain("They are NOT character offsets");
    expect(formatted).toContain(`Boundary 0: offset ${catalog[0]!.offset}`);
    expect(formatted).toContain(
      `Boundary ${catalog.length - 1}: offset ${catalog[catalog.length - 1]!.offset}`,
    );
    expect(formatted).not.toMatch(/\[\d+\] offset=/);

    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: text,
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    const { system, prompt } = buildContradictionAdjudicationPrompt(
      sideA,
      sideB,
      {
        sideACatalog: enumerateValidLexicalBoundaries(sideA.sourceText),
        sideBCatalog: enumerateValidLexicalBoundaries(sideB.sourceText),
      },
    );
    expect(system).toContain(
      "They are NOT character offsets. Do not return UTF-16 offsets",
    );
    expect(prompt).toContain("Boundary 0: offset");
    expect(prompt).toContain("validOrdinalIndexRange=");
  });

  it("live failure pattern: schema-valid object with character-style indices fails closed", async () => {
    // Observed live patterns:
    //   catalog length 13, returned start=0 end=33 (UTF-16 length / char endpoint)
    //   catalog length 15, returned start=0 end=30
    //   catalog length 23, returned start=0 end=44
    const sideA = source({
      sourceId: "live-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "live-b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    const limits = checkLexicalBoundaryCatalogLimits({
      sideAText: sideA.sourceText,
      sideBText: sideB.sourceText,
    });
    expect(limits.ok).toBe(true);
    if (!limits.ok) return;

    expect(limits.sideBCatalog.length).toBe(13);
    expect(sideB.sourceText.length).toBe(33);

    const liveStylePairs: Array<{
      catalog: typeof limits.sideACatalog;
      sourceText: string;
      start: number;
      end: number;
      expectedLength: number;
    }> = [
      {
        catalog: limits.sideBCatalog,
        sourceText: sideB.sourceText,
        start: 0,
        end: 33,
        expectedLength: 13,
      },
      {
        // Exact observed shape: catalog length 15, character-style end=30.
        catalog: Array.from({ length: 15 }, (_, i) => ({
          boundaryIndex: i,
          offset: i === 14 ? 30 : i * 2,
          category: "other_non_word" as const,
        })),
        sourceText: "x".repeat(30),
        start: 0,
        end: 30,
        expectedLength: 15,
      },
    ];

    for (const pair of liveStylePairs) {
      expect(pair.catalog.length).toBe(pair.expectedLength);
      expect(pair.end).toBeGreaterThanOrEqual(pair.catalog.length);
      const resolved = resolveBoundaryIndexSelection(
        pair.sourceText,
        { startBoundaryIndex: pair.start, endBoundaryIndex: pair.end },
        pair.catalog,
      );
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) {
        expect(resolved.code).toBe("invalid_boundary_index");
        expect(resolved.message).toContain(
          `catalog length ${pair.catalog.length}`,
        );
        expect(resolved.message).toContain(`end=${pair.end}`);
      }
      // Must not silently reinterpret the out-of-range end as a UTF-16 offset.
      expect(resolved.startOffset).toBeNull();
      expect(resolved.endOffset).toBeNull();
    }

    const transport = schemaValidTransport(
      sideA,
      sideB,
      transportSelectionForFullSource(sideA.sourceText),
      { startBoundaryIndex: 0, endBoundaryIndex: 33 },
    );

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true as const,
            object: transport,
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.errorCode).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    expect(
      result.validation.errors.some((e) =>
        /invalid_boundary_index|boundary index out of range/i.test(e),
      ),
    ).toBe(true);
  });

  it("fake model that selects printed ordinal Boundary N indices binds successfully", async () => {
    const sideA = source({
      sourceId: "ord-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ord-b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });

    let capturedPrompt = "";
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured(request) {
          capturedPrompt = request.prompt;
          const sideACat = parseOrdinalCatalogFromPrompt(request.prompt, "A");
          const sideBCat = parseOrdinalCatalogFromPrompt(request.prompt, "B");
          expect(sideACat.boundaries).toHaveLength(sideACat.catalogLength);
          expect(sideBCat.boundaries).toHaveLength(sideBCat.catalogLength);
          expect(sideACat.boundaries[0]!.index).toBe(0);
          expect(
            sideACat.boundaries[sideACat.boundaries.length - 1]!.index,
          ).toBe(sideACat.catalogLength - 1);

          // Fake model uses ordinal list positions (not UTF-16 offsets).
          const evidenceClaimA = {
            startBoundaryIndex: 0,
            endBoundaryIndex: sideACat.catalogLength - 1,
          };
          const evidenceClaimB = {
            startBoundaryIndex: 0,
            endBoundaryIndex: sideBCat.catalogLength - 1,
          };
          expect(evidenceClaimA.endBoundaryIndex).toBeLessThan(
            sideACat.catalogLength,
          );
          expect(evidenceClaimB.endBoundaryIndex).toBeLessThan(
            sideBCat.catalogLength,
          );

          return {
            ok: true as const,
            object: schemaValidTransport(
              sideA,
              sideB,
              evidenceClaimA,
              evidenceClaimB,
            ),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(capturedPrompt).toContain("Boundary 0: offset");
    expect(capturedPrompt).toContain("They are NOT character offsets");
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(result.semantic?.evidenceClaimB.exactQuote).toBe(sideB.sourceText);
    expect(result.semantic?.evidenceClaimA.startOffset).toBe(0);
    expect(result.semantic?.evidenceClaimA.endOffset).toBe(
      sideA.sourceText.length,
    );
  });
});
