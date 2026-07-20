/**
 * Shared structured-output helpers for kernel adjudicators (CEQR-001).
 */

import { z } from "zod";

import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  CONTRADICTION_CLASSIFICATIONS,
} from "./contracts";

export const exactEvidenceClaimSchema = z.object({
  sourceId: z.string().min(1),
  exactQuote: z.string(),
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

/**
 * Zod schema for the model-assisted contradiction adjudication structured result.
 * The model may set classification to null when abstaining.
 */
export const contradictionModelResultSchema = z.object({
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
  evidenceClaimA: exactEvidenceClaimSchema,
  evidenceClaimB: exactEvidenceClaimSchema,
  rationale: z.string(),
  alternativeInterpretation: z.string(),
  whatWouldChangeClassification: z.string(),
  abstentionReason: z.string().nullable(),
  /** Optional; if present must be ContradictionNode or omitted. Unsupported types fail closed. */
  proposedObjectType: z.string().nullable().optional(),
});

export type ContradictionModelResult = z.infer<
  typeof contradictionModelResultSchema
>;

export type PropositionFields = z.infer<typeof propositionFieldsSchema>;

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
