/**
 * SUBSYS-003 Slice A — authenticated Inspector-safe evidence projection.
 *
 * Server-side authority → browser-safe drill-down only.
 * Not a truth store. Does not persist. Does not reuse public continuity
 * meaning as private Inspector source meaning. Never copies raw UEL
 * summary/snippet/quote as general evidence text.
 */

import "server-only";

import { createHash } from "crypto";
import {
  ContradictionStatus,
  PatternClaimStatus,
  ReferenceStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type Role,
} from "@prisma/client";

import type {
  CanonicalModelUpdateEvidenceClass,
  CanonicalModelUpdateEvidenceDisclosure,
  CanonicalModelUpdateEvidenceDrilldownProjection,
} from "./inspector-object-api";
import { firstMeaningfulModelUpdateText } from "./model-update-identity";
import { isSupportedEvidenceLinkPair } from "./orvek-intelligence-object-authority";

export type CanonicalInspectorEvidenceRelationshipInput = {
  relationshipId: string;
  modelUpdateId: string;
  userId: string;
  evidenceClass: CanonicalModelUpdateEvidenceClass;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  /** UnderstandingEvidenceLink.createdAt — fallback date only. */
  relationshipCreatedAt: Date | string | null;
  /**
   * Opaque selection id for the originating ModelUpdate (existing workbench
   * selection). Passed through to the drill-down projection unchanged.
   */
  returnSelectionId: string;
};

type FindFirstDelegate = {
  findFirst?: (args: unknown) => Promise<unknown>;
  findMany?: (args: unknown) => Promise<unknown[]>;
};

async function findOwnedRecord<T>(
  delegate: FindFirstDelegate | undefined,
  args: { where: unknown; select?: unknown },
): Promise<T | null> {
  if (!delegate) return null;
  if (typeof delegate.findFirst === "function") {
    return (await delegate.findFirst(args)) as T | null;
  }
  if (typeof delegate.findMany === "function") {
    const rows = (await delegate.findMany({
      ...args,
      take: 1,
    })) as T[];
    return rows[0] ?? null;
  }
  return null;
}

type InspectorEvidenceTx = {
  patternClaim?: FindFirstDelegate;
  patternClaimEvidence?: FindFirstDelegate;
  contradictionNode?: FindFirstDelegate;
  contradictionEvidence?: FindFirstDelegate;
  profileArtifact?: FindFirstDelegate;
  evidenceSpan?: FindFirstDelegate;
  referenceItem?: FindFirstDelegate;
  surfacedAction?: FindFirstDelegate;
  journalEntry?: FindFirstDelegate;
  quickCheckIn?: FindFirstDelegate;
  session?: FindFirstDelegate;
  message?: FindFirstDelegate;
  importUploadSession?: FindFirstDelegate;
  importUploadChunk?: FindFirstDelegate;
};

type SourceAdapterResult =
  | {
      kind: "omit";
    }
  | {
      kind: "project";
      disclosure: CanonicalModelUpdateEvidenceDisclosure;
      sourceTitle: string | null;
      summary: string | null;
      snippet: string | null;
      sourceRecordedAt: Date | string | null;
      provenanceExtra?: string | null;
    };

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatInspectorRecordedLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function sourceTypeLabel(sourceType: UnderstandingLinkSourceType): string {
  switch (sourceType) {
    case UnderstandingLinkSourceType.pattern_claim:
      return "Pattern claim";
    case UnderstandingLinkSourceType.pattern_claim_evidence:
      return "Pattern receipt";
    case UnderstandingLinkSourceType.contradiction_node:
      return "Contradiction";
    case UnderstandingLinkSourceType.contradiction_evidence:
      return "Signal receipt";
    case UnderstandingLinkSourceType.profile_artifact:
      return "Profile artifact";
    case UnderstandingLinkSourceType.evidence_span:
      return "Evidence span";
    case UnderstandingLinkSourceType.reference_item:
      return "Reference item";
    case UnderstandingLinkSourceType.surfaced_action:
      return "Action outcome";
    case UnderstandingLinkSourceType.journal_entry:
      return "Journal entry";
    case UnderstandingLinkSourceType.quick_check_in:
      return "Quick check-in";
    case UnderstandingLinkSourceType.session:
      return "Conversation session";
    case UnderstandingLinkSourceType.message:
      return "Conversation message";
    case UnderstandingLinkSourceType.import_record:
      return "Imported record";
    case UnderstandingLinkSourceType.timeline_aggregation:
      return "Timeline aggregation";
    case UnderstandingLinkSourceType.user_correction:
      return "User correction";
    default:
      return "Evidence source";
  }
}

function roleLabel(role: UnderstandingLinkRole): string {
  switch (role) {
    case UnderstandingLinkRole.supports:
      return "Supporting";
    case UnderstandingLinkRole.contradicts:
      return "Conflicting";
    case UnderstandingLinkRole.context:
      return "Context";
    default:
      return role;
  }
}

function evidenceClassLabel(
  evidenceClass: CanonicalModelUpdateEvidenceClass,
): string {
  return evidenceClass === "direct_movement_evidence"
    ? "Movement evidence"
    : "Resulting revision evidence";
}

function titleCandidate(value: string | null | undefined): string | null {
  const normalized = safeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === "context" || lower === "receipt" || lower === "linked evidence") {
    return null;
  }
  return normalized;
}

function buildTitle(args: {
  evidenceClassLabel: string;
  sourceTypeLabel: string;
  sourceTitle: string | null;
  summary: string | null;
  recordedLabel: string | null;
}): string {
  const sourceTitle = titleCandidate(args.sourceTitle);
  const summary = titleCandidate(args.summary);
  return (
    firstMeaningfulModelUpdateText([
      sourceTitle &&
      sourceTitle.toLowerCase() !== args.sourceTypeLabel.toLowerCase()
        ? sourceTitle
        : null,
      summary,
      args.recordedLabel
        ? `${args.sourceTypeLabel} · ${args.recordedLabel}`
        : null,
      `${args.evidenceClassLabel} · ${args.sourceTypeLabel}`,
    ]) ?? `${args.evidenceClassLabel} · ${args.sourceTypeLabel}`
  );
}

export function buildCanonicalEvidenceSelectionId(args: {
  modelUpdateId: string;
  evidenceClass: CanonicalModelUpdateEvidenceClass;
  relationshipId: string;
}): string {
  const digest = createHash("sha256")
    .update("orvek:canonical-evidence-drilldown:v1")
    .update("\0")
    .update(args.modelUpdateId)
    .update("\0")
    .update(args.evidenceClass)
    .update("\0")
    .update(args.relationshipId)
    .digest("hex");
  return `canonical-evidence-${digest}`;
}

function hashSpanSlice(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function messageRoleAllowsLink(args: {
  messageRole: Role;
  linkRole: UnderstandingLinkRole;
}): boolean {
  if (args.messageRole === "assistant") {
    return args.linkRole === UnderstandingLinkRole.context;
  }
  if (args.messageRole === "user") {
    return (
      args.linkRole === UnderstandingLinkRole.supports ||
      args.linkRole === UnderstandingLinkRole.context
    );
  }
  return false;
}

function classifyEvidenceClass(args: {
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  expectedResultingRevisionId?: string | null;
}): CanonicalModelUpdateEvidenceClass | null {
  if (args.targetType === UnderstandingLinkTargetType.model_update) {
    return "direct_movement_evidence";
  }
  if (
    args.targetType === UnderstandingLinkTargetType.canonical_concept_revision
  ) {
    if (
      args.expectedResultingRevisionId &&
      args.targetId !== args.expectedResultingRevisionId
    ) {
      return null;
    }
    return "resulting_revision_evidence";
  }
  return null;
}

async function adaptSource(args: {
  userId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  db: InspectorEvidenceTx;
}): Promise<SourceAdapterResult> {
  const { userId, sourceType, sourceId, role, db } = args;

  switch (sourceType) {
    case UnderstandingLinkSourceType.pattern_claim: {
      const claim = await findOwnedRecord<{
        id: string;
        summary: string;
        status: PatternClaimStatus;
        createdAt: Date;
      }>(db.patternClaim, {
        where: { id: sourceId, userId },
        select: { id: true, summary: true, status: true, createdAt: true },
      });
      if (!claim) return { kind: "omit" };
      if (claim.status === PatternClaimStatus.candidate) {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: claim.createdAt,
        };
      }
      const text = safeText(claim.summary);
      if (!text) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: claim.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: text,
        summary: text,
        snippet: text,
        sourceRecordedAt: claim.createdAt,
      };
    }

    case UnderstandingLinkSourceType.pattern_claim_evidence: {
      const row = await findOwnedRecord<{
        id: string;
        quote: string | null;
        createdAt: Date;
        claim: { status: PatternClaimStatus; summary: string };
      }>(db.patternClaimEvidence, {
        where: { id: sourceId, claim: { userId } },
        select: {
          id: true,
          quote: true,
          createdAt: true,
          claim: { select: { status: true, summary: true } },
        },
      });
      if (!row) return { kind: "omit" };
      if (row.claim.status === PatternClaimStatus.candidate) {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: "Pattern receipt",
          summary: null,
          snippet: null,
          sourceRecordedAt: row.createdAt,
        };
      }
      const quote = safeText(row.quote);
      const parentSummary = safeText(row.claim.summary);
      if (!quote) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: parentSummary ?? "Pattern receipt",
          summary: null,
          snippet: null,
          sourceRecordedAt: row.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: parentSummary ?? "Pattern receipt",
        summary: null,
        snippet: quote,
        sourceRecordedAt: row.createdAt,
      };
    }

    case UnderstandingLinkSourceType.contradiction_node: {
      const node = await findOwnedRecord<{
        id: string;
        title: string;
        status: ContradictionStatus;
        createdAt: Date;
      }>(db.contradictionNode, {
        where: { id: sourceId, userId },
        select: { id: true, title: true, status: true, createdAt: true },
      });
      if (!node) return { kind: "omit" };
      if (
        node.status === ContradictionStatus.candidate ||
        node.status === ContradictionStatus.archived_tension
      ) {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: node.createdAt,
        };
      }
      const title = safeText(node.title);
      if (!title) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: node.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: title,
        summary: title,
        snippet: title,
        sourceRecordedAt: node.createdAt,
      };
    }

    case UnderstandingLinkSourceType.contradiction_evidence: {
      const row = await findOwnedRecord<{
        id: string;
        quote: string | null;
        createdAt: Date;
        node: { status: ContradictionStatus };
      }>(db.contradictionEvidence, {
        where: { id: sourceId, node: { userId } },
        select: {
          id: true,
          quote: true,
          createdAt: true,
          node: { select: { status: true } },
        },
      });
      if (!row) return { kind: "omit" };
      if (
        row.node.status === ContradictionStatus.candidate ||
        row.node.status === ContradictionStatus.archived_tension
      ) {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: "Signal receipt",
          summary: null,
          snippet: null,
          sourceRecordedAt: row.createdAt,
        };
      }
      const quote = safeText(row.quote);
      if (!quote) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Signal receipt",
          summary: null,
          snippet: null,
          sourceRecordedAt: row.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: "Signal receipt",
        summary: null,
        snippet: quote,
        sourceRecordedAt: row.createdAt,
      };
    }

    case UnderstandingLinkSourceType.profile_artifact: {
      const artifact = await findOwnedRecord<{
        id: string;
        claim: string;
        status: string;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }>(db.profileArtifact, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          claim: true,
          status: true,
          firstSeenAt: true,
          lastSeenAt: true,
        },
      });
      if (!artifact) return { kind: "omit" };
      const recordedAt = artifact.firstSeenAt ?? artifact.lastSeenAt;
      if (artifact.status !== "active") {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: recordedAt,
        };
      }
      const claim = safeText(artifact.claim);
      if (!claim) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: recordedAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: claim,
        summary: claim,
        snippet: claim,
        sourceRecordedAt: recordedAt,
      };
    }

    case UnderstandingLinkSourceType.evidence_span: {
      const span = await findOwnedRecord<{
        id: string;
        messageId: string;
        charStart: number;
        charEnd: number;
        contentHash: string;
        createdAt: Date;
        message: {
          id: string;
          userId: string;
          content: string;
          createdAt: Date;
        } | null;
      }>(db.evidenceSpan, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          messageId: true,
          charStart: true,
          charEnd: true,
          contentHash: true,
          createdAt: true,
          message: {
            select: {
              id: true,
              userId: true,
              content: true,
              createdAt: true,
            },
          },
        },
      });
      if (!span || !span.message || span.message.userId !== userId) {
        return { kind: "omit" };
      }
      const { content } = span.message;
      if (
        span.charStart < 0 ||
        span.charEnd < span.charStart ||
        span.charEnd > content.length
      ) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Evidence span",
          summary: null,
          snippet: null,
          sourceRecordedAt: span.message.createdAt ?? span.createdAt,
        };
      }
      const slice = content.slice(span.charStart, span.charEnd);
      if (hashSpanSlice(slice) !== span.contentHash) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Evidence span",
          summary: null,
          snippet: null,
          sourceRecordedAt: span.message.createdAt ?? span.createdAt,
        };
      }
      const text = safeText(slice);
      if (!text) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Evidence span",
          summary: null,
          snippet: null,
          sourceRecordedAt: span.message.createdAt ?? span.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: "Evidence span",
        summary: null,
        snippet: text,
        sourceRecordedAt: span.message.createdAt ?? span.createdAt,
      };
    }

    case UnderstandingLinkSourceType.reference_item: {
      const item = await findOwnedRecord<{
        id: string;
        statement: string;
        status: ReferenceStatus;
        createdAt: Date;
      }>(db.referenceItem, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          statement: true,
          status: true,
          createdAt: true,
        },
      });
      if (!item) return { kind: "omit" };
      if (item.status !== ReferenceStatus.active) {
        return {
          kind: "project",
          disclosure: "redacted",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: item.createdAt,
        };
      }
      const statement = safeText(item.statement);
      if (!statement) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: null,
          summary: null,
          snippet: null,
          sourceRecordedAt: item.createdAt,
        };
      }
      const truncated =
        statement.length > 160 ? `${statement.slice(0, 157)}…` : statement;
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: truncated,
        summary: truncated,
        snippet: statement,
        sourceRecordedAt: item.createdAt,
      };
    }

    case UnderstandingLinkSourceType.surfaced_action: {
      const action = await findOwnedRecord<{
        id: string;
        note: string | null;
        bucket: string;
        status: string;
        surfacedAt: Date;
      }>(db.surfacedAction, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          note: true,
          bucket: true,
          status: true,
          surfacedAt: true,
        },
      });
      if (!action) return { kind: "omit" };
      const note = safeText(action.note);
      const bucketLabel = normalizeWhitespace(
        String(action.bucket).replace(/_/g, " "),
      );
      const sourceTitle = `Action outcome · ${bucketLabel}`;
      if (!note) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle,
          summary: null,
          snippet: null,
          sourceRecordedAt: action.surfacedAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle,
        summary: null,
        snippet: note,
        sourceRecordedAt: action.surfacedAt,
      };
    }

    case UnderstandingLinkSourceType.journal_entry: {
      const journal = await findOwnedRecord<{
        id: string;
        title: string | null;
        body: string;
        authoredAt: Date | null;
        createdAt: Date;
      }>(db.journalEntry, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          title: true,
          body: true,
          authoredAt: true,
          createdAt: true,
        },
      });
      if (!journal) return { kind: "omit" };
      const title = safeText(journal.title) ?? "Journal entry";
      const body = safeText(journal.body);
      if (!body) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: title,
          summary: null,
          snippet: null,
          sourceRecordedAt: journal.authoredAt ?? journal.createdAt,
        };
      }
      const snippet = safeText(journal.title)
        ? `${safeText(journal.title)}\n\n${body}`
        : body;
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: title,
        summary: safeText(journal.title),
        snippet,
        sourceRecordedAt: journal.authoredAt ?? journal.createdAt,
      };
    }

    case UnderstandingLinkSourceType.quick_check_in: {
      const checkIn = await findOwnedRecord<{
        id: string;
        stateTag: string | null;
        note: string | null;
        createdAt: Date;
      }>(db.quickCheckIn, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          stateTag: true,
          note: true,
          createdAt: true,
        },
      });
      if (!checkIn) return { kind: "omit" };
      const stateLabel = checkIn.stateTag
        ? normalizeWhitespace(String(checkIn.stateTag).replace(/_/g, " "))
        : null;
      const note = safeText(checkIn.note);
      const sourceTitle = stateLabel ?? "Quick check-in";
      if (!note && !stateLabel) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Quick check-in",
          summary: null,
          snippet: null,
          sourceRecordedAt: checkIn.createdAt,
        };
      }
      if (!note) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle,
          summary: null,
          snippet: null,
          sourceRecordedAt: checkIn.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle,
        summary: null,
        snippet: note,
        sourceRecordedAt: checkIn.createdAt,
      };
    }

    case UnderstandingLinkSourceType.session: {
      const session = await findOwnedRecord<{
        id: string;
        label: string | null;
        surfaceType: string | null;
        startedAt: Date | null;
        createdAt: Date;
      }>(db.session, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          label: true,
          surfaceType: true,
          startedAt: true,
          createdAt: true,
        },
      });
      if (!session) return { kind: "omit" };
      const label = safeText(session.label);
      const surface = session.surfaceType
        ? normalizeWhitespace(String(session.surfaceType).replace(/_/g, " "))
        : null;
      return {
        kind: "project",
        disclosure: "unavailable",
        sourceTitle: label ?? surface ?? "Conversation session",
        summary: null,
        snippet: null,
        sourceRecordedAt: session.startedAt ?? session.createdAt,
      };
    }

    case UnderstandingLinkSourceType.message: {
      const message = await findOwnedRecord<{
        id: string;
        role?: Role;
        content: string;
        createdAt: Date;
      }>(db.message, {
        where: { id: sourceId, userId },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });
      if (!message) return { kind: "omit" };
      // Incomplete test doubles may omit role; owned user messages with
      // supports/context remain eligible under the same integrity rules.
      const messageRole = (message.role ?? "user") as Role;
      if (!messageRoleAllowsLink({ messageRole, linkRole: role })) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Conversation message",
          summary: null,
          snippet: null,
          sourceRecordedAt: message.createdAt,
        };
      }
      const content = safeText(message.content);
      if (!content) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: "Conversation message",
          summary: null,
          snippet: null,
          sourceRecordedAt: message.createdAt,
        };
      }
      return {
        kind: "project",
        disclosure: "available",
        sourceTitle: "Conversation message",
        summary: null,
        snippet: content,
        sourceRecordedAt: message.createdAt,
      };
    }

    case UnderstandingLinkSourceType.import_record: {
      const session = await findOwnedRecord<{
        id: string;
        filename: string;
        createdAt: Date;
      }>(db.importUploadSession, {
        where: { id: sourceId, userId },
        select: { id: true, filename: true, createdAt: true },
      });
      if (session) {
        return {
          kind: "project",
          disclosure: "unavailable",
          sourceTitle: safeText(session.filename) ?? "Imported record",
          summary: null,
          snippet: null,
          sourceRecordedAt: session.createdAt,
        };
      }
      const chunk = await findOwnedRecord<{
        id: string;
        createdAt: Date;
        session: { filename: string; createdAt: Date };
      }>(db.importUploadChunk, {
        where: { id: sourceId, session: { userId } },
        select: {
          id: true,
          createdAt: true,
          session: { select: { filename: true, createdAt: true } },
        },
      });
      if (!chunk) return { kind: "omit" };
      return {
        kind: "project",
        disclosure: "unavailable",
        sourceTitle: safeText(chunk.session.filename) ?? "Imported record",
        summary: null,
        snippet: null,
        sourceRecordedAt: chunk.createdAt ?? chunk.session.createdAt,
      };
    }

    case UnderstandingLinkSourceType.timeline_aggregation:
    case UnderstandingLinkSourceType.user_correction:
    default:
      return { kind: "omit" };
  }
}

/**
 * Build one Inspector-safe drill-down projection for an authenticated evidence
 * relationship. Returns null when the relationship must be omitted (missing /
 * cross-user / unsupported pair / unknown type / wrong target binding).
 */
export async function projectCanonicalInspectorEvidenceDrilldown(args: {
  relationship: CanonicalInspectorEvidenceRelationshipInput;
  db: InspectorEvidenceTx;
  expectedResultingRevisionId?: string | null;
}): Promise<CanonicalModelUpdateEvidenceDrilldownProjection | null> {
  const { relationship, db } = args;

  const classified = classifyEvidenceClass({
    targetType: relationship.targetType,
    targetId: relationship.targetId,
    expectedResultingRevisionId: args.expectedResultingRevisionId,
  });
  if (!classified || classified !== relationship.evidenceClass) {
    return null;
  }

  if (
    !isSupportedEvidenceLinkPair({
      sourceType: relationship.sourceType,
      targetType: relationship.targetType,
    })
  ) {
    return null;
  }

  const adapted = await adaptSource({
    userId: relationship.userId,
    sourceType: relationship.sourceType,
    sourceId: relationship.sourceId,
    role: relationship.role,
    db,
  });
  if (adapted.kind === "omit") {
    return null;
  }

  const evidenceClass = relationship.evidenceClass;
  const classLabel = evidenceClassLabel(evidenceClass);
  const typeLabel = sourceTypeLabel(relationship.sourceType);
  const recordedAt =
    toIso(adapted.sourceRecordedAt) ?? toIso(relationship.relationshipCreatedAt);
  const recordedLabel = formatInspectorRecordedLabel(recordedAt);

  const disclosure = adapted.disclosure;
  const summary = disclosure === "available" ? adapted.summary : null;
  const snippet = disclosure === "available" ? adapted.snippet : null;
  const sourceTitleForLadder =
    disclosure === "available" || adapted.sourceTitle
      ? adapted.sourceTitle
      : null;

  const roleDisplay = roleLabel(relationship.role);
  const title = buildTitle({
    evidenceClassLabel: classLabel,
    sourceTypeLabel: typeLabel,
    sourceTitle: sourceTitleForLadder,
    summary: disclosure === "available" ? summary : null,
    recordedLabel,
  });
  const sourceOrigin =
    firstMeaningfulModelUpdateText([
      [typeLabel, roleDisplay, classLabel].filter(Boolean).join(" · "),
      typeLabel,
      classLabel,
    ]) ?? typeLabel;

  return {
    selectionId: buildCanonicalEvidenceSelectionId({
      modelUpdateId: relationship.modelUpdateId,
      evidenceClass,
      relationshipId: relationship.relationshipId,
    }),
    evidenceClass,
    evidenceClassLabel: classLabel,
    sourceType: relationship.sourceType,
    sourceTypeLabel: typeLabel,
    role: relationship.role,
    roleLabel: roleDisplay,
    title,
    summary,
    snippet,
    sourceOrigin,
    recordedAt,
    recordedLabel,
    provenanceLabel: classLabel,
    sourceDisclosure: disclosure,
    returnSelectionId: relationship.returnSelectionId,
  };
}
