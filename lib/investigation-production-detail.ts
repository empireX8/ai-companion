import "server-only";

import {
  FieldworkStatus,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type Prisma,
} from "@prisma/client";

import {
  buildActiveQuestionDetailHref,
  buildWatchForDetailHref,
  formatFieldworkStatus,
  formatInvestigationSeedType,
  formatInvestigationStatus,
} from "./public-intelligence-safe-slice";
import { buildPublicFieldworkWhere } from "./fieldwork-public-visibility";
import { buildPublicInvestigationWhere } from "./investigation-public-visibility";
import { resolvePublicLinkedObjectHref } from "./public-linked-object-continuity";
import prismadb from "./prismadb";

const INVESTIGATION_DETAIL_SELECT = {
  id: true,
  title: true,
  organizingQuestion: true,
  status: true,
  seedType: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  resolutionSummary: true,
  resolvedAt: true,
  resolvedIntoUserMapConclusionId: true,
  reopenReason: true,
  competingTheories: true,
  evidenceNeeded: true,
} satisfies Prisma.InvestigationSelect;

const LINKED_EVIDENCE_LIMIT = 12;
const AVAILABLE_EVIDENCE_LIMIT = 12;

type WatchForRow = {
  id: string;
  prompt: string;
  reason: string;
  status: FieldworkStatus;
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string;
  observationNote: string | null;
  observationOutcome: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EvidenceLinkRow = {
  id: string;
  sourceId: string;
  role: string;
  createdAt: Date;
};

type EvidenceSpanRow = {
  id: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  createdAt: Date;
  message: {
    content: string;
    session: {
      id: string;
      label: string | null;
      origin: string;
    } | null;
  };
};

export type InvestigationEvidenceSpanItem = {
  linkId: string;
  evidenceId: string;
  messageId: string;
  excerpt: string;
  sessionId: string | null;
  sessionLabel: string | null;
  origin: string | null;
  role: string;
  createdAt: string;
  evidenceHref: string;
};

export type InvestigationFieldworkActivityItem = {
  id: string;
  prompt: string;
  reason: string;
  status: string;
  statusLabel: string;
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string;
  observationNote: string | null;
  observationOutcome: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  detailHref: string | null;
};

export type InvestigationAvailableEvidenceItem = {
  id: string;
  messageId: string;
  excerpt: string;
  sessionId: string | null;
  sessionLabel: string | null;
  origin: string | null;
  createdAt: string;
};

export type InvestigationProductionDetail = {
  id: string;
  detailHref: string | null;
  title: string;
  organizingQuestion: string;
  status: string;
  statusLabel: string;
  seedType: string;
  seedTypeLabel: string;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  reopenReason: string | null;
  resolvedConclusionId: string | null;
  resolvedConclusionHref: string | null;
  competingTheories: string[];
  evidenceNeeded: string[];
  linkedEvidence: InvestigationEvidenceSpanItem[];
  linkedFieldwork: InvestigationFieldworkActivityItem[];
  isClosed: boolean;
  closureStateLabel: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function clipText(value: string, max = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function toEvidenceExcerpt(row: EvidenceSpanRow): string {
  const excerpt = row.message.content.slice(row.charStart, row.charEnd).trim();
  if (excerpt.length > 0) {
    return clipText(excerpt);
  }
  return clipText(row.message.content);
}

function toClosureStateLabel(status: string): string {
  if (status === "resolved") {
    return "Closed as resolved";
  }
  if (status === "abandoned") {
    return "Closed as abandoned";
  }
  return "Open";
}

function toLinkedFieldworkItem(row: WatchForRow): InvestigationFieldworkActivityItem {
  return {
    id: row.id,
    prompt: row.prompt,
    reason: row.reason,
    status: row.status,
    statusLabel: formatFieldworkStatus(row.status),
    linkedObjectType: row.linkedObjectType,
    linkedObjectId: row.linkedObjectId,
    observationNote: row.observationNote,
    observationOutcome: row.observationOutcome,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    detailHref: buildWatchForDetailHref(row.id),
  };
}

function toLinkedEvidenceItem(
  link: EvidenceLinkRow,
  span: EvidenceSpanRow | undefined
): InvestigationEvidenceSpanItem | null {
  if (!span) {
    return null;
  }

  return {
    linkId: link.id,
    evidenceId: span.id,
    messageId: span.messageId,
    excerpt: toEvidenceExcerpt(span),
    sessionId: span.message.session?.id ?? null,
    sessionLabel: span.message.session?.label ?? null,
    origin: span.message.session?.origin ?? null,
    role: link.role,
    createdAt: link.createdAt.toISOString(),
    evidenceHref: `/evidence/${span.id}`,
  };
}

export async function loadProductionInvestigationDetail(args: {
  userId: string;
  id: string;
}): Promise<InvestigationProductionDetail | null> {
  const row = await prismadb.investigation.findFirst({
    where: buildPublicInvestigationWhere({
      userId: args.userId,
      id: args.id,
    }),
    select: INVESTIGATION_DETAIL_SELECT,
  });

  if (!row) {
    return null;
  }

  const [resolvedConclusionHref, watchForRows, evidenceLinkRows] =
    await Promise.all([
      row.resolvedIntoUserMapConclusionId
        ? resolvePublicLinkedObjectHref({
            userId: args.userId,
            linkedObjectType: "usermap_conclusion",
            linkedObjectId: row.resolvedIntoUserMapConclusionId,
          })
        : Promise.resolve(null),
      prismadb.fieldworkAssignment.findMany({
        where: buildPublicFieldworkWhere({
          userId: args.userId,
          linkedObjectType: UnderstandingLinkTargetType.investigation,
          linkedObjectId: row.id,
        }),
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          prompt: true,
          reason: true,
          status: true,
          linkedObjectType: true,
          linkedObjectId: true,
          observationNote: true,
          observationOutcome: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismadb.understandingEvidenceLink.findMany({
        where: {
          userId: args.userId,
          targetType: UnderstandingLinkTargetType.investigation,
          targetId: row.id,
          sourceType: UnderstandingLinkSourceType.evidence_span,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LINKED_EVIDENCE_LIMIT,
        select: {
          id: true,
          sourceId: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

  const evidenceIds = [...new Set(evidenceLinkRows.map((link) => link.sourceId))];
  const evidenceSpans = evidenceIds.length
    ? await prismadb.evidenceSpan.findMany({
        where: {
          userId: args.userId,
          id: { in: evidenceIds },
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
                  id: true,
                  label: true,
                  origin: true,
                },
              },
            },
          },
        },
      })
    : [];

  const evidenceById = new Map(evidenceSpans.map((span) => [span.id, span]));
  const linkedEvidence = evidenceLinkRows
    .map((link) => toLinkedEvidenceItem(link, evidenceById.get(link.sourceId)))
    .filter((item): item is InvestigationEvidenceSpanItem => Boolean(item));

  const linkedFieldwork = watchForRows.map((watchFor) => toLinkedFieldworkItem(watchFor));
  const status = row.status;

  return {
    id: row.id,
    detailHref: buildActiveQuestionDetailHref(row.id),
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    status,
    statusLabel: formatInvestigationStatus(status),
    seedType: row.seedType,
    seedTypeLabel: formatInvestigationSeedType(row.seedType),
    priority: row.priority ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolutionSummary: row.resolutionSummary ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    reopenReason: row.reopenReason ?? null,
    resolvedConclusionId: row.resolvedIntoUserMapConclusionId ?? null,
    resolvedConclusionHref,
    competingTheories: toStringArray(row.competingTheories),
    evidenceNeeded: toStringArray(row.evidenceNeeded),
    linkedEvidence,
    linkedFieldwork,
    isClosed: status === "resolved" || status === "abandoned",
    closureStateLabel: toClosureStateLabel(status),
  };
}

export async function listAvailableEvidenceSpansForUser(args: {
  userId: string;
  investigationId: string;
}): Promise<InvestigationAvailableEvidenceItem[]> {
  const linkedRows = await prismadb.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: args.investigationId,
      sourceType: UnderstandingLinkSourceType.evidence_span,
    },
    select: {
      sourceId: true,
    },
  });

  const linkedEvidenceIds = new Set(linkedRows.map((row) => row.sourceId));

  const rows = await prismadb.evidenceSpan.findMany({
    where: {
      userId: args.userId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AVAILABLE_EVIDENCE_LIMIT,
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
              id: true,
              label: true,
              origin: true,
            },
          },
        },
      },
    },
  });

  return rows
    .filter((row) => !linkedEvidenceIds.has(row.id))
    .map((row) => ({
      id: row.id,
      messageId: row.messageId,
      excerpt: toEvidenceExcerpt(row),
      sessionId: row.message.session?.id ?? null,
      sessionLabel: row.message.session?.label ?? null,
      origin: row.message.session?.origin ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
}
