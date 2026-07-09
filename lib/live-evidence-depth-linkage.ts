/**
 * Read/linkage layer for stored SurfacedEvidencePointer records.
 *
 * Durable spec: docs/live-evidence-depth-linkage-contract.md
 * Write spec: docs/live-evidence-depth-write-contract.md
 *
 * Projects stored pointers + UEL graphSlot edges into depth-safe OrvekObject graphs.
 * Does NOT add pointer ids to Today resurfaced rows or touch UI.
 */

import type {
  PrismaClient,
  SurfacedEvidencePointerStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import {
  InvestigationVisibility,
  ModelUpdateVisibility,
  UserMapConclusionVisibility,
} from "@prisma/client";

import {
  assessEvidenceInspectorDepth,
  canUseLiveEvidenceInspectorDepthList,
  isNearEmptyInspectorObject,
  type EvidenceInspectorDepthBlocker,
} from "./orvek-v0/production/evidence-inspector-depth-parity";
import type { OrvekDataApi } from "./orvek-v0/data-provider";
import { EMPTY_ORVEK_DATA_API } from "./orvek-v0/empty-api";
import type { OrvekObject } from "./orvek-v0/orvek-types";
import {
  graphSlotFromUelMeta,
  isGenericSurfacingRationale,
  type EvidencePointerGraphSlot,
} from "./live-evidence-depth-write-contract";
import { isGenericSourceText } from "./live-evidence-depth-write-path";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";

const POINTER_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "Europe/London",
});

export type SurfacedEvidencePointerRecord = {
  id: string;
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  sourceText: string;
  sourceOrigin: string;
  whyItMatters: string;
  whyResurfaced: string | null;
  surfacedAt: Date;
  publicEligible: boolean;
  status: SurfacedEvidencePointerStatus;
  libraryReceiptId?: string | null;
  detailHref?: string | null;
};

export type UnderstandingEvidenceLinkRow = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  role: UnderstandingLinkRole;
  summary: string | null;
  meta: unknown;
};

export type ResolvedSurfacedEvidencePointerLink = {
  targetId: string;
  targetType: UnderstandingLinkTargetType;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  summary?: string;
};

export type SurfacedEvidencePointerReadBlocker =
  | "pointer_not_public_eligible"
  | "pointer_not_active"
  | "missing_why_it_matters"
  | "generic_why_it_matters"
  | "generic_source_text"
  | "no_eligible_links"
  | "missing_graph_slot"
  | "link_not_public_eligible"
  | "unhydrated_target"
  | "near_empty_target"
  | "inspector_depth_blocked"
  | EvidenceInspectorDepthBlocker;

export type RejectedSurfacedEvidencePointer = {
  pointerId: string;
  blockers: SurfacedEvidencePointerReadBlocker[];
};

export type SurfacedEvidenceDepthGraphResult = {
  pointerObjects: OrvekObject[];
  linkedObjects: OrvekObject[];
  depthSafePointerIds: string[];
  rejectedPointers: RejectedSurfacedEvidencePointer[];
  inspectorDepthListReady: boolean;
};

export type SurfacedEvidenceDepthLinkageDeps = {
  listSurfacedEvidencePointers: (args: {
    userId: string;
  }) => Promise<SurfacedEvidencePointerRecord[]>;
  listUnderstandingEvidenceLinksForSources: (args: {
    userId: string;
    sources: Array<{
      sourceType: UnderstandingLinkSourceType;
      sourceId: string;
    }>;
  }) => Promise<UnderstandingEvidenceLinkRow[]>;
  checkPublicTargetEligibility: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
  hydrateLinkedTargetObject: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<OrvekObject | null>;
};

type SurfacedEvidenceDepthLinkageDb = Pick<
  PrismaClient,
  | "surfacedEvidencePointer"
  | "understandingEvidenceLink"
  | "userMapConclusion"
  | "patternClaim"
  | "contradictionNode"
  | "investigation"
  | "modelUpdate"
  | "fieldworkAssignment"
>;

function hasText(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function normalizeIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ids ?? []) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function formatSurfacedEvidencePointerDate(surfacedAt: Date): string {
  return POINTER_DATE_FORMATTER.format(surfacedAt);
}

export function buildSurfacedEvidencePointerTitle(
  pointer: Pick<SurfacedEvidencePointerRecord, "sourceText" | "sourceOrigin">,
): string {
  const sourceText = pointer.sourceText.trim();
  if (hasText(sourceText) && sourceText !== "Receipt") {
    const sentence = sourceText.split(/[.!?]/)[0]?.trim() || sourceText;
    return sentence.length > 96 ? `${sentence.slice(0, 93)}...` : sentence;
  }

  const origin = pointer.sourceOrigin.trim();
  if (hasText(origin) && origin !== "Receipt") {
    return origin;
  }

  return "Surfaced evidence capture";
}

export function resolveGraphSlotFromLinkRow(
  row: Pick<UnderstandingEvidenceLinkRow, "meta" | "role">,
): EvidencePointerGraphSlot | null {
  const fromMeta = graphSlotFromUelMeta(row.meta);
  if (fromMeta) {
    return fromMeta;
  }

  return null;
}

export async function resolveSurfacedEvidencePointerLinks(args: {
  userId: string;
  pointer: SurfacedEvidencePointerRecord;
  linkRows: UnderstandingEvidenceLinkRow[];
  checkPublicTargetEligibility: SurfacedEvidenceDepthLinkageDeps["checkPublicTargetEligibility"];
}): Promise<{
  eligibleLinks: ResolvedSurfacedEvidencePointerLink[];
  excludedLinkIds: string[];
  blockers: SurfacedEvidencePointerReadBlocker[];
}> {
  const eligibleLinks: ResolvedSurfacedEvidencePointerLink[] = [];
  const excludedLinkIds: string[] = [];
  const blockers: SurfacedEvidencePointerReadBlocker[] = [];

  const rowsForPointer = args.linkRows.filter(
    (row) =>
      row.sourceType === args.pointer.sourceObjectType &&
      row.sourceId === args.pointer.sourceObjectId,
  );

  for (const row of rowsForPointer) {
    const graphSlot = resolveGraphSlotFromLinkRow(row);
    if (!graphSlot) {
      excludedLinkIds.push(row.targetId);
      if (!blockers.includes("missing_graph_slot")) {
        blockers.push("missing_graph_slot");
      }
      continue;
    }

    const eligible = await args.checkPublicTargetEligibility({
      userId: args.userId,
      targetType: row.targetType,
      targetId: row.targetId,
    });
    if (!eligible) {
      excludedLinkIds.push(row.targetId);
      if (!blockers.includes("link_not_public_eligible")) {
        blockers.push("link_not_public_eligible");
      }
      continue;
    }

    eligibleLinks.push({
      targetId: row.targetId,
      targetType: row.targetType,
      role: row.role,
      graphSlot,
      summary: row.summary ?? undefined,
    });
  }

  return { eligibleLinks, excludedLinkIds, blockers };
}

export function projectSurfacedEvidencePointerToOrvekObject(args: {
  pointer: SurfacedEvidencePointerRecord;
  relatedIds: string[];
  contextIds: string[];
}): OrvekObject {
  const date = formatSurfacedEvidencePointerDate(args.pointer.surfacedAt);

  return {
    id: args.pointer.id,
    type: "receipt",
    title: buildSurfacedEvidencePointerTitle(args.pointer),
    sourceText: args.pointer.sourceText.trim(),
    sourceOrigin: args.pointer.sourceOrigin.trim(),
    date,
    lastUpdated: date,
    whyItMatters: args.pointer.whyItMatters.trim(),
    whyResurfaced: args.pointer.whyResurfaced?.trim() || undefined,
    relatedIds: normalizeIds(args.relatedIds),
    contextIds: normalizeIds(args.contextIds),
    detailHref: args.pointer.detailHref ?? undefined,
  };
}

export type SurfacedEvidencePointerReadinessAssessment = {
  ready: boolean;
  blockers: SurfacedEvidencePointerReadBlocker[];
  pointerObject: OrvekObject | null;
  linkedObjects: OrvekObject[];
  relatedIds: string[];
  contextIds: string[];
};

export async function assessSurfacedEvidencePointerReadiness(args: {
  userId: string;
  pointer: SurfacedEvidencePointerRecord;
  linkRows: UnderstandingEvidenceLinkRow[];
  deps: Pick<
    SurfacedEvidenceDepthLinkageDeps,
    "checkPublicTargetEligibility" | "hydrateLinkedTargetObject"
  >;
}): Promise<SurfacedEvidencePointerReadinessAssessment> {
  const blockers: SurfacedEvidencePointerReadBlocker[] = [];

  if (!args.pointer.publicEligible) {
    blockers.push("pointer_not_public_eligible");
  }
  if (args.pointer.status !== "active") {
    blockers.push("pointer_not_active");
  }
  if (!hasText(args.pointer.whyItMatters)) {
    blockers.push("missing_why_it_matters");
  } else if (isGenericSurfacingRationale(args.pointer.whyItMatters)) {
    blockers.push("generic_why_it_matters");
  }
  if (!hasText(args.pointer.sourceText) || isGenericSourceText(args.pointer.sourceText)) {
    blockers.push("generic_source_text");
  }

  const { eligibleLinks, blockers: linkBlockers } = await resolveSurfacedEvidencePointerLinks({
    userId: args.userId,
    pointer: args.pointer,
    linkRows: args.linkRows,
    checkPublicTargetEligibility: args.deps.checkPublicTargetEligibility,
  });
  blockers.push(...linkBlockers);

  if (eligibleLinks.length === 0) {
    blockers.push("no_eligible_links");
  }

  const linkedObjects: OrvekObject[] = [];
  const relatedIds: string[] = [];
  const contextIds: string[] = [];

  for (const link of eligibleLinks) {
    const hydrated = await args.deps.hydrateLinkedTargetObject({
      userId: args.userId,
      targetType: link.targetType,
      targetId: link.targetId,
    });
    if (!hydrated) {
      blockers.push("unhydrated_target");
      continue;
    }
    if (isNearEmptyInspectorObject(hydrated)) {
      blockers.push("near_empty_target");
      continue;
    }

    linkedObjects.push(hydrated);
    if (link.graphSlot === "context") {
      contextIds.push(link.targetId);
    } else {
      relatedIds.push(link.targetId);
    }
  }

  if (relatedIds.length === 0 && contextIds.length === 0) {
    if (!blockers.includes("no_eligible_links")) {
      blockers.push("no_eligible_links");
    }
  }

  const pointerObject =
    relatedIds.length > 0 || contextIds.length > 0
      ? projectSurfacedEvidencePointerToOrvekObject({
          pointer: args.pointer,
          relatedIds,
          contextIds,
        })
      : null;

  const objectMap = new Map<string, OrvekObject>();
  if (pointerObject) {
    objectMap.set(pointerObject.id, pointerObject);
  }
  for (const linked of linkedObjects) {
    objectMap.set(linked.id, linked);
  }

  const depthAssessment = pointerObject
    ? assessEvidenceInspectorDepth(pointerObject, (id) =>
        id ? objectMap.get(id) : undefined,
      )
    : null;

  if (depthAssessment && !depthAssessment.inspectorDepthSafe) {
    blockers.push("inspector_depth_blocked");
    blockers.push(...depthAssessment.blockers);
  }

  const uniqueBlockers = [...new Set(blockers)];
  const hardBlockers = uniqueBlockers.filter(
    (blocker) => blocker !== "link_not_public_eligible" && blocker !== "missing_graph_slot",
  );

  return {
    ready: Boolean(
      pointerObject && depthAssessment?.inspectorDepthSafe && hardBlockers.length === 0,
    ),
    blockers: uniqueBlockers,
    pointerObject,
    linkedObjects,
    relatedIds,
    contextIds,
  };
}

export async function buildDepthSafeSurfacedEvidencePointerGraph(args: {
  userId: string;
  pointers: SurfacedEvidencePointerRecord[];
  linkRows: UnderstandingEvidenceLinkRow[];
  deps: Pick<
    SurfacedEvidenceDepthLinkageDeps,
    "checkPublicTargetEligibility" | "hydrateLinkedTargetObject"
  >;
}): Promise<SurfacedEvidenceDepthGraphResult> {
  const pointerObjects: OrvekObject[] = [];
  const linkedObjects: OrvekObject[] = [];
  const depthSafePointerIds: string[] = [];
  const rejectedPointers: RejectedSurfacedEvidencePointer[] = [];
  const linkedById = new Map<string, OrvekObject>();

  for (const pointer of args.pointers) {
    const assessment = await assessSurfacedEvidencePointerReadiness({
      userId: args.userId,
      pointer,
      linkRows: args.linkRows,
      deps: args.deps,
    });

    if (!assessment.ready || !assessment.pointerObject) {
      rejectedPointers.push({
        pointerId: pointer.id,
        blockers: assessment.blockers,
      });
      continue;
    }

    pointerObjects.push(assessment.pointerObject);
    depthSafePointerIds.push(assessment.pointerObject.id);

    for (const linked of assessment.linkedObjects) {
      if (!linkedById.has(linked.id)) {
        linkedById.set(linked.id, linked);
        linkedObjects.push(linked);
      }
    }
  }

  const objectMap = new Map<string, OrvekObject>();
  for (const object of pointerObjects) {
    objectMap.set(object.id, object);
  }
  for (const object of linkedObjects) {
    objectMap.set(object.id, object);
  }

  const api: OrvekDataApi = {
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objectMap.get(id) : undefined),
    getObjects: (ids) =>
      normalizeIds(ids).map((id) => objectMap.get(id)).filter(Boolean) as OrvekObject[],
  };

  return {
    pointerObjects,
    linkedObjects,
    depthSafePointerIds,
    rejectedPointers,
    inspectorDepthListReady: canUseLiveEvidenceInspectorDepthList(
      api,
      depthSafePointerIds,
    ),
  };
}

export async function readSurfacedEvidencePointersForUser(
  input: { userId: string },
  deps: SurfacedEvidenceDepthLinkageDeps,
): Promise<SurfacedEvidenceDepthGraphResult> {
  const pointers = await deps.listSurfacedEvidencePointers({ userId: input.userId });
  const activePublicPointers = pointers.filter(
    (pointer) => pointer.publicEligible && pointer.status === "active",
  );

  const linkRows = await deps.listUnderstandingEvidenceLinksForSources({
    userId: input.userId,
    sources: activePublicPointers.map((pointer) => ({
      sourceType: pointer.sourceObjectType,
      sourceId: pointer.sourceObjectId,
    })),
  });

  return buildDepthSafeSurfacedEvidencePointerGraph({
    userId: input.userId,
    pointers: activePublicPointers,
    linkRows,
    deps,
  });
}

export function buildSurfacedEvidencePointerOrvekObjects(
  result: SurfacedEvidenceDepthGraphResult,
): OrvekObject[] {
  return result.pointerObjects;
}

export function buildLinkedEvidenceTargetOrvekObjects(
  result: SurfacedEvidenceDepthGraphResult,
): OrvekObject[] {
  return result.linkedObjects;
}

export function mergeSurfacedEvidenceDepthObjects(
  baseApi: OrvekDataApi,
  result: SurfacedEvidenceDepthGraphResult,
): OrvekDataApi {
  const depthObjects = new Map<string, OrvekObject>();

  for (const object of result.pointerObjects) {
    depthObjects.set(object.id, object);
  }
  for (const object of result.linkedObjects) {
    depthObjects.set(object.id, object);
  }

  if (depthObjects.size === 0) {
    return baseApi;
  }

  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return depthObjects.get(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = depthObjects.get(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
  };
}

async function hydrateLinkedTargetFromDb(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  db: SurfacedEvidenceDepthLinkageDb;
}): Promise<OrvekObject | null> {
  switch (args.targetType) {
    case "usermap_conclusion": {
      const row = await args.db.userMapConclusion.findFirst({
        where: {
          id: args.targetId,
          userId: args.userId,
          visibility: UserMapConclusionVisibility.user_visible,
        },
        select: { id: true, title: true, summary: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "map-object",
        subtype: "claim",
        title: row.title,
        summary: row.summary,
        whyItMatters: row.summary,
      };
    }
    case "pattern_claim": {
      const row = await args.db.patternClaim.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true, summary: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "map-object",
        subtype: "claim",
        title: row.summary,
        summary: row.summary,
        whyItMatters: row.summary,
      };
    }
    case "contradiction_node": {
      const row = await args.db.contradictionNode.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true, title: true, sideA: true, sideB: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "map-object",
        subtype: "conflict",
        title: row.title,
        summary: `${row.sideA} vs ${row.sideB}`,
        whyItMatters: row.title,
        supporting: [row.sideA, row.sideB],
      };
    }
    case "investigation": {
      const row = await args.db.investigation.findFirst({
        where: {
          id: args.targetId,
          userId: args.userId,
          visibility: InvestigationVisibility.user_visible,
        },
        select: { id: true, title: true, organizingQuestion: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "investigation",
        title: row.title,
        summary: row.organizingQuestion,
        whyItMatters: row.organizingQuestion,
      };
    }
    case "model_update": {
      const row = await args.db.modelUpdate.findFirst({
        where: {
          id: args.targetId,
          userId: args.userId,
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
        },
        select: { id: true, userFacingSummary: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "model-update",
        title: row.userFacingSummary,
        summary: row.userFacingSummary,
        whyItMatters: row.userFacingSummary,
      };
    }
    case "fieldwork_assignment": {
      const row = await args.db.fieldworkAssignment.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true, prompt: true, reason: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        type: "fieldwork",
        title: row.prompt,
        summary: row.reason,
        whyItMatters: row.reason,
      };
    }
    default:
      return null;
  }
}

export function createSurfacedEvidenceDepthLinkageDeps(
  db: SurfacedEvidenceDepthLinkageDb,
): SurfacedEvidenceDepthLinkageDeps {
  return {
    listSurfacedEvidencePointers: async ({ userId }) => {
      const rows = await db.surfacedEvidencePointer.findMany({
        where: { userId },
        orderBy: [{ surfacedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          userId: true,
          sourceObjectType: true,
          sourceObjectId: true,
          sourceText: true,
          sourceOrigin: true,
          whyItMatters: true,
          whyResurfaced: true,
          surfacedAt: true,
          publicEligible: true,
          status: true,
          libraryReceiptId: true,
          detailHref: true,
        },
      });
      return rows;
    },
    listUnderstandingEvidenceLinksForSources: async ({ userId, sources }) => {
      const dedupedSources = [
        ...new Map(
          sources.map((source) => [
            `${source.sourceType}|${source.sourceId}`,
            source,
          ]),
        ).values(),
      ];
      if (dedupedSources.length === 0) {
        return [];
      }

      const rows = await db.understandingEvidenceLink.findMany({
        where: {
          userId,
          OR: dedupedSources.map((source) => ({
            sourceType: source.sourceType,
            sourceId: source.sourceId,
          })),
        },
        select: {
          sourceType: true,
          sourceId: true,
          targetType: true,
          targetId: true,
          role: true,
          summary: true,
          meta: true,
        },
      });
      return rows;
    },
    checkPublicTargetEligibility: async ({ userId, targetType, targetId }) =>
      isEvidenceLinkTargetPublicEligible({ userId, targetType, targetId, db }),
    hydrateLinkedTargetObject: async ({ userId, targetType, targetId }) =>
      hydrateLinkedTargetFromDb({ userId, targetType, targetId, db }),
  };
}
