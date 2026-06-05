import {
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import { buildPublicWatchForWhere } from "./fieldwork-public-visibility";
import { buildPublicActiveInvestigationWhere } from "./investigation-public-visibility";
import prismadb from "./prismadb";

const GUARDED_EVIDENCE_LINK_TARGET_TYPES = new Set<UnderstandingLinkTargetType>([
  UnderstandingLinkTargetType.usermap_conclusion,
  UnderstandingLinkTargetType.investigation,
  UnderstandingLinkTargetType.fieldwork_assignment,
  UnderstandingLinkTargetType.model_update,
]);

export type EvidenceLinkTargetRef = {
  targetType: UnderstandingLinkTargetType;
  targetId: string;
};

function targetRefKey(targetType: UnderstandingLinkTargetType, targetId: string): string {
  return `${targetType}|${targetId}`;
}

export function isGuardedEvidenceLinkTargetType(
  targetType: UnderstandingLinkTargetType
): boolean {
  return GUARDED_EVIDENCE_LINK_TARGET_TYPES.has(targetType);
}

type EligibilityDb = Pick<
  PrismaClient,
  "userMapConclusion" | "investigation" | "fieldworkAssignment" | "modelUpdate"
>;

async function resolvePublicEligibleTargetIdSet(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetIds: string[];
  db: EligibilityDb;
}): Promise<Set<string>> {
  const uniqueTargetIds = [...new Set(args.targetIds)];
  if (uniqueTargetIds.length === 0) {
    return new Set();
  }

  switch (args.targetType) {
    case UnderstandingLinkTargetType.usermap_conclusion: {
      const rows = await args.db.userMapConclusion.findMany({
        where: {
          userId: args.userId,
          id: { in: uniqueTargetIds },
          visibility: UserMapConclusionVisibility.user_visible,
        },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    }
    case UnderstandingLinkTargetType.investigation: {
      const rows = await args.db.investigation.findMany({
        where: {
          ...buildPublicActiveInvestigationWhere({ userId: args.userId }),
          id: { in: uniqueTargetIds },
        },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    }
    case UnderstandingLinkTargetType.fieldwork_assignment: {
      const rows = await args.db.fieldworkAssignment.findMany({
        where: {
          ...buildPublicWatchForWhere({ userId: args.userId }),
          id: { in: uniqueTargetIds },
        },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    }
    case UnderstandingLinkTargetType.model_update: {
      const rows = await args.db.modelUpdate.findMany({
        where: {
          userId: args.userId,
          id: { in: uniqueTargetIds },
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
        },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    }
    default:
      return new Set(uniqueTargetIds);
  }
}

export async function resolvePublicEligibleEvidenceLinkTargetKeys(args: {
  userId: string;
  targets: EvidenceLinkTargetRef[];
  db?: EligibilityDb;
}): Promise<Set<string>> {
  const db = (args.db ?? prismadb) as EligibilityDb;
  const eligibleKeys = new Set<string>();

  const grouped = new Map<UnderstandingLinkTargetType, Set<string>>();
  for (const target of args.targets) {
    if (!isGuardedEvidenceLinkTargetType(target.targetType)) {
      eligibleKeys.add(targetRefKey(target.targetType, target.targetId));
      continue;
    }

    const ids = grouped.get(target.targetType) ?? new Set<string>();
    ids.add(target.targetId);
    grouped.set(target.targetType, ids);
  }

  for (const [targetType, targetIds] of grouped.entries()) {
    const eligibleIds = await resolvePublicEligibleTargetIdSet({
      userId: args.userId,
      targetType,
      targetIds: [...targetIds],
      db,
    });
    for (const targetId of eligibleIds) {
      eligibleKeys.add(targetRefKey(targetType, targetId));
    }
  }

  return eligibleKeys;
}

export async function isEvidenceLinkTargetPublicEligible(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  db?: EligibilityDb;
}): Promise<boolean> {
  const eligibleKeys = await resolvePublicEligibleEvidenceLinkTargetKeys({
    userId: args.userId,
    targets: [{ targetType: args.targetType, targetId: args.targetId }],
    db: args.db,
  });
  return eligibleKeys.has(targetRefKey(args.targetType, args.targetId));
}

export async function filterEvidenceLinksByPublicTargetEligibility<
  T extends EvidenceLinkTargetRef,
>(args: {
  userId: string;
  links: T[];
  db?: EligibilityDb;
}): Promise<T[]> {
  if (args.links.length === 0) {
    return [];
  }

  const eligibleKeys = await resolvePublicEligibleEvidenceLinkTargetKeys({
    userId: args.userId,
    targets: args.links.map((link) => ({
      targetType: link.targetType,
      targetId: link.targetId,
    })),
    db: args.db,
  });

  return args.links.filter((link) =>
    eligibleKeys.has(targetRefKey(link.targetType, link.targetId))
  );
}
