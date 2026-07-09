/**
 * Upstream graphSlot UEL link source for Evidence Pointer depth.
 *
 * Writes explicit meta.graphSlot on UnderstandingEvidenceLink rows at link creation.
 * Does NOT infer slot from role, target type, or read-time linkage heuristics.
 *
 * Durable spec: docs/live-evidence-depth-write-contract.md
 * Consumers: lib/live-evidence-depth-write-hook.ts (#118), linkage read (#116)
 */

import type {
  Prisma,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import type { UnderstandingEvidenceLinkRow } from "./live-evidence-depth-linkage";
import {
  graphSlotFromUelMeta,
  uelMetaWithGraphSlot,
  type EvidencePointerGraphSlot,
} from "./live-evidence-depth-write-contract";
import {
  getEligibleEvidenceDepthLinksForSource,
  type EvidenceDepthWriteHookLinkCandidate,
} from "./live-evidence-depth-write-hook";
import {
  createUnderstandingEvidenceLinkForUser,
  UnderstandingEvidenceLinkDuplicateError,
  type UnderstandingEvidenceLinkWriteInput,
  type UnderstandingEvidenceLinkWriterDb,
} from "./understanding-evidence-link-writer";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";

export const EVIDENCE_DEPTH_GRAPHSLOT_SUPPORTED_SOURCE_TYPES =
  new Set<UnderstandingLinkSourceType>(["pattern_claim", "contradiction_node"]);

export type EvidenceDepthGraphSlotLinkInput = {
  userId: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  summary?: string;
};

export type EvidenceDepthGraphSlotLinkBlocker =
  | "missing_graph_slot"
  | "invalid_graph_slot"
  | "unsupported_source_object_type"
  | "missing_source_object_id"
  | "missing_target_id"
  | "link_not_public_eligible";

export type EvidenceDepthGraphSlotLinkAssessment = {
  accepted: boolean;
  blockers: EvidenceDepthGraphSlotLinkBlocker[];
};

export type EvidenceDepthGraphSlotLinkWriterDb = UnderstandingEvidenceLinkWriterDb & {
  understandingEvidenceLink: UnderstandingEvidenceLinkWriterDb["understandingEvidenceLink"] & {
    findFirst: (args: unknown) => Promise<{
      id: string;
      meta: unknown;
    } | null>;
    update: (args: unknown) => Promise<{ id: string }>;
  };
};

export type EvidenceDepthGraphSlotLinkListDb = Pick<
  EvidenceDepthGraphSlotLinkWriterDb,
  "understandingEvidenceLink"
>;

export class EvidenceDepthGraphSlotLinkValidationError extends Error {
  constructor(
    message: string,
    public readonly blockers: EvidenceDepthGraphSlotLinkBlocker[],
  ) {
    super(message);
    this.name = "EvidenceDepthGraphSlotLinkValidationError";
  }
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isValidEvidenceDepthGraphSlot(
  value: unknown,
): value is EvidencePointerGraphSlot {
  return value === "related" || value === "context";
}

export function assessEvidenceDepthGraphSlotLinkInput(
  input: Pick<
    EvidenceDepthGraphSlotLinkInput,
    | "sourceObjectType"
    | "sourceObjectId"
    | "targetId"
    | "graphSlot"
  >,
): EvidenceDepthGraphSlotLinkAssessment {
  const blockers: EvidenceDepthGraphSlotLinkBlocker[] = [];

  if (!EVIDENCE_DEPTH_GRAPHSLOT_SUPPORTED_SOURCE_TYPES.has(input.sourceObjectType)) {
    blockers.push("unsupported_source_object_type");
  }
  if (!hasText(input.sourceObjectId)) {
    blockers.push("missing_source_object_id");
  }
  if (!hasText(input.targetId)) {
    blockers.push("missing_target_id");
  }
  if (input.graphSlot === undefined || input.graphSlot === null) {
    blockers.push("missing_graph_slot");
  } else if (!isValidEvidenceDepthGraphSlot(input.graphSlot)) {
    blockers.push("invalid_graph_slot");
  }

  return { accepted: blockers.length === 0, blockers };
}

export function buildEvidenceDepthGraphSlotLinkInput(
  input: EvidenceDepthGraphSlotLinkInput,
): UnderstandingEvidenceLinkWriteInput {
  const assessment = assessEvidenceDepthGraphSlotLinkInput(input);
  if (!assessment.accepted) {
    throw new EvidenceDepthGraphSlotLinkValidationError(
      `Cannot build evidence depth graphSlot link: ${assessment.blockers.join(",")}`,
      assessment.blockers,
    );
  }

  return {
    sourceType: input.sourceObjectType,
    sourceId: input.sourceObjectId,
    targetType: input.targetType,
    targetId: input.targetId,
    role: input.role,
    summary: input.summary,
    graphSlot: input.graphSlot,
    meta: uelMetaWithGraphSlot(input.graphSlot, {
      evidenceDepthGraphSlotMaterialization: true,
    }),
  };
}

function mergeGraphSlotIntoExistingMeta(
  existingMeta: unknown,
  graphSlot: EvidencePointerGraphSlot,
): Record<string, unknown> {
  const preserved =
    existingMeta && typeof existingMeta === "object"
      ? { ...(existingMeta as Record<string, unknown>) }
      : {};

  return uelMetaWithGraphSlot(graphSlot, {
    ...preserved,
    evidenceDepthGraphSlotMaterialization: true,
  });
}

export async function upsertEvidenceDepthGraphSlotLinkForUser(args: {
  input: EvidenceDepthGraphSlotLinkInput;
  db: EvidenceDepthGraphSlotLinkWriterDb;
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
}): Promise<{ id: string; created: boolean; skipped?: false } | { skipped: true }> {
  const assessment = assessEvidenceDepthGraphSlotLinkInput(args.input);
  if (!assessment.accepted) {
    throw new EvidenceDepthGraphSlotLinkValidationError(
      `Cannot upsert evidence depth graphSlot link: ${assessment.blockers.join(",")}`,
      assessment.blockers,
    );
  }

  const check =
    args.checkPublicTargetEligibility ?? isEvidenceLinkTargetPublicEligible;
  const publicEligible = await check({
    userId: args.input.userId,
    targetType: args.input.targetType,
    targetId: args.input.targetId,
  });
  if (!publicEligible) {
    return { skipped: true };
  }

  const linkInput = buildEvidenceDepthGraphSlotLinkInput(args.input);

  try {
    const created = await createUnderstandingEvidenceLinkForUser({
      userId: args.input.userId,
      input: linkInput,
      db: args.db,
    });
    return { id: created.id, created: true };
  } catch (error) {
    if (!(error instanceof UnderstandingEvidenceLinkDuplicateError)) {
      throw error;
    }
  }

  const existing = await args.db.understandingEvidenceLink.findFirst({
    where: {
      userId: args.input.userId,
      targetType: args.input.targetType,
      targetId: args.input.targetId,
      sourceType: args.input.sourceObjectType,
      sourceId: args.input.sourceObjectId,
      role: args.input.role,
    },
    select: { id: true, meta: true },
  });

  if (!existing) {
    throw new EvidenceDepthGraphSlotLinkValidationError(
      "Duplicate evidence link reported but existing row not found",
      ["missing_target_id"],
    );
  }

  const updated = await args.db.understandingEvidenceLink.update({
    where: { id: existing.id },
    data: {
      summary: args.input.summary ?? undefined,
      meta: mergeGraphSlotIntoExistingMeta(
        existing.meta,
        args.input.graphSlot,
      ) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return { id: updated.id, created: false };
}

export async function upsertEvidenceDepthGraphSlotLinksForSource(args: {
  userId: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  links: Array<
    Omit<EvidenceDepthGraphSlotLinkInput, "userId" | "sourceObjectType" | "sourceObjectId">
  >;
  db: EvidenceDepthGraphSlotLinkWriterDb;
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
}): Promise<{
  written: Array<{ id: string; created: boolean }>;
  skippedIneligible: number;
}> {
  const written: Array<{ id: string; created: boolean }> = [];
  let skippedIneligible = 0;

  for (const link of args.links) {
    const outcome = await upsertEvidenceDepthGraphSlotLinkForUser({
      input: {
        userId: args.userId,
        sourceObjectType: args.sourceObjectType,
        sourceObjectId: args.sourceObjectId,
        ...link,
      },
      db: args.db,
      checkPublicTargetEligibility: args.checkPublicTargetEligibility,
    });

    if ("skipped" in outcome && outcome.skipped) {
      skippedIneligible += 1;
      continue;
    }

    written.push({ id: outcome.id, created: outcome.created });
  }

  return { written, skippedIneligible };
}

export async function listUnderstandingEvidenceLinkRowsForSource(args: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  db: EvidenceDepthGraphSlotLinkListDb;
}): Promise<UnderstandingEvidenceLinkRow[]> {
  const rows = await args.db.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      sourceType: args.sourceObjectType,
      sourceId: args.sourceObjectId,
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
}

export async function resolveEvidenceDepthGraphSlotLinksForSource(args: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  db: EvidenceDepthGraphSlotLinkListDb;
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
}): Promise<{
  eligible: EvidenceDepthWriteHookLinkCandidate[];
  excludedMissingGraphSlot: number;
  excludedIneligible: number;
}> {
  const linkRows = await listUnderstandingEvidenceLinkRowsForSource(args);
  return getEligibleEvidenceDepthLinksForSource({
    userId: args.userId,
    sourceObjectType: args.sourceObjectType,
    sourceObjectId: args.sourceObjectId,
    linkRows,
    checkPublicTargetEligibility: args.checkPublicTargetEligibility,
  });
}

export function createFindEligibleLinksForEvidenceDepthHook(args: {
  db: EvidenceDepthGraphSlotLinkListDb;
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
}): (hookArgs: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
}) => Promise<EvidenceDepthWriteHookLinkCandidate[]> {
  return async (hookArgs) => {
    const resolution = await resolveEvidenceDepthGraphSlotLinksForSource({
      userId: hookArgs.userId,
      sourceObjectType: hookArgs.sourceObjectType,
      sourceObjectId: hookArgs.sourceObjectId,
      db: args.db,
      checkPublicTargetEligibility: args.checkPublicTargetEligibility,
    });
    return resolution.eligible;
  };
}

/** Explicitly documents that role alone must never imply graphSlot. */
export function graphSlotFromRoleOnly(
  role: UnderstandingLinkRole,
): EvidencePointerGraphSlot | null {
  void role;
  return graphSlotFromUelMeta({});
}
