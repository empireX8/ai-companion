import "server-only";

import {
  PatternClaimStatus,
  ContradictionStatus,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";

const YOUR_MAP_EVIDENCE_LIMIT = 6;
const YOUR_MAP_EVIDENCE_TARGET_TYPE = UnderstandingLinkTargetType.usermap_conclusion;
const YOUR_MAP_EVIDENCE_ALLOWED_SOURCE_TYPES = [
  UnderstandingLinkSourceType.pattern_claim,
  UnderstandingLinkSourceType.contradiction_node,
] as const;

type YourMapEvidenceSourceType =
  (typeof YOUR_MAP_EVIDENCE_ALLOWED_SOURCE_TYPES)[number];

type YourMapEvidenceRow = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  createdAt: Date;
};

export type PublicEvidenceContinuityItem = {
  id: string;
  sourceType: YourMapEvidenceSourceType;
  sourceTypeLabel: string;
  sourceId: string;
  href: string;
  createdAt: string;
};

function toNonEmptyId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildAllowlistedSourceHref(input: {
  sourceType: YourMapEvidenceSourceType;
  sourceId: string;
}): string | null {
  if (input.sourceType === UnderstandingLinkSourceType.pattern_claim) {
    return `/patterns/${input.sourceId}`;
  }
  if (input.sourceType === UnderstandingLinkSourceType.contradiction_node) {
    return `/contradictions/${input.sourceId}`;
  }

  return null;
}

function toSafePublicEvidenceItem(args: {
  row: YourMapEvidenceRow;
  verifiedPatternIds: ReadonlySet<string>;
  verifiedContradictionIds: ReadonlySet<string>;
}): PublicEvidenceContinuityItem | null {
  const safeSourceId = toNonEmptyId(args.row.sourceId);
  if (!safeSourceId) {
    return null;
  }

  if (args.row.sourceType === UnderstandingLinkSourceType.pattern_claim) {
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

  if (args.row.sourceType === UnderstandingLinkSourceType.contradiction_node) {
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

export async function listYourMapPublicEvidenceContinuity(args: {
  userId: string;
  targetId: string;
}): Promise<PublicEvidenceContinuityItem[]> {
  const safeTargetId = toNonEmptyId(args.targetId);
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

  const rows = (await prismadb.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: YOUR_MAP_EVIDENCE_TARGET_TYPE,
      targetId: target.id,
      sourceType: { in: [...YOUR_MAP_EVIDENCE_ALLOWED_SOURCE_TYPES] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: YOUR_MAP_EVIDENCE_LIMIT,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      createdAt: true,
    },
  })) as YourMapEvidenceRow[];

  if (rows.length === 0) {
    return [];
  }

  const patternSourceIds = [...new Set(
    rows
      .filter((row) => row.sourceType === UnderstandingLinkSourceType.pattern_claim)
      .map((row) => toNonEmptyId(row.sourceId))
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  )];
  const contradictionSourceIds = [...new Set(
    rows
      .filter((row) => row.sourceType === UnderstandingLinkSourceType.contradiction_node)
      .map((row) => toNonEmptyId(row.sourceId))
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
