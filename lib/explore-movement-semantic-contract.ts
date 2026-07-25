/**
 * Explore movement semantic adjudication contract (DEL-001B).
 *
 * Domain parser is a strict versioned discriminated union.
 * OpenAI-strict nullable envelopes are validated as strict objects first,
 * then normalised into this domain contract.
 * Malformed / partial / contradictory output fails closed.
 */

import { z } from "zod";

import {
  OBJECTIVITY_REFEREE_OUTCOMES,
} from "./orvek-intelligence-kernel/objectivity-referee";

export const EXPLORE_MOVEMENT_SEMANTIC_CONTRACT_VERSION =
  "explore-movement-semantic-v1" as const;

/**
 * Deterministic minimum confidence for Explore UMC strengthening proposals.
 * Intentionally above the soft medium band floor (0.5) so weak adjudicator
 * confidence does not maximise proposal creation.
 */
export const EXPLORE_MOVEMENT_MIN_CONFIDENCE = 0.6 as const;

export const EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS = 2_000 as const;
export const EXPLORE_MOVEMENT_MAX_SUMMARY_CHARS = 2_000 as const;
export const EXPLORE_MOVEMENT_MAX_USER_FACING_CHARS = 480 as const;

/** Writable proposed object for this delivery — only UserMapConclusion. */
export const EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE =
  "UserMapConclusion" as const;

/**
 * Routed object labels from DEL-005 semantic authority.
 * Recognition does not authorise writing these objects in this delivery.
 */
export const EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES = [
  "PatternClaim",
  "ContradictionNode",
  "Investigation",
  "FieldworkAssignment",
  "ReferenceItem",
  "Decision",
  "Outcome",
] as const;

export type ExploreMovementRoutedObjectType =
  (typeof EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES)[number];

export const EXPLORE_MOVEMENT_SEMANTIC_OUTCOMES = [
  "PROPOSE_CONCLUSION_STRENGTHENING",
  "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
  "REQUEST_MORE_EVIDENCE",
  "ABSTAIN",
] as const;

export type ExploreMovementSemanticOutcome =
  (typeof EXPLORE_MOVEMENT_SEMANTIC_OUTCOMES)[number];

const nonBlankBounded = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max);

const confidenceSchema = z
  .number()
  .finite()
  .min(0)
  .max(1);

const proposeConclusionStrengtheningSchema = z
  .object({
    outcome: z.literal("PROPOSE_CONCLUSION_STRENGTHENING"),
    proposedObjectType: z.literal(
      EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE
    ),
    targetObjectId: z.string().trim().min(1),
    afterSummary: nonBlankBounded(EXPLORE_MOVEMENT_MAX_SUMMARY_CHARS),
    rationale: nonBlankBounded(EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS),
    userFacingSummary: nonBlankBounded(EXPLORE_MOVEMENT_MAX_USER_FACING_CHARS),
    confidence: confidenceSchema,
    alternativeInterpretation: nonBlankBounded(
      EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS
    ),
    qualificationContext: nonBlankBounded(EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS),
    evidenceSourceIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

const routeToDifferentObjectTypeSchema = z
  .object({
    outcome: z.literal("ROUTE_TO_DIFFERENT_OBJECT_TYPE"),
    routedObjectType: z.enum(EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES),
    rationale: nonBlankBounded(EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS),
  })
  .strict();

const requestMoreEvidenceSchema = z
  .object({
    outcome: z.literal("REQUEST_MORE_EVIDENCE"),
    rationale: nonBlankBounded(EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS),
  })
  .strict();

const abstainSchema = z
  .object({
    outcome: z.literal("ABSTAIN"),
    rationale: nonBlankBounded(EXPLORE_MOVEMENT_MAX_RATIONALE_CHARS),
  })
  .strict();

/** Strict domain discriminated union. */
export const exploreMovementSemanticDecisionSchema = z.discriminatedUnion(
  "outcome",
  [
    proposeConclusionStrengtheningSchema,
    routeToDifferentObjectTypeSchema,
    requestMoreEvidenceSchema,
    abstainSchema,
  ]
);

export type ExploreMovementSemanticDecision = z.infer<
  typeof exploreMovementSemanticDecisionSchema
>;

export type ExploreMovementProposeConclusionStrengthening = z.infer<
  typeof proposeConclusionStrengtheningSchema
>;

/**
 * OpenAI strict JSON Schema forbids root anyOf and optional fields.
 * Provider-facing envelope uses nullable fields; domain parser stays strict.
 */
export const EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY = "decision" as const;

const exploreMovementOpenAiStrictDecisionSchema = z
  .object({
    outcome: z.enum(EXPLORE_MOVEMENT_SEMANTIC_OUTCOMES),
    proposedObjectType: z.string().nullable(),
    targetObjectId: z.string().nullable(),
    afterSummary: z.string().nullable(),
    rationale: z.string().nullable(),
    userFacingSummary: z.string().nullable(),
    confidence: z.number().nullable(),
    alternativeInterpretation: z.string().nullable(),
    qualificationContext: z.string().nullable(),
    evidenceSourceIds: z.array(z.string()).nullable(),
    routedObjectType: z.string().nullable(),
  })
  .strict();

export const exploreMovementSemanticOpenAiStrictEnvelopeSchema = z
  .object({
    [EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY]:
      exploreMovementOpenAiStrictDecisionSchema,
  })
  .strict();

export type ExploreMovementSemanticOpenAiStrictEnvelope = z.infer<
  typeof exploreMovementSemanticOpenAiStrictEnvelopeSchema
>;

export type ExploreMovementSemanticParseResult =
  | { ok: true; decision: ExploreMovementSemanticDecision }
  | { ok: false; errors: string[] };

function isPopulated(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

const PROPOSAL_FIELD_KEYS = [
  "proposedObjectType",
  "targetObjectId",
  "afterSummary",
  "userFacingSummary",
  "confidence",
  "alternativeInterpretation",
  "qualificationContext",
  "evidenceSourceIds",
] as const;

/**
 * Outcome nullability rules for provider envelopes (before domain normalisation).
 */
function envelopeOutcomeNullabilityErrors(
  decision: z.infer<typeof exploreMovementOpenAiStrictDecisionSchema>
): string[] {
  const errors: string[] = [];
  const outcome = decision.outcome;

  if (outcome === "PROPOSE_CONCLUSION_STRENGTHENING") {
    if (isPopulated(decision.routedObjectType)) {
      errors.push(
        "explore_movement_semantic_forbidden_field: routedObjectType must be null/absent for PROPOSE_CONCLUSION_STRENGTHENING."
      );
    }
    return errors;
  }

  if (outcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
    for (const key of PROPOSAL_FIELD_KEYS) {
      if (isPopulated(decision[key])) {
        errors.push(
          `explore_movement_semantic_forbidden_field: ${key} must be null/absent for ROUTE_TO_DIFFERENT_OBJECT_TYPE.`
        );
      }
    }
    return errors;
  }

  // REQUEST_MORE_EVIDENCE / ABSTAIN
  for (const key of PROPOSAL_FIELD_KEYS) {
    if (isPopulated(decision[key])) {
      errors.push(
        `explore_movement_semantic_forbidden_field: ${key} must be null/absent for ${outcome}.`
      );
    }
  }
  if (isPopulated(decision.routedObjectType)) {
    errors.push(
      `explore_movement_semantic_forbidden_field: routedObjectType must be null/absent for ${outcome}.`
    );
  }
  return errors;
}

/**
 * Convert a validated nullable envelope decision into a candidate domain object.
 * Does not strip unknown keys — envelope was already `.strict()` validated.
 */
export function normalizeExploreMovementProviderObject(
  value: unknown
): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const outcome = record.outcome;
  if (typeof outcome !== "string") {
    return value;
  }

  if (outcome === "PROPOSE_CONCLUSION_STRENGTHENING") {
    return {
      outcome,
      proposedObjectType: record.proposedObjectType,
      targetObjectId: record.targetObjectId,
      afterSummary: record.afterSummary,
      rationale: record.rationale,
      userFacingSummary: record.userFacingSummary,
      confidence: record.confidence,
      alternativeInterpretation: record.alternativeInterpretation,
      qualificationContext: record.qualificationContext,
      evidenceSourceIds: record.evidenceSourceIds,
    };
  }

  if (outcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
    return {
      outcome,
      routedObjectType: record.routedObjectType,
      rationale: record.rationale,
    };
  }

  if (outcome === "REQUEST_MORE_EVIDENCE" || outcome === "ABSTAIN") {
    return {
      outcome,
      rationale: record.rationale,
    };
  }

  return value;
}

function parseDirectDomainDecision(
  value: unknown
): ExploreMovementSemanticParseResult {
  const parsed = exploreMovementSemanticDecisionSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) =>
          `explore_movement_semantic_invalid: ${issue.path.join(".") || "(root)"}: ${issue.message}`
      ),
    };
  }
  return { ok: true, decision: parsed.data };
}

function parseOpenAiStrictEnvelope(
  value: unknown
): ExploreMovementSemanticParseResult {
  const envelope = exploreMovementSemanticOpenAiStrictEnvelopeSchema.safeParse(
    value
  );
  if (!envelope.success) {
    return {
      ok: false,
      errors: envelope.error.issues.map(
        (issue) =>
          `explore_movement_semantic_envelope_invalid: ${issue.path.join(".") || "(root)"}: ${issue.message}`
      ),
    };
  }

  const decision = envelope.data.decision;
  const nullabilityErrors = envelopeOutcomeNullabilityErrors(decision);
  if (nullabilityErrors.length > 0) {
    return { ok: false, errors: nullabilityErrors };
  }

  const normalised = normalizeExploreMovementProviderObject(decision);
  return parseDirectDomainDecision(normalised);
}

function isOpenAiStrictEnvelopeShape(value: unknown): boolean {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY in (value as object)
  );
}

/**
 * Parse a semantic decision.
 *
 * - Direct domain-shaped input: strict discriminated union (no unknown-field stripping).
 * - Provider envelope (`{ decision: ... }`): strict envelope validation + outcome
 *   nullability rules, then domain parse.
 */
export function parseExploreMovementSemanticDecision(
  value: unknown
): ExploreMovementSemanticParseResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        "explore_movement_semantic_malformed: expected a semantic decision object.",
      ],
    };
  }

  if (isOpenAiStrictEnvelopeShape(value)) {
    return parseOpenAiStrictEnvelope(value);
  }

  return parseDirectDomainDecision(value);
}

/** @deprecated Prefer parseExploreMovementSemanticDecision; kept for call-site unwrap. */
export function unwrapExploreMovementOpenAiStrictEnvelope(
  value: unknown
): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY in record) {
    const nested = record[EXPLORE_MOVEMENT_OPENAI_STRICT_ENVELOPE_KEY];
    return nested === undefined ? null : nested;
  }
  return value;
}

export function isExploreMovementRoutedObjectType(
  value: unknown
): value is ExploreMovementRoutedObjectType {
  return (
    typeof value === "string" &&
    (EXPLORE_MOVEMENT_ROUTED_OBJECT_TYPES as readonly string[]).includes(value)
  );
}

/** Shared referee outcome list re-export for Explore provider schemas. */
export const EXPLORE_MOVEMENT_REFEREE_OUTCOMES = OBJECTIVITY_REFEREE_OUTCOMES;
