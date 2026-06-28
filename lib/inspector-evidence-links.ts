import "server-only";

import {
  ContradictionStatus,
  PatternClaimStatus,
  UnderstandingLinkSourceType,
} from "@prisma/client";

import type { InspectorEvidenceLinkItem } from "./inspector-object-api";
import { dedupeInspectorEvidenceLinks } from "./inspector-evidence-presentation";
import type { PublicEvidenceContinuityItem } from "./public-evidence-continuity";
import prismadb from "./prismadb";

export async function enrichContinuityItemsForInspector(args: {
  userId: string;
  items: PublicEvidenceContinuityItem[];
}): Promise<InspectorEvidenceLinkItem[]> {
  if (args.items.length === 0) {
    return [];
  }

  const patternIds = [
    ...new Set(
      args.items
        .filter((item) => item.sourceType === UnderstandingLinkSourceType.pattern_claim)
        .map((item) => item.sourceId)
    ),
  ];
  const contradictionIds = [
    ...new Set(
      args.items
        .filter((item) => item.sourceType === UnderstandingLinkSourceType.contradiction_node)
        .map((item) => item.sourceId)
    ),
  ];
  const linkIds = args.items.map((item) => item.id);

  const [patterns, contradictions, linkRows] = await Promise.all([
    patternIds.length > 0
      ? prismadb.patternClaim.findMany({
          where: {
            userId: args.userId,
            id: { in: patternIds },
            status: { not: PatternClaimStatus.candidate },
          },
          select: { id: true, summary: true },
        })
      : Promise.resolve([]),
    contradictionIds.length > 0
      ? prismadb.contradictionNode.findMany({
          where: {
            userId: args.userId,
            id: { in: contradictionIds },
            status: { not: ContradictionStatus.candidate },
          },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    linkIds.length > 0
      ? prismadb.understandingEvidenceLink.findMany({
          where: {
            userId: args.userId,
            id: { in: linkIds },
          },
          select: { id: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const patternSummaryById = new Map(patterns.map((row) => [row.id, row.summary]));
  const contradictionTitleById = new Map(contradictions.map((row) => [row.id, row.title]));
  const roleByLinkId = new Map(linkRows.map((row) => [row.id, row.role]));

  const mapped = args.items.map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    sourceTypeLabel: item.sourceTypeLabel,
    evidenceSummaryLabel: item.evidenceSummaryLabel,
    sourceObjectHref: item.href,
    createdAt: item.createdAt,
    hasEvidence: true as const,
    objectTitle:
      item.sourceType === UnderstandingLinkSourceType.pattern_claim
        ? (patternSummaryById.get(item.sourceId) ?? null)
        : item.sourceType === UnderstandingLinkSourceType.contradiction_node
          ? (contradictionTitleById.get(item.sourceId) ?? null)
          : null,
    linkRole: roleByLinkId.get(item.id) ?? null,
  }));

  return dedupeInspectorEvidenceLinks(mapped);
}
