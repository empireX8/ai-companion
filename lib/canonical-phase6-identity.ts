/**
 * Phase 6 — identity envelope + movement identity parity helpers.
 */

import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";
import { extractCanonicalIdentityEnvelope } from "./canonical-model-product-projection";

export type CanonicalMovementIdentityEnvelope = {
  modelUpdateId: string;
  proposalId: string;
  previousRevisionId: string;
  resultingRevisionId: string;
  beforeSummary: string;
  afterSummary: string;
};

export function extractCanonicalMovementIdentityEnvelope(
  concept: CanonicalProductConceptV1,
  modelUpdateId?: string,
): CanonicalMovementIdentityEnvelope | null {
  const movement = modelUpdateId
    ? concept.movementHistory.find((row) => row.modelUpdateId === modelUpdateId)
    : concept.movementHistory[concept.movementHistory.length - 1];
  if (!movement) return null;
  return {
    modelUpdateId: movement.modelUpdateId,
    proposalId: movement.exploreProposalId,
    previousRevisionId: movement.previousRevisionId,
    resultingRevisionId: movement.resultingRevisionId,
    beforeSummary: movement.beforeSummary,
    afterSummary: movement.afterSummary,
  };
}

export function assertCanonicalIdentityEnvelopeEqual(
  left: ReturnType<typeof extractCanonicalIdentityEnvelope>,
  right: ReturnType<typeof extractCanonicalIdentityEnvelope>,
): void {
  expectDeepEqual(left, right, "canonical identity envelope");
}

export function assertCanonicalMovementIdentityEqual(
  left: CanonicalMovementIdentityEnvelope,
  right: CanonicalMovementIdentityEnvelope,
): void {
  expectDeepEqual(left, right, "canonical movement identity");
}

function expectDeepEqual(left: unknown, right: unknown, label: string): void {
  const a = JSON.stringify(left);
  const b = JSON.stringify(right);
  if (a !== b) {
    throw new Error(`${label} mismatch:\nleft=${a}\nright=${b}`);
  }
}
