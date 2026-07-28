/**
 * Server-side public evidence projector for canonical product concepts.
 * Applies existing visibility rules; never returns raw Phase 4 quotes by default.
 */

import {
  ContradictionStatus,
  PatternClaimStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  type PrismaClient,
} from "@prisma/client";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import type { CanonicalRevisionEvidenceProjectionV1 } from "./canonical-model-projection";
import {
  buildPublicObjectHref,
  formatPublicEvidenceSummaryLabel,
} from "./public-continuity-registry";
import { verifyUnderstandingEvidenceLinkSourceOwnership } from "./understanding-evidence-link-writer";

export type CanonicalProductPublicEvidenceV1 = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  role: UnderstandingLinkRole;
  summary: string;
  disclosure: "public" | "redacted";
  sourceId: string | null;
  snippet: string | null;
  /** Never populated from raw UnderstandingEvidenceLink.quote alone. */
  quote: string | null;
  /** Verified public href only — never an empty string. */
  sourceObjectHref: string | null;
};

type EvidenceTx = Pick<
  PrismaClient,
  | "patternClaim"
  | "contradictionNode"
  | "profileArtifact"
  | "referenceItem"
  | "journalEntry"
  | "quickCheckIn"
  | "message"
  | "session"
>;

function redacted(args: {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  role: UnderstandingLinkRole;
}): CanonicalProductPublicEvidenceV1 {
  return {
    id: args.id,
    sourceType: args.sourceType,
    role: args.role,
    summary: formatPublicEvidenceSummaryLabel(),
    disclosure: "redacted",
    sourceId: null,
    snippet: null,
    quote: null,
    sourceObjectHref: null,
  };
}

function publicContinuityEntry(args: {
  id: string;
  sourceType:
    | typeof UnderstandingLinkSourceType.pattern_claim
    | typeof UnderstandingLinkSourceType.contradiction_node;
  role: UnderstandingLinkRole;
  sourceId: string;
}): CanonicalProductPublicEvidenceV1 {
  return {
    id: args.id,
    sourceType: args.sourceType,
    role: args.role,
    // Generic public continuity labels — never raw UEL summary/snippet/quote.
    summary: formatPublicEvidenceSummaryLabel(),
    disclosure: "public",
    sourceId: args.sourceId,
    snippet: null,
    quote: null,
    sourceObjectHref: buildPublicObjectHref({
      type: args.sourceType,
      id: args.sourceId,
    }),
  };
}

async function projectOne(args: {
  userId: string;
  row: CanonicalRevisionEvidenceProjectionV1;
  db: EvidenceTx;
}): Promise<CanonicalProductPublicEvidenceV1> {
  const { row, userId, db } = args;

  const owned = await verifyUnderstandingEvidenceLinkSourceOwnership({
    userId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    db: db as never,
  });
  if (!owned) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      `Public evidence source missing or cross-user: ${row.sourceType}:${row.sourceId}`,
    );
  }

  switch (row.sourceType) {
    case UnderstandingLinkSourceType.pattern_claim: {
      const claim = await db.patternClaim.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true, status: true },
      });
      if (!claim) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `PatternClaim evidence missing: ${row.sourceId}`,
        );
      }
      if (claim.status === PatternClaimStatus.candidate) {
        return redacted(row);
      }
      return publicContinuityEntry({
        id: row.id,
        sourceType: row.sourceType,
        role: row.role,
        sourceId: row.sourceId,
      });
    }
    case UnderstandingLinkSourceType.contradiction_node: {
      const node = await db.contradictionNode.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true, status: true },
      });
      if (!node) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `ContradictionNode evidence missing: ${row.sourceId}`,
        );
      }
      if (
        node.status === ContradictionStatus.candidate ||
        node.status === ContradictionStatus.archived_tension
      ) {
        return redacted(row);
      }
      return publicContinuityEntry({
        id: row.id,
        sourceType: row.sourceType,
        role: row.role,
        sourceId: row.sourceId,
      });
    }
    case UnderstandingLinkSourceType.profile_artifact: {
      const artifact = await db.profileArtifact.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true, status: true },
      });
      if (!artifact) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `ProfileArtifact evidence missing: ${row.sourceId}`,
        );
      }
      return redacted(row);
    }
    case UnderstandingLinkSourceType.reference_item: {
      const item = await db.referenceItem.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true, status: true },
      });
      if (!item) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `ReferenceItem evidence missing: ${row.sourceId}`,
        );
      }
      // No V1 public adapter for ReferenceItem fields — ownership ≠ public disclosure.
      return redacted(row);
    }
    case UnderstandingLinkSourceType.journal_entry: {
      const journal = await db.journalEntry.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true },
      });
      if (!journal) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `JournalEntry evidence missing: ${row.sourceId}`,
        );
      }
      return redacted(row);
    }
    case UnderstandingLinkSourceType.quick_check_in: {
      const checkIn = await db.quickCheckIn.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true },
      });
      if (!checkIn) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `QuickCheckIn evidence missing: ${row.sourceId}`,
        );
      }
      return redacted(row);
    }
    case UnderstandingLinkSourceType.message: {
      const message = await db.message.findFirst({
        where: { id: row.sourceId, userId },
        select: { id: true, role: true },
      });
      if (!message) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PROJECTION",
          `Message evidence missing: ${row.sourceId}`,
        );
      }
      // Messages stay redacted unless a public response adapter exists.
      return redacted(row);
    }
    default:
      return redacted(row);
  }
}

export async function projectCanonicalEvidenceForPublic(args: {
  userId: string;
  evidence: CanonicalRevisionEvidenceProjectionV1[];
  db: EvidenceTx;
}): Promise<CanonicalProductPublicEvidenceV1[]> {
  const out: CanonicalProductPublicEvidenceV1[] = [];
  for (const row of args.evidence) {
    out.push(await projectOne({ userId: args.userId, row, db: args.db }));
  }
  return out;
}
