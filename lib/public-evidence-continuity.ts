import "server-only";

import {
  PatternClaimStatus,
  ContradictionStatus,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  buildPublicObjectHref,
  isPublicEvidenceSourceType,
  toNonEmptyPublicId,
  type PublicEvidenceSourceType,
} from "./public-continuity-registry";

const PUBLIC_EVIDENCE_LIMIT = 6;
const PUBLIC_EVIDENCE_ALLOWED_TARGET_TYPES = [
  UnderstandingLinkTargetType.usermap_conclusion,
  UnderstandingLinkTargetType.investigation,
  UnderstandingLinkTargetType.fieldwork_assignment,
  UnderstandingLinkTargetType.model_update,
] as const;
type PublicEvidenceTargetType =
  (typeof PUBLIC_EVIDENCE_ALLOWED_TARGET_TYPES)[number];

const PUBLIC_EVIDENCE_ALLOWED_SOURCE_TYPES = [
  UnderstandingLinkSourceType.pattern_claim,
  UnderstandingLinkSourceType.contradiction_node,
] as const satisfies readonly PublicEvidenceSourceType[];

type PublicEvidenceSource = PublicEvidenceSourceType;

type PublicEvidenceRow = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  createdAt: Date;
};

export type PublicEvidenceContinuityItem = {
  id: string;
  sourceType: PublicEvidenceSource;
  sourceTypeLabel: string;
  sourceId: string;
  href: string;
  createdAt: string;
};

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildAllowlistedSourceHref(input: {
  sourceType: PublicEvidenceSource;
  sourceId: string;
}): string | null {
  return buildPublicObjectHref({ type: input.sourceType, id: input.sourceId });
}

function toSafePublicEvidenceItem(args: {
  row: PublicEvidenceRow;
  verifiedPatternIds: ReadonlySet<string>;
  verifiedContradictionIds: ReadonlySet<string>;
}): PublicEvidenceContinuityItem | null {
  const safeSourceId = toNonEmptyPublicId(args.row.sourceId);
  if (!safeSourceId) {
    return null;
  }

  if (isPublicEvidenceSourceType(args.row.sourceType) && args.row.sourceType === UnderstandingLinkSourceType.pattern_claim) {
    if (!args.verifiedPatternIds.has(safeSourceId)) {
      return null;
    }

    const href = buildAllowlistedSourceHref({
      sourceType: args.row.sourceType,
      sourceId: safeSourceId,
    });
    if (!href) {
      return null;
    }

    return {
      id: args.row.id,
      sourceType: args.row.sourceType,
      sourceTypeLabel: toTitleCase(args.row.sourceType),
      sourceId: safeSourceId,
      href,
      createdAt: args.row.createdAt.toISOString(),
    };
  }

  if (isPublicEvidenceSourceType(args.row.sourceType) && args.row.sourceType === UnderstandingLinkSourceType.contradiction_node) {
    if (!args.verifiedContradictionIds.has(safeSourceId)) {
      return null;
    }

    const href = buildAllowlistedSourceHref({
      sourceType: args.row.sourceType,
      sourceId: safeSourceId,
    });
    if (!href) {
      return null;
    }

    return {
      id: args.row.id,
      sourceType: args.row.sourceType,
      sourceTypeLabel: toTitleCase(args.row.sourceType),
      sourceId: safeSourceId,
      href,
      createdAt: args.row.createdAt.toISOString(),
    };
  }

  return null;
}

function isSupportedPublicEvidenceTargetType(
  targetType: UnderstandingLinkTargetType
): targetType is PublicEvidenceTargetType {
  return PUBLIC_EVIDENCE_ALLOWED_TARGET_TYPES.includes(
    targetType as PublicEvidenceTargetType
  );
}

async function listVerifiedPublicEvidenceContinuityByTarget(args: {
  userId: string;
  targetType: PublicEvidenceTargetType;
  targetId: string;
}): Promise<PublicEvidenceContinuityItem[]> {
  const rows = (await prismadb.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: args.targetType,
      targetId: args.targetId,
      sourceType: { in: [...PUBLIC_EVIDENCE_ALLOWED_SOURCE_TYPES] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PUBLIC_EVIDENCE_LIMIT,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      createdAt: true,
    },
  })) as PublicEvidenceRow[];

  if (rows.length === 0) {
    return [];
  }

  const patternSourceIds = [...new Set(
    rows
      .filter((row) => row.sourceType === UnderstandingLinkSourceType.pattern_claim)
      .map((row) => toNonEmptyPublicId(row.sourceId))
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  )];
  const contradictionSourceIds = [...new Set(
    rows
      .filter((row) => row.sourceType === UnderstandingLinkSourceType.contradiction_node)
      .map((row) => toNonEmptyPublicId(row.sourceId))
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  )];

  const [patternRows, contradictionRows] = await Promise.all([
    patternSourceIds.length > 0
      ? prismadb.patternClaim.findMany({
          where: {
            userId: args.userId,
            id: { in: patternSourceIds },
            status: { not: PatternClaimStatus.candidate },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    contradictionSourceIds.length > 0
      ? prismadb.contradictionNode.findMany({
          where: {
            userId: args.userId,
            id: { in: contradictionSourceIds },
            status: { not: ContradictionStatus.candidate },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const verifiedPatternIds = new Set(patternRows.map((row) => row.id));
  const verifiedContradictionIds = new Set(contradictionRows.map((row) => row.id));

  return rows
    .map((row) =>
      toSafePublicEvidenceItem({
        row,
        verifiedPatternIds,
        verifiedContradictionIds,
      })
    )
    .filter((item): item is PublicEvidenceContinuityItem => Boolean(item));
}

export async function listPublicEvidenceContinuityForTarget(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
}): Promise<PublicEvidenceContinuityItem[]> {
  const safeTargetId = toNonEmptyPublicId(args.targetId);
  if (!safeTargetId) {
    return [];
  }

  if (!isSupportedPublicEvidenceTargetType(args.targetType)) {
    return [];
  }

  return listVerifiedPublicEvidenceContinuityByTarget({
    userId: args.userId,
    targetType: args.targetType,
    targetId: safeTargetId,
  });
}

export async function listYourMapPublicEvidenceContinuity(args: {
  userId: string;
  targetId: string;
}): Promise<PublicEvidenceContinuityItem[]> {
  const safeTargetId = toNonEmptyPublicId(args.targetId);
  if (!safeTargetId) {
    return [];
  }

  const target = await prismadb.userMapConclusion.findFirst({
    where: {
      id: safeTargetId,
      userId: args.userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    select: { id: true },
  });

  if (!target) {
    return [];
  }

  return listPublicEvidenceContinuityForTarget({
    userId: args.userId,
    targetType: UnderstandingLinkTargetType.usermap_conclusion,
    targetId: target.id,
  });
}
