/**
 * Canonical revision evidence-set preparation for Orvek Canonical Model Authority V1.
 *
 * Prepares a complete immutable link set before revision insertion.
 * Registration (rev1) omits unresolvable links; Explore proposal (rev2) fails closed.
 */

import {
  SessionSurfaceType,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import type { ExploreGroundingSource } from "./explore-grounding-contract";
import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import {
  assertSupportedEvidenceLinkPair,
  EvidenceLinkPairValidationError,
  isSupportedEvidenceLinkPair,
} from "./orvek-intelligence-object-authority";
import {
  verifyUnderstandingEvidenceLinkSourceOwnership,
  createUnderstandingEvidenceLinkForUser,
  type UnderstandingEvidenceLinkWriterDb,
} from "./understanding-evidence-link-writer";

export type PreparedCanonicalRevisionEvidenceLink = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary: string;
  snippet: string;
  quote: string;
};

export type PreparedCanonicalRevisionEvidence = {
  links: PreparedCanonicalRevisionEvidenceLink[];
  supportingLinkCount: number;
};

export type CanonicalExploreLineageMessageRow = {
  id: string;
  userId: string;
  sessionId: string;
  role: string;
};

export type CanonicalExploreLineageSessionRow = {
  id: string;
  userId: string;
  surfaceType: string | null;
};

export type CanonicalRevisionEvidenceDb = Omit<
  UnderstandingEvidenceLinkWriterDb,
  "message" | "session"
> & {
  message: {
    findFirst: (args: {
      where: {
        id: string;
        userId?: string;
        sessionId?: string;
        role?: string;
      };
      select?: {
        id?: boolean;
        userId?: boolean;
        sessionId?: boolean;
        role?: boolean;
      };
    }) => Promise<CanonicalExploreLineageMessageRow | null>;
  };
  session: {
    findFirst: (args: {
      where: {
        id: string;
        userId?: string;
        surfaceType?: string | null;
      };
      select?: {
        id?: boolean;
        userId?: boolean;
        surfaceType?: boolean;
      };
    }) => Promise<CanonicalExploreLineageSessionRow | null>;
  };
};

function linkIdentity(link: {
  sourceType: string;
  sourceId: string;
  role: string;
}): string {
  return `${link.sourceType}\u0000${link.sourceId}\u0000${link.role}`;
}

function dedupeLinks(
  links: PreparedCanonicalRevisionEvidenceLink[],
): PreparedCanonicalRevisionEvidenceLink[] {
  const seen = new Set<string>();
  const out: PreparedCanonicalRevisionEvidenceLink[] = [];
  for (const link of links) {
    const key = linkIdentity(link);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

function countSupporting(
  links: PreparedCanonicalRevisionEvidenceLink[],
): number {
  return links.filter((link) => link.role === UnderstandingLinkRole.supports)
    .length;
}

function finalise(
  links: PreparedCanonicalRevisionEvidenceLink[],
): PreparedCanonicalRevisionEvidence {
  const deduped = dedupeLinks(links);
  return {
    links: deduped,
    supportingLinkCount: countSupporting(deduped),
  };
}

function mapExploreSourceTypeToLinkSource(
  sourceType: ExploreGroundingSource["sourceType"],
): UnderstandingLinkSourceType | null {
  switch (sourceType) {
    case "journal_entry":
      return UnderstandingLinkSourceType.journal_entry;
    case "pattern_claim":
      return UnderstandingLinkSourceType.pattern_claim;
    case "pattern_claim_evidence":
      return UnderstandingLinkSourceType.pattern_claim_evidence;
    case "reference_item":
      return UnderstandingLinkSourceType.reference_item;
    case "message":
      return UnderstandingLinkSourceType.message;
    case "session":
      return UnderstandingLinkSourceType.session;
    case "usermap_conclusion":
      return null;
    default:
      return null;
  }
}

async function assertSupportedCanonicalPair(args: {
  sourceType: UnderstandingLinkSourceType;
}): Promise<void> {
  try {
    assertSupportedEvidenceLinkPair({
      sourceType: args.sourceType,
      targetType: UnderstandingLinkTargetType.canonical_concept_revision,
    });
  } catch (error) {
    if (error instanceof EvidenceLinkPairValidationError) {
      throw new CanonicalModelAuthorityError(
        "UNSUPPORTED_EVIDENCE_PAIR",
        error.message,
      );
    }
    throw error;
  }
}

/**
 * Fixed Explore conversation lineage must match the current owned explore_chat
 * session before any lineage UELs are constructed.
 */
export async function assertCanonicalExploreLineage(args: {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  db: CanonicalRevisionEvidenceDb;
}): Promise<void> {
  const session = await args.db.session.findFirst({
    where: { id: args.conversationId, userId: args.userId },
    select: { id: true, userId: true, surfaceType: true },
  });
  if (!session) {
    throw new CanonicalModelAuthorityError(
      "INVALID_EVIDENCE_OWNERSHIP",
      `Explore lineage session missing or unowned: ${args.conversationId}`,
    );
  }
  if (session.surfaceType !== SessionSurfaceType.explore_chat) {
    throw new CanonicalModelAuthorityError(
      "INVALID_EVIDENCE_OWNERSHIP",
      `Explore lineage session is not explore_chat: ${args.conversationId}`,
    );
  }

  const userMessage = await args.db.message.findFirst({
    where: {
      id: args.userMessageId,
      userId: args.userId,
      sessionId: args.conversationId,
      role: "user",
    },
    select: { id: true, userId: true, sessionId: true, role: true },
  });
  if (!userMessage) {
    throw new CanonicalModelAuthorityError(
      "INVALID_EVIDENCE_OWNERSHIP",
      `Explore lineage user message invalid or unowned: ${args.userMessageId}`,
    );
  }

  const assistantMessage = await args.db.message.findFirst({
    where: {
      id: args.assistantMessageId,
      userId: args.userId,
      sessionId: args.conversationId,
      role: "assistant",
    },
    select: { id: true, userId: true, sessionId: true, role: true },
  });
  if (!assistantMessage) {
    throw new CanonicalModelAuthorityError(
      "INVALID_EVIDENCE_OWNERSHIP",
      `Explore lineage assistant message invalid or unowned: ${args.assistantMessageId}`,
    );
  }
}

/**
 * Revision-1 registration evidence: owned UELs targeting the UMC.
 * Unresolvable / unsupported candidates are omitted (never faked).
 */
export async function prepareCanonicalRegistrationEvidence(args: {
  userId: string;
  userMapConclusionId: string;
  db: CanonicalRevisionEvidenceDb;
}): Promise<PreparedCanonicalRevisionEvidence> {
  const rows = await args.db.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: UnderstandingLinkTargetType.usermap_conclusion,
      targetId: args.userMapConclusionId,
    },
    select: {
      sourceType: true,
      sourceId: true,
      role: true,
      summary: true,
      snippet: true,
      quote: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const prepared: PreparedCanonicalRevisionEvidenceLink[] = [];

  for (const row of rows) {
    if (
      !isSupportedEvidenceLinkPair({
        sourceType: row.sourceType,
        targetType: UnderstandingLinkTargetType.canonical_concept_revision,
      })
    ) {
      continue;
    }

    const owned = await verifyUnderstandingEvidenceLinkSourceOwnership({
      userId: args.userId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      // Ownership helper uses the shared writer Db shape; session/message
      // overrides remain structurally compatible for source lookups.
      db: args.db as UnderstandingEvidenceLinkWriterDb,
    });
    if (!owned) continue;

    prepared.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      role: row.role,
      summary: row.summary ?? "",
      snippet: row.snippet ?? "",
      quote: row.quote ?? "",
    });
  }

  return finalise(prepared);
}

/**
 * Revision-2 proposal evidence: already-parsed Explore grounding sources.
 * Applies Explore role rules and fails closed on ownership / pair failures.
 */
export async function prepareCanonicalProposalEvidence(args: {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  sources: ExploreGroundingSource[];
  db: CanonicalRevisionEvidenceDb;
}): Promise<PreparedCanonicalRevisionEvidence> {
  await assertCanonicalExploreLineage({
    userId: args.userId,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    db: args.db,
  });

  const prepared: PreparedCanonicalRevisionEvidenceLink[] = [
    {
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.conversationId,
      role: UnderstandingLinkRole.context,
      summary: "Explore conversation lineage",
      snippet: args.conversationId,
      quote: args.conversationId,
    },
    {
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.assistantMessageId,
      role: UnderstandingLinkRole.context,
      summary: "Explore assistant reply that proposed movement",
      snippet: args.assistantMessageId,
      quote: args.assistantMessageId,
    },
    {
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.userMessageId,
      role: UnderstandingLinkRole.supports,
      summary: "Explore user message that triggered review",
      snippet: args.userMessageId,
      quote: args.userMessageId,
    },
  ];

  for (const link of prepared) {
    await assertSupportedCanonicalPair({ sourceType: link.sourceType });
  }

  for (const source of args.sources) {
    const mapped = mapExploreSourceTypeToLinkSource(source.sourceType);
    if (!mapped) continue;

    if (mapped === UnderstandingLinkSourceType.message) {
      const messageRow = await args.db.message.findFirst({
        where: { id: source.sourceId, userId: args.userId },
        select: { id: true, userId: true, sessionId: true, role: true },
      });
      if (!messageRow) {
        throw new CanonicalModelAuthorityError(
          "INVALID_EVIDENCE_OWNERSHIP",
          `Explore message evidence not owned: ${source.sourceId}`,
        );
      }
      if (messageRow.role !== "user") {
        throw new CanonicalModelAuthorityError(
          "INVALID_EVIDENCE_OWNERSHIP",
          `Explore assistant message must not support: ${source.sourceId}`,
        );
      }
    }

    await assertSupportedCanonicalPair({ sourceType: mapped });

    const owned = await verifyUnderstandingEvidenceLinkSourceOwnership({
      userId: args.userId,
      sourceType: mapped,
      sourceId: source.sourceId,
      db: args.db as UnderstandingEvidenceLinkWriterDb,
    });
    if (!owned) {
      throw new CanonicalModelAuthorityError(
        "INVALID_EVIDENCE_OWNERSHIP",
        `Evidence source not owned: ${mapped}/${source.sourceId}`,
      );
    }

    const role =
      source.sourceId === args.assistantMessageId
        ? UnderstandingLinkRole.context
        : source.claimSupport === "verifies"
          ? UnderstandingLinkRole.supports
          : UnderstandingLinkRole.context;

    prepared.push({
      sourceType: mapped,
      sourceId: source.sourceId,
      role,
      summary: source.retrievalReason,
      snippet: source.extract.slice(0, 240),
      quote: source.extract.slice(0, 240),
    });
  }

  return finalise(prepared);
}

/**
 * Persist an already-prepared canonical revision evidence set.
 * Intended for use inside an interactive transaction after revision insert.
 */
export async function insertPreparedCanonicalRevisionEvidence(args: {
  userId: string;
  revisionId: string;
  evidence: PreparedCanonicalRevisionEvidence;
  db: UnderstandingEvidenceLinkWriterDb;
}): Promise<void> {
  for (const link of args.evidence.links) {
    await createUnderstandingEvidenceLinkForUser({
      userId: args.userId,
      db: args.db,
      input: {
        targetType: UnderstandingLinkTargetType.canonical_concept_revision,
        targetId: args.revisionId,
        sourceType: link.sourceType,
        sourceId: link.sourceId,
        role: link.role,
        summary: link.summary,
        snippet: link.snippet,
        quote: link.quote,
      },
    });
  }
}
