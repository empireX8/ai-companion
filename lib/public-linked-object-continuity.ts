import "server-only";

import {
  ContradictionStatus,
  PatternClaimStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";

type LinkableObjectType =
  | "usermap_conclusion"
  | "pattern_claim"
  | "contradiction_node";

type LinkedObjectInput = {
  linkedObjectType: string | null | undefined;
  linkedObjectId: string | null | undefined;
};

const SUPPORTED_LINK_TYPES: LinkableObjectType[] = [
  "usermap_conclusion",
  "pattern_claim",
  "contradiction_node",
];

function toNonEmptyId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSupportedType(value: string | null | undefined): LinkableObjectType | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value === "usermap_conclusion") {
    return "usermap_conclusion";
  }
  if (value === "pattern_claim") {
    return "pattern_claim";
  }
  if (value === "contradiction_node") {
    return "contradiction_node";
  }

  return null;
}

function toKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function toHref(type: LinkableObjectType, id: string): string {
  if (type === "usermap_conclusion") {
    return `/your-map/${id}`;
  }
  if (type === "pattern_claim") {
    return `/patterns/${id}`;
  }
  return `/contradictions/${id}`;
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

  const safeId = toNonEmptyId(args.linkedObjectId);
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

  const grouped = {
    usermap_conclusion: new Set<string>(),
    pattern_claim: new Set<string>(),
    contradiction_node: new Set<string>(),
  };

  for (const target of args.targets) {
    const safeType = toSupportedType(target.linkedObjectType);
    const safeId = toNonEmptyId(target.linkedObjectId);

    if (!safeType || !safeId) {
      continue;
    }

    grouped[safeType].add(safeId);
  }

  const [safeConclusions, safePatterns, safeContradictions] = await Promise.all([
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
  const safeId = toNonEmptyId(input.linkedObjectId);
  if (!safeType || !safeId) {
    return null;
  }
  return toKey(safeType, safeId);
}

export function isPublicLinkedObjectTypeSupported(
  linkedObjectType: string | null | undefined
): boolean {
  return SUPPORTED_LINK_TYPES.includes(
    linkedObjectType as LinkableObjectType
  );
}
