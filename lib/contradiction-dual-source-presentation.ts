/**
 * CEQR-008 / CEQR-009 — dual-source presentation server resolver.
 *
 * Resolves exact ordered Side A / Side B EvidenceSpan lineage already stored on
 * ContradictionNode into a typed, fail-closed presentation packet.
 *
 * Authority:
 * - Side A source comes only from sideASourceSpanId
 * - Side B source comes only from sideBSourceSpanId
 *
 * Does NOT:
 * - write to the database
 * - invent spans from messageId / proposition text / ContradictionEvidence
 * - use first-span-by-message heuristics
 * - invoke repaired persistence writers or live extraction
 * - expose complete message content beyond the verified exact slice
 *
 * Client components and client-facing type modules must import the contract
 * module (`contradiction-dual-source-presentation-contract.ts`), not this file.
 */

import { hashExactQuoteSlice } from "./contradiction-dual-side-lineage";
import type {
  ContradictionDualSourcePresentation,
  ContradictionSourceSidePresentation,
  ContradictionSourceSideRole,
  ContradictionSourceUnavailableReason,
  ContradictionDualSourceLineageState,
} from "./contradiction-dual-source-presentation-contract";

export type {
  ContradictionDualSourcePresentation,
  ContradictionDualSourceLineageState,
  ContradictionSourceSidePresentation,
  ContradictionSourceSideRole,
  ContradictionSourceUnavailableReason,
  DualSourceCopySurface,
} from "./contradiction-dual-source-presentation-contract";

export {
  dualSourceLineageNoticeCopy,
  dualSourceSessionOriginCopy,
  dualSourceSideUnavailableCopy,
} from "./contradiction-dual-source-presentation-contract";

export type DualSourceNodeLineageInput = {
  id: string;
  sideASourceSpanId: string | null | undefined;
  sideBSourceSpanId: string | null | undefined;
};

export type DualSourceSpanRecord = {
  id: string;
  userId: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
  createdAt: Date | string | null;
};

export type DualSourceMessageRecord = {
  id: string;
  userId: string;
  sessionId: string;
  content: string;
  createdAt: Date | string | null;
};

export type DualSourceSessionRecord = {
  id: string;
  userId: string;
  origin: "APP" | "IMPORTED_ARCHIVE";
  label: string | null;
};

/**
 * Injected read interface — every lookup is explicitly user-scoped.
 * Routes supply Prisma; tests supply fixtures.
 * No prismadb import in this module.
 */
export type DualSourcePresentationReader = {
  findSpansByIds: (
    userId: string,
    ids: string[],
  ) => Promise<DualSourceSpanRecord[]>;
  findMessagesByIds: (
    userId: string,
    ids: string[],
  ) => Promise<DualSourceMessageRecord[]>;
  findSessionsByIds: (
    userId: string,
    ids: string[],
  ) => Promise<DualSourceSessionRecord[]>;
};

export type DualSourceBatchResolutionStats = {
  spanQueryCount: number;
  messageQueryCount: number;
  sessionQueryCount: number;
  uniqueSpanIdsRequested: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function unavailableSide(
  side: ContradictionSourceSideRole,
  reason: ContradictionSourceUnavailableReason,
): ContradictionSourceSidePresentation {
  return {
    side,
    availability: "unavailable",
    reason,
    integrityVerified: false,
  };
}

function deriveLineageState(
  sideA: ContradictionSourceSidePresentation,
  sideB: ContradictionSourceSidePresentation,
): ContradictionDualSourceLineageState {
  if (
    sideA.availability === "available" &&
    sideB.availability === "available"
  ) {
    return "complete_verified";
  }

  const reasons = [sideA, sideB]
    .filter(
      (
        s,
      ): s is Extract<
        ContradictionSourceSidePresentation,
        { availability: "unavailable" }
      > => s.availability === "unavailable",
    )
    .map((s) => s.reason);

  if (
    reasons.length === 2 &&
    reasons.every((r) => r === "legacy_lineage_not_recorded")
  ) {
    return "legacy_unavailable";
  }

  if (reasons.includes("partial_lineage")) {
    return "partial_unavailable";
  }

  return "integrity_unavailable";
}

function resolveOneSide(args: {
  side: ContradictionSourceSideRole;
  spanId: string | null | undefined;
  peerSpanId: string | null | undefined;
  userId: string;
  spansById: Map<string, DualSourceSpanRecord>;
  messagesById: Map<string, DualSourceMessageRecord>;
  sessionsById: Map<string, DualSourceSessionRecord>;
}): ContradictionSourceSidePresentation {
  const {
    side,
    spanId,
    peerSpanId,
    userId,
    spansById,
    messagesById,
    sessionsById,
  } = args;

  const selfPresent = isNonEmptyString(spanId);
  const peerPresent = isNonEmptyString(peerSpanId);

  if (!selfPresent && !peerPresent) {
    return unavailableSide(side, "legacy_lineage_not_recorded");
  }

  if (!selfPresent && peerPresent) {
    return unavailableSide(side, "partial_lineage");
  }

  const span = spansById.get(spanId!);
  if (!span) {
    return unavailableSide(side, "span_not_found");
  }

  // Second fail-closed ownership boundary (after user-scoped DB lookup).
  if (span.userId !== userId) {
    return unavailableSide(side, "span_wrong_user");
  }

  const message = messagesById.get(span.messageId);
  if (!message) {
    return unavailableSide(side, "message_not_found");
  }

  if (message.userId !== userId) {
    return unavailableSide(side, "message_wrong_user");
  }

  if (message.id !== span.messageId) {
    return unavailableSide(side, "message_not_found");
  }

  const { charStart, charEnd } = span;
  if (
    !Number.isInteger(charStart) ||
    !Number.isInteger(charEnd) ||
    charStart < 0 ||
    charEnd <= charStart ||
    charEnd > message.content.length
  ) {
    return unavailableSide(side, "invalid_offsets");
  }

  const exactQuote = message.content.slice(charStart, charEnd);
  const recomputed = hashExactQuoteSlice(exactQuote);
  if (recomputed !== span.contentHash) {
    return unavailableSide(side, "content_hash_mismatch");
  }

  const session = isNonEmptyString(message.sessionId)
    ? (sessionsById.get(message.sessionId) ?? null)
    : null;

  // Session provenance only from a successfully resolved owned session.
  // Never fall back to message.sessionId after ownership failure.
  const sessionOwned =
    session != null && session.userId === userId ? session : null;

  return {
    side,
    availability: "available",
    spanId: span.id,
    messageId: message.id,
    sessionId: sessionOwned?.id ?? null,
    sessionOrigin: sessionOwned?.origin ?? null,
    sessionLabel: sessionOwned?.label ?? null,
    exactQuote,
    charStart,
    charEnd,
    integrityVerified: true,
    // Message timestamp is the conversation/source date; span.createdAt is
    // extraction/recording metadata and is only a fallback.
    recordedAt:
      toIsoOrNull(message.createdAt) ?? toIsoOrNull(span.createdAt) ?? null,
  };
}

/**
 * Batch-resolve dual-source presentation for many contradiction nodes.
 * Performs at most one user-scoped span query, one message query, and one
 * session query for the whole batch (plus empty no-ops when no IDs).
 */
export async function resolveContradictionDualSourcePresentations(args: {
  userId: string;
  nodes: DualSourceNodeLineageInput[];
  reader: DualSourcePresentationReader;
}): Promise<{
  byNodeId: Map<string, ContradictionDualSourcePresentation>;
  stats: DualSourceBatchResolutionStats;
}> {
  const { userId, nodes, reader } = args;

  const spanIdSet = new Set<string>();
  for (const node of nodes) {
    if (isNonEmptyString(node.sideASourceSpanId)) {
      spanIdSet.add(node.sideASourceSpanId);
    }
    if (isNonEmptyString(node.sideBSourceSpanId)) {
      spanIdSet.add(node.sideBSourceSpanId);
    }
  }

  const spanIds = [...spanIdSet];
  let spanQueryCount = 0;
  let messageQueryCount = 0;
  let sessionQueryCount = 0;

  const spans =
    spanIds.length > 0
      ? ((spanQueryCount += 1), await reader.findSpansByIds(userId, spanIds))
      : [];

  const spansById = new Map(spans.map((s) => [s.id, s]));

  // Only owned spans may drive message lookups in the ordinary flow.
  const messageIdSet = new Set<string>();
  for (const span of spans) {
    if (span.userId === userId && isNonEmptyString(span.messageId)) {
      messageIdSet.add(span.messageId);
    }
  }
  const messageIds = [...messageIdSet];
  const messages =
    messageIds.length > 0
      ? ((messageQueryCount += 1),
        await reader.findMessagesByIds(userId, messageIds))
      : [];
  const messagesById = new Map(messages.map((m) => [m.id, m]));

  const sessionIdSet = new Set<string>();
  for (const message of messages) {
    if (message.userId === userId && isNonEmptyString(message.sessionId)) {
      sessionIdSet.add(message.sessionId);
    }
  }
  const sessionIds = [...sessionIdSet];
  const sessions =
    sessionIds.length > 0
      ? ((sessionQueryCount += 1),
        await reader.findSessionsByIds(userId, sessionIds))
      : [];
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));

  const byNodeId = new Map<string, ContradictionDualSourcePresentation>();

  for (const node of nodes) {
    const sideA = resolveOneSide({
      side: "A",
      spanId: node.sideASourceSpanId,
      peerSpanId: node.sideBSourceSpanId,
      userId,
      spansById,
      messagesById,
      sessionsById,
    });
    const sideB = resolveOneSide({
      side: "B",
      spanId: node.sideBSourceSpanId,
      peerSpanId: node.sideASourceSpanId,
      userId,
      spansById,
      messagesById,
      sessionsById,
    });

    const aPresent = isNonEmptyString(node.sideASourceSpanId);
    const bPresent = isNonEmptyString(node.sideBSourceSpanId);
    let finalA = sideA;
    let finalB = sideB;
    if (aPresent !== bPresent) {
      finalA = unavailableSide("A", "partial_lineage");
      finalB = unavailableSide("B", "partial_lineage");
    }

    byNodeId.set(node.id, {
      lineageState: deriveLineageState(finalA, finalB),
      sideA: finalA,
      sideB: finalB,
    });
  }

  return {
    byNodeId,
    stats: {
      spanQueryCount,
      messageQueryCount,
      sessionQueryCount,
      uniqueSpanIdsRequested: spanIds.length,
    },
  };
}

export async function resolveContradictionDualSourcePresentation(args: {
  userId: string;
  node: DualSourceNodeLineageInput;
  reader: DualSourcePresentationReader;
}): Promise<ContradictionDualSourcePresentation> {
  const { byNodeId } = await resolveContradictionDualSourcePresentations({
    userId: args.userId,
    nodes: [args.node],
    reader: args.reader,
  });
  return (
    byNodeId.get(args.node.id) ?? {
      lineageState: "legacy_unavailable",
      sideA: unavailableSide("A", "legacy_lineage_not_recorded"),
      sideB: unavailableSide("B", "legacy_lineage_not_recorded"),
    }
  );
}

/**
 * Prisma-backed reader factory. Every findMany is scoped by authenticated userId.
 */
export function createPrismaDualSourcePresentationReader(db: {
  evidenceSpan: {
    findMany: (args: {
      where: { id: { in: string[] }; userId: string };
      select: {
        id: true;
        userId: true;
        messageId: true;
        charStart: true;
        charEnd: true;
        contentHash: true;
        createdAt: true;
      };
    }) => Promise<DualSourceSpanRecord[]>;
  };
  message: {
    findMany: (args: {
      where: { id: { in: string[] }; userId: string };
      select: {
        id: true;
        userId: true;
        sessionId: true;
        content: true;
        createdAt: true;
      };
    }) => Promise<DualSourceMessageRecord[]>;
  };
  session: {
    findMany: (args: {
      where: { id: { in: string[] }; userId: string };
      select: {
        id: true;
        userId: true;
        origin: true;
        label: true;
      };
    }) => Promise<DualSourceSessionRecord[]>;
  };
}): DualSourcePresentationReader {
  return {
    findSpansByIds: (userId, ids) =>
      db.evidenceSpan.findMany({
        where: { id: { in: ids }, userId },
        select: {
          id: true,
          userId: true,
          messageId: true,
          charStart: true,
          charEnd: true,
          contentHash: true,
          createdAt: true,
        },
      }),
    findMessagesByIds: (userId, ids) =>
      db.message.findMany({
        where: { id: { in: ids }, userId },
        select: {
          id: true,
          userId: true,
          sessionId: true,
          content: true,
          createdAt: true,
        },
      }),
    findSessionsByIds: (userId, ids) =>
      db.session.findMany({
        where: { id: { in: ids }, userId },
        select: {
          id: true,
          userId: true,
          origin: true,
          label: true,
        },
      }),
  };
}

/** Opt-in list query flag — unrelated list consumers skip source hydration. */
export function isIncludeDualSourceEnabled(
  searchParams: URLSearchParams,
): boolean {
  const raw = searchParams.get("includeDualSource");
  return raw === "true" || raw === "1";
}
