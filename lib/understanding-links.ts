import {
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";

import { filterEvidenceLinksByPublicTargetEligibility } from "./understanding-evidence-link-public-eligibility";

export type RelatedUnderstanding = {
  userMapConclusionIds: string[];
  investigationIds: string[];
  modelUpdateIds: string[];
  fieldworkAssignmentIds: string[];
};

export function isIncludeUnderstandingLinksEnabled(
  searchParams: URLSearchParams
): boolean {
  return searchParams.get("includeUnderstandingLinks") === "true";
}

export function emptyRelatedUnderstanding(): RelatedUnderstanding {
  return {
    userMapConclusionIds: [],
    investigationIds: [],
    modelUpdateIds: [],
    fieldworkAssignmentIds: [],
  };
}

type BuildArgs = {
  userId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceIds: string[];
};

export async function buildRelatedUnderstandingBySourceId(
  args: BuildArgs
): Promise<Map<string, RelatedUnderstanding>> {
  const dedupedSourceIds = [...new Set(args.sourceIds)];
  if (dedupedSourceIds.length === 0) {
    return new Map();
  }

  const rows = await prismadb.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      sourceType: args.sourceType,
      sourceId: { in: dedupedSourceIds },
    },
    select: {
      sourceId: true,
      targetType: true,
      targetId: true,
    },
  });

  const publicEligibleRows = await filterEvidenceLinksByPublicTargetEligibility({
    userId: args.userId,
    links: rows,
  });

  const grouped = new Map<
    string,
    {
      userMapConclusionIds: Set<string>;
      investigationIds: Set<string>;
      modelUpdateIds: Set<string>;
      fieldworkAssignmentIds: Set<string>;
    }
  >();

  for (const row of publicEligibleRows) {
    const current = grouped.get(row.sourceId) ?? {
      userMapConclusionIds: new Set<string>(),
      investigationIds: new Set<string>(),
      modelUpdateIds: new Set<string>(),
      fieldworkAssignmentIds: new Set<string>(),
    };

    if (row.targetType === UnderstandingLinkTargetType.usermap_conclusion) {
      current.userMapConclusionIds.add(row.targetId);
    } else if (row.targetType === UnderstandingLinkTargetType.investigation) {
      current.investigationIds.add(row.targetId);
    } else if (row.targetType === UnderstandingLinkTargetType.model_update) {
      current.modelUpdateIds.add(row.targetId);
    } else if (row.targetType === UnderstandingLinkTargetType.fieldwork_assignment) {
      current.fieldworkAssignmentIds.add(row.targetId);
    }

    grouped.set(row.sourceId, current);
  }

  const projected = new Map<string, RelatedUnderstanding>();
  for (const sourceId of dedupedSourceIds) {
    const entry = grouped.get(sourceId);
    if (!entry) {
      projected.set(sourceId, emptyRelatedUnderstanding());
      continue;
    }
    projected.set(sourceId, {
      userMapConclusionIds: [...entry.userMapConclusionIds],
      investigationIds: [...entry.investigationIds],
      modelUpdateIds: [...entry.modelUpdateIds],
      fieldworkAssignmentIds: [...entry.fieldworkAssignmentIds],
    });
  }

  return projected;
}

