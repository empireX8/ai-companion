/**
 * Deterministic discovery of canonical_v1 Explore proposals that own a ModelUpdate ID.
 */

import {
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  type PrismaClient,
} from "@prisma/client";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import { deriveExploreMovementModelUpdateId } from "./explore-movement-proposal-provenance";

export type CanonicalDeterministicProposalMatch = {
  id: string;
  userId: string;
  status: ExploreMovementProposalStatus;
  authorityMode: ExploreMovementAuthorityMode;
  modelUpdateId: string | null;
  canonicalConceptId: string | null;
};

type ProposalLookupDb = Pick<PrismaClient, "exploreMovementProposal">;

/**
 * Search the authenticated user's canonical_v1 proposals and independently match
 * deriveExploreMovementModelUpdateId(proposal.id) === modelUpdateId.
 *
 * Does not rely on proposal.modelUpdateId or row.exploreProposalId.
 */
export async function findCanonicalProposalsByDeterministicModelUpdateId(args: {
  userId: string;
  modelUpdateId: string;
  db: ProposalLookupDb;
}): Promise<CanonicalDeterministicProposalMatch[]> {
  const proposals = await args.db.exploreMovementProposal.findMany({
    where: {
      userId: args.userId,
      authorityMode: ExploreMovementAuthorityMode.canonical_v1,
    },
    select: {
      id: true,
      userId: true,
      status: true,
      authorityMode: true,
      modelUpdateId: true,
      canonicalConceptId: true,
    },
  });

  return proposals.filter(
    (proposal) =>
      deriveExploreMovementModelUpdateId(proposal.id) === args.modelUpdateId,
  );
}

export function requireSingleDeterministicCanonicalProposal(
  matches: CanonicalDeterministicProposalMatch[],
): CanonicalDeterministicProposalMatch | null {
  if (matches.length > 1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Multiple canonical_v1 proposals deterministically claim the same ModelUpdate ID",
    );
  }
  return matches[0] ?? null;
}
