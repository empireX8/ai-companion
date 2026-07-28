/**
 * Safe public product projection derived only from Phase 4 canonical reads.
 * Never exposes registration hashes, internal notes, or ownership fields.
 */

import {
  CanonicalConceptDomain,
  type CanonicalRevisionOperation,
  type CanonicalRevisionStatus,
  type ModelUpdateType,
  type UnderstandingLinkRole,
  type UnderstandingLinkSourceType,
  type UserMapConfidenceLevel,
} from "@prisma/client";

import type {
  CanonicalConceptProjectionV1,
  CanonicalModelProjectionV1,
} from "./canonical-model-projection";
import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import type { CanonicalProductPublicEvidenceV1 } from "./canonical-product-public-evidence";

export const CANONICAL_PRODUCT_PROJECTION_VERSION =
  "canonical_product_projection:v1" as const;

const V1_PRODUCT_DOMAINS = new Set<CanonicalConceptDomain>([
  CanonicalConceptDomain.operating_logic,
  CanonicalConceptDomain.state_ecology,
  CanonicalConceptDomain.tension_architecture,
  CanonicalConceptDomain.recovery_architecture,
  CanonicalConceptDomain.meaning_system,
  CanonicalConceptDomain.relational_field,
  CanonicalConceptDomain.developmental_vector,
  CanonicalConceptDomain.current_frontier,
]);

/** Fail closed at the product conversion boundary for unsupported domains. */
export function requireV1ProductCanonicalDomain(
  domain: CanonicalConceptDomain,
): CanonicalConceptDomain {
  if (!V1_PRODUCT_DOMAINS.has(domain)) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      `Canonical domain "${domain}" is not accepted for V1 product projection`,
    );
  }
  return domain;
}

export type CanonicalProductConceptV1 = {
  authorityType: "canonical_concept_revision";
  conceptId: string;
  currentRevisionId: string;
  version: number;
  domain: CanonicalConceptDomain;
  title: string;
  summary: string;
  status: CanonicalRevisionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
  rationale: string | null;
  acceptedAt: string;
  legacySeed: {
    objectType: "usermap_conclusion";
    objectId: string;
  };
  evidence: CanonicalProductPublicEvidenceV1[];
  revisionHistory: Array<{
    id: string;
    version: number;
    title: string;
    summary: string;
    status: CanonicalRevisionStatus;
    confidenceScore: number;
    confidenceLevel: UserMapConfidenceLevel;
    evidenceCount: number;
    rationale: string | null;
    acceptedAt: string;
    operation: CanonicalRevisionOperation;
  }>;
  movementHistory: Array<{
    modelUpdateId: string;
    exploreProposalId: string;
    previousRevisionId: string;
    resultingRevisionId: string;
    updateType: ModelUpdateType;
    beforeSummary: string;
    afterSummary: string;
    userFacingSummary: string;
    createdAt: string;
  }>;
  capabilities: {
    inspectEvidence: true;
    inspectMovementHistory: true;
    supportedWriteOperations: CanonicalRevisionOperation[];
  };
};

export type CanonicalProductModelV1 = {
  projectionVersion: typeof CANONICAL_PRODUCT_PROJECTION_VERSION;
  userId: string;
  concepts: CanonicalProductConceptV1[];
};

function requireLegacySeed(
  concept: CanonicalConceptProjectionV1,
): { objectType: "usermap_conclusion"; objectId: string } {
  const seeds = concept.sourceBindings.filter(
    (binding) =>
      binding.sourceType === "usermap_conclusion" &&
      binding.bindingRole === "legacy_seed",
  );
  if (seeds.length !== 1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical product projection requires exactly one legacy_seed binding",
    );
  }
  return {
    objectType: "usermap_conclusion",
    objectId: seeds[0]!.sourceId,
  };
}

function redactedEvidenceFromPhase4(
  concept: CanonicalConceptProjectionV1,
): CanonicalProductPublicEvidenceV1[] {
  return concept.currentRevision.evidence.map((row) => ({
    id: row.id,
    sourceType: row.sourceType as UnderstandingLinkSourceType,
    role: row.role as UnderstandingLinkRole,
    summary: "Linked evidence",
    disclosure: "redacted" as const,
    sourceId: null,
    snippet: null,
    quote: null,
    sourceObjectHref: null,
  }));
}

/**
 * Browser-safe / server product mapper.
 *
 * Domain is validated here. Evidence is redacted by default unless an explicit
 * public evidence projection override is supplied.
 */
export function toCanonicalProductConceptV1(
  concept: CanonicalConceptProjectionV1,
  options?: {
    evidenceOverride?: CanonicalProductPublicEvidenceV1[];
  },
): CanonicalProductConceptV1 {
  const current = concept.currentRevision;
  const domain = requireV1ProductCanonicalDomain(concept.concept.domain);
  return {
    authorityType: "canonical_concept_revision",
    conceptId: concept.concept.id,
    currentRevisionId: current.id,
    version: current.version,
    domain,
    title: current.title,
    summary: current.summary,
    status: current.status,
    confidenceScore: current.confidenceScore,
    confidenceLevel: current.confidenceLevel,
    evidenceCount: current.evidenceCount,
    rationale: current.rationale,
    acceptedAt: current.acceptedAt,
    legacySeed: requireLegacySeed(concept),
    evidence: options?.evidenceOverride ?? redactedEvidenceFromPhase4(concept),
    revisionHistory: concept.revisionHistory.map((revision) => ({
      id: revision.id,
      version: revision.version,
      title: revision.title,
      summary: revision.summary,
      status: revision.status,
      confidenceScore: revision.confidenceScore,
      confidenceLevel: revision.confidenceLevel,
      evidenceCount: revision.evidenceCount,
      rationale: revision.rationale,
      acceptedAt: revision.acceptedAt,
      operation: revision.operation,
    })),
    movementHistory: concept.movementHistory.map((row) => ({
      modelUpdateId: row.modelUpdateId,
      exploreProposalId: row.exploreProposalId,
      previousRevisionId: row.previousRevisionId,
      resultingRevisionId: row.resultingRevisionId,
      updateType: row.updateType,
      beforeSummary: row.beforeSummary,
      afterSummary: row.afterSummary,
      userFacingSummary: row.userFacingSummary,
      createdAt: row.createdAt,
    })),
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: [...concept.capabilities.supportedWriteOperations],
    },
  };
}

/**
 * Authority snapshot for movement/AI paths that must not carry evidence details.
 * Evidence array is empty; evidenceCount remains the authoritative supports count.
 */
export function toCanonicalProductAuthoritySnapshotV1(
  concept: CanonicalConceptProjectionV1,
): CanonicalProductConceptV1 {
  const product = toCanonicalProductConceptV1(concept, { evidenceOverride: [] });
  return product;
}

export function toCanonicalProductModelV1(
  projection: CanonicalModelProjectionV1,
): CanonicalProductModelV1 {
  return {
    projectionVersion: CANONICAL_PRODUCT_PROJECTION_VERSION,
    userId: projection.userId,
    concepts: projection.concepts.map((concept) =>
      toCanonicalProductAuthoritySnapshotV1(concept),
    ),
  };
}

/** Identity envelope used for surface parity proofs. */
export type CanonicalIdentityEnvelope = {
  conceptId: string;
  currentRevisionId: string;
  version: number;
  domain: CanonicalConceptDomain;
  title: string;
  summary: string;
  status: CanonicalRevisionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
};

export function extractCanonicalIdentityEnvelope(
  concept: CanonicalProductConceptV1,
): CanonicalIdentityEnvelope {
  return {
    conceptId: concept.conceptId,
    currentRevisionId: concept.currentRevisionId,
    version: concept.version,
    domain: concept.domain,
    title: concept.title,
    summary: concept.summary,
    status: concept.status,
    confidenceScore: concept.confidenceScore,
    confidenceLevel: concept.confidenceLevel,
    evidenceCount: concept.evidenceCount,
  };
}

export function collectCanonicalMovementModelUpdateIds(
  concepts: CanonicalProductConceptV1[],
): Set<string> {
  const ids = new Set<string>();
  for (const concept of concepts) {
    for (const movement of concept.movementHistory) {
      ids.add(movement.modelUpdateId);
    }
  }
  return ids;
}

export type CanonicalMovementListRow = {
  id: string;
  updateType: ModelUpdateType;
  affectedObjectType: "canonical_concept_revision";
  affectedObjectId: string;
  userFacingSummary: string;
  createdAt: Date;
  conceptId: string;
  previousRevisionId: string;
  resultingRevisionId: string;
  beforeSummary: string;
  afterSummary: string;
};

/** Flatten projection movement history into ModelUpdate-shaped list rows. */
export function flattenCanonicalMovementsForLists(
  concepts: CanonicalProductConceptV1[],
): CanonicalMovementListRow[] {
  const rows: CanonicalMovementListRow[] = [];
  for (const concept of concepts) {
    for (const movement of concept.movementHistory) {
      rows.push({
        id: movement.modelUpdateId,
        updateType: movement.updateType,
        affectedObjectType: "canonical_concept_revision",
        affectedObjectId: movement.resultingRevisionId,
        userFacingSummary: movement.userFacingSummary,
        createdAt: new Date(movement.createdAt),
        conceptId: concept.conceptId,
        previousRevisionId: movement.previousRevisionId,
        resultingRevisionId: movement.resultingRevisionId,
        beforeSummary: movement.beforeSummary,
        afterSummary: movement.afterSummary,
      });
    }
  }
  rows.sort((a, b) => {
    const at = a.createdAt.getTime();
    const bt = b.createdAt.getTime();
    if (at !== bt) return bt - at;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  return rows;
}
