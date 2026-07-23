/**
 * CEQR-021 — distinct controlled-live addendum + schema-v4 offline proofs.
 *
 * The addendum identity is distinct from production addendum-v4. Offline
 * preparation pins it; live execution (separately authorised) must inject it.
 */

import { createHash } from "crypto";

import {
  CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
  CEQR_021_EXPECTED_PROMPT_VERSION,
  CEQR_021_EXPECTED_SCHEMA_VERSION,
} from "./ceqr021-constants";
import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
} from "./orvek-intelligence-kernel/contracts";
import {
  abstentionTransportSchema,
  clearContradictionTransportSchema,
  classifiedNonClearTransportSchema,
  contradictionModelTransportResultSchema,
  evidenceSpanSelectionSchema,
} from "./orvek-intelligence-kernel/structured-output";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY,
  contradictionModelResultOpenAiStrictSchema,
} from "./contradiction-live-provider-adapters";

export const CEQR_021_LIVE_ADDENDUM_TEXT = [
  "",
  `LIVE PROVIDER EVIDENCE HARD RULES (${CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION}):`,
  "CEQR-021 CONTROLLED SCHEMA-V4 LIVE PROOF ADDENDUM:",
  "- This addendum is distinct from contradiction-live-adjudicator-prompt-addendum-v4.",
  "- evidenceClaimA and evidenceClaimB MUST contain ONLY startBoundaryIndex and endBoundaryIndex.",
  "- Do NOT author sourceId.",
  "- Do NOT author exactQuote.",
  "- Do NOT author raw startOffset/endOffset character counts.",
  "- Deterministic code copies sourceId from the authoritative Side A / Side B units.",
  "- Deterministic code maps boundary indices to UTF-16 offsets via the code-owned catalog.",
  "- Deterministic code derives exactQuote as sourceText.slice(startOffset, endOffset).",
  "- Prefer complete proposition spans; do not select isolated nouns, verbs, or partial clauses.",
  "- Mid-word character cuts are structurally absent from the catalog.",
  "- Do not rely on clamping, fuzzy matching, substring search, or full-source fallback.",
  "",
  "LIVE PROVIDER CONSISTENCY HARD RULES:",
  "- If classification is clear_contradiction, then bothCanSimultaneouslyBeTrue, changedBeliefOverTime, intentionVersusOutcome, goalVersusObstacle, and emotionalOrPhysiologicalVersusReasoningStandard MUST all be false.",
  "- If timeframe/scope qualifiers make both true, choose compatible_states instead of clear_contradiction.",
  "- If evidence is insufficient, abstain with a non-blank abstentionReason.",
].join("\n");

export function buildCeqr021LiveAddendumSha256(): string {
  return createHash("sha256")
    .update(CEQR_021_LIVE_ADDENDUM_TEXT, "utf8")
    .digest("hex");
}

export type Ceqr021SchemaV4ContractProof = {
  activeSchemaVersion: string;
  activePromptVersion: string;
  productionAddendumVersion: string;
  ceqr021AddendumVersion: typeof CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION;
  transportFields: ["startBoundaryIndex", "endBoundaryIndex"];
  excludedTransportFields: [
    "startOffset",
    "endOffset",
    "sourceId",
    "exactQuote",
  ];
  boundaryFieldsIntegerNonnegative: boolean;
  clearRequiresAllCompatibilityFlagsFalse: boolean;
  forbiddenClearPlusCompatibleFailsClosed: boolean;
  abstentionRetainsRequiredShape: boolean;
  schemaIdentityMatchesExpected: boolean;
  promptIdentityMatchesExpected: boolean;
  addendumDistinctFromProductionV4: boolean;
};

export function proveCeqr021SchemaV4ProviderContract(): Ceqr021SchemaV4ContractProof {
  const shape = evidenceSpanSelectionSchema.shape;
  const hasStart = "startBoundaryIndex" in shape;
  const hasEnd = "endBoundaryIndex" in shape;
  const excluded = ["startOffset", "endOffset", "sourceId", "exactQuote"] as const;
  const hasExcluded = excluded.some((key) => key in shape);

  const clearParseOk = clearContradictionTransportSchema.safeParse({
    classification: "clear_contradiction",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    propositionA: {
      normalizedProposition: "a",
      actor: "a",
      subject: "a",
      timeframe: "a",
      negation: false,
      modality: "a",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "b",
      subject: "b",
      timeframe: "b",
      negation: false,
      modality: "b",
      qualifications: "none",
    },
    contextAndScope: "x",
    confidence: 0.5,
    rationale: "x",
    alternativeInterpretation: "x",
    whatWouldChangeClassification: "x",
    evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
  }).success;

  const clearWithTrueFlagRejected = !clearContradictionTransportSchema.safeParse({
    classification: "clear_contradiction",
    bothCanSimultaneouslyBeTrue: true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    propositionA: {
      normalizedProposition: "a",
      actor: "a",
      subject: "a",
      timeframe: "a",
      negation: false,
      modality: "a",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "b",
      subject: "b",
      timeframe: "b",
      negation: false,
      modality: "b",
      qualifications: "none",
    },
    contextAndScope: "x",
    confidence: 0.5,
    rationale: "x",
    alternativeInterpretation: "x",
    whatWouldChangeClassification: "x",
    evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
  }).success;

  const forbidden = contradictionModelTransportResultSchema.safeParse({
    classification: "clear_contradiction",
    bothCanSimultaneouslyBeTrue: true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    propositionA: {
      normalizedProposition: "a",
      actor: "a",
      subject: "a",
      timeframe: "a",
      negation: false,
      modality: "a",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "b",
      subject: "b",
      timeframe: "b",
      negation: false,
      modality: "b",
      qualifications: "none",
    },
    contextAndScope: "x",
    confidence: 0.5,
    rationale: "x",
    alternativeInterpretation: "x",
    whatWouldChangeClassification: "x",
    evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
  });

  const abstentionProbe = abstentionTransportSchema.safeParse({
    classification: null,
    bothCanSimultaneouslyBeTrue: true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: "insufficient_evidence",
    propositionA: {
      normalizedProposition: "a",
      actor: "a",
      subject: "a",
      timeframe: "a",
      negation: false,
      modality: "a",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "b",
      subject: "b",
      timeframe: "b",
      negation: false,
      modality: "b",
      qualifications: "none",
    },
    contextAndScope: "x",
    confidence: 0.2,
    rationale: "x",
    alternativeInterpretation: "x",
    whatWouldChangeClassification: "x",
    evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
  });

  // Non-clear cannot masquerade as clear: classifiedNonClear rejects clear_contradiction.
  const masquerade = classifiedNonClearTransportSchema.safeParse({
    classification: "clear_contradiction",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    propositionA: {
      normalizedProposition: "a",
      actor: "a",
      subject: "a",
      timeframe: "a",
      negation: false,
      modality: "a",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "b",
      actor: "b",
      subject: "b",
      timeframe: "b",
      negation: false,
      modality: "b",
      qualifications: "none",
    },
    contextAndScope: "x",
    confidence: 0.5,
    rationale: "x",
    alternativeInterpretation: "x",
    whatWouldChangeClassification: "x",
    evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
    evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
  });

  const intNonneg =
    evidenceSpanSelectionSchema.safeParse({
      startBoundaryIndex: 0,
      endBoundaryIndex: 1,
    }).success &&
    !evidenceSpanSelectionSchema.safeParse({
      startBoundaryIndex: -1,
      endBoundaryIndex: 1,
    }).success &&
    !evidenceSpanSelectionSchema.safeParse({
      startBoundaryIndex: 0.5,
      endBoundaryIndex: 1,
    }).success;

  return {
    activeSchemaVersion: CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
    activePromptVersion: CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
    productionAddendumVersion:
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    ceqr021AddendumVersion: CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION,
    transportFields: ["startBoundaryIndex", "endBoundaryIndex"],
    excludedTransportFields: [
      "startOffset",
      "endOffset",
      "sourceId",
      "exactQuote",
    ],
    boundaryFieldsIntegerNonnegative: intNonneg && hasStart && hasEnd && !hasExcluded,
    clearRequiresAllCompatibilityFlagsFalse:
      clearParseOk && clearWithTrueFlagRejected,
    forbiddenClearPlusCompatibleFailsClosed: forbidden.success === false,
    abstentionRetainsRequiredShape: abstentionProbe.success === true,
    schemaIdentityMatchesExpected:
      CONTRADICTION_ADJUDICATION_SCHEMA_VERSION ===
      CEQR_021_EXPECTED_SCHEMA_VERSION,
    promptIdentityMatchesExpected:
      CONTRADICTION_ADJUDICATION_PROMPT_VERSION ===
      CEQR_021_EXPECTED_PROMPT_VERSION,
    addendumDistinctFromProductionV4:
      (CEQR_021_EXPECTED_LIVE_ADDENDUM_VERSION as string) !==
        (CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION as string) &&
      masquerade.success === false,
  };
}

/**
 * Offline OpenAI strict-schema generation probe.
 * Does not claim live OpenAI acceptance.
 */
export async function generateCeqr021OpenAiStrictSchemaOffline(): Promise<{
  ok: boolean;
  rootType: string | null;
  rootAnyOfForbidden: boolean;
  nestedAnyOfCount: number | null;
  envelopeKey: typeof CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY;
  unsupportedConstructDetected: boolean;
  message: string;
}> {
  try {
    const { Output } = await import("ai");
    const out = Output.object({
      schema: contradictionModelResultOpenAiStrictSchema,
      name: "ContradictionAdjudicationCeqr021",
    });
    const rf = await Promise.resolve(out.responseFormat);
    if (rf == null || rf.type !== "json" || rf.schema == null) {
      return {
        ok: false,
        rootType: null,
        rootAnyOfForbidden: false,
        nestedAnyOfCount: null,
        envelopeKey: CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY,
        unsupportedConstructDetected: true,
        message: "expected json responseFormat with schema",
      };
    }
    const schema = rf.schema as {
      type?: string;
      anyOf?: unknown;
      oneOf?: unknown;
      properties?: Record<string, { anyOf?: unknown[] }>;
      required?: string[];
    };
    const nested =
      schema.properties?.[CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY]?.anyOf;
    return {
      ok:
        schema.type === "object" &&
        schema.anyOf == null &&
        schema.oneOf == null &&
        Array.isArray(nested) &&
        nested.length === 3,
      rootType: schema.type ?? null,
      rootAnyOfForbidden: schema.anyOf == null && schema.oneOf == null,
      nestedAnyOfCount: Array.isArray(nested) ? nested.length : null,
      envelopeKey: CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY,
      unsupportedConstructDetected: false,
      message:
        "Offline OpenAI-strict schema generated; live acceptance not claimed.",
    };
  } catch (error) {
    return {
      ok: false,
      rootType: null,
      rootAnyOfForbidden: false,
      nestedAnyOfCount: null,
      envelopeKey: CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY,
      unsupportedConstructDetected: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
