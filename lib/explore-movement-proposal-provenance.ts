/**
 * Versioned ExploreMovementProposal.sourcesJson provenance envelope (DEL-001B).
 *
 * Cross-field coherence is required: sources, semanticDecision evidence IDs,
 * referee result, and successful provider call metadata must agree.
 * Legacy array-only sourcesJson remains readable for historical display only.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  EXPLORE_GROUNDING_CLAIM_SUPPORTS,
  EXPLORE_GROUNDING_EPISTEMIC_STATUSES,
  EXPLORE_GROUNDING_SOURCE_FAMILIES,
  type ExploreGroundingSource,
} from "./explore-grounding-contract";
import {
  EXPLORE_MOVEMENT_MIN_CONFIDENCE,
  EXPLORE_MOVEMENT_SEMANTIC_CONTRACT_VERSION,
  EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE,
  exploreMovementSemanticDecisionSchema,
  type ExploreMovementProposeConclusionStrengthening,
  type ExploreMovementSemanticDecision,
} from "./explore-movement-semantic-contract";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  refereeAllowsContinuation,
  validateObjectivityRefereeEvaluation,
  type ObjectivityRefereeResult,
} from "./orvek-intelligence-kernel/objectivity-referee";

export const EXPLORE_MOVEMENT_PROPOSAL_PROVENANCE_VERSION =
  EXPLORE_MOVEMENT_SEMANTIC_CONTRACT_VERSION;

export const EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE =
  "blocked_unverified_semantic_provenance" as const;

export type ExploreMovementBlockedUnverifiedSemanticProvenance =
  typeof EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE;

/** Successful semantic proposal provider accounting — exactly one of each role. */
export const EXPLORE_MOVEMENT_SUCCESS_ADJUDICATOR_CALLS = 1 as const;
export const EXPLORE_MOVEMENT_SUCCESS_REFEREE_CALLS = 1 as const;
export const EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS = 2 as const;

export const exploreMovementProvenanceSourceSchema = z
  .object({
    sourceId: z.string().trim().min(1),
    sourceType: z.enum(EXPLORE_GROUNDING_SOURCE_FAMILIES),
    sourceFamily: z.enum(EXPLORE_GROUNDING_SOURCE_FAMILIES),
    userId: z.string().trim().min(1),
    title: z.string(),
    extract: z.string(),
    retrievalReason: z.string(),
    claimSupport: z.enum(EXPLORE_GROUNDING_CLAIM_SUPPORTS),
    epistemicStatus: z.enum(EXPLORE_GROUNDING_EPISTEMIC_STATUSES),
  })
  .strict()
  .superRefine((source, ctx) => {
    if (source.sourceType !== source.sourceFamily) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "explore_movement_provenance_source_type_family_mismatch: sourceType must equal sourceFamily.",
        path: ["sourceFamily"],
      });
    }
  });

export const exploreMovementSuccessfulProviderMetadataSchema = z
  .object({
    providerId: z.string().min(1),
    adjudicatorModelId: z.string().min(1),
    refereeModelId: z.string().min(1),
    adjudicatorCalls: z.literal(EXPLORE_MOVEMENT_SUCCESS_ADJUDICATOR_CALLS),
    refereeCalls: z.literal(EXPLORE_MOVEMENT_SUCCESS_REFEREE_CALLS),
    totalCalls: z.literal(EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS),
  })
  .strict();

const objectivityRefereeResultSchema = z
  .object({
    interfaceVersion: z.literal(OBJECTIVITY_REFEREE_INTERFACE_VERSION),
    executionState: z.enum([
      "not_run",
      "completed",
      "failed",
      "invalid_evaluation",
    ]),
    outcome: z
      .enum([
        "PASS",
        "PASS_WITH_LOWER_CONFIDENCE",
        "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
        "REQUEST_MORE_EVIDENCE",
        "ABSTAIN",
      ])
      .nullable(),
    rationale: z.string().nullable(),
    proposedObjectType: z.string().nullable(),
    proposedConfidence: z.number().nullable(),
    adjustedConfidence: z.number().nullable(),
    routedObjectType: z.string().nullable(),
    validationErrors: z.array(z.string()),
    continuationAllowed: z.boolean(),
    errorMessage: z.string().nullable(),
  })
  .strict();

export const exploreMovementProposalProvenanceSchema = z
  .object({
    version: z.literal(EXPLORE_MOVEMENT_PROPOSAL_PROVENANCE_VERSION),
    sources: z.array(exploreMovementProvenanceSourceSchema).min(1),
    semanticDecision: exploreMovementSemanticDecisionSchema,
    refereeResult: objectivityRefereeResultSchema,
    providerMetadata: exploreMovementSuccessfulProviderMetadataSchema,
  })
  .strict();

export type ExploreMovementProposalProvenance = z.infer<
  typeof exploreMovementProposalProvenanceSchema
>;

export type ExploreMovementProposalProviderMetadata = z.infer<
  typeof exploreMovementSuccessfulProviderMetadataSchema
>;

export type ExploreMovementProvenanceParseResult =
  | { ok: true; provenance: ExploreMovementProposalProvenance }
  | { ok: false; errors: string[]; legacyArray: boolean };

function isLegacySourcesArray(value: unknown): value is ExploreGroundingSource[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ExploreGroundingSource>;
    return (
      typeof candidate.sourceId === "string" &&
      typeof candidate.sourceType === "string" &&
      typeof candidate.userId === "string"
    );
  });
}

function sortedUniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))].sort();
}

export function evidenceSourceIdSetsEqual(
  decisionIds: string[],
  sourceIds: string[]
): boolean {
  const left = sortedUniqueIds(decisionIds);
  const right = sortedUniqueIds(sourceIds);
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

/**
 * Cross-field coherence for a schema-shaped provenance envelope.
 * Does not trust continuationAllowed alone — recomputes referee eligibility.
 */
export function validateExploreMovementProposalProvenanceCoherence(
  value: unknown
): ExploreMovementProvenanceParseResult {
  const parsed = exploreMovementProposalProvenanceSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      legacyArray: false,
      errors: parsed.error.issues.map(
        (issue) =>
          `explore_movement_provenance_invalid: ${issue.path.join(".") || "(root)"}: ${issue.message}`
      ),
    };
  }

  const provenance = parsed.data;
  const errors: string[] = [];
  const decision = provenance.semanticDecision;

  if (decision.outcome !== "PROPOSE_CONCLUSION_STRENGTHENING") {
    errors.push(
      "explore_movement_provenance_decision_not_propose: stored provenance must be PROPOSE_CONCLUSION_STRENGTHENING."
    );
    return { ok: false, legacyArray: false, errors };
  }

  const propose = decision as ExploreMovementProposeConclusionStrengthening;
  const decisionIds = sortedUniqueIds(propose.evidenceSourceIds);
  if (decisionIds.length !== propose.evidenceSourceIds.length) {
    errors.push(
      "explore_movement_provenance_duplicate_evidence_ids: evidenceSourceIds must be unique after normalisation."
    );
  }

  const sourceIds = provenance.sources.map((source) => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    errors.push(
      "explore_movement_provenance_duplicate_source_ids: provenance.sources must not repeat sourceId."
    );
  }

  if (!evidenceSourceIdSetsEqual(propose.evidenceSourceIds, sourceIds)) {
    errors.push(
      "explore_movement_provenance_evidence_set_mismatch: semanticDecision.evidenceSourceIds must exactly equal provenance.sources[].sourceId."
    );
  }

  if (provenance.sources.length === 0) {
    errors.push(
      "explore_movement_provenance_empty_sources: cited source set must be non-empty."
    );
  }

  const referee = provenance.refereeResult;
  if (referee.executionState !== "completed") {
    errors.push(
      "explore_movement_provenance_referee_not_completed: executionState must be completed."
    );
  }
  if (referee.proposedObjectType !== EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE) {
    errors.push(
      "explore_movement_provenance_referee_object_type: proposedObjectType must be UserMapConclusion."
    );
  }
  if (referee.proposedConfidence !== propose.confidence) {
    errors.push(
      "explore_movement_provenance_referee_confidence_mismatch: proposedConfidence must equal semanticDecision.confidence."
    );
  }
  if (referee.validationErrors.length > 0) {
    errors.push(
      "explore_movement_provenance_referee_validation_errors: validationErrors must be empty."
    );
  }
  if (referee.outcome == null || referee.rationale == null) {
    errors.push(
      "explore_movement_provenance_referee_incomplete: completed referee requires outcome and rationale."
    );
  } else {
    const evaluation: {
      outcome: NonNullable<typeof referee.outcome>;
      rationale: string;
      adjustedConfidence?: number;
      routedObjectType?: string;
    } = {
      outcome: referee.outcome,
      rationale: referee.rationale,
    };
    if (referee.adjustedConfidence != null) {
      evaluation.adjustedConfidence = referee.adjustedConfidence;
    }
    if (referee.routedObjectType != null && referee.routedObjectType.trim()) {
      evaluation.routedObjectType = referee.routedObjectType;
    }

    const validated = validateObjectivityRefereeEvaluation({
      evaluation,
      proposedObjectType: EXPLORE_MOVEMENT_WRITABLE_PROPOSED_OBJECT_TYPE,
      proposedConfidence: propose.confidence,
    });
    if (!validated.ok) {
      errors.push(
        ...validated.errors.map(
          (err) => `explore_movement_provenance_referee_revalidation: ${err}`
        )
      );
    } else {
      const recomputed = refereeAllowsContinuation({
        executionState: "completed",
        outcome: validated.evaluation.outcome,
        validationErrors: [],
      });
      if (referee.continuationAllowed !== recomputed) {
        errors.push(
          "explore_movement_provenance_continuation_forged: stored continuationAllowed does not match recomputed eligibility."
        );
      }
      if (!recomputed) {
        errors.push(
          "explore_movement_provenance_continuation_denied: referee does not allow continuation."
        );
      }
      if (
        validated.evaluation.outcome !== "PASS" &&
        validated.evaluation.outcome !== "PASS_WITH_LOWER_CONFIDENCE"
      ) {
        errors.push(
          "explore_movement_provenance_referee_outcome_blocked: outcome must be PASS or PASS_WITH_LOWER_CONFIDENCE."
        );
      }

      let effectiveConfidence = propose.confidence;
      if (
        validated.evaluation.outcome === "PASS_WITH_LOWER_CONFIDENCE" &&
        validated.evaluation.adjustedConfidence != null
      ) {
        effectiveConfidence = validated.evaluation.adjustedConfidence;
      }
      if (effectiveConfidence < EXPLORE_MOVEMENT_MIN_CONFIDENCE) {
        errors.push(
          `explore_movement_provenance_effective_confidence_below_min: ${effectiveConfidence} < ${EXPLORE_MOVEMENT_MIN_CONFIDENCE}.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, legacyArray: false, errors };
  }

  return { ok: true, provenance };
}

/**
 * Parse sourcesJson as versioned coherent provenance or legacy array.
 */
export function parseExploreMovementProposalProvenance(
  value: unknown
): ExploreMovementProvenanceParseResult {
  if (isLegacySourcesArray(value)) {
    return {
      ok: false,
      legacyArray: true,
      errors: [
        "explore_movement_provenance_unversioned: legacy array-only sourcesJson is not publishable under semantic restoration.",
      ],
    };
  }

  return validateExploreMovementProposalProvenanceCoherence(value);
}

/**
 * Extract grounding sources for display / evidence materialisation.
 * Supports both versioned envelope and legacy array.
 */
export function extractExploreMovementProposalSources(
  value: unknown
): ExploreGroundingSource[] {
  const provenance = parseExploreMovementProposalProvenance(value);
  if (provenance.ok) {
    return provenance.provenance.sources as ExploreGroundingSource[];
  }
  if (isLegacySourcesArray(value)) {
    return value;
  }
  return [];
}

/**
 * Build and runtime-validate a provenance envelope.
 * Throws when the envelope is incoherent — callers must fail closed.
 */
export function buildExploreMovementProposalProvenance(args: {
  sources: ExploreGroundingSource[];
  semanticDecision: ExploreMovementSemanticDecision;
  refereeResult: ObjectivityRefereeResult;
  providerMetadata: ExploreMovementProposalProviderMetadata;
}): ExploreMovementProposalProvenance {
  const candidate = {
    version: EXPLORE_MOVEMENT_PROPOSAL_PROVENANCE_VERSION,
    sources: args.sources,
    semanticDecision: args.semanticDecision,
    refereeResult: args.refereeResult,
    providerMetadata: args.providerMetadata,
  };
  const validated = validateExploreMovementProposalProvenanceCoherence(candidate);
  if (!validated.ok) {
    throw new Error(
      `explore_movement_provenance_build_failed: ${validated.errors.join(" | ")}`
    );
  }
  return validated.provenance;
}

export function normalizeExploreMovementAfterSummaryForIdentity(
  value: string
): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Deterministic proposal ID from canonical semantic identity (no schema migration).
 */
export function deriveExploreMovementProposalId(args: {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  affectedObjectType: string;
  affectedObjectId: string;
  afterSummary: string;
}): string {
  const canonical = [
    args.userId,
    args.conversationId,
    args.assistantMessageId,
    args.affectedObjectType,
    args.affectedObjectId,
    normalizeExploreMovementAfterSummaryForIdentity(args.afterSummary),
  ].join("\u001f");
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `emp_${digest.slice(0, 40)}`;
}

export function deriveExploreMovementModelUpdateId(proposalId: string): string {
  const digest = createHash("sha256")
    .update(`explore_movement_model_update:${proposalId}`, "utf8")
    .digest("hex");
  return `emu_${digest.slice(0, 40)}`;
}

/**
 * Select provenance sources that exactly match the decision evidence set.
 * Empty match fails closed — never substitute unrelated sources.
 */
export function selectCitedExploreMovementSources(args: {
  ownedSources: ExploreGroundingSource[];
  evidenceSourceIds: string[];
}):
  | { ok: true; sources: ExploreGroundingSource[] }
  | { ok: false; errors: string[] } {
  const uniqueIds = sortedUniqueIds(args.evidenceSourceIds);
  if (uniqueIds.length === 0) {
    return {
      ok: false,
      errors: ["explore_movement_cited_sources_empty: evidenceSourceIds must be non-empty."],
    };
  }
  if (uniqueIds.length !== args.evidenceSourceIds.length) {
    return {
      ok: false,
      errors: [
        "explore_movement_cited_sources_duplicate: evidenceSourceIds must be unique after normalisation.",
      ],
    };
  }

  const byId = new Map<string, ExploreGroundingSource>();
  for (const source of args.ownedSources) {
    if (!byId.has(source.sourceId)) {
      byId.set(source.sourceId, source);
    }
  }

  const sources: ExploreGroundingSource[] = [];
  for (const id of uniqueIds) {
    const source = byId.get(id);
    if (!source) {
      return {
        ok: false,
        errors: [
          `explore_movement_cited_source_missing: evidence ID ${id} is not in the owned source packet.`,
        ],
      };
    }
    sources.push(source);
  }

  if (!evidenceSourceIdSetsEqual(uniqueIds, sources.map((s) => s.sourceId))) {
    return {
      ok: false,
      errors: [
        "explore_movement_cited_source_set_mismatch: cited sources must exactly equal decision evidence IDs.",
      ],
    };
  }

  return { ok: true, sources };
}
