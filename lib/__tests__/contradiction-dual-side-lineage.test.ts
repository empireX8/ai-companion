/**
 * CEQR-005 — dual-side exact span lineage migration + construction contract.
 * Injected fakes / pure fixtures only. No live provider. No DB mutation.
 * No materialisation. No migration application.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ContradictionAdjudicationResult } from "../contradiction-adjudicator";
import type { DetectedContradiction } from "../contradiction-detection";
import {
  CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
  buildValidatedDualSideLineage,
  classifyStoredContradictionLineage,
  hashExactQuoteSlice,
  rejectSameSpanOnBothSides,
  type DualSideLineageBuildInput,
  type ValidatedDualSideLineage,
} from "../contradiction-dual-side-lineage";
import {
  assessReferenceSourceCompleteness,
  selectSameSessionContradictionPair,
  type SemanticallySelectedContradictionPair,
} from "../contradiction-same-session-selection";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  type KernelSourceUnit,
  type ObjectivityRefereeResult,
} from "../orvek-intelligence-kernel";
import type { ExactEvidenceClaim } from "../orvek-intelligence-kernel/types";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260721003000_add_contradiction_dual_side_span_lineage/migration.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const lineageModulePath = resolve(
  process.cwd(),
  "lib/contradiction-dual-side-lineage.ts",
);
const lineageModuleSource = readFileSync(lineageModulePath, "utf8");

const USER = "user-kay";
const SESSION = "session-1";
const MSG_A = "message-a";
const MSG_B = "message-b";

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "m"));
  if (!match) throw new Error(`Model ${modelName} not found`);
  return match[0];
}

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? SESSION,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType,
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function claimAt(
  sourceUnit: KernelSourceUnit,
  exactQuote: string,
  startOffset: number,
): ExactEvidenceClaim {
  return {
    sourceId: sourceUnit.sourceId,
    exactQuote,
    startOffset,
    endOffset: startOffset + exactQuote.length,
  };
}

function refereePass(
  overrides: Partial<ObjectivityRefereeResult> = {},
): ObjectivityRefereeResult {
  return {
    interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
    executionState: "completed",
    outcome: "PASS",
    rationale: "Objectively a clear contradiction.",
    proposedObjectType: "ContradictionNode",
    proposedConfidence: 0.86,
    adjustedConfidence: null,
    routedObjectType: null,
    validationErrors: [],
    continuationAllowed: true,
    errorMessage: null,
    ...overrides,
  };
}

function buildAdjudication(args: {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
  classification?:
    | "clear_contradiction"
    | "plausible_unresolved_tension"
    | "compatible_states"
    | "insufficient_or_misaligned_context";
  outcome?: ContradictionAdjudicationResult["outcome"];
  validationStatus?: "valid" | "invalid" | "not_run";
  referee?: ObjectivityRefereeResult;
  normalizedA?: string;
}): ContradictionAdjudicationResult {
  const classification = args.classification ?? "clear_contradiction";
  const outcome = args.outcome ?? "semantic_accepted";
  const validationStatus = args.validationStatus ?? "valid";
  const semantic =
    outcome === "semantic_accepted"
      ? {
          propositionA: {
            normalizedProposition: args.normalizedA ?? "I never drink alcohol",
            actor: "speaker",
            subject: "alcohol",
            timeframe: "general",
            negation: true,
            modality: "assertive",
            qualifications: "none",
          },
          propositionB: {
            normalizedProposition: "I drank last night",
            actor: "speaker",
            subject: "alcohol",
            timeframe: "last night",
            negation: false,
            modality: "assertive",
            qualifications: "none",
          },
          contextAndScope: "same speaker",
          bothCanSimultaneouslyBeTrue: false,
          changedBeliefOverTime: false,
          intentionVersusOutcome: false,
          goalVersusObstacle: false,
          emotionalOrPhysiologicalVersusReasoningStandard: false,
          classification,
          confidence: 0.86,
          evidenceClaimA: args.claimA,
          evidenceClaimB: args.claimB,
          rationale: "Incompatible.",
          alternativeInterpretation: "Temporal change.",
          whatWouldChangeClassification: "Scoped belief change.",
          abstentionReason: null,
          proposedObjectType: "ContradictionNode",
        }
      : null;

  return {
    outcome,
    semantic,
    validation: {
      status: validationStatus,
      errors: validationStatus === "valid" ? [] : ["simulated validation failure"],
      warnings: [],
    },
    refereeStatus: args.referee?.outcome ?? "not_run",
    referee: args.referee ?? {
      interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
      executionState: "not_run",
      outcome: null,
      rationale: null,
      proposedObjectType: null,
      proposedConfidence: null,
      adjustedConfidence: null,
      routedObjectType: null,
      validationErrors: [],
      continuationAllowed: false,
      errorMessage: null,
    },
    audit: {
      processorVersion: "test",
      kernelContractVersion: "test",
      schemaVersion: "test",
      promptVersion: "test",
      providerId: "test-fake",
      modelId: "test-fake-model",
      sourceIds: [args.sideA.sourceId, args.sideB.sourceId],
      executedAt: "2026-07-21T00:00:00.000Z",
      parseValidationOutcome: validationStatus,
      semanticClassification: classification,
      abstentionOrErrorCode: null,
      refereeStatus: args.referee?.outcome ?? "not_run",
    },
    abstentionReason: null,
    errorCode: null,
    errorMessage: null,
    persistenceDecision: null,
    createCandidate: undefined,
  };
}

function selectedPair(args: {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
  adjudicationOverrides?: Parameters<typeof buildAdjudication>[0];
}): SemanticallySelectedContradictionPair {
  return {
    sideA: args.sideA,
    sideB: args.sideB,
    referenceId: "ref-1",
    semanticallySelected: true,
    persistable: false,
    persistenceAuthorised: false,
    adjudication: buildAdjudication({
      sideA: args.sideA,
      sideB: args.sideB,
      claimA: args.claimA,
      claimB: args.claimB,
      referee: refereePass(),
      ...args.adjudicationOverrides,
    }),
  };
}

function twoMessageFixture() {
  const textA = "I never drink alcohol at all.";
  const textB = "I drank three beers last night.";
  const sideA = source({
    sourceId: "src-a",
    sourceText: textA,
    label: "side_a",
    messageId: MSG_A,
    sessionId: SESSION,
  });
  const sideB = source({
    sourceId: "src-b",
    sourceText: textB,
    label: "side_b",
    messageId: MSG_B,
    sessionId: SESSION,
  });
  const quoteA = "I never drink alcohol";
  const quoteB = "I drank three beers last night";
  const claimA = claimAt(sideA, quoteA, 0);
  const claimB = claimAt(sideB, quoteB, 0);
  return {
    sideA,
    sideB,
    claimA,
    claimB,
    pair: selectedPair({ sideA, sideB, claimA, claimB }),
    resolvedMessages: {
      sideA: { id: MSG_A, sessionId: SESSION, userId: USER, content: textA },
      sideB: { id: MSG_B, sessionId: SESSION, userId: USER, content: textB },
    },
  };
}

function sameMessageFixture() {
  const text =
    "I never drink alcohol. Later: I drank three beers last night.";
  const sideA = source({
    sourceId: "src-a-same",
    sourceText: text,
    label: "side_a",
    messageId: "message-same",
    sessionId: SESSION,
  });
  const sideB = source({
    sourceId: "src-b-same",
    sourceText: text,
    label: "side_b",
    messageId: "message-same",
    sessionId: SESSION,
  });
  const quoteA = "I never drink alcohol";
  const quoteB = "I drank three beers last night";
  const claimA = claimAt(sideA, quoteA, text.indexOf(quoteA));
  const claimB = claimAt(sideB, quoteB, text.indexOf(quoteB));
  return {
    sideA,
    sideB,
    claimA,
    claimB,
    pair: selectedPair({ sideA, sideB, claimA, claimB }),
    resolvedMessages: {
      sideA: {
        id: "message-same",
        sessionId: SESSION,
        userId: USER,
        content: text,
      },
      sideB: {
        id: "message-same",
        sessionId: SESSION,
        userId: USER,
        content: text,
      },
    },
  };
}

function buildInput(
  fixture: ReturnType<typeof twoMessageFixture>,
  overrides: Partial<DualSideLineageBuildInput> = {},
): DualSideLineageBuildInput {
  return {
    userId: USER,
    selectedPair: fixture.pair,
    resolvedMessages: fixture.resolvedMessages,
    ...overrides,
  };
}

/** Compile-time proof: validated lineage is not DetectedContradiction. */
type _LineageIsNotDetectedContradiction =
  ValidatedDualSideLineage extends DetectedContradiction ? never : true;
const _lineageTypeProof: _LineageIsNotDetectedContradiction = true;
void _lineageTypeProof;

describe("CEQR-005 Prisma schema dual-side span relations", () => {
  it("1. contains exact Side A and Side B span relations", () => {
    const cn = modelBlock("ContradictionNode");
    const span = modelBlock("EvidenceSpan");

    expect(cn).toMatch(/\bsideASourceSpanId\s+String\?/);
    expect(cn).toMatch(/\bsideBSourceSpanId\s+String\?/);
    expect(cn).toMatch(
      /sideASourceSpan\s+EvidenceSpan\?\s+@relation\("ContradictionNodeSideASourceSpan"/,
    );
    expect(cn).toMatch(
      /sideBSourceSpan\s+EvidenceSpan\?\s+@relation\("ContradictionNodeSideBSourceSpan"/,
    );
    expect(cn).toMatch(/onDelete:\s*Restrict/);
    expect(cn).toContain("@@index([sideASourceSpanId])");
    expect(cn).toContain("@@index([sideBSourceSpanId])");

    expect(span).toMatch(
      /contradictionNodesAsSideA\s+ContradictionNode\[\]\s+@relation\("ContradictionNodeSideASourceSpan"\)/,
    );
    expect(span).toMatch(
      /contradictionNodesAsSideB\s+ContradictionNode\[\]\s+@relation\("ContradictionNodeSideBSourceSpan"\)/,
    );

    // Legacy fields retained.
    expect(cn).toMatch(/\bsourceSessionId\s+String\?/);
    expect(cn).toMatch(/\bsourceMessageId\s+String\?/);
  });
});

describe("CEQR-005 migration SQL contracts", () => {
  it("2–5. adds nullable columns, FKs, indexes; no DML/backfill", () => {
    expect(migrationSql).toContain('ADD COLUMN "sideASourceSpanId" TEXT');
    expect(migrationSql).toContain('ADD COLUMN "sideBSourceSpanId" TEXT');
    expect(migrationSql).toContain(
      'FOREIGN KEY ("sideASourceSpanId") REFERENCES "EvidenceSpan"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain(
      'FOREIGN KEY ("sideBSourceSpanId") REFERENCES "EvidenceSpan"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain("ContradictionNode_sideASourceSpanId_idx");
    expect(migrationSql).toContain("ContradictionNode_sideBSourceSpanId_idx");
    expect(migrationSql).toContain(
      "ContradictionNode_dual_side_span_lineage_both_or_neither_check",
    );
    expect(migrationSql).toContain(
      "ContradictionNode_dual_side_span_distinct_check",
    );

    const sqlWithoutComments = migrationSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(sqlWithoutComments).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(sqlWithoutComments).not.toMatch(/\bUPDATE\s+\S+\s+SET\b/i);
    expect(sqlWithoutComments).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sqlWithoutComments).not.toMatch(/\bDROP\s+(TABLE|INDEX|TYPE|CONSTRAINT)\b/i);
  });
});

describe("CEQR-005 stored lineage classification", () => {
  it("6. both-null is legacy_incomplete", () => {
    expect(
      classifyStoredContradictionLineage({
        sideASourceSpanId: null,
        sideBSourceSpanId: null,
      }),
    ).toBe("legacy_incomplete");
  });

  it("7. one-sided is invalid_partial", () => {
    expect(
      classifyStoredContradictionLineage({
        sideASourceSpanId: "span-a",
        sideBSourceSpanId: null,
      }),
    ).toBe("invalid_partial");
    expect(
      classifyStoredContradictionLineage({
        sideASourceSpanId: null,
        sideBSourceSpanId: "span-b",
      }),
    ).toBe("invalid_partial");
  });

  it("8. both present is complete_exact_dual_side", () => {
    expect(
      classifyStoredContradictionLineage({
        sideASourceSpanId: "span-a",
        sideBSourceSpanId: "span-b",
      }),
    ).toBe("complete_exact_dual_side");
  });

  it("9. same span ID on both sides is rejected", () => {
    const rejected = rejectSameSpanOnBothSides({
      sideASourceSpanId: "span-same",
      sideBSourceSpanId: "span-same",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("identical_side_spans");
  });
});

describe("CEQR-005 buildValidatedDualSideLineage happy paths", () => {
  it("10. valid two-message same-session exact spans pass", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lineageReadyForPersistenceGate).toBe(true);
    expect(result.continuationReady).toBe(true);
    expect(result.validatedDualSideLineage.sideA.messageId).toBe(MSG_A);
    expect(result.validatedDualSideLineage.sideB.messageId).toBe(MSG_B);
    expect(result.validatedDualSideLineage.lineageContractVersion).toBe(
      CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    );
  });

  it("11. valid same-message two-distinct-span input passes", () => {
    const fixture = sameMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validatedDualSideLineage.sideA.messageId).toBe(
      result.validatedDualSideLineage.sideB.messageId,
    );
    expect(result.validatedDualSideLineage.sideA.startOffset).not.toBe(
      result.validatedDualSideLineage.sideB.startOffset,
    );
  });
});

describe("CEQR-005 session and ownership gates", () => {
  it("12. cross-session evidence fails", () => {
    const fixture = twoMessageFixture();
    const pair = {
      ...fixture.pair,
      sideB: { ...fixture.sideB, sessionId: "other-session" },
    };
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("cross_session");
  });

  it("13. Side A message/session disagreement fails", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, {
        resolvedMessages: {
          ...fixture.resolvedMessages,
          sideA: {
            ...fixture.resolvedMessages.sideA,
            sessionId: "wrong-session",
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("kernel_session_id_mismatch_a");
  });

  it("14. Side B message/session disagreement fails", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, {
        resolvedMessages: {
          ...fixture.resolvedMessages,
          sideB: {
            ...fixture.resolvedMessages.sideB,
            sessionId: "wrong-session",
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("kernel_session_id_mismatch_b");
  });

  it("15. Side A user mismatch fails", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, {
        resolvedMessages: {
          ...fixture.resolvedMessages,
          sideA: { ...fixture.resolvedMessages.sideA, userId: "other-user" },
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("user_mismatch_a");
  });

  it("16. Side B user mismatch fails", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, {
        resolvedMessages: {
          ...fixture.resolvedMessages,
          sideB: { ...fixture.resolvedMessages.sideB, userId: "other-user" },
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("user_mismatch_b");
  });

  it("17. missing Side A message ID fails", () => {
    const fixture = twoMessageFixture();
    const pair = {
      ...fixture.pair,
      sideA: { ...fixture.sideA, messageId: null },
    };
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_message_id_a");
  });

  it("18. missing Side B message ID fails", () => {
    const fixture = twoMessageFixture();
    const pair = {
      ...fixture.pair,
      sideB: { ...fixture.sideB, messageId: "   " },
    };
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_message_id_b");
  });
});

describe("CEQR-005 evidence claim and source ID gates", () => {
  it("19. missing Side A evidence claim fails", () => {
    const fixture = twoMessageFixture();
    const adjudication = buildAdjudication({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      referee: refereePass(),
    });
    // Force-missing after construction.
    (adjudication.semantic as { evidenceClaimA: unknown }).evidenceClaimA =
      undefined;
    const pair: SemanticallySelectedContradictionPair = {
      ...fixture.pair,
      adjudication,
    };
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_evidence_claim_a");
  });

  it("20. missing Side B evidence claim fails", () => {
    const fixture = twoMessageFixture();
    const adjudication = buildAdjudication({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      referee: refereePass(),
    });
    (adjudication.semantic as { evidenceClaimB: unknown }).evidenceClaimB =
      undefined;
    const pair: SemanticallySelectedContradictionPair = {
      ...fixture.pair,
      adjudication,
    };
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_evidence_claim_b");
  });

  it("21. incorrect Side A source ID fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = { ...fixture.claimA, sourceId: "wrong-source" };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("claim_source_id_mismatch_a");
  });

  it("22. incorrect Side B source ID fails", () => {
    const fixture = twoMessageFixture();
    const badClaimB = { ...fixture.claimB, sourceId: "wrong-source" };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: badClaimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("claim_source_id_mismatch_b");
  });
});

describe("CEQR-005 exact offset and quote gates", () => {
  it("23. negative offset fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = { ...fixture.claimA, startOffset: -1 };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_offsets_a");
  });

  it("24. end <= start fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = {
      ...fixture.claimA,
      startOffset: 5,
      endOffset: 5,
    };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_offsets_a");
  });

  it("25. out-of-bounds end fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = {
      ...fixture.claimA,
      endOffset: fixture.resolvedMessages.sideA.content.length + 10,
    };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_offsets_a");
  });

  it("26. exact quote mismatch fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = {
      ...fixture.claimA,
      exactQuote: "I never drink wine",
    };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("quote_mismatch_a");
  });

  it("27. repeated quote with explicitly correct offsets passes without searching", () => {
    const repeated = "same claim. middle. same claim.";
    const first = "same claim.";
    const secondStart = repeated.lastIndexOf(first);
    const sideA = source({
      sourceId: "src-rep-a",
      sourceText: repeated,
      label: "a",
      messageId: "msg-rep-a",
    });
    const sideB = source({
      sourceId: "src-rep-b",
      sourceText: "I drank.",
      label: "b",
      messageId: "msg-rep-b",
    });
    const claimA = claimAt(sideA, first, secondStart);
    const claimB = claimAt(sideB, "I drank.", 0);
    const pair = selectedPair({ sideA, sideB, claimA, claimB });
    const result = buildValidatedDualSideLineage({
      userId: USER,
      selectedPair: pair,
      resolvedMessages: {
        sideA: {
          id: "msg-rep-a",
          sessionId: SESSION,
          userId: USER,
          content: repeated,
        },
        sideB: {
          id: "msg-rep-b",
          sessionId: SESSION,
          userId: USER,
          content: "I drank.",
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validatedDualSideLineage.sideA.startOffset).toBe(secondStart);
    expect(lineageModuleSource).not.toMatch(/\.indexOf\(/);
  });

  it("28. repeated quote with incorrect offsets fails; no first-occurrence fallback", () => {
    const repeated = "same claim. middle. same claim.";
    const first = "same claim.";
    const sideA = source({
      sourceId: "src-rep-a2",
      sourceText: repeated,
      label: "a",
      messageId: "msg-rep-a2",
    });
    const sideB = source({
      sourceId: "src-rep-b2",
      sourceText: "I drank.",
      label: "b",
      messageId: "msg-rep-b2",
    });
    // Wrong offsets: claim the first occurrence text but point at middle garbage.
    const badClaimA: ExactEvidenceClaim = {
      sourceId: sideA.sourceId,
      exactQuote: first,
      startOffset: 12,
      endOffset: 12 + first.length,
    };
    const claimB = claimAt(sideB, "I drank.", 0);
    const pair = selectedPair({
      sideA,
      sideB,
      claimA: badClaimA,
      claimB,
    });
    const result = buildValidatedDualSideLineage({
      userId: USER,
      selectedPair: pair,
      resolvedMessages: {
        sideA: {
          id: "msg-rep-a2",
          sessionId: SESSION,
          userId: USER,
          content: repeated,
        },
        sideB: {
          id: "msg-rep-b2",
          sessionId: SESSION,
          userId: USER,
          content: "I drank.",
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("quote_mismatch_a");
  });

  it("29. blank quote fails", () => {
    const fixture = twoMessageFixture();
    const badClaimA = { ...fixture.claimA, exactQuote: "   " };
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: badClaimA,
      claimB: fixture.claimB,
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("blank_quote_a");
  });

  it("30. content hash equals SHA-256 of the exact slice", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = createHash("sha256")
      .update(fixture.claimA.exactQuote, "utf8")
      .digest("hex");
    expect(result.validatedDualSideLineage.sideA.contentHash).toBe(expected);
    expect(hashExactQuoteSlice(fixture.claimA.exactQuote)).toBe(expected);
  });

  it("31. content hash is not based on normalized proposition", () => {
    const fixture = twoMessageFixture();
    const normalized = "I never drink alcohol";
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        normalizedA: "TOTALLY_DIFFERENT_NORMALIZED_PROPOSITION",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const wrongHash = createHash("sha256")
      .update("TOTALLY_DIFFERENT_NORMALIZED_PROPOSITION", "utf8")
      .digest("hex");
    expect(result.validatedDualSideLineage.sideA.contentHash).not.toBe(
      wrongHash,
    );
    expect(result.validatedDualSideLineage.sideA.contentHash).toBe(
      hashExactQuoteSlice(fixture.claimA.exactQuote),
    );
    void normalized;
  });
});

describe("CEQR-005 classification and validation gates", () => {
  it("32. Class B fails before lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        classification: "plausible_unresolved_tension",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("classification_not_clear_contradiction");
  });

  it("33. Class C fails before lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        classification: "compatible_states",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("classification_not_clear_contradiction");
  });

  it("34. Class D fails before lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        classification: "insufficient_or_misaligned_context",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("classification_not_clear_contradiction");
  });

  it("35. model abstention fails before lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        outcome: "abstained",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("adjudication_not_semantic_accepted");
  });

  it("36. deterministic adjudication validation failure blocks lineage", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        validationStatus: "invalid",
        referee: refereePass(),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("deterministic_validation_invalid");
  });
});

describe("CEQR-005 referee continuation boundary", () => {
  it("37. referee not_run blocks lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          executionState: "not_run",
          outcome: null,
          continuationAllowed: false,
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_not_run");
  });

  it("38. referee failed blocks lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          executionState: "failed",
          outcome: null,
          continuationAllowed: false,
          validationErrors: ["referee_execution_failed: boom"],
          errorMessage: "boom",
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_failed");
  });

  it("39. referee invalid_evaluation blocks lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          executionState: "invalid_evaluation",
          outcome: null,
          continuationAllowed: false,
          validationErrors: ["bad"],
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_invalid_evaluation");
  });

  it("40. referee ROUTE blocks lineage readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
          routedObjectType: "PatternClaim",
          continuationAllowed: false,
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_continuation_blocked");
  });

  it("41. referee REQUEST_MORE_EVIDENCE blocks readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          outcome: "REQUEST_MORE_EVIDENCE",
          continuationAllowed: false,
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_continuation_blocked");
  });

  it("42. referee ABSTAIN blocks readiness", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: {
          ...refereePass(),
          outcome: "ABSTAIN",
          continuationAllowed: false,
        },
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("referee_continuation_blocked");
  });

  it("43. referee PASS permits lineage readiness only", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validatedDualSideLineage.refereeOutcome).toBe("PASS");
    expect(result.persistable).toBe(false);
    expect(result.persistenceAuthorised).toBe(false);
    expect(result.createCandidate).toBeUndefined();
    expect(result.persistenceDecision).toBeNull();
  });

  it("44. PASS_WITH_LOWER_CONFIDENCE permits readiness and preserves adjusted confidence", () => {
    const fixture = twoMessageFixture();
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: fixture.claimA,
      claimB: fixture.claimB,
      adjudicationOverrides: {
        sideA: fixture.sideA,
        sideB: fixture.sideB,
        claimA: fixture.claimA,
        claimB: fixture.claimB,
        referee: refereePass({
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          adjustedConfidence: 0.55,
          continuationAllowed: true,
        }),
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validatedDualSideLineage.refereeOutcome).toBe(
      "PASS_WITH_LOWER_CONFIDENCE",
    );
    expect(result.validatedDualSideLineage.adjustedConfidence).toBe(0.55);
    expect(result.persistable).toBe(false);
  });

  it("45. successful lineage still has no persistence decision/auth/candidate", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      persistable: false,
      persistenceAuthorised: false,
      createCandidate: undefined,
      persistenceDecision: null,
    });
    expect(result).not.toHaveProperty("persistable", true);
  });
});

describe("CEQR-005 non-wiring and regression boundaries", () => {
  it("46–47. no materialisation / provider / referee production wiring in module", () => {
    expect(lineageModuleSource).not.toMatch(
      /import\s+.*materializeContradictions/,
    );
    expect(lineageModuleSource).not.toMatch(/materializeContradictions\s*\(/);
    expect(lineageModuleSource).not.toMatch(/contradictionNode\.create\s*\(/);
    expect(lineageModuleSource).not.toMatch(/contradictionNode\.update\s*\(/);
    expect(lineageModuleSource).not.toMatch(/from\s+["'].*openai/);
    expect(lineageModuleSource).not.toMatch(/runObjectivityRefereeSafely\s*\(/);
    expect(lineageModuleSource).not.toMatch(/ensureEvidenceSpan\s*\(/);
    expect(lineageModuleSource).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(lineageModuleSource).not.toMatch(/new\s+PrismaClient/);
  });

  it("48. existing same-session zero-or-one ambiguity behaviour remains unchanged", async () => {
    const textA1 = "I never drink.";
    const textA2 = "I never drink alcohol.";
    const textB = "I drank last night.";
    const sideA1 = source({
      sourceId: "a1",
      sourceText: textA1,
      label: "a1",
      messageId: "m-a1",
    });
    const sideA2 = source({
      sourceId: "a2",
      sourceText: textA2,
      label: "a2",
      messageId: "m-a2",
    });
    const sideB = source({
      sourceId: "b",
      sourceText: textB,
      label: "b",
      messageId: "m-b",
    });

    const claimFor = (s: KernelSourceUnit) => ({
      sourceId: s.sourceId,
      exactQuote: s.sourceText,
      startOffset: 0,
      endOffset: s.sourceText.length,
    });

    const modelResult = {
      propositionA: {
        normalizedProposition: "never drink",
        actor: "speaker",
        subject: "alcohol",
        timeframe: "general",
        negation: true,
        modality: "assertive",
        qualifications: "none",
      },
      propositionB: {
        normalizedProposition: "drank",
        actor: "speaker",
        subject: "alcohol",
        timeframe: "last night",
        negation: false,
        modality: "assertive",
        qualifications: "none",
      },
      contextAndScope: "same",
      bothCanSimultaneouslyBeTrue: false,
      changedBeliefOverTime: false,
      intentionVersusOutcome: false,
      goalVersusObstacle: false,
      emotionalOrPhysiologicalVersusReasoningStandard: false,
      classification: "clear_contradiction" as const,
      confidence: 0.9,
      rationale: "conflict",
      alternativeInterpretation: "none",
      whatWouldChangeClassification: "n/a",
      abstentionReason: null,
      proposedObjectType: "ContradictionNode",
    };

    const runner = {
      async runStructured({ prompt }: { prompt: string }) {
        const isA1 = prompt.includes("sourceId: a1");
        const side = isA1 ? sideA1 : sideA2;
        return {
          ok: true as const,
          object: {
            ...modelResult,
            evidenceClaimA: claimFor(side),
            evidenceClaimB: claimFor(sideB),
          },
          providerId: "test-fake",
          modelId: "test-fake-model",
          rawText: null,
        };
      },
    };

    const result = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: sideA1, referenceId: "r1" },
        { sideA: sideA2, referenceId: "r2" },
      ],
      modelRunner: runner,
      objectivityReferee: {
        evaluate: () => ({
          outcome: "PASS" as const,
          rationale: "ok",
        }),
      },
    });

    expect(result.outcome).toBe("ambiguous_multiple_matches");
    expect(result.selectedPair).toBeNull();
    expect(result.persistable).toBe(false);
  });

  it("49. existing cross-session exclusion remains unchanged", () => {
    const assessment = assessReferenceSourceCompleteness({
      reference: {
        id: "ref-x",
        type: "goal",
        statement: "I never drink",
        sourceSessionId: "other-session",
        sourceMessageId: "msg-x",
        sourceMessage: {
          id: "msg-x",
          sessionId: "other-session",
          userId: USER,
          content: "I never drink",
        },
      },
      currentSessionId: SESSION,
      userId: USER,
    });
    expect(assessment).toEqual({ ok: false, reason: "cross_session_excluded" });
  });

  it("50. compile-time/type proof that lineage result is not DetectedContradiction", () => {
    const fixture = twoMessageFixture();
    const result = buildValidatedDualSideLineage(buildInput(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lineage = result.validatedDualSideLineage;
    // Runtime shape divergence from DetectedContradiction.
    expect(lineage).not.toHaveProperty("title");
    expect(lineage).not.toHaveProperty("type");
    expect(lineage).toHaveProperty("sideA.startOffset");
    expect(lineage).toHaveProperty("spanEnsureDescriptors");

    type AssertNotDetected = ValidatedDualSideLineage extends DetectedContradiction
      ? "fail"
      : "pass";
    const proof: AssertNotDetected = "pass";
    expect(proof).toBe("pass");
  });

  it("identical same-message span identities fail closed", () => {
    const fixture = sameMessageFixture();
    const identicalClaim = fixture.claimA;
    const pair = selectedPair({
      sideA: fixture.sideA,
      sideB: fixture.sideB,
      claimA: identicalClaim,
      claimB: {
        ...identicalClaim,
        sourceId: fixture.sideB.sourceId,
      },
    });
    const result = buildValidatedDualSideLineage(
      buildInput(fixture, { selectedPair: pair }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("identical_side_spans");
  });

  it("version constant is set and adjudication versions are not bumped by this module", () => {
    expect(CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION).toBe(
      "contradiction-dual-side-lineage-v1",
    );
    const contracts = readFileSync(
      join(process.cwd(), "lib/orvek-intelligence-kernel/contracts.ts"),
      "utf8",
    );
    // Sanity: lineage module does not rewrite contract version constants.
    expect(lineageModuleSource).not.toMatch(
      /CONTRADICTION_ADJUDICATION_PROMPT_VERSION\s*=/,
    );
    expect(lineageModuleSource).not.toMatch(
      /OBJECTIVITY_REFEREE_INTERFACE_VERSION\s*=/,
    );
    expect(contracts).toMatch(/CONTRADICTION_ADJUDICATION_PROMPT_VERSION/);
  });
});
