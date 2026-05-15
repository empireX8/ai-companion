import type {
  ContradictionStatus,
  PrismaClient,
  UnderstandingLinkSourceType,
} from "@prisma/client";
import { UnderstandingLinkSourceType as SourceType } from "@prisma/client";

import prismadb from "../prismadb";
import { PHASE2_OBJECTIVITY_CONSTANTS } from "./constants";
import {
  detectHighEmotionSignalFromCheckIn,
  detectHighEmotionSignalFromText,
} from "./high-emotion-guard";
import type {
  EvidencePacket,
  EvidencePacketItem,
  EvidencePacketMetrics,
  EvidenceSourceFamily,
  EvidenceWeightClass,
} from "./types";

type PatternClaimRow = {
  id: string;
  summary: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sourceRunId: string | null;
};

type PatternClaimEvidenceRow = {
  id: string;
  claimId: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  journalEntryId: string | null;
  quote: string | null;
  createdAt: Date;
};

type ContradictionNodeRow = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: ContradictionStatus;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  lastTouchedAt: Date;
  lastEvidenceAt: Date | null;
};

type ContradictionEvidenceRow = {
  id: string;
  nodeId: string;
  sessionId: string | null;
  messageId: string | null;
  quote: string | null;
  createdAt: Date;
};

type ProfileArtifactRow = {
  id: string;
  type: string;
  claim: string;
  confidence: number;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type EvidenceSpanRow = {
  id: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  createdAt: Date;
  message: {
    content: string;
    session: { origin: "APP" | "IMPORTED_ARCHIVE" };
  };
};

type ReferenceItemRow = {
  id: string;
  type: string;
  status: string;
  statement: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SurfacedActionRow = {
  id: string;
  bucket: string;
  status: string;
  note: string | null;
  surfacedAt: Date;
  updatedAt: Date;
  linkedClaimId: string | null;
};

type QuickCheckInRow = {
  id: string;
  stateTag: string | null;
  eventTags: string[];
  note: string | null;
  createdAt: Date;
};

type JournalEntryRow = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
  id: string;
  origin: "APP" | "IMPORTED_ARCHIVE";
  startedAt: Date;
  createdAt: Date;
  label: string | null;
};

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
  session: { origin: "APP" | "IMPORTED_ARCHIVE" };
};

type ImportUploadSessionRow = {
  id: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  processedConversations: number;
  processedMessages: number;
};

type ImportUploadChunkRow = {
  id: string;
  sessionId: string;
  sizeBytes: number;
  createdAt: Date;
};

type ModelUpdateCorrectionRow = {
  id: string;
  userFacingSummary: string;
  createdAt: Date;
};

type UserMapCorrectionRow = {
  id: string;
  lastUserCorrectionAt: Date | null;
  lastUserCorrectionLabel: string | null;
};

type MessageOriginRow = {
  id: string;
  sessionId: string;
  session: { origin: "APP" | "IMPORTED_ARCHIVE" };
};

type SessionOriginRow = {
  id: string;
  origin: "APP" | "IMPORTED_ARCHIVE";
};

type DerivationRunScopeRow = {
  id: string;
  scope: string;
};

type ProfileArtifactEvidenceLinkRow = {
  artifactId: string;
  spanId: string;
  span: {
    message: {
      session: { origin: "APP" | "IMPORTED_ARCHIVE" };
    };
  };
};

type EvidencePacketDb = {
  patternClaim: {
    findMany: (args: unknown) => Promise<PatternClaimRow[]>;
  };
  patternClaimEvidence: {
    findMany: (args: unknown) => Promise<PatternClaimEvidenceRow[]>;
  };
  contradictionNode: {
    findMany: (args: unknown) => Promise<ContradictionNodeRow[]>;
  };
  contradictionEvidence: {
    findMany: (args: unknown) => Promise<ContradictionEvidenceRow[]>;
  };
  profileArtifact: {
    findMany: (args: unknown) => Promise<ProfileArtifactRow[]>;
  };
  evidenceSpan: {
    findMany: (args: unknown) => Promise<EvidenceSpanRow[]>;
  };
  referenceItem: {
    findMany: (args: unknown) => Promise<ReferenceItemRow[]>;
  };
  surfacedAction: {
    findMany: (args: unknown) => Promise<SurfacedActionRow[]>;
  };
  quickCheckIn: {
    findMany: (args: unknown) => Promise<QuickCheckInRow[]>;
  };
  journalEntry: {
    findMany: (args: unknown) => Promise<JournalEntryRow[]>;
  };
  session: {
    findMany: (args: unknown) => Promise<SessionRow[]>;
  };
  message: {
    findMany: (args: unknown) => Promise<MessageRow[] | MessageOriginRow[]>;
  };
  importUploadSession: {
    findMany: (args: unknown) => Promise<ImportUploadSessionRow[]>;
  };
  importUploadChunk: {
    findMany: (args: unknown) => Promise<ImportUploadChunkRow[]>;
  };
  derivationRun: {
    findMany: (args: unknown) => Promise<DerivationRunScopeRow[]>;
  };
  profileArtifactEvidenceLink: {
    findMany: (args: unknown) => Promise<ProfileArtifactEvidenceLinkRow[]>;
  };
  modelUpdate: {
    findMany: (args: unknown) => Promise<ModelUpdateCorrectionRow[]>;
  };
  userMapConclusion: {
    findMany: (args: unknown) => Promise<UserMapCorrectionRow[]>;
  };
};

export type AssembleEvidencePacketInput = {
  userId: string;
  now?: Date;
  windowDays?: number;
  includeTimelineAggregationContext?: boolean;
  includeUserCorrectionContext?: boolean;
  db?: EvidencePacketDb;
};

const DEFAULT_WINDOW_DAYS = 90;

function weightClassForSource(sourceType: UnderstandingLinkSourceType): EvidenceWeightClass {
  switch (sourceType) {
    case SourceType.pattern_claim:
    case SourceType.pattern_claim_evidence:
    case SourceType.user_correction:
      return "critical";
    case SourceType.contradiction_node:
    case SourceType.contradiction_evidence:
    case SourceType.surfaced_action:
    case SourceType.timeline_aggregation:
      return "high";
    case SourceType.import_record:
      return "moderate_high";
    case SourceType.evidence_span:
    case SourceType.reference_item:
    case SourceType.quick_check_in:
    case SourceType.message:
      return "moderate";
    case SourceType.profile_artifact:
      return "low_to_moderate";
    case SourceType.session:
      return "low";
    case SourceType.journal_entry:
      return "high";
    default:
      return "moderate";
  }
}

function sourceFamilyForType(sourceType: UnderstandingLinkSourceType): EvidenceSourceFamily {
  return sourceType;
}

function hasLowQuoteQuality(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.length < PHASE2_OBJECTIVITY_CONSTANTS.LOW_QUOTE_MIN_LENGTH) {
    return true;
  }
  if (normalized.endsWith("?")) return true;
  return false;
}

function determineEpisodeKey(args: {
  sessionId?: string | null;
  journalEntryId?: string | null;
  checkInId?: string | null;
  messageId?: string | null;
}): string | null {
  if (args.sessionId) return `session:${args.sessionId}`;
  if (args.journalEntryId) return `journal:${args.journalEntryId}`;
  if (args.checkInId) return `checkin:${args.checkInId}`;
  if (args.messageId) return `message:${args.messageId}`;
  return null;
}

function buildQualityFlags(args: {
  hasProvenance: boolean;
  quote?: string | null;
  snippet?: string | null;
  highEmotionSignal: boolean;
  linkable: boolean;
  ownershipResolvable: boolean;
}): string[] {
  const flags: string[] = [];

  if (args.hasProvenance) {
    flags.push("HAS_PROVENANCE");
  } else {
    flags.push("MISSING_PROVENANCE");
  }

  const quoteLike = args.quote ?? args.snippet ?? null;
  if (quoteLike) {
    if (hasLowQuoteQuality(quoteLike)) {
      flags.push("LOW_QUOTE_QUALITY");
    } else {
      flags.push("HAS_RECEIPT");
    }
  }

  if (args.highEmotionSignal) {
    flags.push("HIGH_EMOTION_SIGNAL");
  }

  if (!args.linkable) {
    flags.push("NON_LINKABLE_CONTEXT");
  }

  if (!args.ownershipResolvable) {
    flags.push("OWNERSHIP_UNRESOLVABLE");
  }

  return flags;
}

function toDaysSpread(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function createEvidenceItem(args: {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: EvidencePacketItem["role"];
  timestamp: Date;
  authoredAt?: Date | null;
  snippet?: string | null;
  quote?: string | null;
  provenanceRefs: EvidencePacketItem["provenanceRefs"];
  linkable: boolean;
  ownershipResolvable: boolean;
  highEmotionSignal: boolean;
  origin: EvidencePacketItem["origin"];
  episodeKey: string | null;
}): EvidencePacketItem {
  const qualityFlags = buildQualityFlags({
    hasProvenance: Object.keys(args.provenanceRefs).length > 0,
    quote: args.quote,
    snippet: args.snippet,
    highEmotionSignal: args.highEmotionSignal,
    linkable: args.linkable,
    ownershipResolvable: args.ownershipResolvable,
  });

  return {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    role: args.role,
    weightClass: weightClassForSource(args.sourceType),
    sourceFamily: sourceFamilyForType(args.sourceType),
    timestamp: args.timestamp,
    authoredAt: args.authoredAt,
    snippet: args.snippet,
    quote: args.quote,
    provenanceRefs: args.provenanceRefs,
    qualityFlags,
    linkable: args.linkable,
    ownershipResolvable: args.ownershipResolvable,
    highEmotionSignal: args.highEmotionSignal,
    origin: args.origin,
    episodeKey: args.episodeKey,
  };
}

function computeSourceCounts(
  items: EvidencePacketItem[]
): Partial<Record<UnderstandingLinkSourceType, number>> {
  const counts: Partial<Record<UnderstandingLinkSourceType, number>> = {};

  for (const item of items) {
    counts[item.sourceType] = (counts[item.sourceType] ?? 0) + 1;
  }

  return counts;
}

function computeMetrics(items: EvidencePacketItem[]): EvidencePacketMetrics {
  const sourceCounts = computeSourceCounts(items);

  const timestamps = items
    .map((item) => item.authoredAt ?? item.timestamp)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  const timeSpreadDays =
    timestamps.length > 0
      ? toDaysSpread(timestamps[0], timestamps[timestamps.length - 1])
      : 0;

  const sourceDiversity = new Set(items.map((item) => item.sourceType)).size;
  const linkableEvidenceCount = items.filter((item) => item.linkable).length;
  const ownershipResolvableCount = items.filter(
    (item) => item.ownershipResolvable
  ).length;

  const highEmotionItemCount = items.filter((item) => item.highEmotionSignal).length;
  const nonLinkableContextItems = items.filter((item) => !item.linkable).length;
  const quoteQualityLowCount = items.filter((item) =>
    item.qualityFlags.includes("LOW_QUOTE_QUALITY")
  ).length;
  const receiptCount = items.filter((item) =>
    item.qualityFlags.includes("HAS_RECEIPT")
  ).length;

  const unresolvedContradictionCount = items.filter(
    (item) =>
      item.sourceType === SourceType.contradiction_node &&
      item.snippet !== null &&
      item.snippet !== undefined &&
      item.snippet !== ""
  ).length;

  const correctionSignalCount = items.filter(
    (item) => item.sourceType === SourceType.user_correction
  ).length;

  const distinctEpisodeCount = new Set(
    items
      .map((item) => item.episodeKey)
      .filter((value): value is string => Boolean(value))
  ).size;

  const importedCount = items.filter((item) => item.origin === "imported").length;
  const nativeCount = items.filter((item) => item.origin === "native").length;
  const mixedCount = items.filter((item) => item.origin === "mixed").length;
  const unknownOriginCount = items.filter((item) => item.origin === "unknown").length;

  return {
    evidenceCount: items.length,
    linkableEvidenceCount,
    ownershipResolvableCount,
    sourceCounts,
    sourceDiversity,
    timeSpreadDays,
    importedCount,
    nativeCount,
    mixedCount,
    unknownOriginCount,
    highEmotionItemCount,
    nonLinkableContextItems,
    quoteQualityLowCount,
    receiptCount,
    unresolvedContradictionCount,
    correctionSignalCount,
    distinctEpisodeCount,
  };
}

function originFromSessionOrigin(
  origin: "APP" | "IMPORTED_ARCHIVE" | null | undefined
): EvidencePacketItem["origin"] {
  if (origin === "APP") return "native";
  if (origin === "IMPORTED_ARCHIVE") return "imported";
  return "unknown";
}

function rollupOrigins(
  origins: EvidencePacketItem["origin"][]
): EvidencePacketItem["origin"] {
  const hasNative = origins.some(
    (origin) => origin === "native" || origin === "mixed"
  );
  const hasImported = origins.some(
    (origin) => origin === "imported" || origin === "mixed"
  );

  if (hasNative && hasImported) return "mixed";
  if (hasNative) return "native";
  if (hasImported) return "imported";
  return "unknown";
}

function originFromDerivationRunScope(
  scope: string | null | undefined
): EvidencePacketItem["origin"] {
  if (!scope) return "unknown";
  const normalized = scope.toLowerCase();
  if (normalized === "import" || normalized.startsWith("import")) {
    return "imported";
  }
  if (normalized === "native" || normalized.startsWith("native")) {
    return "native";
  }
  return "unknown";
}

async function fetchMessageOriginsById(
  db: EvidencePacketDb,
  userId: string,
  messageIds: string[]
): Promise<Map<string, MessageOriginRow>> {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = (await db.message.findMany({
    where: {
      userId,
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      sessionId: true,
      session: {
        select: {
          origin: true,
        },
      },
    },
  })) as MessageOriginRow[];

  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchSessionOriginsById(
  db: EvidencePacketDb,
  userId: string,
  sessionIds: string[]
): Promise<Map<string, SessionOriginRow>> {
  const uniqueIds = [...new Set(sessionIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = (await db.session.findMany({
    where: {
      userId,
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      origin: true,
    },
  })) as SessionOriginRow[];

  return new Map(rows.map((row) => [row.id, row]));
}

function resolveProvenanceOrigin(args: {
  messageId?: string | null;
  sessionId?: string | null;
  journalEntryId?: string | null;
  messageOriginsById: Map<string, MessageOriginRow>;
  sessionOriginsById: Map<string, SessionOriginRow>;
}): EvidencePacketItem["origin"] {
  if (args.messageId) {
    const message = args.messageOriginsById.get(args.messageId);
    if (message) {
      return originFromSessionOrigin(message.session.origin);
    }
  }

  if (args.sessionId) {
    const session = args.sessionOriginsById.get(args.sessionId);
    if (session) {
      return originFromSessionOrigin(session.origin);
    }
  }

  if (args.journalEntryId) {
    return "native";
  }

  return "unknown";
}

function hasActiveContradiction(status: ContradictionStatus): boolean {
  return (
    status === "candidate" ||
    status === "open" ||
    status === "snoozed" ||
    status === "explored"
  );
}

export async function assembleEvidencePacketV1(
  input: AssembleEvidencePacketInput
): Promise<EvidencePacket> {
  const db = (input.db ?? (prismadb as unknown as PrismaClient)) as unknown as EvidencePacketDb;
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const includeTimelineAggregationContext =
    input.includeTimelineAggregationContext ?? true;
  const includeUserCorrectionContext = input.includeUserCorrectionContext ?? true;

  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  windowStart.setUTCHours(0, 0, 0, 0);

  const [
    patternClaims,
    patternClaimEvidence,
    contradictionNodes,
    contradictionEvidence,
    profileArtifacts,
    evidenceSpans,
    referenceItems,
    surfacedActions,
    quickCheckIns,
    journalEntries,
    sessions,
    messages,
    importSessions,
    importChunks,
    correctionUpdates,
    correctionConclusions,
  ] = await Promise.all([
    db.patternClaim.findMany({
      where: {
        userId: input.userId,
        updatedAt: { gte: windowStart },
      },
      select: {
        id: true,
        summary: true,
        status: true,
        sourceRunId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.patternClaimEvidence.findMany({
      where: {
        claim: { userId: input.userId },
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        claimId: true,
        source: true,
        sessionId: true,
        messageId: true,
        journalEntryId: true,
        quote: true,
        createdAt: true,
      },
    }),
    db.contradictionNode.findMany({
      where: {
        userId: input.userId,
        lastTouchedAt: { gte: windowStart },
      },
      select: {
        id: true,
        title: true,
        sideA: true,
        sideB: true,
        status: true,
        createdAt: true,
        lastTouchedAt: true,
        lastEvidenceAt: true,
        sourceSessionId: true,
        sourceMessageId: true,
      },
    }),
    db.contradictionEvidence.findMany({
      where: {
        node: { userId: input.userId },
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        nodeId: true,
        sessionId: true,
        messageId: true,
        quote: true,
        createdAt: true,
      },
    }),
    db.profileArtifact.findMany({
      where: {
        userId: input.userId,
        lastSeenAt: { gte: windowStart },
      },
      select: {
        id: true,
        type: true,
        claim: true,
        confidence: true,
        status: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
    db.evidenceSpan.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        messageId: true,
        charStart: true,
        charEnd: true,
        createdAt: true,
        message: {
          select: {
            content: true,
            session: {
              select: {
                origin: true,
              },
            },
          },
        },
      },
    }),
    db.referenceItem.findMany({
      where: {
        userId: input.userId,
        updatedAt: { gte: windowStart },
      },
      select: {
        id: true,
        type: true,
        status: true,
        statement: true,
        sourceSessionId: true,
        sourceMessageId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.surfacedAction.findMany({
      where: {
        userId: input.userId,
        updatedAt: { gte: windowStart },
      },
      select: {
        id: true,
        bucket: true,
        status: true,
        note: true,
        surfacedAt: true,
        updatedAt: true,
        linkedClaimId: true,
      },
    }),
    db.quickCheckIn.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
      },
    }),
    db.journalEntry.findMany({
      where: {
        userId: input.userId,
        updatedAt: { gte: windowStart },
      },
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.session.findMany({
      where: {
        userId: input.userId,
        startedAt: { gte: windowStart },
      },
      select: {
        id: true,
        origin: true,
        startedAt: true,
        createdAt: true,
        label: true,
      },
    }),
    db.message.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        sessionId: true,
        role: true,
        content: true,
        createdAt: true,
        session: {
          select: {
            origin: true,
          },
        },
      },
    }) as Promise<MessageRow[]>,
    db.importUploadSession.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        processedConversations: true,
        processedMessages: true,
      },
    }),
    db.importUploadChunk.findMany({
      where: {
        session: {
          userId: input.userId,
        },
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        sessionId: true,
        sizeBytes: true,
        createdAt: true,
      },
    }),
    db.modelUpdate.findMany({
      where: {
        userId: input.userId,
        updateType: "correction_applied",
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        userFacingSummary: true,
        createdAt: true,
      },
    }),
    db.userMapConclusion.findMany({
      where: {
        userId: input.userId,
        lastUserCorrectionAt: { not: null },
        updatedAt: { gte: windowStart },
      },
      select: {
        id: true,
        lastUserCorrectionAt: true,
        lastUserCorrectionLabel: true,
      },
    }),
  ]);

  const referencedMessageIds = [
    ...patternClaimEvidence.map((item) => item.messageId),
    ...contradictionNodes.map((item) => item.sourceMessageId),
    ...contradictionEvidence.map((item) => item.messageId),
    ...referenceItems.map((item) => item.sourceMessageId),
  ].filter((value): value is string => Boolean(value));

  const referencedSessionIds = [
    ...patternClaimEvidence.map((item) => item.sessionId),
    ...contradictionNodes.map((item) => item.sourceSessionId),
    ...contradictionEvidence.map((item) => item.sessionId),
    ...referenceItems.map((item) => item.sourceSessionId),
  ].filter((value): value is string => Boolean(value));

  const [messageOriginsById, sessionOriginsById] = await Promise.all([
    fetchMessageOriginsById(db, input.userId, referencedMessageIds),
    fetchSessionOriginsById(db, input.userId, referencedSessionIds),
  ]);

  const sourceRunIds = [
    ...new Set(
      patternClaims
        .map((item) => item.sourceRunId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const sourceRuns = sourceRunIds.length
    ? await db.derivationRun.findMany({
        where: {
          id: { in: sourceRunIds },
          userId: input.userId,
        },
        select: {
          id: true,
          scope: true,
        },
      })
    : [];
  const sourceRunsById = new Map(sourceRuns.map((row) => [row.id, row]));

  const claimEvidenceOriginsById = new Map<
    string,
    EvidencePacketItem["origin"][]
  >();

  for (const evidence of patternClaimEvidence) {
    const evidenceOrigin = resolveProvenanceOrigin({
      messageId: evidence.messageId,
      sessionId: evidence.sessionId,
      journalEntryId: evidence.journalEntryId,
      messageOriginsById,
      sessionOriginsById,
    });

    if (!claimEvidenceOriginsById.has(evidence.claimId)) {
      claimEvidenceOriginsById.set(evidence.claimId, []);
    }
    claimEvidenceOriginsById.get(evidence.claimId)?.push(evidenceOrigin);
  }

  const profileArtifactIds = profileArtifacts.map((item) => item.id);
  const profileArtifactEvidenceLinks = profileArtifactIds.length
    ? await db.profileArtifactEvidenceLink.findMany({
        where: {
          artifactId: { in: profileArtifactIds },
          artifact: { userId: input.userId },
        },
        select: {
          artifactId: true,
          spanId: true,
          span: {
            select: {
              message: {
                select: {
                  session: {
                    select: {
                      origin: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];

  const profileArtifactOriginsById = new Map<
    string,
    EvidencePacketItem["origin"][]
  >();
  for (const link of profileArtifactEvidenceLinks) {
    const origin = originFromSessionOrigin(link.span.message.session.origin);
    if (!profileArtifactOriginsById.has(link.artifactId)) {
      profileArtifactOriginsById.set(link.artifactId, []);
    }
    profileArtifactOriginsById.get(link.artifactId)?.push(origin);
  }

  const items: EvidencePacketItem[] = [];

  for (const claim of patternClaims) {
    const claimEvidenceOrigins = claimEvidenceOriginsById.get(claim.id) ?? [];
    const originFromEvidence = rollupOrigins(claimEvidenceOrigins);
    const sourceRun = claim.sourceRunId
      ? sourceRunsById.get(claim.sourceRunId)
      : null;
    const fallbackRunOrigin = originFromDerivationRunScope(sourceRun?.scope);
    const claimOrigin =
      originFromEvidence !== "unknown" ? originFromEvidence : fallbackRunOrigin;

    items.push(
      createEvidenceItem({
        sourceType: SourceType.pattern_claim,
        sourceId: claim.id,
        role: "signal",
        timestamp: claim.updatedAt,
        snippet: claim.summary,
        provenanceRefs: {},
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(claim.summary),
        origin: claimOrigin,
        episodeKey: null,
      })
    );
  }

  for (const receipt of patternClaimEvidence) {
    const origin = resolveProvenanceOrigin({
      messageId: receipt.messageId,
      sessionId: receipt.sessionId,
      journalEntryId: receipt.journalEntryId,
      messageOriginsById,
      sessionOriginsById,
    });

    items.push(
      createEvidenceItem({
        sourceType: SourceType.pattern_claim_evidence,
        sourceId: receipt.id,
        role: "receipt",
        timestamp: receipt.createdAt,
        quote: receipt.quote,
        provenanceRefs: {
          patternClaimId: receipt.claimId,
          sessionId: receipt.sessionId ?? undefined,
          messageId: receipt.messageId ?? undefined,
          journalEntryId: receipt.journalEntryId ?? undefined,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(receipt.quote),
        origin,
        episodeKey: determineEpisodeKey({
          sessionId: receipt.sessionId,
          journalEntryId: receipt.journalEntryId,
          messageId: receipt.messageId,
        }),
      })
    );
  }

  for (const node of contradictionNodes) {
    const contradictionSummary = `${node.title} ${node.sideA} ${node.sideB}`;

    items.push(
      createEvidenceItem({
        sourceType: SourceType.contradiction_node,
        sourceId: node.id,
        role: "context",
        timestamp: node.lastTouchedAt,
        snippet: node.title,
        provenanceRefs: {
          contradictionNodeId: node.id,
          sessionId: node.sourceSessionId ?? undefined,
          messageId: node.sourceMessageId ?? undefined,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(contradictionSummary),
        origin: resolveProvenanceOrigin({
          messageId: node.sourceMessageId,
          sessionId: node.sourceSessionId,
          messageOriginsById,
          sessionOriginsById,
        }),
        episodeKey: determineEpisodeKey({
          sessionId: node.sourceSessionId,
          messageId: node.sourceMessageId,
        }),
      })
    );
  }

  for (const evidence of contradictionEvidence) {
    items.push(
      createEvidenceItem({
        sourceType: SourceType.contradiction_evidence,
        sourceId: evidence.id,
        role: "receipt",
        timestamp: evidence.createdAt,
        quote: evidence.quote,
        provenanceRefs: {
          contradictionNodeId: evidence.nodeId,
          sessionId: evidence.sessionId ?? undefined,
          messageId: evidence.messageId ?? undefined,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(evidence.quote),
        origin: resolveProvenanceOrigin({
          messageId: evidence.messageId,
          sessionId: evidence.sessionId,
          messageOriginsById,
          sessionOriginsById,
        }),
        episodeKey: determineEpisodeKey({
          sessionId: evidence.sessionId,
          messageId: evidence.messageId,
        }),
      })
    );
  }

  for (const artifact of profileArtifacts) {
    const signalSnippet = `${artifact.type}: ${artifact.claim}`;
    const profileOrigins = profileArtifactOriginsById.get(artifact.id) ?? [];
    const profileOrigin = rollupOrigins(profileOrigins);

    items.push(
      createEvidenceItem({
        sourceType: SourceType.profile_artifact,
        sourceId: artifact.id,
        role: "signal",
        timestamp: artifact.lastSeenAt,
        snippet: signalSnippet,
        provenanceRefs: {},
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(artifact.claim),
        origin: profileOrigin,
        episodeKey: null,
      })
    );
  }

  for (const span of evidenceSpans) {
    const excerpt = span.message.content.slice(span.charStart, span.charEnd);
    items.push(
      createEvidenceItem({
        sourceType: SourceType.evidence_span,
        sourceId: span.id,
        role: "receipt",
        timestamp: span.createdAt,
        quote: excerpt,
        provenanceRefs: {
          messageId: span.messageId,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(excerpt),
        origin: originFromSessionOrigin(span.message.session.origin),
        episodeKey: determineEpisodeKey({ messageId: span.messageId }),
      })
    );
  }

  for (const reference of referenceItems) {
    items.push(
      createEvidenceItem({
        sourceType: SourceType.reference_item,
        sourceId: reference.id,
        role: "context",
        timestamp: reference.updatedAt,
        snippet: reference.statement,
        provenanceRefs: {
          referenceItemId: reference.id,
          sessionId: reference.sourceSessionId ?? undefined,
          messageId: reference.sourceMessageId ?? undefined,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(reference.statement),
        origin: resolveProvenanceOrigin({
          messageId: reference.sourceMessageId,
          sessionId: reference.sourceSessionId,
          messageOriginsById,
          sessionOriginsById,
        }),
        episodeKey: determineEpisodeKey({
          sessionId: reference.sourceSessionId,
          messageId: reference.sourceMessageId,
        }),
      })
    );
  }

  for (const action of surfacedActions) {
    const actionSnippet = `${action.bucket}:${action.status}${
      action.note ? ` ${action.note}` : ""
    }`;

    items.push(
      createEvidenceItem({
        sourceType: SourceType.surfaced_action,
        sourceId: action.id,
        role: "outcome",
        timestamp: action.updatedAt,
        snippet: actionSnippet,
        provenanceRefs: {
          patternClaimId: action.linkedClaimId ?? undefined,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(action.note),
        origin: "native",
        episodeKey: null,
      })
    );
  }

  for (const checkIn of quickCheckIns) {
    const highEmotionSignal = detectHighEmotionSignalFromCheckIn({
      stateTag: checkIn.stateTag,
      eventTags: checkIn.eventTags,
      note: checkIn.note,
    });

    items.push(
      createEvidenceItem({
        sourceType: SourceType.quick_check_in,
        sourceId: checkIn.id,
        role: "signal",
        timestamp: checkIn.createdAt,
        snippet: [checkIn.stateTag, ...checkIn.eventTags].filter(Boolean).join(" | "),
        quote: checkIn.note,
        provenanceRefs: {},
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal,
        origin: "native",
        episodeKey: determineEpisodeKey({ checkInId: checkIn.id }),
      })
    );
  }

  for (const entry of journalEntries) {
    const authoredAt = entry.authoredAt ?? entry.createdAt;

    items.push(
      createEvidenceItem({
        sourceType: SourceType.journal_entry,
        sourceId: entry.id,
        role: "signal",
        timestamp: authoredAt,
        authoredAt,
        snippet: entry.title ?? entry.body.slice(0, 180),
        quote: entry.body.slice(0, 280),
        provenanceRefs: {
          journalEntryId: entry.id,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(entry.body),
        origin: "native",
        episodeKey: determineEpisodeKey({ journalEntryId: entry.id }),
      })
    );
  }

  for (const session of sessions) {
    items.push(
      createEvidenceItem({
        sourceType: SourceType.session,
        sourceId: session.id,
        role: "container",
        timestamp: session.startedAt,
        snippet: session.label,
        provenanceRefs: {
          sessionId: session.id,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: false,
        origin: originFromSessionOrigin(session.origin),
        episodeKey: determineEpisodeKey({ sessionId: session.id }),
      })
    );
  }

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    items.push(
      createEvidenceItem({
        sourceType: SourceType.message,
        sourceId: message.id,
        role: "signal",
        timestamp: message.createdAt,
        quote: message.content.slice(0, 280),
        provenanceRefs: {
          sessionId: message.sessionId,
          messageId: message.id,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: detectHighEmotionSignalFromText(message.content),
        origin: originFromSessionOrigin(message.session.origin),
        episodeKey: determineEpisodeKey({
          sessionId: message.sessionId,
          messageId: message.id,
        }),
      })
    );
  }

  for (const importSession of importSessions) {
    const summary = `${importSession.status} conv=${importSession.processedConversations} msg=${importSession.processedMessages}`;

    items.push(
      createEvidenceItem({
        sourceType: SourceType.import_record,
        sourceId: importSession.id,
        role: "context",
        timestamp: importSession.finishedAt ?? importSession.startedAt ?? importSession.createdAt,
        snippet: summary,
        provenanceRefs: {
          importSessionId: importSession.id,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: false,
        origin: "imported",
        episodeKey: null,
      })
    );
  }

  for (const chunk of importChunks) {
    items.push(
      createEvidenceItem({
        sourceType: SourceType.import_record,
        sourceId: chunk.id,
        role: "container",
        timestamp: chunk.createdAt,
        snippet: `chunk bytes=${chunk.sizeBytes}`,
        provenanceRefs: {
          importSessionId: chunk.sessionId,
          importChunkId: chunk.id,
        },
        linkable: true,
        ownershipResolvable: true,
        highEmotionSignal: false,
        origin: "imported",
        episodeKey: null,
      })
    );
  }

  if (includeTimelineAggregationContext) {
    const checkInCount = quickCheckIns.length;
    if (checkInCount > 0) {
      const stateCounts = new Map<string, number>();
      for (const checkIn of quickCheckIns) {
        if (!checkIn.stateTag) continue;
        stateCounts.set(checkIn.stateTag, (stateCounts.get(checkIn.stateTag) ?? 0) + 1);
      }
      const topState = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      items.push(
        createEvidenceItem({
          sourceType: SourceType.timeline_aggregation,
          sourceId: `timeline:${windowStart.toISOString()}:${now.toISOString()}`,
          role: "context",
          timestamp: now,
          snippet: `window=${windowDays}d checkIns=${checkInCount} topState=${topState ?? "none"}`,
          provenanceRefs: {},
          linkable: false,
          ownershipResolvable: false,
          highEmotionSignal: quickCheckIns.some((row) =>
            detectHighEmotionSignalFromCheckIn({
              stateTag: row.stateTag,
              eventTags: row.eventTags,
              note: row.note,
            })
          ),
          origin: "mixed",
          episodeKey: null,
        })
      );
    }
  }

  if (includeUserCorrectionContext) {
    for (const correctionUpdate of correctionUpdates) {
      items.push(
        createEvidenceItem({
          sourceType: SourceType.user_correction,
          sourceId: correctionUpdate.id,
          role: "calibration",
          timestamp: correctionUpdate.createdAt,
          snippet: correctionUpdate.userFacingSummary,
          provenanceRefs: {},
          linkable: false,
          ownershipResolvable: false,
          highEmotionSignal: detectHighEmotionSignalFromText(
            correctionUpdate.userFacingSummary
          ),
          origin: "unknown",
          episodeKey: null,
        })
      );
    }

    for (const correctionConclusion of correctionConclusions) {
      if (!correctionConclusion.lastUserCorrectionAt) {
        continue;
      }
      items.push(
        createEvidenceItem({
          sourceType: SourceType.user_correction,
          sourceId: correctionConclusion.id,
          role: "calibration",
          timestamp: correctionConclusion.lastUserCorrectionAt,
          snippet: correctionConclusion.lastUserCorrectionLabel,
          provenanceRefs: {},
          linkable: false,
          ownershipResolvable: false,
          highEmotionSignal: detectHighEmotionSignalFromText(
            correctionConclusion.lastUserCorrectionLabel
          ),
          origin: "unknown",
          episodeKey: null,
        })
      );
    }
  }

  const metrics = computeMetrics(items);

  metrics.unresolvedContradictionCount = contradictionNodes.filter((node) =>
    hasActiveContradiction(node.status)
  ).length;

  return {
    userId: input.userId,
    assembledAt: now,
    windowStart,
    windowEnd: now,
    items,
    metrics,
  };
}
