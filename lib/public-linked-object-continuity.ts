import "server-only";

import {
  ContradictionStatus,
  PatternClaimStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { buildPublicWatchForWhere } from "./fieldwork-public-visibility";
import { buildPublicActiveInvestigationWhere } from "./investigation-public-visibility";
import {
  buildPublicObjectHref,
  isPublicObjectLinkType,
  toNonEmptyPublicId,
  type PublicObjectLinkType,
} from "./public-continuity-registry";

type LinkableObjectType = PublicObjectLinkType;

type LinkedObjectInput = {
  linkedObjectType: string | null | undefined;
  linkedObjectId: string | null | undefined;
};

type AffectedObjectLinkInput = {
  affectedObjectType: string | null | undefined;
  affectedObjectId: string | null | undefined;
  affectedObjectHref: string | null;
};

function toSupportedType(value: string | null | undefined): LinkableObjectType | null {
  return isPublicObjectLinkType(value) ? value : null;
}

function toKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function toHref(type: LinkableObjectType, id: string): string {
  return buildPublicObjectHref({ type, id }) ?? "";
}

export async function resolvePublicLinkedObjectHref(args: {
  userId: string;
  linkedObjectType: string | null | undefined;
  linkedObjectId: string | null | undefined;
}): Promise<string | null> {
  const result = await resolvePublicLinkedObjectHrefs({
    userId: args.userId,
    targets: [
      {
        linkedObjectType: args.linkedObjectType,
        linkedObjectId: args.linkedObjectId,
      },
    ],
  });

  const safeId = toNonEmptyPublicId(args.linkedObjectId);
  if (!safeId) {
    return null;
  }

  const safeType = toSupportedType(args.linkedObjectType);
  if (!safeType) {
    return null;
  }

  return result.get(toKey(safeType, safeId)) ?? null;
}

export async function resolvePublicLinkedObjectHrefs(args: {
  userId: string;
  targets: LinkedObjectInput[];
}): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  const grouped: Record<PublicObjectLinkType, Set<string>> = {
    usermap_conclusion: new Set<string>(),
    investigation: new Set<string>(),
    fieldwork_assignment: new Set<string>(),
    pattern_claim: new Set<string>(),
    contradiction_node: new Set<string>(),
  };

  for (const target of args.targets) {
    const safeType = toSupportedType(target.linkedObjectType);
    const safeId = toNonEmptyPublicId(target.linkedObjectId);

    if (!safeType || !safeId) {
      continue;
    }

    grouped[safeType].add(safeId);
  }

  const [safeConclusions, safeInvestigations, safeFieldwork, safePatterns, safeContradictions] =
    await Promise.all([
    grouped.usermap_conclusion.size > 0
      ? prismadb.userMapConclusion.findMany({
          where: {
            userId: args.userId,
            visibility: UserMapConclusionVisibility.user_visible,
            id: { in: [...grouped.usermap_conclusion] },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    grouped.investigation.size > 0
      ? prismadb.investigation.findMany({
          where: {
            ...buildPublicActiveInvestigationWhere({ userId: args.userId }),
            id: { in: [...grouped.investigation] },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    grouped.fieldwork_assignment.size > 0
      ? prismadb.fieldworkAssignment.findMany({
          where: {
            ...buildPublicWatchForWhere({ userId: args.userId }),
            id: { in: [...grouped.fieldwork_assignment] },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    grouped.pattern_claim.size > 0
      ? prismadb.patternClaim.findMany({
          where: {
            userId: args.userId,
            status: { not: PatternClaimStatus.candidate },
            id: { in: [...grouped.pattern_claim] },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    grouped.contradiction_node.size > 0
      ? prismadb.contradictionNode.findMany({
          where: {
            userId: args.userId,
            status: { not: ContradictionStatus.candidate },
            id: { in: [...grouped.contradiction_node] },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  for (const row of safeConclusions) {
    resolved.set(
      toKey(UnderstandingLinkTargetType.usermap_conclusion, row.id),
      toHref("usermap_conclusion", row.id)
    );
  }

  for (const row of safeInvestigations) {
    resolved.set(
      toKey(UnderstandingLinkTargetType.investigation, row.id),
      toHref("investigation", row.id)
    );
  }

  for (const row of safeFieldwork) {
    resolved.set(
      toKey(UnderstandingLinkTargetType.fieldwork_assignment, row.id),
      toHref("fieldwork_assignment", row.id)
    );
  }

  for (const row of safePatterns) {
    resolved.set(
      toKey(UnderstandingLinkTargetType.pattern_claim, row.id),
      toHref("pattern_claim", row.id)
    );
  }

  for (const row of safeContradictions) {
    resolved.set(
      toKey(UnderstandingLinkTargetType.contradiction_node, row.id),
      toHref("contradiction_node", row.id)
    );
  }

  return resolved;
}

export function linkedObjectHrefMapKey(input: {
  linkedObjectType: string | null | undefined;
  linkedObjectId: string | null | undefined;
}): string | null {
  const safeType = toSupportedType(input.linkedObjectType);
  const safeId = toNonEmptyPublicId(input.linkedObjectId);
  if (!safeType || !safeId) {
    return null;
  }
  return toKey(safeType, safeId);
}

export function isPublicLinkedObjectTypeSupported(
  linkedObjectType: string | null | undefined
): boolean {
  return isPublicObjectLinkType(linkedObjectType);
}

export async function applyVerifiedAffectedObjectHrefs<
  T extends AffectedObjectLinkInput,
>(args: {
  userId: string;
  items: T[];
}): Promise<T[]> {
  const hrefsByKey = await resolvePublicLinkedObjectHrefs({
    userId: args.userId,
    targets: args.items.map((item) => ({
      linkedObjectType: item.affectedObjectType,
      linkedObjectId: item.affectedObjectId,
    })),
  });

  return args.items.map((item) => {
    const mapKey = linkedObjectHrefMapKey({
      linkedObjectType: item.affectedObjectType,
      linkedObjectId: item.affectedObjectId,
    });
    const verifiedHref = mapKey ? hrefsByKey.get(mapKey) ?? null : null;

    return {
      ...item,
      affectedObjectHref: verifiedHref,
    };
  });
}
