/**
 * Shared structured-output helpers for kernel adjudicators
 * (CEQR-001 + CEQR-016 + CEQR-018 + CEQR-020).
 *
 * CEQR-016 splits provider transport from domain evidence authority:
 * - sourceId and exactQuote are code-owned after deterministic binding.
 *
 * CEQR-018 makes forbidden clear_contradiction + compatibility-flag
 * combinations structurally unrepresentable in the provider transport
 * contract via classification-discriminated variants (Zod union → JSON
 * Schema anyOf). Deterministic validation remains defence in depth.
 *
 * CEQR-020 replaces raw UTF-16 offset transport with code-owned lexical
 * boundary indices (startBoundaryIndex / endBoundaryIndex). Code maps
 * indices to offsets; mid-word cuts are absent from the catalog.
 *
 * TRANSPORT and DOMAIN schemas/types/parsers remain distinct:
 * - provider I/O uses contradictionModelTransportResultSchema;
 * - bound domain results use contradictionModelResultSchema.
 */

import { z } from "zod";

import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  CONTRADICTION_CLASSIFICATIONS,
  NON_CONTRADICTION_NODE_CLASSIFICATIONS,
} from "./contracts";

/** Domain exact-evidence claim (post-binding). Not the provider transport shape. */
export const exactEvidenceClaimSchema = z.object({
  sourceId: z.string().min(1),
  exactQuote: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
});

/**
 * Provider-transport evidence selection (CEQR-020 / schema-v4).
 * Model selects indices into the code-owned lexical boundary catalog.
 * Code maps indices → UTF-16 offsets and owns sourceId / exactQuote.
 *
 * OpenAI-compatible integer contract: non-negative integers. Dynamic upper
 * bound remains code-owned and enforced by deterministic catalog range gates
 * (Zod cannot encode per-request catalog length in a static strict schema).
 */
export const evidenceSpanSelectionSchema = z.object({
  startBoundaryIndex: z.number().int().nonnegative(),
  endBoundaryIndex: z.number().int().nonnegative(),
});

export type EvidenceSpanSelection = z.infer<typeof evidenceSpanSelectionSchema>;

/**
 * Historical CEQR-016…019 raw-offset transport shape (immutable receipts only).
 * Not used by the active provider contract.
 */
export const historicalEvidenceSpanOffsetSelectionSchema = z.object({
  startOffset: z.number(),
  endOffset: z.number(),
});

export const propositionFieldsSchema = z.object({
  normalizedProposition: z.string(),
  actor: z.string(),
  subject: z.string(),
  timeframe: z.string(),
  negation: z.boolean(),
  modality: z.string(),
  qualifications: z.string(),
});

export type PropositionFields = z.infer<typeof propositionFieldsSchema>;

const transportSharedFields = {
  propositionA: propositionFieldsSchema,
  propositionB: propositionFieldsSchema,
  contextAndScope: z.string(),
  confidence: z.number().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX),
  rationale: z.string(),
  alternativeInterpretation: z.string(),
  whatWouldChangeClassification: z.string(),
  /** Optional; if present must be ContradictionNode or omitted. Unsupported types fail closed. */
  proposedObjectType: z.string().nullable().optional(),
  evidenceClaimA: evidenceSpanSelectionSchema,
  evidenceClaimB: evidenceSpanSelectionSchema,
} as const;

const compatibilityFlagBooleans = {
  bothCanSimultaneouslyBeTrue: z.boolean(),
  changedBeliefOverTime: z.boolean(),
  intentionVersusOutcome: z.boolean(),
  goalVersusObstacle: z.boolean(),
  emotionalOrPhysiologicalVersusReasoningStandard: z.boolean(),
} as const;

/** clear_contradiction structurally requires every compatibility flag false. */
export const clearContradictionTransportSchema = z.object({
  ...transportSharedFields,
  classification: z.literal("clear_contradiction"),
  bothCanSimultaneouslyBeTrue: z.literal(false),
  changedBeliefOverTime: z.literal(false),
  intentionVersusOutcome: z.literal(false),
  goalVersusObstacle: z.literal(false),
  emotionalOrPhysiologicalVersusReasoningStandard: z.literal(false),
  abstentionReason: z.null(),
});

/** Classified non-clear variants: supported classification + abstentionReason null. */
export const classifiedNonClearTransportSchema = z.object({
  ...transportSharedFields,
  classification: z.enum(NON_CONTRADICTION_NODE_CLASSIFICATIONS),
  ...compatibilityFlagBooleans,
  abstentionReason: z.null(),
});

/**
 * Abstention variant: classification null + truthful nonblank abstentionReason.
 * `z.string().regex(/\S/)` alone rejects empty and whitespace-only strings and
 * emits JSON Schema `pattern` on the provider-facing contract.
 */
export const abstentionTransportSchema = z.object({
  ...transportSharedFields,
  classification: z.null(),
  ...compatibilityFlagBooleans,
  abstentionReason: z.string().regex(/\S/),
});

/**
 * Provider transport schema (CEQR-020 / contradiction-adjudication-schema-v4).
 *
 * Classification-discriminated union (emits JSON Schema `anyOf`, not `oneOf`).
 * Evidence slots are lexical boundary-index selections — no authoritative
 * sourceId/exactQuote and no raw character offsets authored by the provider.
 *
 * Forbidden: clear_contradiction with any compatibility flag true.
 * Forbidden: classified result with affirmative abstentionReason.
 * Forbidden: classification null with blank/null abstentionReason.
 */
export const contradictionModelTransportResultSchema = z.union([
  clearContradictionTransportSchema,
  classifiedNonClearTransportSchema,
  abstentionTransportSchema,
]);

/**
 * Domain semantic fields remain a flat object after binding.
 * Semantic consistency is still enforced by collectSemanticConsistencyErrors
 * (defence in depth); the domain schema does not silently reclassify.
 */
const contradictionDomainSemanticFieldsSchema = {
  propositionA: propositionFieldsSchema,
  propositionB: propositionFieldsSchema,
  contextAndScope: z.string(),
  bothCanSimultaneouslyBeTrue: z.boolean(),
  changedBeliefOverTime: z.boolean(),
  intentionVersusOutcome: z.boolean(),
  goalVersusObstacle: z.boolean(),
  emotionalOrPhysiologicalVersusReasoningStandard: z.boolean(),
  classification: z.enum(CONTRADICTION_CLASSIFICATIONS).nullable(),
  confidence: z.number().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX),
  rationale: z.string(),
  alternativeInterpretation: z.string(),
  whatWouldChangeClassification: z.string(),
  abstentionReason: z.string().nullable(),
  proposedObjectType: z.string().nullable().optional(),
} as const;

/**
 * Domain structured result after deterministic evidence binding.
 * Evidence slots are ExactEvidenceClaim (sourceId + exactQuote + offsets).
 */
export const contradictionModelResultSchema = z.object({
  ...contradictionDomainSemanticFieldsSchema,
  evidenceClaimA: exactEvidenceClaimSchema,
  evidenceClaimB: exactEvidenceClaimSchema,
});

export type ContradictionModelTransportResult = z.infer<
  typeof contradictionModelTransportResultSchema
>;

export type ContradictionModelResult = z.infer<
  typeof contradictionModelResultSchema
>;

export type ClearContradictionTransportResult = z.infer<
  typeof clearContradictionTransportSchema
>;
export type ClassifiedNonClearTransportResult = z.infer<
  typeof classifiedNonClearTransportSchema
>;
export type AbstentionTransportResult = z.infer<
  typeof abstentionTransportSchema
>;

export function parseContradictionModelTransportResult(
  value: unknown,
):
  | { success: true; data: ContradictionModelTransportResult }
  | { success: false; error: string } {
  const parsed = contradictionModelTransportResultSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }
  return { success: true, data: parsed.data };
}

/**
 * Parse a bound domain ContradictionModelResult (ExactEvidenceClaim evidence).
 * Not for raw provider I/O — use parseContradictionModelTransportResult there.
 */
export function parseContradictionModelResult(
  value: unknown,
):
  | { success: true; data: ContradictionModelResult }
  | { success: false; error: string } {
  const parsed = contradictionModelResultSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }
  return { success: true, data: parsed.data };
}
