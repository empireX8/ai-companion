/**
 * Shared structured-output helpers for kernel adjudicators (CEQR-001 + CEQR-016).
 *
 * CEQR-016 splits provider transport from domain evidence authority:
 * - transport evidence selections carry only startOffset/endOffset;
 * - sourceId and exactQuote are code-owned after deterministic binding.
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
} from "./contracts";

/** Domain exact-evidence claim (post-binding). Not the provider transport shape. */
export const exactEvidenceClaimSchema = z.object({
  sourceId: z.string().min(1),
  exactQuote: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
});

/**
 * Provider-transport evidence selection (CEQR-016).
 * Model selects offsets only; code owns sourceId and exactQuote.
 */
export const evidenceSpanSelectionSchema = z.object({
  startOffset: z.number(),
  endOffset: z.number(),
});

export type EvidenceSpanSelection = z.infer<typeof evidenceSpanSelectionSchema>;

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

const contradictionSemanticFieldsSchema = {
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
  /** Optional; if present must be ContradictionNode or omitted. Unsupported types fail closed. */
  proposedObjectType: z.string().nullable().optional(),
} as const;

/**
 * Provider transport schema (CEQR-016 / contradiction-adjudication-schema-v2).
 * Evidence slots are offset selections only — no authoritative sourceId/exactQuote.
 */
export const contradictionModelTransportResultSchema = z.object({
  ...contradictionSemanticFieldsSchema,
  evidenceClaimA: evidenceSpanSelectionSchema,
  evidenceClaimB: evidenceSpanSelectionSchema,
});

/**
 * Domain structured result after deterministic evidence binding.
 * Evidence slots are ExactEvidenceClaim (sourceId + exactQuote + offsets).
 */
export const contradictionModelResultSchema = z.object({
  ...contradictionSemanticFieldsSchema,
  evidenceClaimA: exactEvidenceClaimSchema,
  evidenceClaimB: exactEvidenceClaimSchema,
});

export type ContradictionModelTransportResult = z.infer<
  typeof contradictionModelTransportResultSchema
>;

export type ContradictionModelResult = z.infer<
  typeof contradictionModelResultSchema
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
