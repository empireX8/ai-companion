/**
 * CEQR-004 — same-session zero-or-one semantic selection contract tests.
 * Injected fake model runners / referees only. No network. No DB mutation.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import type {
  ContradictionModelResult,
  ContradictionModelTransportResult,
} from "../contradiction-adjudicator";
import {
  KERNEL_FIRST_PROOF_OBJECT,
} from "../contradiction-adjudicator";
import type { DetectedContradiction } from "../contradiction-detection";
import {
  assessReferenceSourceCompleteness,
  buildSameSessionReferenceQuery,
  selectSameSessionContradictionFromReferences,
  selectSameSessionContradictionPair,
  type SameSessionReferenceRow,
  type SemanticallySelectedContradictionPair,
} from "../contradiction-same-session-selection";
import {
  claimForSubstring,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";

const FIXED_NOW = () => new Date("2026-07-20T12:00:00.000Z");
const USER_A = "user-a";
const USER_B = "user-b";
const SESSION_B = "session-b";
const SESSION_A = "session-a";

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? SESSION_B,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType,
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function baseModelResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Partial<ContradictionModelTransportResult> & {
    quoteA?: string;
    quoteB?: string;
  } = {},
): ContradictionModelTransportResult {
  const quoteA = overrides.quoteA ?? sideA.sourceText;
  const quoteB = overrides.quoteB ?? sideB.sourceText;
  const claimA =
    overrides.evidenceClaimA ??
    claimForSubstring(sideA, quoteA) ??
    {
      sourceId: sideA.sourceId,
      exactQuote: quoteA,
      startOffset: 0,
      endOffset: quoteA.length,
    };
  const claimB =
    overrides.evidenceClaimB ??
    claimForSubstring(sideB, quoteB) ??
    {
      sourceId: sideB.sourceId,
      exactQuote: quoteB,
      startOffset: 0,
      endOffset: quoteB.length,
    };

  const {
    quoteA: _qa,
    quoteB: _qb,
    evidenceClaimA: _ea,
    evidenceClaimB: _eb,
    ...rest
  } = overrides;

  return {
    propositionA: {
      normalizedProposition: "Proposition A",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general / recent",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Proposition B",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker, overlapping lifestyle scope",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.86,
    evidenceClaimA: claimA,
    evidenceClaimB: claimB,
    rationale: "Incompatible propositions under same actor and modality.",
    alternativeInterpretation: "Temporal change if scopes differ.",
    whatWouldChangeClassification: "Explicit time-scoped belief change.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...rest,
  };
}

function countingRunner(
  bySourceId: Record<string, ContradictionModelTransportResult | ContradictionModelResult | "fail" | (() => ContradictionModelTransportResult | ContradictionModelResult)>,
): { runner: StructuredModelRunner; callCount: () => number; calledSourceIds: () => string[] } {
  let calls = 0;
  const called: string[] = [];
  return {
    callCount: () => calls,
    calledSourceIds: () => called,
    runner: {
      async runStructured({ prompt }) {
        calls += 1;
        const match = /Side A sourceId: ([^\n]+)/.exec(prompt);
        const sourceId = match?.[1]?.trim() ?? "";
        called.push(sourceId);
        const configured = bySourceId[sourceId];
        if (configured === "fail" || configured === undefined) {
          return {
            ok: false as const,
            errorCode: "model_execution_failed" as const,
            message: `no result for ${sourceId}`,
            providerId: "test-fake",
            modelId: "test-fake-model",
          };
        }
        const object =
          typeof configured === "function" ? configured() : configured;
        return {
          ok: true as const,
          object,
          providerId: "test-fake",
          modelId: "test-fake-model",
          rawText: null,
        };
      },
    },
  };
}

function fixedRunner(
  result: ContradictionModelTransportResult | ContradictionModelResult | "fail",
): { runner: StructuredModelRunner; callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    runner: {
      async runStructured() {
        calls += 1;
        if (result === "fail") {
          return {
            ok: false as const,
            errorCode: "model_execution_failed" as const,
            message: "simulated failure",
            providerId: "test-fake",
            modelId: "test-fake-model",
          };
        }
        return {
          ok: true as const,
          object: result,
          providerId: "test-fake",
          modelId: "test-fake-model",
          rawText: null,
        };
      },
    },
  };
}

function sameSessionRef(partial: Partial<SameSessionReferenceRow> & { id: string }): SameSessionReferenceRow {
  const sessionId =
    "sourceSessionId" in partial
      ? (partial.sourceSessionId as string | null)
      : SESSION_B;
  const messageId =
    "sourceMessageId" in partial
      ? (partial.sourceMessageId as string | null)
      : `msg-${partial.id}`;
  const content =
    partial.sourceMessage?.content ??
    `I never drink alcohol on weeknights. (${partial.id})`;
  const hasExplicitSourceMessage = "sourceMessage" in partial;
  return {
    id: partial.id,
    type: partial.type ?? "constraint",
    statement: partial.statement ?? content,
    status: partial.status ?? "active",
    confidence: partial.confidence ?? "medium",
    sourceSessionId: sessionId,
    sourceMessageId: messageId,
    sourceMessage: hasExplicitSourceMessage
      ? (partial.sourceMessage ?? null)
      : sessionId && messageId
        ? {
            id: messageId,
            sessionId,
            userId: USER_A,
            content,
          }
        : null,
  };
}

describe("CEQR-004 source completeness", () => {
  it("assembles exact Side A when provenance is complete", () => {
    const reference = sameSessionRef({ id: "ref-ok" });
    const result = assessReferenceSourceCompleteness({
      reference,
      currentSessionId: SESSION_B,
      userId: USER_A,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sideA.sessionId).toBe(SESSION_B);
    expect(result.sideA.messageId).toBe(reference.sourceMessageId);
    expect(result.sideA.sourceText).toBe(reference.sourceMessage!.content);
    expect(result.sideA.existingObjectId).toBe("ref-ok");
  });

  it("fails closed on missing Side A session", () => {
    const reference = sameSessionRef({
      id: "ref-no-session",
      sourceSessionId: null,
    });
    expect(
      assessReferenceSourceCompleteness({
        reference,
        currentSessionId: SESSION_B,
        userId: USER_A,
      }),
    ).toEqual({ ok: false, reason: "missing_source_session_id" });
  });

  it("fails closed on missing Side A message", () => {
    const reference = sameSessionRef({
      id: "ref-no-message",
      sourceMessageId: null,
      sourceMessage: null,
    });
    expect(
      assessReferenceSourceCompleteness({
        reference,
        currentSessionId: SESSION_B,
        userId: USER_A,
      }),
    ).toEqual({ ok: false, reason: "missing_source_message_id" });
  });

  it("fails closed on source session disagreement", () => {
    const reference = sameSessionRef({
      id: "ref-disagree",
      sourceSessionId: SESSION_B,
      sourceMessage: {
        id: "msg-disagree",
        sessionId: SESSION_A,
        userId: USER_A,
        content: "I never drink alcohol on weeknights.",
      },
    });
    expect(
      assessReferenceSourceCompleteness({
        reference,
        currentSessionId: SESSION_B,
        userId: USER_A,
      }),
    ).toEqual({ ok: false, reason: "source_session_disagreement" });
  });

  it("excludes cross-session references before adjudication", () => {
    const reference = sameSessionRef({
      id: "ref-cross",
      sourceSessionId: SESSION_A,
      sourceMessage: {
        id: "msg-cross",
        sessionId: SESSION_A,
        userId: USER_A,
        content: "I never drink alcohol on weeknights.",
      },
    });
    expect(
      assessReferenceSourceCompleteness({
        reference,
        currentSessionId: SESSION_B,
        userId: USER_A,
      }),
    ).toEqual({ ok: false, reason: "cross_session_excluded" });
  });

  it("isolates cross-user source messages", () => {
    const reference = sameSessionRef({
      id: "ref-other-user",
      sourceMessage: {
        id: "msg-other",
        sessionId: SESSION_B,
        userId: USER_B,
        content: "I never drink alcohol on weeknights.",
      },
    });
    expect(
      assessReferenceSourceCompleteness({
        reference,
        currentSessionId: SESSION_B,
        userId: USER_A,
      }),
    ).toEqual({ ok: false, reason: "source_message_user_mismatch" });
  });
});

describe("CEQR-004 same-session query contract", () => {
  it("requires userId, allowed types/statuses, and sourceSessionId equality", () => {
    const query = buildSameSessionReferenceQuery({
      userId: USER_A,
      sessionId: SESSION_B,
      referenceStatuses: ["active", "candidate"],
    });

    expect(query.where).toEqual({
      userId: USER_A,
      status: { in: ["active", "candidate"] },
      type: { in: ["goal", "constraint"] },
      sourceSessionId: SESSION_B,
    });
    expect(query.take).toBe(50);
    expect(query.select.sourceSessionId).toBe(true);
    expect(query.select.sourceMessageId).toBe(true);
    expect(query.select.sourceMessage).toEqual({
      select: {
        id: true,
        sessionId: true,
        userId: true,
        content: true,
      },
    });
  });
});

describe("CEQR-004 zero-or-one selection", () => {
  const sideBText = "I drank whiskey last night after dinner.";
  const sideB = source({
    sourceId: "side-b",
    sessionId: SESSION_B,
    messageId: "msg-b",
    label: "side_b",
    sourceText: sideBText,
  });

  it("1. CROSS-SESSION EXCLUSION — never adjudicates or selects", async () => {
    const cross = source({
      sourceId: "side-a-cross",
      sessionId: SESSION_A,
      messageId: "msg-a-cross",
      label: "cross",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner, callCount } = fixedRunner(
      baseModelResult(cross, sideB, { classification: "clear_contradiction" }),
    );

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: cross, referenceId: "ref-cross" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_same_session_sources");
    expect(result.selectedPair).toBeNull();
    expect(result.modelCallCount).toBe(0);
    expect(callCount()).toBe(0);
  });

  it("6. ZERO REFERENCES — zero selected, no model call", async () => {
    const { runner, callCount } = fixedRunner("fail");
    const result = await selectSameSessionContradictionFromReferences({
      userId: USER_A,
      sideB,
      references: [],
      modelRunner: runner,
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("no_same_session_sources");
    expect(result.selectedPair).toBeNull();
    expect(result.modelCallCount).toBe(0);
    expect(callCount()).toBe(0);
  });

  it("7. MULTIPLE REFERENCES, NONE PASS — zero selected", async () => {
    const a1 = source({
      sourceId: "a1",
      sessionId: SESSION_B,
      messageId: "m1",
      label: "a1",
      sourceText: "I want to review after every reading.",
    });
    const a2 = source({
      sourceId: "a2",
      sessionId: SESSION_B,
      messageId: "m2",
      label: "a2",
      sourceText: "I try to stay objective under pressure.",
    });
    const counted = countingRunner({
      a1: baseModelResult(a1, sideB, {
        classification: "plausible_unresolved_tension",
        bothCanSimultaneouslyBeTrue: true,
        goalVersusObstacle: true,
        confidence: 0.4,
      }),
      a2: baseModelResult(a2, sideB, {
        classification: "compatible_states",
        bothCanSimultaneouslyBeTrue: true,
        emotionalOrPhysiologicalVersusReasoningStandard: true,
        confidence: 0.5,
      }),
    });

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: a1, referenceId: "ref-1" },
        { sideA: a2, referenceId: "ref-2" },
      ],
      modelRunner: counted.runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_semantic_match");
    expect(result.selectedPair).toBeNull();
    expect(result.eligibleCount).toBe(0);
    expect(result.modelCallCount).toBe(2);
  });

  it("8. MULTIPLE REFERENCES, ONE PASSES — one semantic selection, persistence blocked", async () => {
    const aPass = source({
      sourceId: "a-pass",
      sessionId: SESSION_B,
      messageId: "m-pass",
      label: "pass",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const aFail = source({
      sourceId: "a-fail",
      sessionId: SESSION_B,
      messageId: "m-fail",
      label: "fail",
      sourceText: "I want to stay hydrated.",
    });
    const counted = countingRunner({
      "a-pass": baseModelResult(aPass, sideB),
      "a-fail": baseModelResult(aFail, sideB, {
        classification: "insufficient_or_misaligned_context",
        confidence: 0.2,
      }),
    });

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: aPass, referenceId: "ref-pass" },
        { sideA: aFail, referenceId: "ref-fail" },
      ],
      modelRunner: counted.runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.selectedPair).not.toBeNull();
    expect(result.selectedPair?.referenceId).toBe("ref-pass");
    expect(result.selectedPair?.semanticallySelected).toBe(true);
    expect(result.selectedPair?.persistable).toBe(false);
    expect(result.selectedPair?.persistenceAuthorised).toBe(false);
    expect(result.persistable).toBe(false);
    expect(result.persistenceAuthorised).toBe(false);
    expect(result.persistenceDecision).toBeNull();
    expect(result.createCandidate).toBeUndefined();
    expect(result.eligibleCount).toBe(1);
  });

  it("9. MULTIPLE REFERENCES, MULTIPLE PASS — ambiguity abstention, never fan-out", async () => {
    const a1 = source({
      sourceId: "a-multi-1",
      sessionId: SESSION_B,
      messageId: "m1",
      label: "m1",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const a2 = source({
      sourceId: "a-multi-2",
      sessionId: SESSION_B,
      messageId: "m2",
      label: "m2",
      sourceText: "I do not drink spirits after dinner.",
    });
    const counted = countingRunner({
      "a-multi-1": baseModelResult(a1, sideB, { confidence: 0.99 }),
      "a-multi-2": baseModelResult(a2, sideB, { confidence: 0.5 }),
    });

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: a1, referenceId: "ref-1" },
        { sideA: a2, referenceId: "ref-2" },
      ],
      modelRunner: counted.runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("ambiguous_multiple_matches");
    expect(result.selectedPair).toBeNull();
    expect(result.eligibleCount).toBe(2);
    expect(Array.isArray(result.selectedPair)).toBe(false);
  });

  it("10. HIGHEST OVERLAP FAILS — no forced-one fallback", async () => {
    const highOverlap = source({
      sourceId: "high-overlap",
      sessionId: SESSION_B,
      messageId: "m-high",
      label: "high",
      sourceText: "I drank whiskey last night after dinner carefully avoided.",
    });
    const lowOverlap = source({
      sourceId: "low-overlap",
      sessionId: SESSION_B,
      messageId: "m-low",
      label: "low",
      sourceText: "I prefer tea in the evenings.",
    });
    const counted = countingRunner({
      "high-overlap": baseModelResult(highOverlap, sideB, {
        classification: "compatible_states",
        bothCanSimultaneouslyBeTrue: true,
        confidence: 0.95,
      }),
      "low-overlap": baseModelResult(lowOverlap, sideB, {
        classification: "insufficient_or_misaligned_context",
        confidence: 0.1,
      }),
    });

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: highOverlap, referenceId: "ref-high" },
        { sideA: lowOverlap, referenceId: "ref-low" },
      ],
      modelRunner: counted.runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_semantic_match");
    expect(result.selectedPair).toBeNull();
  });

  it("11. MARKER-ONLY — Class C/D across marker-like nominees yields zero", async () => {
    const markerSideB = source({
      sourceId: "side-b-marker",
      sessionId: SESSION_B,
      messageId: "msg-marker-b",
      label: "b",
      sourceText: "but I mean that in a different way today under pressure.",
    });
    const a1 = source({
      sourceId: "marker-a",
      sessionId: SESSION_B,
      messageId: "m-marker",
      label: "marker",
      sourceText: "Stay calm under pressure.",
    });
    const { runner } = fixedRunner(
      baseModelResult(a1, markerSideB, {
        classification: "compatible_states",
        bothCanSimultaneouslyBeTrue: true,
        rationale: "Rhetorical but I is not contradiction.",
      }),
    );

    const result = await selectSameSessionContradictionPair({
      sideB: markerSideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-marker" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_semantic_match");
    expect(result.selectedPair).toBeNull();
  });

  it("12. QUALIFIER CONTROL — partial compliance remains Class B → zero selected", async () => {
    const a1 = source({
      sourceId: "partial-a",
      sessionId: SESSION_B,
      messageId: "m-partial",
      label: "partial",
      sourceText: "I need to review after I read.",
    });
    const bPartial = source({
      sourceId: "partial-b",
      sessionId: SESSION_B,
      messageId: "m-partial-b",
      label: "partial-b",
      sourceText:
        "I did review it after every read, but I did not do the question exercises.",
    });
    const { runner } = fixedRunner(
      baseModelResult(a1, bPartial, {
        classification: "plausible_unresolved_tension",
        bothCanSimultaneouslyBeTrue: true,
        goalVersusObstacle: true,
        propositionA: {
          normalizedProposition: "Speaker needs to review after reading",
          actor: "speaker",
          subject: "review habit",
          timeframe: "ongoing",
          negation: false,
          modality: "obligation",
          qualifications: "after reading",
        },
        propositionB: {
          normalizedProposition: "Speaker reviewed but skipped exercises",
          actor: "speaker",
          subject: "review habit",
          timeframe: "recent",
          negation: false,
          modality: "assertive",
          qualifications: "partial compliance — reviewed, skipped exercises",
        },
      }),
    );

    const result = await selectSameSessionContradictionPair({
      sideB: bPartial,
      sideACandidates: [{ sideA: a1, referenceId: "ref-partial" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_semantic_match");
    expect(result.selectedPair).toBeNull();
    expect(result.rejectionSummaries[0]?.classification).toBe(
      "plausible_unresolved_tension",
    );
  });

  it("13. TRUE SAME-SESSION CLASS A — one semantic selection, not persistable", async () => {
    const a1 = source({
      sourceId: "true-a",
      sessionId: SESSION_B,
      messageId: "m-true-a",
      label: "true-a",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner } = fixedRunner(baseModelResult(a1, sideB));

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-true" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.selectedPair?.sideA.sessionId).toBe(SESSION_B);
    expect(result.selectedPair?.sideB.sessionId).toBe(SESSION_B);
    expect(result.selectedPair?.persistable).toBe(false);
    expect(result.persistenceAuthorised).toBe(false);
  });

  it("14. SAME-MESSAGE EXACT SOURCES — may select; still non-persistable", async () => {
    const messageId = "msg-same";
    const text =
      "I never drink alcohol on weeknights. I drank whiskey last night after dinner.";
    const clauseA = source({
      sourceId: "clause-a",
      sessionId: SESSION_B,
      messageId,
      label: "clause-a",
      sourceText: text,
    });
    const clauseB = source({
      sourceId: "clause-b",
      sessionId: SESSION_B,
      messageId,
      label: "clause-b",
      sourceText: text,
    });
    const { runner } = fixedRunner(
      baseModelResult(clauseA, clauseB, {
        quoteA: "I never drink alcohol on weeknights.",
        quoteB: "I drank whiskey last night after dinner.",
      }),
    );

    const result = await selectSameSessionContradictionPair({
      sideB: clauseB,
      sideACandidates: [{ sideA: clauseA, referenceId: null }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.selectedPair?.sideA.messageId).toBe(messageId);
    expect(result.selectedPair?.sideB.messageId).toBe(messageId);
    expect(result.selectedPair?.persistable).toBe(false);
  });

  it("15. VALIDATION FAILURE — invalid offsets → zero selected (CEQR-016)", async () => {
    const a1 = source({
      sourceId: "val-a",
      sessionId: SESSION_B,
      messageId: "m-val",
      label: "val",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner } = fixedRunner(
      baseModelResult(a1, sideB, {
        evidenceClaimA: {
          startOffset: 0,
          endOffset: a1.sourceText.length + 2,
        },
      }),
    );

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-val" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("adjudication_failed");
    expect(result.selectedPair).toBeNull();
  });

  it("16. MODEL FAILURE — zero selected, no deterministic fallback", async () => {
    const a1 = source({
      sourceId: "fail-a",
      sessionId: SESSION_B,
      messageId: "m-fail",
      label: "fail",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner } = fixedRunner("fail");

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-fail" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("model_failed");
    expect(result.selectedPair).toBeNull();
  });

  it("17. REFEREE NOT RUN — Class A selected; not_run is not PASS; persistence blocked", async () => {
    const a1 = source({
      sourceId: "ref-not-run",
      sessionId: SESSION_B,
      messageId: "m-nr",
      label: "nr",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner } = fixedRunner(baseModelResult(a1, sideB));

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-nr" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.refereeStatus).toBe("not_run");
    expect(result.refereeStatus).not.toBe("PASS");
    expect(result.persistenceAuthorised).toBe(false);
  });

  it("18. REFEREE ABSTAIN — outcome preserved; persistence blocked", async () => {
    const a1 = source({
      sourceId: "ref-abstain",
      sessionId: SESSION_B,
      messageId: "m-ab",
      label: "ab",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const referee: ObjectivityReferee = {
      evaluate: () => ({
        outcome: "ABSTAIN",
        rationale: "Need more evidence.",
      }),
    };
    const { runner } = fixedRunner(baseModelResult(a1, sideB));

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-ab" }],
      modelRunner: runner,
      objectivityReferee: referee,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.refereeStatus).toBe("ABSTAIN");
    expect(result.persistenceAuthorised).toBe(false);
    expect(result.persistable).toBe(false);
  });

  it("19. FAKE REFEREE PASS — cannot authorise persistence before CEQR-005", async () => {
    const a1 = source({
      sourceId: "ref-pass",
      sessionId: SESSION_B,
      messageId: "m-pass",
      label: "pass",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const referee: ObjectivityReferee = {
      evaluate: () => ({
        outcome: "PASS",
        rationale: "fake pass for contract test",
      }),
    };
    const { runner } = fixedRunner(baseModelResult(a1, sideB));

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-pass" }],
      modelRunner: runner,
      objectivityReferee: referee,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("selected");
    expect(result.refereeStatus).toBe("PASS");
    expect(result.persistenceAuthorised).toBe(false);
    expect(result.persistable).toBe(false);
    expect(result.persistenceDecision).toBeNull();
  });

  it("20. NO FAN-OUT TYPE CONTRACT — selectedPair is null or one, never DetectedContradiction[]", async () => {
    const a1 = source({
      sourceId: "type-a",
      sessionId: SESSION_B,
      messageId: "m-type",
      label: "type",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const { runner } = fixedRunner(baseModelResult(a1, sideB));
    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: a1, referenceId: "ref-type" }],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.selectedPair).not.toBeNull();
    const pair = result.selectedPair as SemanticallySelectedContradictionPair;
    expect(Array.isArray(result.selectedPair)).toBe(false);
    expect("title" in pair).toBe(false);
    expect("type" in pair).toBe(false);
    expect("sideA" in pair).toBe(true);
    expect(typeof pair.sideA).toBe("object");

    const asDetection = result.selectedPair as unknown as DetectedContradiction;
    expect(asDetection.title).toBeUndefined();
    expect(asDetection.type).toBeUndefined();
  });

  it("cross-session reference from DB pool never reaches the model", async () => {
    const { runner, callCount } = fixedRunner("fail");
    const result = await selectSameSessionContradictionFromReferences({
      userId: USER_A,
      sideB,
      references: [
        sameSessionRef({
          id: "cross-db",
          sourceSessionId: SESSION_A,
          sourceMessage: {
            id: "msg-cross-db",
            sessionId: SESSION_A,
            userId: USER_A,
            content: "I never drink alcohol on weeknights.",
          },
        }),
      ],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_same_session_sources");
    expect(result.modelCallCount).toBe(0);
    expect(callCount()).toBe(0);
    expect(result.selectedPair).toBeNull();
  });

  it("3–5 source incompleteness paths yield zero selection and no model call", async () => {
    const { runner, callCount } = fixedRunner("fail");
    const result = await selectSameSessionContradictionFromReferences({
      userId: USER_A,
      sideB,
      references: [
        sameSessionRef({
          id: "missing-session",
          sourceSessionId: null,
        }),
        sameSessionRef({
          id: "missing-message",
          sourceMessageId: null,
          sourceMessage: null,
        }),
        sameSessionRef({
          id: "unresolved",
          sourceMessageId: "missing-msg",
          sourceMessage: null,
        }),
      ],
      modelRunner: runner,
      now: FIXED_NOW,
    });

    expect(result.selectedPair).toBeNull();
    expect(result.modelCallCount).toBe(0);
    expect(callCount()).toBe(0);
    expect(result.outcome).toBe("source_validation_failed");
  });
});

describe("CEQR-004 live/import wiring and materialisation boundary", () => {
  const root = process.cwd();

  function read(rel: string): string {
    return readFileSync(join(root, rel), "utf8");
  }

  it("21. LIVE QUERY CONTRACT — route passes session/message provenance", () => {
    const route = read("app/api/message/route.ts");
    expect(route).toMatch(/sessionId:\s*session\.id/);
    expect(route).toMatch(/messageId:\s*userMessage\.id/);
    expect(route).toMatch(/detectContradictions/);
  });

  it("22. IMPORT QUERY CONTRACT — imported conversation session is passed", () => {
    const importPath = read("lib/import-chatgpt.ts");
    expect(importPath).toMatch(/sessionId:\s*created\.sessionId/);
    expect(importPath).toMatch(/messageId:\s*importedMessage\.id/);
  });

  it("24. MATERIALISATION BOUNDARY — selection module never materialises", () => {
    const selection = read("lib/contradiction-same-session-selection.ts");
    const detection = read("lib/contradiction-detection.ts");
    const materialization = read("lib/contradiction-materialization.ts");

    expect(selection).not.toMatch(/from ["'].*contradiction-materialization["']/);
    expect(selection).not.toMatch(/import\s*\{[^}]*materializeContradictions/);
    expect(selection).not.toMatch(/export type DetectedContradiction/);
    expect(detection).not.toMatch(/selectSameSessionContradiction/);
    expect(detection).not.toMatch(/from ["'].*contradiction-same-session-selection["']/);
    expect(materialization).not.toMatch(/from ["'].*contradiction-same-session-selection["']/);
    expect(materialization).not.toMatch(/selectSameSessionContradiction/);
  });

  it("does not add production model invocation on message/import paths", () => {
    const route = read("app/api/message/route.ts");
    const importPath = read("lib/import-chatgpt.ts");
    const backfill = read("lib/contradiction-backfill.ts");

    for (const src of [route, importPath, backfill]) {
      expect(src).not.toMatch(/selectSameSessionContradiction/);
      expect(src).not.toMatch(/contradiction-same-session-selection/);
      expect(src).not.toMatch(/adjudicateContradiction/);
    }
  });

  it("detection DB query enforces same-session restriction", () => {
    const detection = read("lib/contradiction-detection.ts");
    expect(detection).toMatch(/sourceSessionId:\s*args\.sessionId/);
    expect(detection).toMatch(/sessionId:\s*string/);
  });
});

describe("CEQR-004 backfill status", () => {
  it("backfill supplies session scope but still cannot create repaired candidates", async () => {
    const backfill = readFileSync(
      join(process.cwd(), "lib/contradiction-backfill.ts"),
      "utf8",
    );
    expect(backfill).toMatch(/sessionId:\s*message\.sessionId/);
    expect(backfill).toMatch(/messageId:\s*message\.id/);
    expect(backfill).toMatch(/Do not revive marker-only backfill creation/);
  });
});
